import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ── Public routes (no header/footer) ──
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { public: true },
    },

    // ── Patient route (public — no login required) ──
    {
      path: '/patient/:locationId',
      name: 'patient-room',
      component: () => import('../views/PatientRoomView.vue'),
      meta: { public: true, isPatient: true },
    },

    // ── Authenticated routes (wrapped in AppLayout with header/footer) ──
    {
      path: '/',
      component: () => import('../components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/DashboardView.vue'),
        },
      ],
    },
  ],
});

// Auth guard
router.beforeEach((to) => {
  const auth = useAuthStore();

  // Redirect to login if route (or parent) requires auth and user is not authenticated
  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login' };
  }

  // Redirect to dashboard if user is authenticated and trying to access login/register
  // (but NOT patient routes — those are always public)
  if (to.meta.public && !to.meta.isPatient && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  // Allow navigation
  return true;
});

export default router;
