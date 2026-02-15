import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChimeService } from './chime.service';
import { ChimeController } from './chime.controller';

/**
 * Amazon Chime SDK module.
 * Provides meeting creation, attendee management, and media capture pipelines.
 */
@Module({
  imports: [ConfigModule],
  controllers: [ChimeController],
  providers: [ChimeService],
  exports: [ChimeService],
})
export class ChimeModule {}
