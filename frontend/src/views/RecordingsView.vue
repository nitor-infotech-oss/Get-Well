<template>
  <v-container fluid class="pa-6">
    <v-row class="mb-4">
      <v-col>
        <h1 class="text-h4 font-weight-bold">Meeting Recordings</h1>
        <p class="text-subtitle-1 text-grey">
          View previous video call recordings with patients
        </p>
      </v-col>
    </v-row>

    <v-alert
      v-if="!hasRecordings && !loading"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      No recordings yet. Recordings are saved automatically when a video call
      ends. Ensure CHIME_RECORDING_BUCKET is configured on the backend.
    </v-alert>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="recordings"
        :loading="loading"
        :items-per-page="10"
        class="elevation-0"
      >
        <template #item.locationId="{ item }">
          <v-chip size="small" variant="tonal">
            {{ item.locationId }}
          </v-chip>
        </template>

        <template #item.startedAt="{ item }">
          {{ formatDate(item.startedAt) }}
        </template>

        <template #item.durationSeconds="{ item }">
          {{ formatDuration(item.durationSeconds) }}
        </template>

        <template #item.actions="{ item }">
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            :loading="playbackLoading === item.id"
            @click="openPlayback(item)"
          >
            <v-icon start>mdi-play-circle</v-icon>
            Play
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Playback Dialog -->
    <v-dialog
      v-model="showPlaybackDialog"
      max-width="900"
      persistent
      @click:outside="closePlayback"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-video</v-icon>
          Recording — {{ playbackMeta?.locationId ?? '—' }}
          <v-spacer />
          <v-btn icon variant="text" @click="closePlayback">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-subtitle v-if="playbackMeta">
          {{ formatDate(playbackMeta.startedAt) }}
          <span v-if="playbackMeta.durationSeconds">
            · {{ formatDuration(playbackMeta.durationSeconds) }}
          </span>
        </v-card-subtitle>
        <v-card-text>
          <RecordingPlayer v-if="playbackSegments.length" :segments="playbackSegments" />
          <v-alert v-else-if="playbackError" type="error" variant="tonal">
            {{ playbackError }}
          </v-alert>
          <v-progress-linear v-else indeterminate />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { recordingsApi, type RecordingListItem } from '../services/api';
import RecordingPlayer from '../components/recordings/RecordingPlayer.vue';

const recordings = ref<RecordingListItem[]>([]);
const loading = ref(true);
const playbackLoading = ref<string | null>(null);
const showPlaybackDialog = ref(false);
const playbackSegments = ref<{ url: string; order: number }[]>([]);
const playbackMeta = ref<RecordingListItem | null>(null);
const playbackError = ref<string | null>(null);

const hasRecordings = computed(() => recordings.value.length > 0);

const headers = [
  { title: 'Location', key: 'locationId', sortable: true },
  { title: 'Caller ID', key: 'callerId', sortable: true },
  { title: 'Started', key: 'startedAt', sortable: true },
  { title: 'Duration', key: 'durationSeconds', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, width: '120' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

async function loadRecordings() {
  loading.value = true;
  try {
    const { data } = await recordingsApi.list({ limit: 50 });
    recordings.value = data;
  } catch (err) {
    recordings.value = [];
  } finally {
    loading.value = false;
  }
}

async function openPlayback(item: RecordingListItem) {
  playbackMeta.value = item;
  playbackSegments.value = [];
  playbackError.value = null;
  showPlaybackDialog.value = true;

  playbackLoading.value = item.id;
  try {
    const { data } = await recordingsApi.getPlaybackUrls(item.id);
    playbackSegments.value = data.segments.sort((a, b) => a.order - b.order);
  } catch (err: unknown) {
    playbackError.value =
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? 'Failed to load recording';
  } finally {
    playbackLoading.value = null;
  }
}

function closePlayback() {
  showPlaybackDialog.value = false;
  playbackMeta.value = null;
  playbackSegments.value = [];
  playbackError.value = null;
}

onMounted(() => {
  loadRecordings();
});
</script>
