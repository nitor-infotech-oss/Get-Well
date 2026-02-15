/**
 * Audit log entry for HIPAA compliance.
 * IMPORTANT: Never include PHI (patient names, MRNs).
 * Only use anonymized identifiers (meetingId, locationId).
 */
export interface AuditLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Audit event type (e.g., CALL_ATTEMPT, CALL_CONNECTED) */
  event: string;

  /** Anonymized meeting identifier */
  meetingId: string;

  /** Physical room/location identifier */
  locationId: string;

  /** Caller identifier (nurse user ID, not name in logs) */
  callerId?: string;

  /** Duration of the call in milliseconds (if applicable) */
  durationMs?: number;

  /** Additional metadata (no PHI) */
  metadata?: Record<string, unknown>;
}
