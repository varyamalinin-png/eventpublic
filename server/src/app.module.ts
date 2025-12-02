import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { ChatsModule } from './chats/chats.module';
import { FoldersModule } from './folders/folders.module';
import { FriendsModule } from './friends/friends.module';
import { RedisModule } from './redis/redis.module';
import { MailerModule } from './mailer/mailer.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { StatisticsModule } from './statistics/statistics.module';
import { ModerationModule } from './moderation/moderation.module';
import { SearchModule } from './search/search.module';
import { WSModule } from './ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
      validationSchema,
    }),
    PrismaModule,
    RedisModule,
    WSModule, // Глобальный WebSocket модуль должен быть первым
    HealthModule,
    StorageModule,
    UsersModule,
    AuthModule,
    EventsModule,
    ChatsModule,
    FoldersModule,
    FriendsModule,
    MailerModule,
    NotificationsModule,
    ComplaintsModule,
    StatisticsModule,
    ModerationModule,
    SearchModule,
  ],
})
export class AppModule {}
