import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma.service';
import { RedisService } from 'src/core/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private envAllowedIds: bigint[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.envAllowedIds = this.configService.get<bigint[]>('bot.allowedUserIds', []);
  }

  async isUserAllowed(telegramId: bigint): Promise<boolean> {
    try {
      // 1. .env dagi boshlang'ich adminlar
      if (this.envAllowedIds.some((id) => id === telegramId)) {
        return true;
      }

      // 2. Redis keshdan tekshirish
      const cached = await this.redis.get(`allowed_user:${telegramId}`);
      if (cached !== null) {
        return cached === '1';
      }

      // 3. PostgreSQL bazasidan tekshirish
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      const allowed = !!user && user.isAllowed;
      await this.redis.set(`allowed_user:${telegramId}`, allowed ? '1' : '0', 3600); // 1 soat kesh
      return allowed;
    } catch (error) {
      this.logger.error(`isUserAllowed (${telegramId}) da xatolik:`, error);
      return false;
    }
  }

  async addAllowedUser(params: {
    telegramId: string | number | bigint;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    try {
      const id = BigInt(params.telegramId);

      const user = await this.prisma.user.upsert({
        where: { telegramId: id },
        update: {
          isAllowed: true,
          firstName: params.firstName,
          lastName: params.lastName,
          username: params.username,
        },
        create: {
          telegramId: id,
          isAllowed: true,
          firstName: params.firstName,
          lastName: params.lastName,
          username: params.username,
        },
      });

      // Keshni yangilash
      await this.redis.set(`allowed_user:${id}`, '1', 3600);

      return {
        success: true,
        message: 'Foydalanuvchiga muvaffaqiyatli ruxsat berildi',
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          firstName: user.firstName,
          username: user.username,
          isAllowed: user.isAllowed,
        },
      };
    } catch (error) {
      this.logger.error('addAllowedUser da xatolik:', error);
      return { success: false, message: error.message };
    }
  }

  async removeAllowedUser(telegramId: string | number | bigint) {
    try {
      const id = BigInt(telegramId);

      const user = await this.prisma.user.update({
        where: { telegramId: id },
        data: { isAllowed: false },
      });

      // Keshni yangilash
      await this.redis.set(`allowed_user:${id}`, '0', 3600);

      return {
        success: true,
        message: 'Foydalanuvchi ruxsati bekor qilindi',
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          isAllowed: user.isAllowed,
        },
      };
    } catch (error) {
      this.logger.error('removeAllowedUser da xatolik:', error);
      return { success: false, message: error.message };
    }
  }

  async listAllowedUsers() {
    try {
      const dbUsers = await this.prisma.user.findMany({
        where: { isAllowed: true },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = dbUsers.map((u) => ({
        id: u.id,
        telegramId: u.telegramId.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        isAllowed: u.isAllowed,
        createdAt: u.createdAt,
      }));

      // .env dagi ID lar bazada bo'lmasa ularni ham qo'shamiz
      const envList = this.envAllowedIds.map((id) => ({
        id: 'ENV',
        telegramId: id.toString(),
        firstName: 'System Admin (ENV)',
        isAllowed: true,
      }));

      return {
        success: true,
        total: formatted.length + envList.length,
        users: [...envList, ...formatted],
      };
    } catch (error) {
      this.logger.error('listAllowedUsers da xatolik:', error);
      return { success: false, message: error.message, users: [] };
    }
  }
}
