import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@Injectable()
export class BotConnectorService {
  private readonly logger = new Logger(BotConnectorService.name);

  constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

  getBot(): Telegraf<Context> {
    return this.bot;
  }

  getTelegram() {
    return this.bot.telegram;
  }

  async getBotInfo() {
    try {
      return await this.bot.telegram.getMe();
    } catch (error) {
      this.logger.error('Bot ma\'lumotlarini olishda xatolik:', error);
      return null;
    }
  }

  async sendTextMessage(chatId: string | number | bigint, text: string, extra?: any) {
    try {
      return await this.bot.telegram.sendMessage(chatId.toString(), text, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`sendTextMessage (${chatId}) da xatolik:`, error);
      throw error;
    }
  }

  async sendPhoto(chatId: string | number | bigint, photoFileId: string, caption?: string, extra?: any) {
    try {
      return await this.bot.telegram.sendPhoto(chatId.toString(), photoFileId, {
        caption,
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`sendPhoto (${chatId}) da xatolik:`, error);
      throw error;
    }
  }

  async sendVideo(chatId: string | number | bigint, videoFileId: string, caption?: string, extra?: any) {
    try {
      return await this.bot.telegram.sendVideo(chatId.toString(), videoFileId, {
        caption,
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`sendVideo (${chatId}) da xatolik:`, error);
      throw error;
    }
  }

  async sendDocument(chatId: string | number | bigint, documentFileId: string, caption?: string, extra?: any) {
    try {
      return await this.bot.telegram.sendDocument(chatId.toString(), documentFileId, {
        caption,
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`sendDocument (${chatId}) da xatolik:`, error);
      throw error;
    }
  }
}
