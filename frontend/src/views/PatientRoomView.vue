<template>
  <v-app>
    <v-main class="patient-bg">
      <!-- Incoming Call Overlay -->
      <v-dialog v-model="showIncomingCall" persistent max-width="500" :scrim="true">
        <v-card class="pa-6 text-center" rounded="xl" elevation="24">
          <div class="mb-4">
            <v-avatar size="80" color="primary">
              <v-icon size="48" color="white">mdi-phone-incoming</v-icon>
            </v-avatar>
          </div>

          <v-card-title class="text-h5 font-weight-bold justify-center">
            Incoming Video Call
          </v-card-title>

          <v-card-subtitle class="text-body-1 mt-2">
            <strong>{{ incomingCallerName }}</strong> is calling...
          </v-card-subtitle>

          <v-card-text class="mt-2">
            <p class="text-grey">{{ locationId }}</p>
          </v-card-text>

          <v-card-actions class="justify-center ga-4 pb-4">
            <v-btn
              color="error"
              variant="elevated"
              size="x-large"
              rounded="pill"
              @click="declineCall"
              min-width="140"
            >
              <v-icon start>mdi-phone-hangup</v-icon>
              Decline
            </v-btn>

            <v-btn
              color="success"
              variant="elevated"
              size="x-large"
              rounded="pill"
              @click="acceptCall"
              :loading="isAccepting"
              min-width="140"
            >
              <v-icon start>mdi-phone</v-icon>
              Accept
            </v-btn>
          </v-card-actions>

          <!-- Ringing animation -->
          <div class="ringing-indicator">
            <v-icon color="primary" class="ring-pulse" size="24">mdi-phone-ring</v-icon>
          </div>
        </v-card>
      </v-dialog>

      <!-- Active Video Call View -->
      <div v-if="isInCall" class="call-fullscreen">
        <v-card class="fill-height d-flex flex-column" color="grey-darken-4" flat>
          <!-- Top Bar -->
          <v-toolbar color="transparent" flat density="compact">
            <v-toolbar-title class="text-white">
              <v-icon start>mdi-video</v-icon>
              Video Call — {{ locationId }}
            </v-toolbar-title>

            <v-spacer />

            <v-chip color="success" variant="tonal" class="mr-3">
              <v-icon start size="x-small">mdi-circle</v-icon>
              Connected
            </v-chip>

            <span class="text-white mr-3">{{ callDuration }}</span>

            <v-btn color="error" variant="elevated" @click="endCall">
              <v-icon start>mdi-phone-hangup</v-icon>
              End Call
            </v-btn>
          </v-toolbar>

          <!-- Video Grid -->
          <v-row class="flex-grow-1 ma-0">
            <!-- Remote Video (Nurse) -->
            <v-col cols="12" md="9" class="pa-2">
              <div class="video-container">
                <video
                  ref="remoteVideoRef"
                  class="video-tile fill-height"
                  autoplay
                  playsinline
                  muted
                ></video>
                <div class="video-label">Nurse</div>
              </div>
            </v-col>

            <!-- Self View + Controls -->
            <v-col cols="12" md="3" class="pa-2">
              <div class="video-container mb-3" style="height: 200px;">
                <video
                  ref="localVideoRef"
                  class="video-tile fill-height"
                  autoplay
                  playsinline
                  muted
                  style="transform: scaleX(-1);"
                ></video>
                <div class="video-label">You</div>
              </div>

              <!-- Media Controls -->
              <v-card color="grey-darken-3" class="pa-3">
                <div class="d-flex justify-center ga-2">
                  <v-btn
                    :icon="isMuted ? 'mdi-microphone-off' : 'mdi-microphone'"
                    :color="isMuted ? 'error' : 'white'"
                    variant="tonal"
                    @click="chime.toggleMute()"
                    size="large"
                  />
                  <v-btn
                    :icon="isVideoOff ? 'mdi-video-off' : 'mdi-video'"
                    :color="isVideoOff ? 'error' : 'white'"
                    variant="tonal"
                    @click="chime.toggleVideo()"
                    size="large"
                  />
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </div>

      <!-- Idle / Waiting State -->
      <v-container
        v-if="!isInCall"
        class="fill-height d-flex align-center justify-center"
      >
        <v-card
          max-width="600"
          class="pa-8 text-center"
          rounded="xl"
          elevation="8"
        >
          <v-avatar size="100" color="primary" class="mb-4">
            <v-icon size="56" color="white">mdi-hospital-building</v-icon>
          </v-avatar>

          <h1 class="text-h4 font-weight-bold mb-2">Patient Room</h1>
          <h2 class="text-h6 text-primary mb-4">{{ locationId }}</h2>

          <v-chip
            :color="isConnectedToServer ? 'success' : 'error'"
            variant="tonal"
            class="mb-4"
          >
            <v-icon start size="x-small">mdi-circle</v-icon>
            {{ isConnectedToServer ? 'Online — Waiting for calls' : 'Connecting...' }}
          </v-chip>

          <p class="text-body-1 text-grey mt-4">
            When a nurse initiates a call to this room, you will receive a notification here.
          </p>

          <v-divider class="my-6" />

          <p class="text-caption text-grey">
            GetWell RhythmX Virtual Care &middot; Room {{ locationId }}
          </p>
        </v-card>
      </v-container>

      <!-- Error snackbar -->
      <v-snackbar v-model="showError" :timeout="6000" color="error" location="bottom">
        {{ errorMessage }}
        <template v-slot:actions>
          <v-btn variant="text" @click="showError = false">Dismiss</v-btn>
        </template>
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useChimeSession } from '../composables/useChimeSession';
import {
  connectSocket,
  registerPatient,
  onIncomingCall,
  onCallEnded,
  disconnectSocket,
  getSocket,
} from '../services/socket';
import { patientCallApi } from '../services/api';

