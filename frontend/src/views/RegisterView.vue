<template>
  <v-main>
    <v-container class="fill-height" fluid>
      <v-row align="center" justify="center">
        <v-col cols="12" sm="8" md="4">
          <v-card class="pa-6" elevation="8">
            <v-card-title class="text-center mb-4">
              <v-icon icon="mdi-account-plus" size="48" color="primary" />
              <div class="text-h5 mt-2 font-weight-bold">Create Account</div>
              <div class="text-subtitle-2 text-grey">GetWell RhythmX Virtual Care</div>
            </v-card-title>

            <v-form @submit.prevent="handleRegister" ref="form">
              <v-text-field
                v-model="firstName"
                label="First name"
                prepend-inner-icon="mdi-account"
                :rules="[rules.required]"
                class="mb-2"
              />
              <v-text-field
                v-model="lastName"
                label="Last name"
                prepend-inner-icon="mdi-account"
                :rules="[rules.required]"
                class="mb-2"
              />
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                :rules="[rules.required, rules.email]"
                class="mb-2"
              />
              <v-text-field
                v-model="password"
                label="Password (min 8 characters)"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
                :rules="[rules.required, rules.minLength]"
                class="mb-4"
              />

              <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable>
                {{ error }}
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="isLoading"
              >
                <v-icon start>mdi-account-plus</v-icon>
                Register
              </v-btn>
              <div class="text-center mt-4">
                <router-link to="/login" class="text-primary">Already have an account? Sign in</router-link>
              </div>
            </v-form>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
  minLength: (v: string) => (v && v.length >= 8) || 'Min 8 characters',
};

async function handleRegister() {
  isLoading.value = true;
  error.value = '';

  try {
    await auth.register({
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
      role: 'nurse',
    });
    // Wait for reactivity to update before navigation
    await nextTick();
    await router.replace({ name: 'dashboard' });
  } catch (err: any) {
    const msg = err.response?.data?.message;
    error.value = Array.isArray(msg) ? msg.join(' ') : msg || 'Registration failed';
  } finally {
    isLoading.value = false;
  }
}
</script>
