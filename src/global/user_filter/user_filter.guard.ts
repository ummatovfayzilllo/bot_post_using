import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { MessageGenerator } from 'src/common/utils/_message_generator';

@Injectable()
export class UserFilterGuard implements CanActivate {
  private readonly logger = new Logger(UserFilterGuard.name);
  private allowedIds: bigint[] = [];

  constructor(private readonly configService: ConfigService) {
    this.allowedIds = this.configService.get<bigint[]>('bot.allowedUserIds', []);
  }

  canActivate(context: ExecutionContext): boolean {
    try {
      const tgContext = TelegrafExecutionContext.create(context);
      const ctx = tgContext.getContext<Context>();

      if (!ctx || !ctx.from) {
        return true;
      }

      const userId = BigInt(ctx.from.id);

      // Agar ALLOWED_USER_IDS bo'sh bo'lmasa, tekshiramiz
      if (this.allowedIds.length > 0) {
        const isAllowed = this.allowedIds.some((allowedId) => allowedId === userId);

        if (!isAllowed) {
          this.logger.warn(`Ruxsatsiz kirishga urinish: ${ctx.from.id} (@${ctx.from.username || 'noma\'lum'})`);
          ctx.reply(MessageGenerator.accessDeniedMessage(), { parse_mode: 'HTML' }).catch(() => {});
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('UserFilterGuard da xatolik:', error);
      return false;
    }
  }
}
