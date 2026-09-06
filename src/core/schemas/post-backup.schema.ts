import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostBackupDocument = PostBackup & Document;

@Schema({ timestamps: true, collection: 'post_backups' })
export class PostBackup {
  @Prop({ required: true, index: true })
  postId: string;

  @Prop()
  text?: string;

  @Prop()
  mediaType?: string;

  @Prop()
  mediaFileId?: string;

  @Prop({ type: [String], default: [] })
  targetIds: string[];

  @Prop({ required: true })
  status: string;

  @Prop({ required: true, index: true })
  createdBy: string;

  @Prop({ type: Object })
  rawTelegramPayload?: Record<string, any>;

  @Prop({ type: [Object], default: [] })
  executionLogs: Array<{
    timestamp: Date;
    targetId: string;
    status: string;
    error?: string;
    messageId?: number;
  }>;
}

export const PostBackupSchema = SchemaFactory.createForClass(PostBackup);
