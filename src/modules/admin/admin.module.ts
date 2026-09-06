import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminUpdate } from './admin.update';
import { ChannelsModule } from '../channels/channels.module';
import { GroupsModule } from '../groups/groups.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [ChannelsModule, GroupsModule, PostsModule],
  providers: [AdminService, AdminUpdate],
  exports: [AdminService],
})
export class AdminModule {}
