import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StateBackupDocument = StateBackup & Document;

@Schema({ timestamps: true, collection: 'state_backups' })
export class StateBackup {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true })
  step: string;

  @Prop({ type: Object, default: {} })
  draftPost: Record<string, any>;

  @Prop({ type: [String], default: [] })
  selectedTargetIds: string[];

  @Prop({ type: Date, default: Date.now, expires: 86400 * 3 }) // 3 kun saqlanadi
  updatedAt: Date;
}

export const StateBackupSchema = SchemaFactory.createForClass(StateBackup);
