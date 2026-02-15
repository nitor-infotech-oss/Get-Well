import { io, Socket } from 'socket.io-client';
import type { CallStatusUpdate } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection to the backend.
 * Nurse Console uses this for real-time call status updates.
 */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(`${WS_URL}/devices`, {
    transports: ['websocket'],
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
