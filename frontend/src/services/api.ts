import axios from 'axios';
import type { AuthResponse, InitiateCallResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── Auth ──
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) => api.post<AuthResponse>('/auth/register', data),

  getProfile: () => api.get<AuthResponse['user']>('/auth/profile'),
};

// ── Chime SDK ──
export const chimeApi = {
  getNearestRegion: () =>
    api.get<{ region: string }>('/chime/nearest-region'),
};

// ── Calls ──
export const callApi = {
  initiateCall: (data: {
    locationId: string;
    callerId: string;
    callerName: string;
    callType?: string;
    mediaRegion?: string;
  }) => api.post<InitiateCallResponse>('/calls', data),

  endCall: (sessionId: string) =>
    api.post(`/calls/${sessionId}/end`),
};

// ── Recordings ──
export const recordingsApi = {
  list: (params?: {
    locationId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }) => api.get<RecordingListItem[]>('/recordings', { params }),

  getPlaybackUrls: (id: string) =>
    api.get<PlaybackUrlResponse>(`/recordings/${id}/playback-url`),
};

export interface RecordingListItem {
  id: string;
  sessionId: string;
  meetingId: string;
  locationId: string;
  callerId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface PlaybackUrlResponse {
  recordingId: string;
  meetingId: string;
  locationId: string;
  segments: { url: string; order: number }[];
  expiresInSeconds: number;
}

// ── Patient Call (no auth required) ──
export const patientCallApi = {
  acceptCall: (data: { meetingId: string; locationId: string }) =>
    api.post<{
      meetingId: string;
      attendeeId: string;
      joinToken: string;
      mediaRegion: string;
      mediaPlacement: Record<string, string>;
    }>('/calls/patient-accept', data),

  declineCall: (data: { meetingId: string }) =>
    api.post('/calls/patient-decline', data),
};

export default api;
