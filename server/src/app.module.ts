import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
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
import { VkMiniAppsModule } from './vk-mini-apps/vk-mini-apps.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
      validationSchema,
    }),
    // 300 запросов в минуту на IP.
    //
    // Было 100, и этого не хватало на холодный старт: приложение при первом
    // открытии тянет профили по каждому событию отдельным запросом, и на
    // четырёх десятках событий лимит выбирался за секунды — пользователь
    // видел 429 и пустые экраны. Настоящее лечение — пакетная загрузка
    // профилей одним запросом, но до неё запас нужен уже сейчас.
    //
    // На перебор паролей это не влияет: у входа, регистрации и сброса пароля
    // свои, куда более жёсткие лимиты через @Throttle в auth.controller.ts
    // (5, 10 и 3 запроса в минуту), и они перекрывают глобальный.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    ScheduleModule.forRoot(),
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
    VkMiniAppsModule,
    TasksModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
