import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  GetBucketLocationCommand,
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
  private readonly logger = new Logger(RecordingsService.name);
  private s3Client: S3Client;
  private readonly bucket: string;
  private bucketRegion: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RecordingMetadata)
    private readonly recordingRepo: Repository<RecordingMetadata>,
  ) {
    const region =
      this.configService.get<string>('chime.recordingBucketRegion') ||
      this.configService.get<string>('chime.region') ||
      'us-east-1';
    this.s3Client = new S3Client({ region });

    const bucketConfig = this.configService.get<string>(
      'chime.recordingBucket',
    );
    if (!bucketConfig?.trim()) {
      this.bucket = '';
      return;
    }
    this.bucket = bucketConfig.startsWith('arn:')
      ? bucketConfig.split(':').pop()!
      : bucketConfig;
  }

  /** Resolve bucket's actual region (handles "must be addressed using specified endpoint") */
  private async getBucketRegion(): Promise<string> {
    if (this.bucketRegion) return this.bucketRegion;
    try {
      const client = new S3Client({ region: 'us-east-1' }); // GetBucketLocation works from us-east-1
      const res = await client.send(
        new GetBucketLocationCommand({ Bucket: this.bucket }),
      );
      const loc = res.LocationConstraint;
      this.bucketRegion = loc && loc !== 'EU' ? loc : 'us-east-1';
      this.s3Client = new S3Client({ region: this.bucketRegion });
      this.logger.log(`S3 bucket ${this.bucket} region: ${this.bucketRegion}`);
      return this.bucketRegion;
    } catch (err) {
      this.logger.warn(
        `GetBucketLocation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'us-east-1';
    }
  }

  /** Whether recording to S3 is configured (CHIME_RECORDING_BUCKET set). */
  isRecordingConfigured(): boolean {
    return !!this.bucket && this.bucket.length > 0;
  }

  /**
   * Debug: return prefix/bucket for a recording (no S3 call). Use to verify DB and config.
   */
  async getPlaybackDebug(recordingId: string): Promise<{
    recordingId: string;
    pipelineId: string | null;
    s3Prefix: string | null;
    resolvedPrefix: string | null;
    bucket: string;
  }> {
    const rec = await this.recordingRepo.findOne({
      where: { id: recordingId },
    });
    if (!rec) {
      throw new NotFoundException('Recording not found');
    }
    let prefix: string | null = rec.pipelineId
      ? `${rec.pipelineId}/`
      : rec.s3Prefix?.trim() || null;
    if (prefix && prefix.startsWith('captures/')) {
      prefix = prefix.replace(/^captures\//, '').replace(/\/?$/, '') + '/';
    }
    return {
      recordingId,
      pipelineId: rec.pipelineId ?? null,
      s3Prefix: rec.s3Prefix ?? null,
      resolvedPrefix: prefix,
      bucket: this.bucket || '(not set)',
    };
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
          ? Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 1000)
          : null,
    }));
  }

  /**
   * Get pre-signed playback URLs for a recording.
   * Chime Media Capture writes to S3 under {MediaCapturePipelineId}/ (pipeline ID).
   * Try pipelineId first, then meetingId for backward compatibility with old rows.
   */
  async getPlaybackUrls(recordingId: string): Promise<PlaybackUrlResponse> {
    const rec = await this.recordingRepo.findOne({
      where: { id: recordingId },
    });
    if (!rec) {
      throw new NotFoundException('Recording not found');
    }

    const prefixesToTry: string[] = [];
    // Chime writes under pipeline ID; prefer s3Prefix then pipelineId
    const s3Prefix = rec.s3Prefix?.trim();
    if (s3Prefix) {
      let p = s3Prefix;
      if (p.startsWith('captures/')) {
        p = p.replace(/^captures\//, '').replace(/\/?$/, '') + '/';
      }
      if (!p.endsWith('/')) p += '/';
      prefixesToTry.push(p);
    }
    if (rec.pipelineId && !prefixesToTry.includes(`${rec.pipelineId}/`)) {
      prefixesToTry.push(`${rec.pipelineId}/`);
    }
    if (rec.meetingId && !prefixesToTry.includes(`${rec.meetingId}/`)) {
      prefixesToTry.push(`${rec.meetingId}/`);
    }

    if (prefixesToTry.length === 0 || !this.bucket) {
      throw new NotFoundException(
        'Recording artifacts not available (S3 not configured or missing prefix)',
      );
    }

    this.logger.log(
      `Playback: bucket=${this.bucket} trying prefixes=[${prefixesToTry.join(', ')}]`,
    );

    // Ensure we use the bucket's actual region (fixes "must be addressed using specified endpoint")
    await this.getBucketRegion();

    let contents: { Key?: string }[] = [];
    let resolvedPrefix = prefixesToTry[0];

    for (const prefix of prefixesToTry) {
      try {
        const listCmd = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
        });
        const listRes = await this.s3Client.send(listCmd);
        contents = listRes.Contents ?? [];
        if (contents.length > 0) {
          resolvedPrefix = prefix;
          this.logger.log(
            `S3 list found ${contents.length} objects at prefix ${prefix}`,
          );
          break;
        }
      } catch (err) {
        this.logger.warn(
          `S3 ListObjectsV2 failed for prefix ${prefix}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (contents.length === 0) {
      throw new NotFoundException(
        'No recording artifacts found in storage (may still be processing). Chime can take 1–2 minutes after call end to finish uploading.',
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
      // Only include playable media (Chime also writes meeting-events/*.txt)
      if (!obj.Key.toLowerCase().endsWith('.mp4')) continue;

      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: obj.Key,
      });
      const url = await getSignedUrl(this.s3Client, getCmd, {
        expiresIn: PRESIGN_EXPIRY_SECONDS,
      });
      segments.push({ url, order: segments.length + 1 });
    }

    if (segments.length === 0) {
      throw new NotFoundException(
        'No playable media found (only metadata files). Chime may still be processing.',
      );
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
