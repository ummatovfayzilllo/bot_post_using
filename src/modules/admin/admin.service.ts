import { Injectable, Logger } from '@nestjs/common';
import { StateService } from 'src/core/state.service';
import { ChannelsService } from 'src/modules/channels/channels.service';
import { GroupsService } from 'src/modules/groups/groups.service';
import { PostsService } from 'src/modules/posts/posts.service';
import { PrismaService } from 'src/core/prisma.service';
import { BotWizardStep, TargetItem } from 'src/common/types';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly stateService: StateService,
    private readonly channelsService: ChannelsService,
    private readonly groupsService: GroupsService,
    private readonly postsService: PostsService,
    private readonly prisma: PrismaService,
  ) {}

  async getAllTargets(): Promise<TargetItem[]> {
    try {
      const channels = await this.channelsService.listChannels();
      const groups = await this.groupsService.listGroups();

      const items: TargetItem[] = [];

      for (const ch of channels) {
        items.push({
          id: ch.id,
          chatId: ch.chatId,
          title: ch.title,
          username: ch.username,
          type: 'CHANNEL',
          hasAdmin: ch.hasAdmin,
          canPost: ch.canPost,
        });
      }

      for (const gr of groups) {
        items.push({
          id: gr.id,
          chatId: gr.chatId,
          title: gr.title,
          username: gr.username,
          type: 'GROUP',
          hasAdmin: gr.hasAdmin,
          canPost: gr.canPost,
        });
      }

      return items;
    } catch (error) {
      this.logger.error('getAllTargets da xatolik:', error);
      return [];
    }
  }

  async ensureUserExists(telegramId: bigint, firstName?: string, lastName?: string, username?: string) {
    try {
      return await this.prisma.user.upsert({
        where: { telegramId },
        update: {
          firstName: firstName || null,
          lastName: lastName || null,
          username: username || null,
          isAllowed: true,
          updatedAt: new Date(),
        },
        create: {
          telegramId,
          firstName: firstName || null,
          lastName: lastName || null,
          username: username || null,
          isAllowed: true,
        },
      });
    } catch (error) {
      this.logger.error(`ensureUserExists (${telegramId}) da xatolik:`, error);
      return null;
    }
  }
}
