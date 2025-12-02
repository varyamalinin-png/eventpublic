import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly pub: Redis;
  private readonly sub: Redis;

  constructor(url?: string) {
    const connectionString = url ?? 'redis://localhost:6380';
    this.client = new Redis(connectionString);
    this.pub = new Redis(connectionString);
    this.sub = new Redis(connectionString);
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
