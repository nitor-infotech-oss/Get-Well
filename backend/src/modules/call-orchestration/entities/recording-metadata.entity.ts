import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Recording metadata for HIPAA-compliant audit and retrieval.
 * Persisted when a call ends and recording was active.
 * No PHI — only anonymized IDs (sessionId, meetingId, locationId, callerId).
 */
@Entity('recording_metadata')
export class RecordingMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index('IDX_recording_metadata_sessionId')
  sessionId!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index('IDX_recording_metadata_meetingId')
  meetingId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pipelineId!: string | null;

  @Column({ type: 'varchar', length: 128 })
  @Index('IDX_recording_metadata_locationId')
  locationId!: string;

  @Column({ type: 'varchar', length: 255 })
  callerId!: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  endedAt!: Date | null;

  /** S3 prefix where Chime wrote artifacts (e.g. captures/{pipelineId}) */
  @Column({ type: 'varchar', length: 512, nullable: true })
  s3Prefix!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
