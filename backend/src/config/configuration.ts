/**
 * Centralized configuration loader.
 * All secrets should come from AWS Secrets Manager in production.
 * .env files are for local development only.
 */
export default () => ({
  // ── Application ──
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    jwtSecret: process.env.JWT_SECRET || 'getwell-dev-secret-change-in-prod',
  },

  // ── PostgreSQL ──
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'getwell',
    password: process.env.DB_PASSWORD || 'getwell_dev',
    name: process.env.DB_NAME || 'getwell_rhythmx',
    ssl: process.env.DB_SSL === 'true',
  },

  // ── Redis (session state, caching for <2s latency) ──
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  },

  // ── Amazon Chime SDK ──
  chime: {
    region: process.env.CHIME_REGION || 'us-east-1',
    /** For GovCloud: use us-gov-west-1 */
    meetingRegion: process.env.CHIME_MEETING_REGION || 'us-east-1',
    /** S3 bucket for media capture pipeline recordings */
    recordingBucket: process.env.CHIME_RECORDING_BUCKET || '',
    /** KMS Key ARN for S3 encryption at rest */
    kmsKeyArn: process.env.CHIME_KMS_KEY_ARN || '',
  },

  // ── GetWell Stay API ──
  getwellStay: {
    baseUrl: process.env.GETWELL_STAY_BASE_URL || 'https://api.getwellnetwork.com',
    clientId: process.env.GETWELL_STAY_CLIENT_ID || '',
    clientSecret: process.env.GETWELL_STAY_CLIENT_SECRET || '',
    /** OAuth2 token endpoint */
    tokenEndpoint: process.env.GETWELL_STAY_TOKEN_ENDPOINT || '/oauth/token',
  },

  // ── WebSocket ──
  websocket: {
    port: parseInt(process.env.WS_PORT || '3001', 10),
    cors: {
      origin: process.env.WS_CORS_ORIGIN || '*',
    },
  },
});
