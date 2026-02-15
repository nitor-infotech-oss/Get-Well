/**
 * Application-wide constants for GetWell RhythmX Virtual Care.
 * Values derived from PRD success metrics and Chime SDK requirements.
 */

/** Maximum time (ms) to wait for patient response before timing out */
export const CALL_TIMEOUT_MS = 60_000; // 60 seconds

/** Heartbeat interval (ms) for camera device watchdog */
export const DEVICE_HEARTBEAT_INTERVAL_MS = 10_000; // 10 seconds

/** Number of missed heartbeats before device is considered offline */
export const DEVICE_OFFLINE_THRESHOLD = 3;

/** Redis key prefixes for session management */
export const REDIS_KEYS = {
  CALL_SESSION: 'call:session:',
  DEVICE_STATE: 'device:state:',
  DEVICE_HEARTBEAT: 'device:heartbeat:',
  MEETING_MAP: 'meeting:map:',
} as const;

/** Amazon Chime SDK nearest region endpoint */
export const CHIME_NEAREST_REGION_URL =
  'https://nearest-media-region.l.chime.aws';

/** Default Chime media region fallback */
export const CHIME_DEFAULT_REGION = 'us-east-1';

/** System name sent to GetWell Stay API */
export const SYSTEM_NAME = 'GetWell';

/** Audit event types for HIPAA compliance logging */
export const AUDIT_EVENTS = {
  CALL_ATTEMPT: 'CALL_ATTEMPT',
  CALL_RINGING: 'CALL_RINGING',
  CALL_ACCEPTED: 'CALL_ACCEPTED',
  CALL_DECLINED: 'CALL_DECLINED',
  CALL_CONNECTED: 'CALL_CONNECTED',
  CALL_TERMINATED: 'CALL_TERMINATED',
  CALL_FAILED: 'CALL_FAILED',
  CALL_TIMEOUT: 'CALL_TIMEOUT',
  DEVICE_ONLINE: 'DEVICE_ONLINE',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
} as const;
