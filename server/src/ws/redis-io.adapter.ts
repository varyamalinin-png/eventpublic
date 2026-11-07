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
    /**
     * app передаём в базовый адаптер ОБЯЗАТЕЛЬНО.
     *
     * Без него у IoAdapter нет HTTP-сервера, и createIOServer(0) делает
     * `new Server(0)` — отдельный socket.io на СЛУЧАЙНОМ порту. Так и было на
     * проде: Nest слушал 4000, а сокеты — какой-нибудь 38027, до которого не
     * доходит ни nginx, ни клиент. /socket.io/ на 4000 отвечал 404, realtime не
     * работал вовсе: сообщения, заявки и уведомления появлялись только после
     * ручного обновления.
     */
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
