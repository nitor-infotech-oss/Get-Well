import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * HIPAA Audit Log entity.
 * Immutable record of every system event for compliance auditing.
 * No PHI — only anonymized identifiers.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  event: string; // CALL_ATTEMPT, CALL_CONNECTED, CALL_TERMINATED, etc.

  @Column({ nullable: true })
  @Index()
  meetingId: string;

  @Column({ nullable: true })
  @Index()
  locationId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}
