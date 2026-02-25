# GetWell RhythmX Virtual Care Platform

**Phase 1 — Inpatient Video Communication System**

A real-time video platform that enables nurses to initiate ad-hoc bi-directional video calls from a web console to a patient's room. In the POC, both the nurse and patient use web browsers; the patient receives incoming call notifications via WebSocket and joins the Chime meeting directly.

---

## Documentation Index

**New to this codebase?** Start here:

| Document | Purpose |
|----------|---------|
| **[docs/PREREQUISITES_AND_SETUP.md](docs/PREREQUISITES_AND_SETUP.md)** | Prerequisites checklist, one-time setup, run commands, default login, troubleshooting quick ref |
| **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** | Full developer runbook: project overview, env vars, running backend/frontend, Chime SDK, tests, libraries, troubleshooting |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | AWS deployment: Terraform (aws-poc), Docker Compose prod, GitHub Actions CI/CD, secrets, manual deploy |
| **[project_context.md](project_context.md)** | Product context, workflow, API specs, Chime rules, security |

**Quick start:** Install Node 20+, Docker, then from project root run `docker compose up -d postgres redis`, start backend (`cd backend && npm install && npm run start:dev`), then frontend (`cd frontend && npm install && npm run dev`). Login at http://localhost:5173 with **nurse1@rhythmx.dev** / **Test1234!**. Open a second browser tab at **http://localhost:5173/patient/room-101** to simulate the patient side. See the docs for details.

---

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────────────────────────────┐     ┌──────────────────┐
│  Nurse Console   │────▶│         NestJS Backend (Orchestrator)    │────▶│  Patient Browser │
│  (Vue/Vuetify)   │     │                                          │     │  (WebRTC Client) │
│  (Vite)          │◀────│  ┌─────────────┐  ┌──────────────────┐  │◀────│  /patient/:room  │
└──────────────────┘     │  │ Chime Module │  │ Call Orchestrator │  │     └──────────────────┘
        │                │  └──────┬──────┘  └────────┬─────────┘  │              │
        │                │         │                  │             │              │
        │                │  ┌──────▼──────┐  ┌────────▼─────────┐  │              │
        │                │  │  AWS Chime   │  │  WebSocket GW   │──┼──────────────┘
        │                │  │  SDK (WebRTC)│  │  (Socket.IO)    │  │  incoming_call
        │                │  └─────────────┘  │  register_patient │  │  call_ended
        │                │         │         └──────────────────┘  │
        │                │  ┌──────▼──────┐  ┌──────────────────┐  │
        │                │  │  Redis       │  │  GetWell Stay     │  │
        │                │  │  (Sessions)  │  │  (optional)       │  │
        │                │  └─────────────┘  └──────────────────┘  │
        │                └──────────────────────────────────────────┘
        │                                     │
        └─────── Amazon Chime WebRTC ─────────┘
