import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { RedisModule } from './config/redis.module';
import { ChimeModule } from './modules/chime/chime.module';
import { GetwellStayModule } from './modules/getwell-stay/getwell-stay.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { CallOrchestrationModule } from './modules/call-orchestration/call-orchestration.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

// Entities
import { User } from './modules/auth/entities/user.entity';
import { CallRecord } from './modules/call-orchestration/entities/call-record.entity';
import { AuditLog } from './modules/call-orchestration/entities/audit-log.entity';
import { RecordingMetadata } from './modules/call-orchestration/entities/recording-metadata.entity';
import { Device } from './modules/device/entities/device.entity';

/**
 * Root application module for GetWell RhythmX Virtual Care Backend.
 *
 * Module Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    AppModule (Root)                         │
 * ├─────────────────────────────────────────────────────────────┤
 * │  AuthModule             ← JWT auth, users, roles           │
 * │  CallOrchestrationModule  ← Core "Digital Knock" workflow  │
 * │    ├── ChimeModule        ← AWS Chime SDK (meetings, rec)  │
 * │    ├── GetwellStayModule  ← TV API (/start_call, /end_call)│
 * │    └── WebsocketModule    ← Real-time device signaling     │
 * │  HealthModule             ← Liveness / Readiness probes    │
 * └─────────────────────────────────────────────────────────────┘
 */
@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // TypeORM — PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false,
        entities: [User, CallRecord, AuditLog, RecordingMetadata, Device],
        synchronize: config.get<string>('app.environment') === 'development',
        // In production: use migrations, never synchronize
        logging: config.get<string>('app.environment') === 'development',
      }),
    }),

    // Global Redis client (accessible by all modules)
    RedisModule,

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    AuthModule,
    ChimeModule,
    GetwellStayModule,
    WebsocketModule,
    CallOrchestrationModule,
    RecordingsModule,
    HealthModule,
  ],
  providers: [
    // Global JWT auth guard — protects all routes by default
    // Use @Public() decorator on routes that don't need auth
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global roles guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [],
})
export class AppModule {}
