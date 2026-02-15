<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-4">
      <v-col>
        <h1 class="text-h4 font-weight-bold">Nurse Station Dashboard</h1>
        <p class="text-subtitle-1 text-grey">Select a room to initiate a video call</p>
      </v-col>
    </v-row>

    <!-- Active Call Banner -->
    <v-row v-if="callStore.isInCall" class="mb-4">
      <v-col>
        <CallStatusBanner />
      </v-col>
    </v-row>

    <!-- Room Grid -->
    <v-row>
      <v-col v-for="room in rooms" :key="room.locationId" cols="12" sm="6" md="4" lg="3">
        <v-card
          :class="{
            'border-primary': room.deviceStatus === 'ONLINE',
            'border-error': room.deviceStatus === 'OFFLINE',
            'border-warning': room.deviceStatus === 'IN_CALL',
          }"
          class="room-card"
          hover
        >
          <v-card-title class="d-flex align-center">
            <v-icon
              :icon="room.deviceStatus === 'ONLINE' ? 'mdi-video' : 'mdi-video-off'"
              :color="statusColor(room.deviceStatus)"
              class="mr-2"
            />
            {{ room.roomName }}
          </v-card-title>

          <v-card-subtitle>
            {{ room.floor }} &middot; {{ room.locationId }}
          </v-card-subtitle>

          <v-card-text>
            <v-chip
              :color="statusColor(room.deviceStatus)"
              size="small"
              variant="tonal"
            >
              <v-icon start size="x-small">mdi-circle</v-icon>
              {{ room.deviceStatus }}
            </v-chip>
          </v-card-text>

          <v-card-actions>
            <v-btn
              color="primary"
              variant="elevated"
              :disabled="callStore.isInCall"
              @click="startCall(room.locationId, 'regular')"
              :loading="callStore.isLoading && selectedRoom === room.locationId"
            >
              <v-icon start>mdi-phone</v-icon>
              Call
            </v-btn>

            <v-btn
              color="error"
              variant="tonal"
              :disabled="callStore.isInCall"
              @click="startCall(room.locationId, 'override')"
              size="small"
            >
              <v-icon start>mdi-alert</v-icon>
              Emergency
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Video Call Dialog (opens when call is initiating/ringing/connected) -->
    <v-dialog v-model="showCallDialog" fullscreen persistent transition="dialog-bottom-transition">
      <CallVideoView
        v-if="callStore.isInCall"
        @end-call="handleEndCall"
      />
    </v-dialog>

    <!-- Call error snackbar -->
    <v-snackbar
      v-model="showErrorSnackbar"
      :timeout="6000"
      color="error"
      location="bottom"
    >
      {{ callStore.error }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showErrorSnackbar = false">Dismiss</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCallStore } from '../stores/call';
import { useAuthStore } from '../stores/auth';
import type { Room } from '../types';
import CallStatusBanner from '../components/call/CallStatusBanner.vue';
import CallVideoView from '../components/call/CallVideoView.vue';

const callStore = useCallStore();
const authStore = useAuthStore();
const selectedRoom = ref<string | null>(null);

// In a real app, rooms come from the backend API
const rooms = ref<Room[]>([
  { locationId: 'room-101', roomName: 'Room 101', floor: '1st Floor', deviceStatus: 'ONLINE' },
  { locationId: 'room-102', roomName: 'Room 102', floor: '1st Floor', deviceStatus: 'ONLINE' },
  { locationId: 'room-103', roomName: 'Room 103', floor: '1st Floor', deviceStatus: 'OFFLINE' },
  { locationId: 'room-201', roomName: 'Room 201', floor: '2nd Floor', deviceStatus: 'ONLINE' },
  { locationId: 'room-202', roomName: 'Room 202', floor: '2nd Floor', deviceStatus: 'IN_CALL' },
  { locationId: 'room-203', roomName: 'Room 203', floor: '2nd Floor', deviceStatus: 'ONLINE' },
]);

const showCallDialog = computed(() => callStore.isInCall);

const showErrorSnackbar = computed({
  get: () => !!callStore.error,
  set: () => callStore.clearError(),
});

function statusColor(status: string): string {
  const map: Record<string, string> = {
    ONLINE: 'success',
    OFFLINE: 'error',
    DEGRADED: 'warning',
    IN_CALL: 'info',
  };
  return map[status] || 'grey';
}

async function startCall(locationId: string, callType: 'regular' | 'override') {
  if (!authStore.user) return;
  selectedRoom.value = locationId;

  await callStore.initiateCall(
    locationId,
    authStore.user.id,
    authStore.displayName,
    callType,
  );
}

function handleEndCall() {
  callStore.endCall();
}

onMounted(() => {
  callStore.listenForUpdates();
});
</script>

<style scoped>
.room-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.room-card:hover {
  transform: translateY(-2px);
}
.border-primary {
  border-left: 4px solid rgb(var(--v-theme-primary));
}
.border-error {
  border-left: 4px solid rgb(var(--v-theme-error));
}
.border-warning {
  border-left: 4px solid rgb(var(--v-theme-warning));
}
</style>
