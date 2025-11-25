import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { WebSocketService } from './websocket.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtAccessSecret'),
      }),
    }),
  ],
  providers: [RealtimeGateway, WebSocketService],
  exports: [WebSocketService, RealtimeGateway],
})
export class WSModule {}

