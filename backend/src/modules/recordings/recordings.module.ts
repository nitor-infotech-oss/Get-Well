import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { RecordingMetadata } from '../call-orchestration/entities/recording-metadata.entity';

/**
 * Recordings module — list and playback meeting recordings from S3.
 * HIPAA: Pre-signed URLs only; no PHI in response.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RecordingMetadata]),
  ],
  controllers: [RecordingsController],
  providers: [RecordingsService],
  exports: [RecordingsService],
})
export class RecordingsModule {}
