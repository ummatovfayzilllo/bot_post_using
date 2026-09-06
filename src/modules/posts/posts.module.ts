import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsService } from './posts.service';
import { PostBackup, PostBackupSchema } from 'src/core/schemas/post-backup.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostBackup.name, schema: PostBackupSchema },
    ]),
  ],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
