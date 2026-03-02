<template>
  <!-- Top Navigation Bar -->
  <v-app-bar color="primary" density="comfortable">
    <v-app-bar-title>
      <v-icon icon="mdi-hospital-building" class="mr-2" />
      GetWell RhythmX Virtual Care
    </v-app-bar-title>

    <v-btn variant="text" color="white" :to="{ name: 'dashboard' }">
      Dashboard
    </v-btn>
    <v-btn variant="text" color="white" :to="{ name: 'recordings' }">
      Recordings
    </v-btn>

    <v-spacer />

    <v-chip v-if="auth.user" variant="outlined" color="white" class="mr-3">
      <v-icon start icon="mdi-account-circle" />
      {{ auth.displayName }} ({{ auth.user.role }})
    </v-chip>

    <v-btn icon @click="handleLogout" title="Logout">
      <v-icon>mdi-logout</v-icon>
    </v-btn>
  </v-app-bar>

  <!-- Main Content — child route renders here -->
  <v-main>
    <router-view />
  </v-main>

  <!-- Bottom Status Bar -->
  <v-footer app color="grey-darken-4" class="text-caption">
    <v-icon size="x-small" :color="isBackendHealthy ? 'success' : 'error'" class="mr-1">
      mdi-circle
    </v-icon>
    {{ isBackendHealthy ? 'Backend Connected' : 'Backend Disconnected' }}
    <v-spacer />
    Phase 1 — HIPAA Compliant
  </v-footer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { connectSocket } from '../../services/socket';
import api from '../../services/api';

const auth = useAuthStore();
const router = useRouter();
const isBackendHealthy = ref(false);

// Connect WebSocket immediately during setup() — NOT in onMounted —
// so that child components (DashboardView) can register listeners
// in their own onMounted hooks without the socket being null.
connectSocket();

function handleLogout() {
  auth.logout();
  router.replace({ name: 'login' });
}

onMounted(async () => {
  await auth.fetchProfile();

  // Health check
  try {
    await api.get('/health');
    isBackendHealthy.value = true;
  } catch {
    isBackendHealthy.value = false;
  }
});
</script>
