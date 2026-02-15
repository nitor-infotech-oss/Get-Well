import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../config/redis.config';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Health check controller.
 * Provides liveness and readiness probes for container orchestration.
 */
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'getwell-rhythmx-backend',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks Redis connectivity' })
  async readiness() {
    try {
      await this.redis.ping();
      return {
        status: 'ready',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'not_ready',
        redis: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
