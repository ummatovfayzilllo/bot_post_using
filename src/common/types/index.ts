export enum BotWizardStep {
  IDLE = 'IDLE',
  WAITING_FOR_CONTENT = 'WAITING_FOR_CONTENT',
  SELECTING_TARGETS = 'SELECTING_TARGETS',
  CHOOSING_SCHEDULE_TYPE = 'CHOOSING_SCHEDULE_TYPE',
  WAITING_FOR_DATE = 'WAITING_FOR_DATE',
  CONFIRMING = 'CONFIRMING',
  ADDING_CHANNEL = 'ADDING_CHANNEL',
  ADDING_GROUP = 'ADDING_GROUP',
}

export interface UserSessionState {
  userId: bigint;
  step: BotWizardStep;
  draftPost?: {
    text?: string;
    mediaType?: 'photo' | 'video' | 'document';
    mediaFileId?: string;
    scheduledAt?: Date;
    selectedTargets?: string[]; // channel / group IDs
  };
  editingPostId?: string;
  tempData?: Record<string, any>;
}

export interface TargetItem {
  id: string;
  chatId: bigint;
  title: string;
  username?: string | null;
  type: 'CHANNEL' | 'GROUP';
  hasAdmin: boolean;
  canPost: boolean;
}

export interface PostJobData {
  postId: string;
  createdBy: string;
}
