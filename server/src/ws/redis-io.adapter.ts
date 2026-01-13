import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    private readonly app: INestApplicationContext,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      cors: {
        origin: '*',
        credentials: true,
      },
      ...options,
    });

    try {
      const pubClient = this.redisService.getPubClient();
      const subClient = this.redisService.getSubClient();

      // Проверяем, что клиенты Redis готовы перед созданием адаптера
      if (pubClient && subClient && pubClient.status === 'ready' && subClient.status === 'ready') {
        this.adapterConstructor = createAdapter(pubClient, subClient);
        server.adapter(this.adapterConstructor);
        console.log('[RedisIoAdapter] Redis adapter initialized successfully');
      } else {
        console.warn('[RedisIoAdapter] Redis clients not ready, using default adapter');
      }
    } catch (error) {
      console.error('[RedisIoAdapter] Failed to initialize Redis adapter, using default:', error);
      // Продолжаем работу без Redis адаптера
    }

    return server;
  }
}
