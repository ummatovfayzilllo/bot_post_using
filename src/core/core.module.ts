import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { StateService } from './state.service';
import { MessageQueueService } from './message_queue.service';
import { BotConnectorService } from './bot_connector.service';
import { AppLoggerService } from 'src/global/logger/logger.service';
import { UserFilterGuard } from 'src/global/user_filter/user_filter.guard';
import { PostFormatterService } from './post_formatter.service';
import { VoiceTranscriberService } from './voice_transcriber.service';
import { PostBackup, PostBackupSchema } from './schemas/post-backup.schema';
import { StateBackup, StateBackupSchema } from './schemas/state-backup.schema';
import configuration from 'src/common/config/configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: PostBackup.name, schema: PostBackupSchema },
      { name: StateBackup.name, schema: StateBackupSchema },
    ]),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        token: configService.get<string>('bot.token') || '',
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    RedisService,
    StateService,
    MessageQueueService,
    BotConnectorService,
    PostFormatterService,
    VoiceTranscriberService,
    AppLoggerService,
    UserFilterGuard,
  ],
  exports: [
    PrismaService,
    RedisService,
    StateService,
    MessageQueueService,
    BotConnectorService,
    PostFormatterService,
    VoiceTranscriberService,
    AppLoggerService,
    UserFilterGuard,
    MongooseModule,
  ],
})
export class CoreModule {}
