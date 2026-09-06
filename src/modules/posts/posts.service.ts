import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from 'src/core/prisma.service';
import { BotConnectorService } from 'src/core/bot_connector.service';
import { MessageQueueService } from 'src/core/message_queue.service';
import { PostBackup, PostBackupDocument } from 'src/core/schemas/post-backup.schema';

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botConnector: BotConnectorService,
    private readonly messageQueue: MessageQueueService,
    @InjectModel(PostBackup.name)
    private readonly postBackupModel: Model<PostBackupDocument>,
  ) {}

  onModuleInit() {
    // MessageQueue BullMQ workeriga yuborish handlerini ulaymiz
    this.messageQueue.setPostSenderHandler(async (postId: string) => {
      await this.sendPostNow(postId);
    });
  }

  async createPost(params: {
    userId: bigint;
    text?: string;
    mediaType?: string;
    mediaFileId?: string;
    targetIds: string[];
    scheduledAt?: Date | null;
  }) {
    try {
      const { userId, text, mediaType, mediaFileId, targetIds, scheduledAt } = params;

      // 1. User bazada bormi tekshiramiz/upsert qilamiz
      await this.prisma.user.upsert({
        where: { telegramId: userId },
        update: {},
        create: {
          telegramId: userId,
          isAllowed: true,
        },
      });

      const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now();
      const initialStatus = isScheduled ? 'SCHEDULED' : 'SENT';

      // 2. PostgreSQL da Post yaratish
      const post = await this.prisma.post.create({
        data: {
          text: text || null,
          mediaType: mediaType || null,
          mediaFileId: mediaFileId || null,
          scheduledAt: scheduledAt || null,
          status: isScheduled ? 'SCHEDULED' : 'DRAFT',
          createdBy: userId,
        },
      });

      // 3. Targets (kanallar va guruhlar)ni biriktirish
      const channels = await this.prisma.channel.findMany({
        where: { id: { in: targetIds } },
      });
      const groups = await this.prisma.group.findMany({
        where: { id: { in: targetIds } },
      });

      for (const ch of channels) {
        await this.prisma.postTarget.create({
          data: {
            postId: post.id,
            targetType: 'CHANNEL',
            channelId: ch.id,
            status: isScheduled ? 'SCHEDULED' : 'DRAFT',
          },
        });
      }

      for (const gr of groups) {
        await this.prisma.postTarget.create({
          data: {
            postId: post.id,
            targetType: 'GROUP',
            groupId: gr.id,
            status: isScheduled ? 'SCHEDULED' : 'DRAFT',
          },
        });
      }

      // 4. MongoDB ga PostBackup yaratish
      await this.postBackupModel.create({
        postId: post.id,
        text,
        mediaType,
        mediaFileId,
        targetIds,
        status: isScheduled ? 'SCHEDULED' : 'PENDING',
        createdBy: userId.toString(),
        rawTelegramPayload: {
          scheduledAt,
          targetCount: targetIds.length,
        },
        executionLogs: [],
      });

      // 5. Agar scheduled bo'lsa navbatga qo'yamiz, aks holda darhol yuboramiz
      if (isScheduled && scheduledAt) {
        await this.messageQueue.schedulePost(post.id, scheduledAt, userId.toString());
      } else {
        await this.sendPostNow(post.id);
      }

      return { success: true, post };
    } catch (error) {
      this.logger.error('createPost da xatolik:', error);
      return { success: false, message: error.message };
    }
  }

  async sendPostNow(postId: string) {
    try {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        include: {
          targets: {
            include: {
              channel: true,
              group: true,
            },
          },
        },
      });

      if (!post) {
        this.logger.error(`sendPostNow: Post (${postId}) topilmadi.`);
        return { success: false, message: 'Post topilmadi' };
      }

      const executionLogs: any[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const target of post.targets) {
        let chatId: bigint | null = null;
        let targetName = '';

        if (target.channel) {
          chatId = target.channel.chatId;
          targetName = target.channel.title;
        } else if (target.group) {
          chatId = target.group.chatId;
          targetName = target.group.title;
        }

        if (!chatId) {
          continue;
        }

        try {
          let sentMsg: any = null;

          if (post.mediaFileId && post.mediaType) {
            if (post.mediaType === 'photo') {
              sentMsg = await this.botConnector.sendPhoto(chatId, post.mediaFileId, post.text || undefined);
            } else if (post.mediaType === 'video') {
              sentMsg = await this.botConnector.sendVideo(chatId, post.mediaFileId, post.text || undefined);
            } else if (post.mediaType === 'document') {
              sentMsg = await this.botConnector.sendDocument(chatId, post.mediaFileId, post.text || undefined);
            }
          } else if (post.text) {
            sentMsg = await this.botConnector.sendTextMessage(chatId, post.text);
          }

          if (sentMsg) {
            await this.prisma.postTarget.update({
              where: { id: target.id },
              data: {
                status: 'SENT',
                messageId: sentMsg.message_id,
                sentAt: new Date(),
              },
            });
            successCount++;
            executionLogs.push({
              timestamp: new Date(),
              targetId: target.id,
              status: 'SENT',
              messageId: sentMsg.message_id,
            });
          }
        } catch (err) {
          failCount++;
          this.logger.error(`Post (${postId}) ni chatga (${targetName} / ${chatId}) yuborishda xatolik:`, err);

          await this.prisma.postTarget.update({
            where: { id: target.id },
            data: {
              status: 'FAILED',
              errorMessage: err.message,
            },
          });

          executionLogs.push({
            timestamp: new Date(),
            targetId: target.id,
            status: 'FAILED',
            error: err.message,
          });
        }
      }

      const overallStatus = successCount > 0 ? 'SENT' : 'FAILED';

      // PostgreSQL Post statusini yangilash
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: overallStatus,
          sentAt: new Date(),
        },
      });

      // MongoDB Backup statusini yangilash
      await this.postBackupModel.updateOne(
        { postId },
        {
          $set: { status: overallStatus },
          $push: { executionLogs: { $each: executionLogs } },
        },
      );

      return { success: true, successCount, failCount };
    } catch (error) {
      this.logger.error(`sendPostNow (${postId}) da xatolik:`, error);
      return { success: false, message: error.message };
    }
  }

  async listPosts(category: 'SCHEDULED' | 'SENT') {
    try {
      return await this.prisma.post.findMany({
        where: {
          status: category,
        },
        include: {
          targets: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } catch (error) {
      this.logger.error(`listPosts (${category}) da xatolik:`, error);
      return [];
    }
  }

  async getPostDetail(postId: string) {
    try {
      return await this.prisma.post.findUnique({
        where: { id: postId },
        include: {
          targets: {
            include: {
              channel: true,
              group: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`getPostDetail (${postId}) da xatolik:`, error);
      return null;
    }
  }

  async deletePost(postId: string) {
    try {
      // Navbatdan o'chiramiz
      await this.messageQueue.cancelScheduledPost(postId);

      // PostgreSQL dan o'chirish
      await this.prisma.post.delete({
        where: { id: postId },
      });

      // MongoDB dan arxiv/status yangilash
      await this.postBackupModel.updateOne(
        { postId },
        { $set: { status: 'DELETED' } },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`deletePost (${postId}) da xatolik:`, error);
      return { success: false, message: error.message };
    }
  }
}