const route = useRoute();
const locationId = computed(() => route.params.locationId as string);

// ── State ──
const isConnectedToServer = ref(false);
const showIncomingCall = ref(false);
const isInCall = ref(false);
const isAccepting = ref(false);
const showError = ref(false);
const errorMessage = ref('');

// Incoming call data
const incomingMeetingId = ref<string | null>(null);
const incomingSessionId = ref<string | null>(null);
const incomingCallerName = ref('Nurse');

// Call timing
const callStartTime = ref<number | null>(null);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval>;

// Chime session
const chime = useChimeSession();
const { isMuted, isVideoOff } = chime;
const localVideoRef = ref<HTMLVideoElement | null>(null);
const remoteVideoRef = ref<HTMLVideoElement | null>(null);

const callDuration = computed(() => {
  if (!callStartTime.value) return '0:00';
  const seconds = Math.floor((now.value - callStartTime.value) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

// ── Lifecycle ──
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now(); }, 1000);
  setupWebSocket();
});

onUnmounted(() => {
  clearInterval(timer);
  chime.stopAudioVideo();
  disconnectSocket();
});

function setupWebSocket(): void {
  const socket = connectSocket();

  socket.on('connect', () => {
    isConnectedToServer.value = true;
    console.log('[Patient] Connected to backend, registering for', locationId.value);
    registerPatient(locationId.value);
  });

  socket.on('disconnect', () => {
    isConnectedToServer.value = false;
  });

  // If already connected (e.g., hot reload), register immediately
  if (socket.connected) {
    isConnectedToServer.value = true;
    registerPatient(locationId.value);
  }

  // Listen for incoming calls
  onIncomingCall((data) => {
    console.log('[Patient] Incoming call:', data);
    incomingMeetingId.value = data.meetingId;
    incomingSessionId.value = data.sessionId;
    incomingCallerName.value = data.callerName || 'Nurse';
    showIncomingCall.value = true;
  });

  // Listen for call ended (nurse hung up before we answered, or after we answered)
  onCallEnded((data) => {
    console.log('[Patient] Call ended:', data);
    showIncomingCall.value = false;
    if (isInCall.value) {
      chime.stopAudioVideo();
      isInCall.value = false;
      callStartTime.value = null;
    }
  });
}

// ── Actions ──
async function acceptCall(): Promise<void> {
  if (!incomingMeetingId.value) return;

  isAccepting.value = true;
  try {
    // Tell backend we accept — it creates our attendee and returns Chime credentials
    const { data } = await patientCallApi.acceptCall({
      meetingId: incomingMeetingId.value,
      locationId: locationId.value,
    });

    console.log('[Patient] Accepted call, got credentials:', data);

    showIncomingCall.value = false;
    isInCall.value = true;
    callStartTime.value = Date.now();

    // Build Chime SDK format — use canonical { Meeting: { ... } } wrapper
    const meetingConfig = {
      Meeting: {
        MeetingId: data.meetingId,
        MediaPlacement: {
          AudioHostUrl: data.mediaPlacement.audioHostUrl,
          AudioFallbackUrl: data.mediaPlacement.audioFallbackUrl,
          SignalingUrl: data.mediaPlacement.signalingUrl,
          TurnControlUrl: data.mediaPlacement.turnControlUrl,
          ScreenDataUrl: data.mediaPlacement.screenDataUrl,
          ScreenSharingUrl: data.mediaPlacement.screenSharingUrl,
          ScreenViewingUrl: data.mediaPlacement.screenViewingUrl,
          EventIngestionUrl: data.mediaPlacement.eventIngestionUrl,
        },
      },
    };

    const attendeeConfig = {
      Attendee: {
        AttendeeId: data.attendeeId,
        ExternalUserId: `patient-${locationId.value}`,
        JoinToken: data.joinToken,
      },
    };

    // Initialize Chime SDK and start audio/video
    // Wait for next tick so video refs are mounted (isInCall triggers v-if render)
    await nextTick();

    chime.setVideoElements(localVideoRef, remoteVideoRef);
    await chime.initializeSession(meetingConfig, attendeeConfig);
    await chime.startAudioVideo();

    console.log('[Patient] Chime session started');
  } catch (err: any) {
    console.error('[Patient] Failed to accept call:', err);
    errorMessage.value = err.response?.data?.message || err.message || 'Failed to accept call';
    showError.value = true;
    showIncomingCall.value = false;
  } finally {
    isAccepting.value = false;
  }
}

async function declineCall(): Promise<void> {
  if (!incomingMeetingId.value) return;

  try {
    await patientCallApi.declineCall({
      meetingId: incomingMeetingId.value,
    });
  } catch (err) {
    console.error('[Patient] Failed to decline call:', err);
  }

  showIncomingCall.value = false;
  incomingMeetingId.value = null;
  incomingSessionId.value = null;
}

function endCall(): void {
  chime.stopAudioVideo();
  isInCall.value = false;
  callStartTime.value = null;
  incomingMeetingId.value = null;
  incomingSessionId.value = null;
}
</script>

<style scoped>
.patient-bg {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.call-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

.video-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #1a1a1a;
  height: 100%;
  min-height: 300px;
}

.video-tile {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.ringing-indicator {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.ring-pulse {
  animation: ringPulse 1s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(15deg); }
  50% { transform: rotate(-15deg); }
  75% { transform: rotate(10deg); }
}
</style>
