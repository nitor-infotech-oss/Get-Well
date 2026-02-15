<template>
  <v-card color="grey-darken-3" class="pa-3">
    <v-card-title class="text-caption text-center text-grey-lighten-1 pa-0 mb-2">
      <v-icon size="small" class="mr-1">mdi-camera-control</v-icon>
      PTZ Camera Controls
    </v-card-title>

    <!-- Directional Pad -->
    <div class="d-flex flex-column align-center">
      <!-- Up -->
      <v-btn
        icon="mdi-chevron-up"
        size="small"
        variant="tonal"
        color="white"
        @mousedown="sendPtz('tilt_up')"
        @mouseup="stopPtz"
        class="mb-1"
      />

      <!-- Left / Home / Right -->
      <div class="d-flex ga-1">
        <v-btn
          icon="mdi-chevron-left"
          size="small"
          variant="tonal"
          color="white"
          @mousedown="sendPtz('pan_left')"
          @mouseup="stopPtz"
        />
        <v-btn
          icon="mdi-home"
          size="small"
          variant="tonal"
          color="primary"
          @click="sendPtz('home')"
        />
        <v-btn
          icon="mdi-chevron-right"
          size="small"
          variant="tonal"
          color="white"
          @mousedown="sendPtz('pan_right')"
          @mouseup="stopPtz"
        />
      </div>

      <!-- Down -->
      <v-btn
        icon="mdi-chevron-down"
        size="small"
        variant="tonal"
        color="white"
        @mousedown="sendPtz('tilt_down')"
        @mouseup="stopPtz"
        class="mt-1"
      />
    </div>

    <!-- Zoom -->
    <div class="d-flex justify-center ga-2 mt-3">
      <v-btn
        icon="mdi-minus"
        size="small"
        variant="tonal"
        color="white"
        @mousedown="sendPtz('zoom_out')"
        @mouseup="stopPtz"
      />
      <v-chip size="small" variant="text" class="text-grey-lighten-1">Zoom</v-chip>
      <v-btn
        icon="mdi-plus"
        size="small"
        variant="tonal"
        color="white"
        @mousedown="sendPtz('zoom_in')"
        @mouseup="stopPtz"
      />
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { sendPtzCommand } from '../../services/socket';
import { useCallStore } from '../../stores/call';

const callStore = useCallStore();

function sendPtz(command: string) {
  if (!callStore.locationId) return;
  // deviceId derived from locationId for now
  sendPtzCommand(`device-${callStore.locationId}`, command, 50);
}

function stopPtz() {
  // In production: send a "stop" command to halt continuous movement
}
</script>
