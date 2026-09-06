import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { GroupsModule } from './modules/groups/groups.module';
import { PostsModule } from './modules/posts/posts.module';

@Module({
  imports: [
    CoreModule,
    AdminModule,
    ChannelsModule,
    GroupsModule,
    PostsModule,
  ],
})
export class AppModule {}
