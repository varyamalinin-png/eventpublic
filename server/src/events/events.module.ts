import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventProfilesService } from './event-profiles.service';
import { EventProfilesController } from './event-profiles.controller';
import { RecurringEventsService } from './recurring-events.service';
import { TagsService } from './tags.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [StorageModule, NotificationsModule, ChatsModule],
  controllers: [EventsController, EventProfilesController],
  providers: [EventsService, EventProfilesService, RecurringEventsService, TagsService],
  exports: [EventsService, EventProfilesService, RecurringEventsService, TagsService],
})
export class EventsModule {}
