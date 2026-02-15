import { CallStatus, CallType } from '../../../common/enums';

/**
 * Represents a call session stored in Redis for fast access (<2s latency).
 * This is the primary state object for the Digital Knock workflow.
 */
export interface CallSession {
  /** Internal session identifier */
  sessionId: string;

  /** Chime Meeting ID */
  meetingId: string;

  /** Physical room/location */
  locationId: string;

  /** Caller (nurse) user ID */
  callerId: string;

  /** Caller display name (for TV prompt) */
  callerName: string;

  /** Call type: regular or emergency override */
  callType: CallType;

  /** Current call status */
  status: CallStatus;

  /** Chime media region */
  mediaRegion: string;

  /** Media capture pipeline ID (for recording) */
  pipelineId?: string;

  /** Camera device attendee info */
  deviceAttendeeId?: string;
  deviceJoinToken?: string;

  /** Nurse attendee info */
  nurseAttendeeId: string;
  nurseJoinToken: string;

  /** Timestamps */
  createdAt: string;
  ringingAt?: string;
  acceptedAt?: string;
  connectedAt?: string;
  terminatedAt?: string;
}
