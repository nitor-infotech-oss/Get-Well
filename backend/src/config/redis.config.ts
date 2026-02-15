import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Creates a Redis client instance from application configuration.
 * Redis is critical for the <2s latency requirement — used for
 * session state, call state caching, and device heartbeat tracking.
 */
export function createRedisClient(configService: ConfigService): Redis {
  return new Redis({
    host: configService.get<string>('redis.host'),
    port: configService.get<number>('redis.port'),
    password: configService.get<string>('redis.password'),
    tls: configService.get<boolean>('redis.tls') ? {} : undefined,
    retryStrategy: (times: number) => {
      // Exponential backoff: 50ms, 100ms, 200ms... max 2s
      return Math.min(times * 50, 2000);
    },
    lazyConnect: true,
  });
}

export const REDIS_CLIENT = 'REDIS_CLIENT';
