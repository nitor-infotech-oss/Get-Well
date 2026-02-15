<template>
  <v-alert
    :type="alertType"
    :icon="alertIcon"
    variant="tonal"
    prominent
    closable
  >
    <v-alert-title>{{ alertTitle }}</v-alert-title>
    <div>
      Room: <strong>{{ callStore.locationId }}</strong>
      <span v-if="callStore.callStartTime" class="ml-4">
        Duration: <strong>{{ callDuration }}</strong>
      </span>
    </div>

    <template v-slot:append>
      <v-btn
        v-if="callStore.isInCall"
        color="error"
        variant="elevated"
        @click="callStore.endCall()"
      >
        <v-icon start>mdi-phone-hangup</v-icon>
        End Call
      </v-btn>
    </template>
  </v-alert>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useCallStore } from '../../stores/call';

const callStore = useCallStore();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval>;

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now(); }, 1000);
});

onUnmounted(() => clearInterval(timer));

const callDuration = computed(() => {
  if (!callStore.callStartTime) return '0:00';
  const seconds = Math.floor((now.value - callStore.callStartTime) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

const alertType = computed(() => {
  const map: Record<string, string> = {
    RINGING: 'info',
    ACCEPTED: 'info',
    CONNECTED: 'success',
    DECLINED: 'warning',
    FAILED: 'error',
    TERMINATED: 'info',
  };
  return (map[callStore.status || ''] || 'info') as 'info' | 'success' | 'warning' | 'error';
});

const alertIcon = computed(() => {
  const map: Record<string, string> = {
    RINGING: 'mdi-phone-ring',
    ACCEPTED: 'mdi-phone-in-talk',
    CONNECTED: 'mdi-video',
    DECLINED: 'mdi-phone-missed',
    FAILED: 'mdi-alert-circle',
  };
  return map[callStore.status || ''] || 'mdi-phone';
});

const alertTitle = computed(() => {
  const map: Record<string, string> = {
    INITIATING: 'Setting up call...',
    RINGING: 'Ringing patient room...',
    ACCEPTED: 'Patient accepted — connecting camera...',
    CONNECTED: 'Call in progress',
    DECLINED: 'Patient declined the call',
    IGNORED: 'No response from patient',
    FAILED: 'Call failed',
    TERMINATED: 'Call ended',
  };
  return map[callStore.status || ''] || 'Unknown status';
});
</script>
