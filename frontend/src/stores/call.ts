import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { callApi, chimeApi } from '../services/api';
import { onCallStatusUpdate, joinLocationRoom } from '../services/socket';
import type { CallStatus, InitiateCallResponse } from '../types';

export const useCallStore = defineStore('call', () => {
  const sessionId = ref<string | null>(null);
  const meetingId = ref<string | null>(null);
  const locationId = ref<string | null>(null);
  const status = ref<CallStatus | null>(null);
  const joinToken = ref<string | null>(null);
  const attendeeId = ref<string | null>(null);
  const mediaPlacement = ref<Record<string, string> | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const callStartTime = ref<number | null>(null);

  const isInCall = computed(() =>
    ['INITIATING', 'RINGING', 'ACCEPTED', 'CONNECTED'].includes(status.value || ''),
  );

  const isConnected = computed(() => status.value === 'CONNECTED');
  const isRinging = computed(() => status.value === 'RINGING');

  /**
   * Build Chime SDK MeetingSessionConfiguration-compatible objects.
   * Returns meeting and attendee in the format expected by the Chime SDK.
   */
  const meetingSession = computed(() => {
    if (!meetingId.value || !attendeeId.value || !joinToken.value || !mediaPlacement.value) {
      return null;
    }

    // Wrap in the canonical { Meeting: { ... } } / { Attendee: { ... } } format
    // that MeetingSessionConfiguration expects from the CreateMeeting/CreateAttendee API.
    return {
      meeting: {
        Meeting: {
          MeetingId: meetingId.value,
          MediaPlacement: {
            AudioHostUrl: mediaPlacement.value.audioHostUrl,
            AudioFallbackUrl: mediaPlacement.value.audioFallbackUrl,
            SignalingUrl: mediaPlacement.value.signalingUrl,
            TurnControlUrl: mediaPlacement.value.turnControlUrl,
            ScreenDataUrl: mediaPlacement.value.screenDataUrl,
            ScreenSharingUrl: mediaPlacement.value.screenSharingUrl,
            ScreenViewingUrl: mediaPlacement.value.screenViewingUrl,
            EventIngestionUrl: mediaPlacement.value.eventIngestionUrl,
          },
        },
      },
      attendee: {
        Attendee: {
          AttendeeId: attendeeId.value,
          ExternalUserId: attendeeId.value,
          JoinToken: joinToken.value,
        },
      },
    };
  });

  /** Initiate a call to a patient room */
  async function initiateCall(
    targetLocationId: string,
    callerId: string,
    callerName: string,
    callType: 'regular' | 'override' = 'regular',
  ) {
    isLoading.value = true;
    error.value = null;

    try {
      // Step 1: Get nearest Chime media region for optimal latency
      let mediaRegion: string | undefined;
      try {
        const regionResponse = await chimeApi.getNearestRegion();
        mediaRegion = regionResponse.data.region;
        console.log('[CallStore] Nearest Chime region:', mediaRegion);
      } catch (err) {
        console.warn('[CallStore] Failed to get nearest region, using backend default');
      }

      // Step 2: Initiate call with region hint
      const { data } = await callApi.initiateCall({
        locationId: targetLocationId,
        callerId,
        callerName,
        callType,
        mediaRegion,
      });

      sessionId.value = data.sessionId;
      meetingId.value = data.meetingId;
      locationId.value = targetLocationId;
      joinToken.value = data.joinToken;
      attendeeId.value = data.attendeeId;
      mediaPlacement.value = data.mediaPlacement;
      status.value = 'RINGING';
      joinLocationRoom(targetLocationId);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to initiate call';
      status.value = 'FAILED';
    } finally {
      isLoading.value = false;
    }
  }

  /** End the current call */
  async function endCall() {
    if (!sessionId.value) return;

    try {
      await callApi.endCall(sessionId.value);
    } catch {
      // Best effort — clear state anyway
    }

    resetState();
  }

  /** Listen for real-time status updates */
  function listenForUpdates() {
    onCallStatusUpdate((update) => {
      if (update.meetingId === meetingId.value) {
        status.value = update.status;

        if (update.status === 'CONNECTED') {
          callStartTime.value = Date.now();
        }

        if (['TERMINATED', 'DECLINED', 'IGNORED', 'FAILED'].includes(update.status)) {
          // Auto-reset after showing final status briefly
          setTimeout(resetState, 3000);
        }
      }
    });
  }

  function resetState() {
    sessionId.value = null;
    meetingId.value = null;
    locationId.value = null;
    status.value = null;
    joinToken.value = null;
    attendeeId.value = null;
    mediaPlacement.value = null;
    callStartTime.value = null;
    error.value = null;
  }

  function clearError() {
    error.value = null;
  }

  return {
    sessionId, meetingId, locationId, status, joinToken, attendeeId,
    mediaPlacement, isLoading, error, callStartTime,
    isInCall, isConnected, isRinging, meetingSession,
    initiateCall, endCall, listenForUpdates, resetState, clearError,
  };
});
