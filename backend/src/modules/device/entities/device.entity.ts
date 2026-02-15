import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Camera device registry — persistent record of all enrolled kiosk devices.
 */
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  deviceId: string;

  @Column()
  @Index()
  locationId: string;

  @Column({ nullable: true })
  locationName: string;

  @Column({ default: 'OFFLINE' })
  status: string; // ONLINE | OFFLINE | DEGRADED | IN_CALL

  @Column({ nullable: true })
  firmwareVersion: string;

  @Column({ type: 'simple-array', nullable: true })
  capabilities: string[]; // ['PTZ', 'IR', 'HDMI-CEC']

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastHeartbeat: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastCallAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
