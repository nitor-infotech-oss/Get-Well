import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createRedisClient, REDIS_CLIENT } from './redis.config';

/**
 * Global Redis module — makes REDIS_CLIENT injectable everywhere.
 * Redis is critical for the <2s latency requirement — used for
 * session state, call state caching, and device heartbeat tracking.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) =>
        createRedisClient(configService),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
