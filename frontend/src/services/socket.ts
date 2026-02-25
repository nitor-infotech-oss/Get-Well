import { io, Socket } from 'socket.io-client';
import type { CallStatusUpdate } from '../types';

/**
 * Resolve the Socket.IO server URL.
 *
 * - Development: VITE_WS_URL is set to 'http://localhost:3000' → connect there.
 * - Production (behind nginx proxy): VITE_WS_URL is undefined/empty → use
 *   a relative path so Socket.IO connects to the SAME origin as the page.
 *   This ensures wss:// is used when the page is served over HTTPS.
 */
function getSocketTarget(): string {
  const envUrl = import.meta.env.VITE_WS_URL;
  // If explicitly set to a non-empty URL, use it (development)
  if (envUrl && envUrl.length > 0) {
    return `${envUrl}/devices`;
  }
  // Production: relative namespace → same origin, nginx proxies /socket.io/ to backend
  return '/devices';
}

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection to the backend.
 * Nurse Console uses this for real-time call status updates.
 */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const target = getSocketTarget();
  console.log('[WS] Connecting to:', target);

  socket = io(target, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected to backend');
  });

  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Listen for call status updates (after joining a location room).
 */
export function onCallStatusUpdate(
  callback: (update: CallStatusUpdate) => void,
): void {
  socket?.on('call_status_update', callback);
}

/**
 * Join a location room to receive call_status_update for that room.
 * Call this after initiating a call so the Nurse Console gets status updates.
 */
export function joinLocationRoom(locationId: string): void {
  if (locationId) socket?.emit('join_location', { locationId });
}

/**
 * Send a PTZ command to a camera device.
 */
export function sendPtzCommand(
  deviceId: string,
  command: string,
  value?: number,
): void {
  socket?.emit('ptz_command', {
    type: 'PTZ_COMMAND',
    deviceId,
    command,
    value,
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// ── Patient-Specific Socket Functions ──

/**
 * Register as a patient for a specific room.
 * This makes the patient receive incoming_call events for that room.
 */
export function registerPatient(locationId: string): void {
  socket?.emit('register_patient', { locationId }, (response: any) => {
    console.log('[WS] Patient registered:', response);
  });
}

/**
 * Listen for incoming call events (patient side).
 */
export function onIncomingCall(
  callback: (data: {
    type: string;
    meetingId: string;
    callerName: string;
    callType: string;
    sessionId: string;
    locationId: string;
    timestamp: string;
  }) => void,
): void {
  socket?.on('incoming_call', callback);
}

/**
 * Listen for call ended events (patient side).
 */
export function onCallEnded(
  callback: (data: {
    type: string;
    meetingId: string;
    locationId: string;
    timestamp: string;
  }) => void,
): void {
  socket?.on('call_ended', callback);
}
