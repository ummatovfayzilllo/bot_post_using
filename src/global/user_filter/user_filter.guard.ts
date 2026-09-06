import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { MessageGenerator } from 'src/common/utils/_message_generator';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class UserFilterGuard implements CanActivate {
  private readonly logger = new Logger(UserFilterGuard.name);

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const tgContext = TelegrafExecutionContext.create(context);
      const ctx = tgContext.getContext<Context>();

      if (!ctx || !ctx.from) {
        return true;
      }

      const userId = BigInt(ctx.from.id);
      const isAllowed = await this.usersService.isUserAllowed(userId);

      if (!isAllowed) {
        this.logger.warn(`Ruxsatsiz kirishga urinish: ${ctx.from.id} (@${ctx.from.username || 'noma\'lum'})`);
        ctx.reply(MessageGenerator.accessDeniedMessage(), { parse_mode: 'HTML' }).catch(() => {});
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('UserFilterGuard da xatolik:', error);
      return false;
    }
  }
}
