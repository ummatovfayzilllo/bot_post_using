import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

export interface BotMetadata {
  id: number;
  name: string;
  username: string;
}

@Injectable()
export class BotConnectorService implements OnModuleInit {
  private readonly logger = new Logger(BotConnectorService.name);
  private static botMetadata: BotMetadata = {
    id: 0,
    name: 'Post Bot',
    username: 'bot',
  };

  constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

  async onModuleInit() {
    try {
      const me = await this.bot.telegram.getMe();
      if (me) {
        BotConnectorService.botMetadata = {
          id: me.id,
          name: me.first_name || 'Post Bot',
          username: me.username || '',
        };
        this.logger.log(`🤖 Bot ma'lumotlari yuklandi: ${me.first_name} (@${me.username}) [ID: ${me.id}]`);
      }
    } catch (error) {
      this.logger.error('Bot ma\'lumotlarini boshlang\'ich yuklashda xatolik:', error);
    }
  }

  static getMetadata(): BotMetadata {
    return this.botMetadata;
  }

  static getBotName(): string {
    return this.botMetadata.name;
  }

  static getBotUsername(): string {
    return this.botMetadata.username ? `@${this.botMetadata.username}` : '';
  }

  static getRawUsername(): string {
    return this.botMetadata.username;
  }

  getBot(): Telegraf<Context> {
    return this.bot;
  }

  getTelegram() {
    return this.bot.telegram;
  }

  async getBotInfo() {
    try {
      const me = await this.bot.telegram.getMe();
      if (me) {
        BotConnectorService.botMetadata = {
          id: me.id,
          name: me.first_name || 'Post Bot',
          username: me.username || '',
        };
      }
      return me;
    } catch (error) {
      this.logger.error('Bot ma\'lumotlarini olishda xatolik:', error);
      return BotConnectorService.botMetadata.id ? (BotConnectorService.botMetadata as any) : null;
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

  async editMessageText(chatId: string | number | bigint, messageId: number, text: string, extra?: any) {
    try {
      return await this.bot.telegram.editMessageText(chatId.toString(), messageId, undefined, text, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`editMessageText (${chatId}/${messageId}) da xatolik:`, error);
      throw error;
    }
  }

  async editMessageCaption(chatId: string | number | bigint, messageId: number, caption: string, extra?: any) {
    try {
      return await this.bot.telegram.editMessageCaption(chatId.toString(), messageId, undefined, caption, {
        parse_mode: 'HTML',
        ...extra,
      });
    } catch (error) {
      this.logger.error(`editMessageCaption (${chatId}/${messageId}) da xatolik:`, error);
      throw error;
    }
  }
}
