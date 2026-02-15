/**
 * Represents the lifecycle states of a Virtual Care call session.
 * Follows the "Digital Knock" workflow defined in the PRD.
 */
export enum CallStatus {
  /** Meeting created, waiting to signal TV */
  INITIATING = 'INITIATING',

  /** TV has been signaled (start_call sent), awaiting patient response */
  RINGING = 'RINGING',

  /** Patient accepted the call, camera joining meeting */
  ACCEPTED = 'ACCEPTED',

  /** Call is active with both parties connected */
  CONNECTED = 'CONNECTED',

  /** Patient declined the call */
  DECLINED = 'DECLINED',

  /** Patient did not respond within timeout */
  IGNORED = 'IGNORED',

  /** Call ended normally */
  TERMINATED = 'TERMINATED',

  /** Call failed due to an error */
  FAILED = 'FAILED',
}

/**
 * Call types supported by the Digital Knock workflow.
 */
export enum CallType {
  /** Normal call — requires patient acceptance */
  REGULAR = 'regular',

  /** Emergency override — camera auto-joins without patient input */
  OVERRIDE = 'override',
}
