<template>
  <v-card class="fill-height d-flex flex-column" color="grey-darken-4" flat>
    <!-- Top Bar -->
    <v-toolbar color="transparent" flat density="compact">
      <v-toolbar-title class="text-white">
        <v-icon start>mdi-video</v-icon>
        Call — {{ callStore.locationId }}
      </v-toolbar-title>

      <v-spacer />

      <v-chip color="success" variant="tonal" class="mr-3" v-if="callStore.isConnected">
        <v-icon start size="x-small">mdi-circle</v-icon>
        Connected
      </v-chip>

      <span class="text-white mr-3" v-if="callStore.callStartTime">
        {{ callDuration }}
      </span>

      <v-btn color="error" variant="elevated" @click="handleEndCall">
        <v-icon start>mdi-phone-hangup</v-icon>
        End Call
      </v-btn>
    </v-toolbar>

    <!-- Video Grid Area -->
    <v-row class="flex-grow-1 ma-0">
      <!-- Remote Video (Patient Camera) -->
      <v-col cols="12" md="9" class="pa-2">
        <div class="video-container">
          <!-- Video element — ALWAYS in DOM so the ref is never null -->
          <video
            ref="remoteVideoRef"
            class="video-tile"
            autoplay
            playsinline
          ></video>

          <!-- Ringing overlay — absolutely positioned ON TOP of the video.
               Uses v-if (not v-show) to avoid Vuetify d-flex !important conflicts -->
          <div v-if="isRingingOrConnecting" class="ringing-overlay">
            <div class="text-center">
              <v-icon size="120" color="primary" class="pulse-icon">mdi-phone-ring</v-icon>
              <div class="text-h5 mt-4 text-white">{{ ringingMessage }}</div>
              <div class="text-body-2 text-grey-lighten-1 mt-2">{{ callStore.locationId }}</div>
            </div>
          </div>
        </div>
      </v-col>

      <!-- Self View + Controls -->
      <v-col cols="12" md="3" class="pa-2">
        <!-- Self Video -->
        <div class="video-container mb-3" style="height: 200px;">
          <video
            ref="localVideoRef"
            class="video-tile"
            autoplay
            playsinline
            muted
            style="transform: scaleX(-1);"
          ></video>
        </div>

        <!-- Media Controls -->
        <v-card color="grey-darken-3" class="mb-3 pa-3">
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

        <!-- PTZ Controls -->
        <PtzControls />
      </v-col>
    </v-row>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useCallStore } from '../../stores/call';
import { useChimeSession } from '../../composables/useChimeSession';
import PtzControls from './PtzControls.vue';

const emit = defineEmits<{ endCall: [] }>();
const callStore = useCallStore();

// Chime SDK composable — refs are auto-unwrapped in the template
const chime = useChimeSession();
const { isMuted, isVideoOff } = chime;

const localVideoRef = ref<HTMLVideoElement | null>(null);
const remoteVideoRef = ref<HTMLVideoElement | null>(null);
const isChimeInitialized = ref(false);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval>;

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now(); }, 1000);
});

onUnmounted(() => {
  clearInterval(timer);
  chime.stopAudioVideo();
});

// Initialize Chime SDK as soon as call credentials are available
watch(
  () => callStore.status,
  async (newStatus) => {
    if (
      ['RINGING', 'ACCEPTED', 'CONNECTED'].includes(newStatus || '') &&
      !isChimeInitialized.value
    ) {
      await initializeChime();
    }
  },
  { immediate: true },
);

async function initializeChime(): Promise<void> {
  if (isChimeInitialized.value || !callStore.meetingSession) return;

  try {
    const { meeting, attendee } = callStore.meetingSession;

    // Set video element refs (stored as reactive Refs, read dynamically)
    chime.setVideoElements(localVideoRef, remoteVideoRef);

    // Initialize and start Chime session
    await chime.initializeSession(meeting, attendee);
    await chime.startAudioVideo();

    isChimeInitialized.value = true;
    console.log('[CallVideoView] Chime SDK initialized and started');
  } catch (err: any) {
    console.error('[CallVideoView] Failed to initialize Chime:', err);
    callStore.error = `Chime initialization failed: ${err.message}`;
  }
}

function handleEndCall() {
  chime.stopAudioVideo();
  emit('endCall');
}

const callDuration = computed(() => {
  if (!callStore.callStartTime) return '0:00';
  const seconds = Math.floor((now.value - callStore.callStartTime) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

const isRingingOrConnecting = computed(() =>
  ['INITIATING', 'RINGING'].includes(callStore.status || ''),
);

const ringingMessage = computed(() => {
  const s = callStore.status || '';
  if (s === 'INITIATING') return 'Setting up call...';
  if (s === 'RINGING') return 'Ringing patient room...';
  if (s === 'ACCEPTED') return 'Patient accepted — connecting...';
  return '';
});
</script>

<style scoped>
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

/* Ringing overlay — sits on top of the video element */
.ringing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
  z-index: 2;
}

.pulse-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}
</style>
