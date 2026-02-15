/**
 * Health/connection status of a camera device (kiosk).
 */
export enum DeviceStatus {
  /** Device is connected and healthy */
  ONLINE = 'ONLINE',

  /** Device missed heartbeat threshold — considered unhealthy */
  DEGRADED = 'DEGRADED',

  /** Device is disconnected */
  OFFLINE = 'OFFLINE',

  /** Device is currently in a call */
  IN_CALL = 'IN_CALL',
}
