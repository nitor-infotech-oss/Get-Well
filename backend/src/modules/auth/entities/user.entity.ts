import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * User entity — represents nurses and administrators.
 * HIPAA Note: No patient data stored here. Only staff identifiers.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  password: string; // bcrypt hashed

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ default: 'nurse' })
  role: 'nurse' | 'admin' | 'supervisor';

  /** Display name shown on patient TV during calls */
  @Column({ nullable: true })
  displayName: string;

  /** Employee/badge ID for audit trails (not PHI) */
  @Column({ nullable: true })
  employeeId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
