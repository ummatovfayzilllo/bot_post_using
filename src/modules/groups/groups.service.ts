import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma.service';
import { BotConnectorService } from 'src/core/bot_connector.service';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botConnector: BotConnectorService,
  ) {}

  async listGroups() {
    try {
      return await this.prisma.group.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('listGroups da xatolik:', error);
      return [];
    }
  }

  async addGroup(chatInput: string) {
    try {
      const telegram = this.botConnector.getTelegram();
      const botInfo = await this.botConnector.getBotInfo();

      if (!botInfo) {
        return { success: false, message: 'Bot ma\'lumotlarini olib bo\'lmadi.' };
      }

      let cleanInput = chatInput.trim();
      if (cleanInput.includes('t.me/')) {
        const parts = cleanInput.split('t.me/');
        cleanInput = '@' + parts[1].replace('/', '');
      }

      let chat: any;
      try {
        chat = await telegram.getChat(cleanInput);
      } catch (err) {
        return {
          success: false,
          message: `Guruh topilmadi yoki bot guruhga a'zo emas (${err.message})`,
        };
      }

      if (chat.type !== 'group' && chat.type !== 'supergroup') {
        return {
          success: false,
          message: `Bu chat guruh emas (turi: ${chat.type}). Kanallar uchun /channels bo'limidan foydalaning.`,
        };
      }

      let chatMember: any;
      try {
        chatMember = await telegram.getChatMember(chat.id, botInfo.id);
      } catch (err) {
        return {
          success: false,
          message: `Botning guruhdagi huquqlarini tekshirib bo'lmadi (${err.message})`,
        };
      }

      // 1. Bot guruhdan chiqarilgan yoki a'zo emasligini tekshirish
      if (chatMember.status === 'left' || chatMember.status === 'kicked') {
        return {
          success: false,
          message: `⚠️ Bot "${chat.title}" guruhiga a'zo emas (yoki chiqarib yuborilgan).\nIltimos, avval botni (@${botInfo.username}) guruhga qo'shing va qayta urinib ko'ring!`,
        };
      }

      // 2. Xabar yozish huquqini tekshirish
      const isRestricted = chatMember.status === 'restricted';
      const canSendMessages = isRestricted ? chatMember.can_send_messages !== false : true;

      if (isRestricted && !canSendMessages) {
        return {
          success: false,
          message: `⚠️ Bot "${chat.title}" guruhida a'zo, lekin unga xabar yuborish (Send Messages) taqiqlangan!`,
        };
      }

      const isAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator';
      const canPost = canSendMessages;

      const group = await this.prisma.group.upsert({
        where: { chatId: BigInt(chat.id) },
        update: {
          title: chat.title || 'Nomsiz guruh',
          username: chat.username || null,
          hasAdmin: isAdmin,
          canPost: canPost,
          updatedAt: new Date(),
        },
        create: {
          chatId: BigInt(chat.id),
          title: chat.title || 'Nomsiz guruh',
          username: chat.username || null,
          type: 'GROUP',
          hasAdmin: isAdmin,
          canPost: canPost,
        },
      });

      return {
        success: true,
        group,
        title: chat.title,
        username: chat.username,
      };
    } catch (error) {
      this.logger.error(`addGroup (${chatInput}) da xatolik:`, error);
      return { success: false, message: `Guruh qo'shishda xatolik: ${error.message}` };
    }
  }

  async deleteGroup(id: string) {
    try {
      await this.prisma.group.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      this.logger.error(`deleteGroup (${id}) da xatolik:`, error);
      return { success: false, message: error.message };
    }
  }

  async getGroupById(id: string) {
    try {
      return await this.prisma.group.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`getGroupById (${id}) da xatolik:`, error);
      return null;
    }
  }
}
