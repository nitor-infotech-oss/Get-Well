/** API response from POST /api/calls (initiate call) */
export interface InitiateCallResponse {
  sessionId: string;
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  mediaRegion: string;
  mediaPlacement: Record<string, string>;
}

/** Login response */
export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  displayName: string;
}

/** Call session status (mirrors backend enum) */
export type CallStatus =
  | 'INITIATING'
  | 'RINGING'
  | 'ACCEPTED'
  | 'CONNECTED'
  | 'DECLINED'
  | 'IGNORED'
  | 'TERMINATED'
  | 'FAILED';

/** WebSocket call status update event */
export interface CallStatusUpdate {
  type: 'CALL_STATUS_UPDATE';
  meetingId: string;
  locationId: string;
  status: CallStatus;
  timestamp: string;
}

/** Room/Location for the room list */
export interface Room {
  locationId: string;
  roomName: string;
  floor: string;
  deviceStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'IN_CALL';
  patientName?: string; // Display only, not stored in backend
}
