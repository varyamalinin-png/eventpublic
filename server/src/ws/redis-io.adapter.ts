import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private app: INestApplication, private readonly redisService: RedisService) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      cors: {
        origin: '*',
        credentials: true,
      },
      ...options,
    });

    const pubClient = this.redisService.getPubClient();
    const subClient = this.redisService.getSubClient();

    this.adapterConstructor = createAdapter(pubClient, subClient);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
