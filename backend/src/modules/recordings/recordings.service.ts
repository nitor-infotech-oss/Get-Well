import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RecordingMetadata } from '../call-orchestration/entities/recording-metadata.entity';

export interface RecordingListItem {
  id: string;
  sessionId: string;
  meetingId: string;
  locationId: string;
  callerId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface PlaybackUrlResponse {
  recordingId: string;
  meetingId: string;
  locationId: string;
  segments: { url: string; order: number }[];
  expiresInSeconds: number;
}

/** Pre-signed URL expiry (1 hour — HIPAA: limit exposure) */
const PRESIGN_EXPIRY_SECONDS = 3600;

@Injectable()
export class RecordingsService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RecordingMetadata)
    private readonly recordingRepo: Repository<RecordingMetadata>,
  ) {
    const region = this.configService.get<string>('chime.region') || 'us-east-1';
    this.s3Client = new S3Client({ region });

    const bucketConfig = this.configService.get<string>('chime.recordingBucket');
    if (!bucketConfig?.trim()) {
      this.bucket = '';
      return;
    }
    // Extract bucket name from ARN (arn:aws:s3:::bucket-name) or use as-is if plain name
    this.bucket = bucketConfig.startsWith('arn:')
      ? bucketConfig.split(':').pop()!
      : bucketConfig;
  }

  /**
   * List recordings for nurses. Supports optional filters.
   * No PHI — only anonymized IDs.
   */
  async listRecordings(options?: {
    locationId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<RecordingListItem[]> {
    if (!this.bucket) {
      return [];
    }

    const qb = this.recordingRepo.createQueryBuilder('r');
    qb.select([
      'r.id',
      'r.sessionId',
      'r.meetingId',
      'r.locationId',
      'r.callerId',
      'r.startedAt',
      'r.endedAt',
    ]);
    qb.orderBy('r.createdAt', 'DESC');

    if (options?.locationId) {
      qb.andWhere('r.locationId = :locationId', {
        locationId: options.locationId,
      });
    }
    if (options?.fromDate) {
      qb.andWhere('r.startedAt >= :fromDate', {
        fromDate: new Date(options.fromDate),
      });
    }
    if (options?.toDate) {
      qb.andWhere('r.endedAt <= :toDate', {
        toDate: new Date(options.toDate),
      });
    }
    const limit = Math.min(options?.limit ?? 50, 100);
    qb.take(limit);

    const rows = await qb.getMany();

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      meetingId: r.meetingId,
      locationId: r.locationId,
      callerId: r.callerId,
      startedAt: r.startedAt?.toISOString() ?? null,
      endedAt: r.endedAt?.toISOString() ?? null,
      durationSeconds:
        r.startedAt && r.endedAt
          ? Math.round(
              (r.endedAt.getTime() - r.startedAt.getTime()) / 1000,
            )
          : null,
    }));
  }

  /**
   * Get pre-signed playback URLs for a recording.
   * Chime writes segments under captures/{pipelineId}/.
   * Returns URLs in chronological order for sequential playback.
   */
  async getPlaybackUrls(recordingId: string): Promise<PlaybackUrlResponse> {
    const rec = await this.recordingRepo.findOne({ where: { id: recordingId } });
    if (!rec) {
      throw new NotFoundException('Recording not found');
    }

    const prefix = rec.s3Prefix?.trim();
    if (!prefix || !this.bucket) {
      throw new NotFoundException(
        'Recording artifacts not available (S3 not configured or missing prefix)',
      );
    }

    const listCmd = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });
    const listRes = await this.s3Client.send(listCmd);
    const contents = listRes.Contents ?? [];

    if (contents.length === 0) {
      throw new NotFoundException(
        'No recording artifacts found in storage (may still be processing)',
      );
    }

    // Sort by Key (Chime typically uses timestamp in key) for chronological order
    const sorted = [...contents].sort((a, b) =>
      (a.Key ?? '').localeCompare(b.Key ?? ''),
    );

    const segments: { url: string; order: number }[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const obj = sorted[i];
      if (!obj.Key || obj.Key.endsWith('/')) continue;

      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: obj.Key,
      });
      const url = await getSignedUrl(this.s3Client, getCmd, {
        expiresIn: PRESIGN_EXPIRY_SECONDS,
      });
      segments.push({ url, order: i + 1 });
    }

    return {
      recordingId: rec.id,
      meetingId: rec.meetingId,
      locationId: rec.locationId,
      segments,
      expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
    };
  }
}
