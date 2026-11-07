import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ApnsService } from './apns.service';
import { FcmService } from './fcm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ApnsService, FcmService],
  exports: [NotificationsService, ApnsService, FcmService],
})
export class NotificationsModule {}

