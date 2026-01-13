import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly pub: Redis;
  private readonly sub: Redis;

  constructor(url?: string) {
    const connectionString = url ?? 'redis://localhost:6379';
    const redisOptions = {
      retryStrategy: (times: number) => {
        // Экспоненциальная задержка, но не более 3000мс
        const delay = Math.min(times * 50, 3000);
        return delay;
      },
      maxRetriesPerRequest: null, // Отключаем ограничение на количество попыток
      lazyConnect: true,
      enableReadyCheck: false, // Отключаем проверку готовности, чтобы не падать при ошибках
      enableOfflineQueue: false, // Отключаем очередь офлайн-запросов, чтобы не накапливать ошибки
      reconnectOnError: (err: Error) => {
        // Не переподключаемся на определенные ошибки
        if (err.message.includes('READONLY')) {
          return false;
        }
        // Для ошибок подключения пытаемся переподключиться, но без блокировки
        return true;
      },
      // Отключаем автоматическое переподключение при критических ошибках
      showFriendlyErrorStack: false,
    };
    
    this.client = new Redis(connectionString, redisOptions);
    this.pub = new Redis(connectionString, redisOptions);
    this.sub = new Redis(connectionString, redisOptions);
    
    // Обработка ошибок соединения без падения приложения
    [this.client, this.pub, this.sub].forEach((redis, index) => {
      const name = ['client', 'pub', 'sub'][index];
      redis.on('error', (err) => {
        // Логируем как предупреждение, а не ошибку, чтобы не падал сервер
        console.warn(`[Redis ${name}] Connection error (non-fatal):`, err.message);
      });
      redis.on('connect', () => {
        console.log(`[Redis ${name}] Connected successfully`);
      });
      redis.on('ready', () => {
        console.log(`[Redis ${name}] Ready`);
      });
      redis.on('close', () => {
        console.warn(`[Redis ${name}] Connection closed`);
      });
    });
  }

  getClient(): Redis {
    return this.client;
  }

  getPubClient(): Redis {
    return this.pub;
  }

  getSubClient(): Redis {
    return this.sub;
  }

  async onModuleDestroy() {
    await Promise.all([this.client.quit(), this.pub.quit(), this.sub.quit()]);
  }
}
