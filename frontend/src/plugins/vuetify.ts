import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

/**
 * Vuetify configuration — healthcare-themed Material Design.
 */
export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'getwellLight',
    themes: {
      getwellLight: {
        dark: false,
        colors: {
          primary: '#1565C0',      // Blue — trust, healthcare
          secondary: '#00897B',    // Teal — calming
          accent: '#FF6F00',       // Amber — attention/alerts
          error: '#D32F2F',
          warning: '#F57C00',
          info: '#0288D1',
          success: '#2E7D32',
          background: '#F5F7FA',
          surface: '#FFFFFF',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'elevated', rounded: 'lg' },
    VCard: { rounded: 'lg', elevation: 2 },
    VTextField: { variant: 'outlined', density: 'comfortable' },
  },
});
