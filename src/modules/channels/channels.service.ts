import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma.service';
import { BotConnectorService } from 'src/core/bot_connector.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botConnector: BotConnectorService,
  ) {}

  async listChannels() {
    try {
      return await this.prisma.channel.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('listChannels da xatolik:', error);
      return [];
    }
  }

  async addChannel(chatInput: string) {
    try {
      const telegram = this.botConnector.getTelegram();
      const botInfo = await this.botConnector.getBotInfo();

      if (!botInfo) {
        return { success: false, message: 'Bot ma\'lumotlarini olib bo\'lmadi.' };
      }

      // 1. Tozalash (@ yoki URL bo'lsa)
      let cleanInput = chatInput.trim();
      if (cleanInput.includes('t.me/')) {
        const parts = cleanInput.split('t.me/');
        cleanInput = '@' + parts[1].replace('/', '');
      }

      // 2. Chat ma'lumotini olish
      let chat: any;
      try {
        chat = await telegram.getChat(cleanInput);
      } catch (err) {
        return {
          success: false,
          message: `Kanal topilmadi yoki bot kanalga a'zo emas (${err.message})`,
        };
      }

      if (chat.type !== 'channel') {
        return {
          success: false,
          message: `Bu chat kanal emas (turi: ${chat.type}). Guruhlar uchun /groups bo'limidan foydalaning.`,
        };
      }

      // 3. Admin huquqini tekshirish (Health Check)
      let chatMember: any;
      try {
        chatMember = await telegram.getChatMember(chat.id, botInfo.id);
      } catch (err) {
        return {
          success: false,
          message: `Botning kanaldagi huquqlarini tekshirib bo'lmadi (${err.message})`,
        };
      }

      const isAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator';
      const canPost = Boolean(chatMember.can_post_messages || chatMember.status === 'creator');

      if (!isAdmin) {
        return {
          success: false,
          message: `Bot "${chat.title}" kanalida administrator emas. Iltimos, avval botni administrator qiling.`,
        };
      }

      // 4. Bazaga saqlash yoki yangilash
      const channel = await this.prisma.channel.upsert({
        where: { chatId: BigInt(chat.id) },
        update: {
          title: chat.title || 'Nomsiz kanal',
          username: chat.username || null,
          hasAdmin: isAdmin,
          canPost: canPost,
          updatedAt: new Date(),
        },
        create: {
          chatId: BigInt(chat.id),
          title: chat.title || 'Nomsiz kanal',
          username: chat.username || null,
          type: 'CHANNEL',
          hasAdmin: isAdmin,
          canPost: canPost,
        },
      });

      return {
        success: true,
        channel,
        title: chat.title,
        username: chat.username,
      };
    } catch (error) {
      this.logger.error(`addChannel (${chatInput}) da xatolik:`, error);
      return { success: false, message: `Kanal qo'shishda kutilmagan xatolik: ${error.message}` };
    }
  }

  async deleteChannel(id: string) {
    try {
      await this.prisma.channel.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      this.logger.error(`deleteChannel (${id}) da xatolik:`, error);
      return { success: false, message: error.message };
    }
  }

  async getChannelById(id: string) {
    try {
      return await this.prisma.channel.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`getChannelById (${id}) da xatolik:`, error);
      return null;
    }
  }
}
