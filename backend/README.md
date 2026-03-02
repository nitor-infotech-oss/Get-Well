# GetWell RhythmX — Backend

NestJS API and WebSocket server for the GetWell RhythmX Virtual Care platform.

## Quick Start

```bash
# From project root: start dependencies
docker compose up -d postgres redis

# Backend
cp .env.example .env
# Edit .env: CORS_ORIGIN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
npm install
npm run start:dev
```

See [docs/DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md) for full setup.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm run start:prod` | Run production build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:cov` | Tests with coverage |

## Key Modules

- **auth** — JWT, login, register, users
- **call-orchestration** — Digital Knock workflow, Chime integration
- **chime** — Amazon Chime SDK (CreateMeeting, CreateAttendee)
- **websocket** — Socket.IO gateway (devices, patient registration)
- **health** — Liveness / readiness probes

## Environment

Copy `.env.example` to `.env`. Required for local: `CORS_ORIGIN`, `DB_*`, `REDIS_*`. For video: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

## API Docs

When running: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger).
