/**
 * WebSocket event interfaces for real-time signaling
 * between the Backend, Camera Devices, and Nurse Console.
 */

/** Sent to camera device when patient accepts call */
export interface DeviceJoinMeetingEvent {
  type: 'JOIN_MEETING';
  meetingId: string;
  attendeeInfo: {
    attendeeId: string;
    joinToken: string;
  };
  meetingInfo: {
    mediaRegion: string;
    mediaPlacement: Record<string, string>;
  };
}

/** Sent to camera device to leave/end call */
export interface DeviceLeaveMeetingEvent {
  type: 'LEAVE_MEETING';
  meetingId: string;
}

/** PTZ command from Nurse Console to Camera Device */
export interface PtzCommandEvent {
  type: 'PTZ_COMMAND';
  deviceId: string;
  command: 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'home';
  /** Speed/step value (0-100) */
  value?: number;
}

/** Heartbeat from Camera Device to Backend */
export interface DeviceHeartbeatEvent {
  type: 'HEARTBEAT';
  deviceId: string;
  locationId: string;
  timestamp: string;
  status: 'healthy' | 'degraded';
  /** Optional diagnostics */
  diagnostics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    cameraStatus?: 'ok' | 'error';
    networkLatencyMs?: number;
  };
}

/** Device registration on initial WebSocket connection */
export interface DeviceRegisterEvent {
  type: 'REGISTER';
  deviceId: string;
  locationId: string;
  firmwareVersion?: string;
  capabilities?: string[];
}

/** Call status update sent to Nurse Console */
export interface CallStatusUpdateEvent {
  type: 'CALL_STATUS_UPDATE';
  meetingId: string;
  locationId: string;
  status: string;
  timestamp: string;
}