```

## The "Digital Knock" Workflow (POC — Nurse ↔ Patient Browser)

1. **Nurse clicks "Call"** on room (e.g. room-101) → Backend creates Chime Meeting + Attendee
2. **Backend emits WebSocket** `incoming_call` to patient(s) registered for that room
3. **Patient browser** (open at `/patient/room-101`) receives the notification and shows "Incoming Video Call" dialog
4. **Patient responds:**
   - **ACCEPT** → Patient browser calls `POST /api/calls/patient-accept` → Backend creates patient attendee → Patient joins Chime meeting directly (video/audio via WebRTC)
   - **DECLINE** → Patient calls `POST /api/calls/patient-decline` → Backend tears down meeting, notifies nurse
5. **Call ends** → Nurse or patient ends call → Backend tears down Chime meeting, notifies both sides

*(Production flow also supports GetWell Stay TV webhooks and camera devices; POC focuses on browser-to-browser.)*

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js 20+ / NestJS (TypeScript) | REST API, WebSocket (Socket.IO), Chime orchestration |
| **Frontend** | Vue 3 / Vuetify / Pinia / Vite | Nurse Console + Patient Room UI |
| **Video/Audio** | Amazon Chime SDK (WebRTC) | Real-time video/audio |
| **Database** | PostgreSQL 16 | Users, call records, audit logs |
| **Cache** | Redis 7 | Session state, device heartbeat |
| **Deployment** | Docker, Nginx, EC2, GitHub Actions | POC on AWS |

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
│   │   │   ├── getwell-stay/         # GetWell Stay API client (optional)
│   │   │   ├── websocket/            # Device/patient signaling (Socket.IO)
│   │   │   ├── health/               # Liveness/readiness
│   │   │   └── device/               # Device entity
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── frontend/                         # Vue 3 Nurse Console + Patient Room
│   ├── src/
│   │   ├── components/               # Layout, call UI, PTZ controls
│   │   ├── views/                   # Login, Register, Dashboard, PatientRoomView
│   │   ├── stores/                  # Auth, call state
│   │   ├── services/                # API client, Socket.IO
│   │   └── composables/             # useChimeSession (Chime SDK)
│   ├── Dockerfile
│   ├── nginx.conf                   # Production (HTTPS, WebSocket proxy)
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── DEVELOPER_GUIDE.md            # Full developer runbook
│   ├── PREREQUISITES_AND_SETUP.md    # Prerequisites & setup checklist
│   └── DEPLOYMENT.md                 # AWS deployment & CI/CD
├── infrastructure/
│   ├── aws-poc/                      # Terraform: EC2, VPC, Security Group, IAM
│   └── terraform/                   # GovCloud (legacy)
├── .github/workflows/deploy.yml      # CI/CD: test + deploy to EC2
├── docker-compose.yml               # Local dev: Postgres, Redis
├── docker-compose.prod.yml          # Production: Postgres, Redis, Backend, Frontend (Nginx)
├── project_context.md               # Product/architecture context
└── README.md
```

## Quick Start (Local Development)

See **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** for full steps. Summary:

- **Prerequisites:** Node.js 20.19+ (or 22.12+), Docker & Docker Compose, Git.
- **Backend:** Copy `backend/.env.example` → `backend/.env`, set `CORS_ORIGIN=http://localhost:5173`, add AWS credentials for Chime. Run `npm install` and `npm run start:dev`.
- **Infrastructure:** From project root, `docker compose up -d postgres redis`.
- **Frontend:** Copy `frontend/.env.example` → `frontend/.env` (defaults point to localhost:3000). Run `npm install` and `npm run dev`. Open http://localhost:5173.
- **Login (dev):** `nurse1@rhythmx.dev` / `Test1234!` (created automatically in development).
- **Patient:** Open http://localhost:5173/patient/room-101 in a second tab; when nurse calls room-101, patient will see the incoming call dialog.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | No | Register (nurse/admin) |
| `POST` | `/api/auth/login` | No | Login (returns JWT) |
| `GET`  | `/api/auth/profile` | JWT | Current user profile |
| `POST` | `/api/calls` | JWT | Initiate a call |
| `POST` | `/api/calls/patient-accept` | No | Patient accepts call (browser) |
| `POST` | `/api/calls/patient-decline` | No | Patient declines call |
| `POST` | `/api/calls/webhook` | No | Patient action webhook (TV) |
| `POST` | `/api/calls/:sessionId/end` | JWT | End an active call |
| `GET`  | `/api/chime/nearest-region` | No | Nearest Chime media region |
| `GET`  | `/api/health` | No | Liveness probe |
| `GET`  | `/api/health/ready` | No | Readiness probe (checks Redis) |

Full API docs: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger).

## Deployment (AWS POC)

The application can be deployed to AWS using Terraform (EC2 + Docker Compose) and GitHub Actions for CI/CD. See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for full instructions.

- **Nurse Console:** https://&lt;EC2_IP&gt;
- **Patient Room:** https://&lt;EC2_IP&gt;/patient/room-101
- **HTTPS:** Self-signed certificate (browser will show "Not Secure" — accept for demo)

## License

Proprietary — Nitor Infotech / GetWell Network
