import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotWizardStep, UserSessionState } from 'src/common/types';
import { StateBackup, StateBackupDocument } from './schemas/state-backup.schema';
import { RedisService } from './redis.service';

@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);
  private readonly memoryState = new Map<string, UserSessionState>();

  constructor(
    private readonly redisService: RedisService,
    @InjectModel(StateBackup.name)
    private readonly stateBackupModel: Model<StateBackupDocument>,
  ) {}

  async getState(userId: bigint): Promise<UserSessionState> {
    try {
      const userKey = userId.toString();

      // 1. In-Memory Map tekshirish
      if (this.memoryState.has(userKey)) {
        return this.memoryState.get(userKey)!;
      }

      // 2. Redis keshdan tiklash
      const redisData = await this.redisService.get(`session:${userKey}`);
      if (redisData) {
        const parsed = JSON.parse(redisData) as UserSessionState;
        parsed.userId = BigInt(parsed.userId);
        this.memoryState.set(userKey, parsed);
        return parsed;
      }

      // 3. MongoDB backup dan tiklash
      const mongoBackup = await this.stateBackupModel.findOne({ userId: userKey });
      if (mongoBackup) {
        const restored: UserSessionState = {
          userId: BigInt(mongoBackup.userId),
          step: mongoBackup.step as BotWizardStep,
          draftPost: {
            ...mongoBackup.draftPost,
            selectedTargets: mongoBackup.selectedTargetIds,
          },
        };
        this.memoryState.set(userKey, restored);
        return restored;
      }

      // 4. Standart boshlang'ich holat
      const defaultState: UserSessionState = {
        userId,
        step: BotWizardStep.IDLE,
      };
      this.memoryState.set(userKey, defaultState);
      return defaultState;
    } catch (error) {
      this.logger.error(`getState (${userId}) da xatolik:`, error);
      return {
        userId,
        step: BotWizardStep.IDLE,
      };
    }
  }

  async setState(state: UserSessionState): Promise<void> {
    try {
      const userKey = state.userId.toString();

      // 1. In-Memory Map ga yozish
      this.memoryState.set(userKey, state);

      // 2. Redis keshga yozish (24 soat TTL)
      const serializableState = {
        ...state,
        userId: state.userId.toString(),
      };
      await this.redisService.set(`session:${userKey}`, JSON.stringify(serializableState), 86400);

      // 3. MongoDB zaxiraga sinxronlash
      await this.stateBackupModel.findOneAndUpdate(
        { userId: userKey },
        {
          userId: userKey,
          step: state.step,
          draftPost: state.draftPost || {},
          selectedTargetIds: state.draftPost?.selectedTargets || [],
          updatedAt: new Date(),
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(`setState (${state.userId}) da xatolik:`, error);
    }
  }

  async clearState(userId: bigint): Promise<void> {
    try {
      const userKey = userId.toString();
      this.memoryState.delete(userKey);
      await this.redisService.del(`session:${userKey}`);
      await this.stateBackupModel.deleteOne({ userId: userKey });
    } catch (error) {
      this.logger.error(`clearState (${userId}) da xatolik:`, error);
    }
  }
}
