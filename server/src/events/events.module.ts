import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventProfilesService } from './event-profiles.service';
import { EventProfilesController } from './event-profiles.controller';
import { EventFoldersService } from './event-folders.service';
import { EventFoldersController } from './event-folders.controller';
import { RecurringEventsService } from './recurring-events.service';
import { TagsService } from './tags.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [StorageModule, NotificationsModule, ChatsModule],
  controllers: [EventsController, EventProfilesController, EventFoldersController],
  providers: [EventsService, EventProfilesService, EventFoldersService, RecurringEventsService, TagsService],
  exports: [EventsService, EventProfilesService, EventFoldersService, RecurringEventsService, TagsService],
})
export class EventsModule {}
