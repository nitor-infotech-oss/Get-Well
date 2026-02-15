import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/**
 * Persistent call record for HIPAA audit trail.
 * Every call attempt is recorded regardless of outcome.
 *
 * HIPAA: No patient name/MRN stored. Only locationId, meetingId.
 */
@Entity('call_records')
export class CallRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  meetingId: string;

  @Column()
  @Index()
  locationId: string;

  @Column()
  callerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'callerId', referencedColumnName: 'id' })
  caller: User;

  @Column()
  callerName: string;

  @Column({ default: 'regular' })
  callType: string; // 'regular' | 'override'

  @Column()
  @Index()
  status: string; // Final status: CONNECTED, DECLINED, IGNORED, FAILED, TERMINATED

  @Column({ nullable: true })
  mediaRegion: string;

  @Column({ nullable: true })
  pipelineId: string;

  /** Duration in milliseconds (null if call never connected) */
  @Column({ type: 'int', nullable: true })
  durationMs: number;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ringingAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  connectedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  terminatedAt: Date;

  /** Failure reason if status is FAILED */
  @Column({ nullable: true })
  failureReason: string;
}
