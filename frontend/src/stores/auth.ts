import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../services/api';
import type { UserProfile } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<UserProfile | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const displayName = computed(() => user.value?.displayName || '');

  async function login(email: string, password: string) {
    const { data } = await authApi.login(email, password);
    token.value = data.accessToken;
    user.value = data.user;
    localStorage.setItem('token', data.accessToken);
  }

  async function register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) {
    const { data: res } = await authApi.register(data);
    token.value = res.accessToken;
    user.value = res.user;
    localStorage.setItem('token', res.accessToken);
  }

  async function fetchProfile() {
    if (!token.value) return;
    try {
      const { data } = await authApi.getProfile();
      user.value = data;
    } catch {
      logout();
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isAuthenticated, displayName, login, register, fetchProfile, logout };
});
