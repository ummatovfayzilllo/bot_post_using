import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');
      const isTls = this.configService.get<boolean>('redis.tls', false);

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        tls: isTls ? {} : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts
          }
          return Math.min(times * 500, 2000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis serveriga muvaffaqiyatli ulandi.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis bilan aloqada ogohlantirish: ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`Redisga dastlabki ulanish amalga oshmadi: ${err.message}`);
      });
    } catch (error) {
      this.logger.error('RedisService ishga tushishida xatolik:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this.isConnected || !this.client) {
        return null;
      }
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis get (${key}) xatoligi:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis set (${key}) xatoligi:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis del (${key}) xatoligi:`, error);
      return false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async onModuleDestroy() {
    try {
      if (this.client) {
        await this.client.quit();
        this.logger.log('Redis ulanishi yopildi.');
      }
    } catch (error) {
      this.logger.error('Redis ulanishini yopishda xatolik:', error);
    }
  }
}
