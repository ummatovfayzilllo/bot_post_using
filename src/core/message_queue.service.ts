import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from './prisma.service';
import { PostBackup, PostBackupDocument } from './schemas/post-backup.schema';
import { PostJobData } from 'src/common/types';

@Injectable()
export class MessageQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private isRedisReady = false;

  // Telegram bot sender callback
  private postSenderHandler: ((postId: string) => Promise<void>) | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectModel(PostBackup.name)
    private readonly postBackupModel: Model<PostBackupDocument>,
  ) {}

  async onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');
      const isTls = this.configService.get<boolean>('redis.tls', false);

      const connection: any = {
        host,
        port,
        password: password || undefined,
        tls: isTls ? {} : undefined,
        maxRetriesPerRequest: null,
      };

      this.queue = new Queue('post_schedule_queue', { connection });
      this.isRedisReady = true;
      this.logger.log('BullMQ post_schedule_queue muvaffaqiyatli ishga tushdi.');

      // Worker sozlash
      this.worker = new Worker(
        'post_schedule_queue',
        async (job: Job<PostJobData>) => {
          const { postId } = job.data;
          this.logger.log(`Rejalashtirilgan post (${postId}) yuborilmoqda...`);
          if (this.postSenderHandler) {
            await this.postSenderHandler(postId);
          }
        },
        { connection },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(`Job muvaffaqiyatli yakunlandi: ${job.id}`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job xatolik bilan tugadi (${job?.id}): ${err.message}`);
      });

      // Cold start / Failover rehydration
      await this.rehydratePendingJobs();
    } catch (error) {
      this.isRedisReady = false;
      this.logger.warn(`MessageQueueService BullMQ ulanishida ogohlantirish: ${error.message}`);
    }
  }

  setPostSenderHandler(handler: (postId: string) => Promise<void>) {
    this.postSenderHandler = handler;
  }

  async schedulePost(postId: string, date: Date, createdBy: string): Promise<boolean> {
    try {
      const now = Date.now();
      const targetTime = new Date(date).getTime();
      const delay = Math.max(0, targetTime - now);

      if (this.queue && this.isRedisReady) {
        await this.queue.add(
          'send_post',
          { postId, createdBy },
          {
            jobId: `post_${postId}`,
            delay,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log(`Post (${postId}) ${delay} ms kechikish bilan navbatga qo'yildi.`);
      }

      // MongoDB backup zaxirasini yangilash
      await this.postBackupModel.updateOne(
        { postId },
        {
          $set: {
            status: 'SCHEDULED',
            'rawTelegramPayload.scheduledAt': date,
          },
        },
        { upsert: true },
      );

      return true;
    } catch (error) {
      this.logger.error(`schedulePost (${postId}) da xatolik:`, error);
      return false;
    }
  }

  async cancelScheduledPost(postId: string): Promise<boolean> {
    try {
      if (this.queue && this.isRedisReady) {
        const job = await this.queue.getJob(`post_${postId}`);
        if (job) {
          await job.remove();
          this.logger.log(`Post (${postId}) navbatdan o'chirildi.`);
        }
      }

      await this.postBackupModel.updateOne(
        { postId },
        { $set: { status: 'CANCELLED' } },
      );

      return true;
    } catch (error) {
      this.logger.error(`cancelScheduledPost (${postId}) da xatolik:`, error);
      return false;
    }
  }

  async rehydratePendingJobs(): Promise<void> {
    try {
      // PostgreSQL'dan kutilayotgan (SCHEDULED) postlarni olish
      const pendingPosts = await this.prisma.post.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { not: null },
        },
      });

      if (!pendingPosts || pendingPosts.length === 0) {
        return;
      }

      this.logger.log(`${pendingPosts.length} ta kutilayotgan postlar navbatga qayta tiklanmoqda...`);

      for (const post of pendingPosts) {
        if (post.scheduledAt) {
          const now = Date.now();
          const targetTime = new Date(post.scheduledAt).getTime();
          const delay = Math.max(0, targetTime - now);

          if (this.queue && this.isRedisReady) {
            await this.queue.add(
              'send_post',
              { postId: post.id, createdBy: post.createdBy.toString() },
              {
                jobId: `post_${post.id}`,
                delay,
                removeOnComplete: true,
              },
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('rehydratePendingJobs da xatolik:', error);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.worker) {
        await this.worker.close();
      }
      if (this.queue) {
        await this.queue.close();
      }
      this.logger.log('MessageQueueService to\'xtatildi.');
    } catch (error) {
      this.logger.error('MessageQueueService to\'xtashida xatolik:', error);
    }
  }
}
