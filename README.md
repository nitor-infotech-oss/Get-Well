# GetWell RhythmX Virtual Care Platform

**Phase 1 — Inpatient Video Communication System**

A HIPAA-compliant, real-time video platform that enables nurses to initiate ad-hoc bi-directional video calls from a web console to a patient's room TV via a dedicated camera device.

---

## For developers: running the application

**New to this codebase?** Use the guides in the `docs/` folder:

| Document | Purpose |
|----------|---------|
| **[docs/PREREQUISITES_AND_SETUP.md](docs/PREREQUISITES_AND_SETUP.md)** | Prerequisites checklist and minimal run steps |
| **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** | Full developer guide: env vars, running backend/frontend, default login, tests, optional AWS, troubleshooting |

**Quick start:** Install Node 20+, Docker, then from project root run `docker compose up -d postgres redis`, start backend (`cd backend && npm install && npm run start:dev`), then frontend (`cd frontend && npm install && npm run dev`). Login at http://localhost:5173 with **nurse1@rhythmx.dev** / **Test1234!** (dev seed). See the docs above for details.

---

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────────────────────────────┐     ┌──────────────────┐
│  Nurse Console   │────▶│         NestJS Backend (Orchestrator)    │────▶│  Camera Device   │
│  (Vue/Vuetify)   │     │                                          │     │  (Kiosk/Android) │
│  (Vite)          │◀────│  ┌─────────────┐  ┌──────────────────┐  │◀────│  PTZ + IR + HDMI │
└──────────────────┘     │  │ Chime Module │  │ Call Orchestrator │  │     └──────────────────┘
        │                │  └──────┬──────┘  └────────┬─────────┘  │              │
        │                │         │                  │             │              │
        │                │  ┌──────▼──────┐  ┌────────▼─────────┐  │              │
        │                │  │  AWS Chime   │  │  GetWell Stay    │  │              │
        │                │  │  SDK (WebRTC)│  │  API Integration │  │              │
        │                │  └─────────────┘  └──────────────────┘  │              │
        │                │         │                  │             │              │
        │                │  ┌──────▼──────┐  ┌────────▼─────────┐  │              │
        │                │  │  Redis       │  │  WebSocket GW    │──┼──────────────┘
        │                │  │  (Sessions)  │  │  (Device Signal) │  │
        │                │  └─────────────┘  └──────────────────┘  │
        │                └──────────────────────────────────────────┘
        │                                     │
        └─────── Amazon Chime WebRTC ─────────┘
```

## The "Digital Knock" Workflow

1. **Nurse clicks "Call"** → Backend creates Chime Meeting + Attendee
2. **Backend signals TV** → `POST /start_call` to GetWell Stay API
3. **TV shows prompt** → "Incoming Call from [Nurse Name]"
4. **Patient responds** → TV webhooks back to Backend
   - **ACCEPTED** → WebSocket signal to Camera → Camera joins Chime meeting
   - **DECLINED** → Tear down meeting, notify Nurse
   - **OVERRIDE** → Camera auto-joins (emergency, no patient prompt)
5. **Call ends** → Backend → `POST /end_call` → TV restores via HDMI-CEC

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js / NestJS (TypeScript) | Orchestration, API, WebSocket |
| **Video** | Amazon Chime SDK (WebRTC) | Real-time video/audio |
| **Database** | PostgreSQL | Relational data |
| **Cache** | Redis | Session state (<2s latency) |
| **Frontend** | Vue 3 / Vuetify / Pinia / Vite | Nurse Console |
| **Hardware** | Android/Linux Camera Kiosk | PTZ, IR, HDMI-CEC |
| **Infrastructure** | AWS GovCloud, Docker | FedRAMP Moderate |

## Project Structure

```
GetWell/
├── backend/                          # NestJS Backend
│   ├── src/
│   │   ├── common/                   # Constants, enums, filters, utils
│   │   ├── config/                   # Configuration, Redis module
│   │   ├── modules/
│   │   │   ├── auth/                 # JWT, login, register, users
│   │   │   ├── call-orchestration/   # Digital Knock workflow
│   │   │   ├── chime/                # Amazon Chime SDK
│   │   │   ├── getwell-stay/         # GetWell Stay API client
│   │   │   ├── websocket/            # Device signaling (Socket.IO)
│   │   │   ├── health/               # Liveness/readiness
│   │   │   └── device/               # Device entity
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/                         # Vue 3 Nurse Console (Vite, Vuetify, Pinia)
│   ├── src/
│   │   ├── components/              # Layout, call UI, PTZ controls
│   │   ├── views/                   # Login, Register, Dashboard
│   │   ├── stores/                  # Auth, call state
│   │   └── services/                # API client, Socket.IO
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── DEVELOPER_GUIDE.md            # Full developer runbook
│   └── PREREQUISITES_AND_SETUP.md    # Prerequisites & setup checklist
├── infrastructure/terraform/        # AWS (minimal + govcloud)
├── docker-compose.yml                # Postgres, Redis, optional backend
├── project_context.md                # Product/architecture context
├── .cursorrules                      # AI architect rules
└── README.md
```

## Quick Start

See **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** for full steps. Summary:

- **Prerequisites:** Node.js 20.19+ (or 22.12+), Docker & Docker Compose, Git.
- **Backend:** Copy `backend/.env.example` → `backend/.env`, set `CORS_ORIGIN=http://localhost:5173`, then `npm install` and `npm run start:dev`.
- **Infrastructure:** From project root, `docker compose up -d postgres redis`.
- **Frontend:** Copy `frontend/.env.example` → `frontend/.env`, then `npm install` and `npm run dev`. Open http://localhost:5173.
- **Login (dev):** `nurse1@rhythmx.dev` / `Test1234!` (created automatically in development).
- **API docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register (nurse/admin) |
| `POST` | `/api/auth/login` | Login (returns JWT) |
| `GET`  | `/api/auth/profile` | Current user (JWT) |
| `POST` | `/api/calls` | Initiate a call (Digital Knock) |
| `POST` | `/api/calls/webhook` | Patient action webhook (ACCEPTED/DECLINED) |
| `POST` | `/api/calls/:sessionId/end` | End an active call |
| `GET`  | `/api/health` | Liveness probe |
| `GET`  | `/api/health/ready` | Readiness probe (checks Redis) |

Full API docs: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger).

## Success Metrics

| Metric | Target |
|--------|--------|
| Time-to-connect | < 2 seconds median |
| Call setup success | >= 99.9% |
| Video uptime | >= 99.99% |
| Video quality | 1080p FHD |
| Compliance | HIPAA / FedRAMP Moderate |

## Security & Compliance

- **No PHI in logs** — Only anonymized `meetingId` / `locationId`
- **Encryption in transit** — TLS 1.2+ enforced
- **Encryption at rest** — S3 recordings use SSE-KMS
- **Audit trails** — Every call event logged for HIPAA
- **OAuth2** — GetWell Stay API auth via Client Credentials
- **Secrets** — AWS Secrets Manager (never in code)

## License

Proprietary — Nitor Infotech / GetWell Network
