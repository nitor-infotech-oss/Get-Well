# GetWell RhythmX Virtual Care — Developer Guide

This guide helps any developer clone, configure, and run the full application locally. Follow the steps in order.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Repository Structure](#3-repository-structure)
4. [Environment Setup](#4-environment-setup)
5. [Running the Application](#5-running-the-application)
6. [Default Login & Dev Seed](#6-default-login--dev-seed)
7. [API Documentation](#7-api-documentation)
8. [Amazon Chime SDK Integration (Audio/Video)](#8-amazon-chime-sdk-integration-audiovideo)
9. [Running Tests](#10-running-tests)
10. [Optional: AWS Resources (Minimal)](#11-optional-aws-resources-minimal)
11. [Troubleshooting](#12-troubleshooting)

---

## 1. Project Overview

GetWell RhythmX is a **Phase 1 inpatient video communication system**. Nurses use a web console to start ad-hoc video calls to a patient’s room TV; a camera device in the room joins the call via Amazon Chime SDK. The backend orchestrates the “Digital Knock” flow: create meeting → signal TV → patient Accept/Decline → signal camera to join.

| Layer        | Technology                    | Purpose                          |
|-------------|------------------------------|----------------------------------|
| Backend     | Node.js 20+, NestJS (TypeScript) | REST API, WebSocket, Chime, GetWell Stay |
| Frontend    | Vue 3, Vuetify, Pinia, Vite  | Nurse Console UI                 |
| Database    | PostgreSQL 16                | Users, call records, audit logs  |
| Cache       | Redis 7                      | Session state, device heartbeat  |
| Video       | Amazon Chime SDK (WebRTC)    | Real-time video/audio            |
| Infra (dev) | Docker Compose               | Postgres + Redis locally         |

---

## 2. Prerequisites

Install the following **before** running the app.

### Required

| Tool            | Version / Notes | How to install |
|-----------------|-----------------|----------------|
| **Node.js**     | 20.19+ or 22.12+ (LTS) | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **npm**         | 10+ (comes with Node) | — |
| **Docker**      | Latest stable   | [Docker Desktop](https://www.docker.com/products/docker-desktop) (Mac/Windows) or Docker Engine + Docker Compose on Linux |
| **Git**         | Any recent      | [git-scm.com](https://git-scm.com) |

Check versions:

```bash
node --version   # v20.19.x or v22.12.x or higher
npm --version    # 10.x or higher
docker --version
docker compose version
git --version
```

### Optional (for Chime recording / AWS deployment)

| Tool            | Purpose |
|-----------------|--------|
| **AWS CLI**     | Configure credentials for Chime SDK and S3 recording bucket |
| **Terraform**   | Deploy minimal AWS resources (S3, KMS, ECR) — see [Optional: AWS](#9-optional-aws-resources-minimal) |

---

## 3. Repository Structure

```
GetWell/
├── backend/                    # NestJS API + WebSocket
│   ├── src/
│   │   ├── common/             # Constants, enums, filters, utils
│   │   ├── config/             # Configuration, Redis, RedisModule
│   │   ├── modules/
│   │   │   ├── auth/           # JWT, login, register, users
│   │   │   ├── call-orchestration/  # Digital Knock workflow
│   │   │   ├── chime/          # Amazon Chime SDK
│   │   │   ├── getwell-stay/   # GetWell Stay API client
│   │   │   ├── websocket/      # Device gateway (Socket.IO)
│   │   │   ├── health/         # Liveness / readiness
│   │   │   └── device/         # Device entity
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # Vue 3 Nurse Console
│   ├── src/
│   │   ├── components/         # Layout, call UI, PTZ controls
│   │   ├── views/              # Login, Register, Dashboard
│   │   ├── stores/             # Pinia (auth, call)
│   │   ├── services/           # API client, Socket.IO
│   │   ├── router/
│   │   └── main.ts
│   ├── .env.example
│   └── package.json
├── infrastructure/
│   └── terraform/              # AWS (minimal + govcloud)
│       └── environments/
│           └── minimal/        # S3, KMS, ECR, IAM for dev
├── docker-compose.yml          # Postgres + Redis (+ optional backend)
├── docs/
│   └── DEVELOPER_GUIDE.md      # This file
├── project_context.md          # Product/architecture context
└── README.md
```

---

## 4. Environment Setup

### 4.1 Clone the repository

```bash
git clone <repository-url> GetWell
cd GetWell
```

### 4.2 Backend environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`. For **local development only**, you can keep defaults; only change what you need.

| Variable | Description | Local default |
|----------|-------------|----------------|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Backend HTTP port | `3000` |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | `http://localhost:5173,http://localhost:8080` |
| `JWT_SECRET` | Secret for JWT signing (use strong value in prod) | Any non-empty string |
| `DB_HOST` | PostgreSQL host | `localhost` (use `postgres` if backend runs in Docker) |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | DB user | `getwell` |
| `DB_PASSWORD` | DB password | `getwell_dev` |
| `DB_NAME` | Database name | `getwell_rhythmx` |
| `DB_SSL` | Use SSL for DB | `false` |
| `REDIS_HOST` | Redis host | `localhost` (use `redis` if backend in Docker) |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (empty if none) | (empty) |
| `CHIME_REGION` | AWS region for Chime SDK | `us-east-1` |
| `CHIME_MEETING_REGION` | Chime media region | `us-east-1` |
| `CHIME_RECORDING_BUCKET` | S3 bucket ARN for recordings | Required only if using recording |
| `CHIME_KMS_KEY_ARN` | KMS key ARN for S3 encryption | Required only if using recording |
| `GETWELL_STAY_*` | GetWell Stay API (only needed for real TV integration) | Placeholders OK for UI dev |

**Important for frontend login:** Set `CORS_ORIGIN` to include your frontend URL, e.g. `http://localhost:5173` (Vite default). Multiple origins: `http://localhost:5173,http://localhost:8080`.

### 4.3 Frontend environment

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

| Variable | Description | Local default |
|----------|-------------|----------------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3000/api` |
| `VITE_WS_URL` | WebSocket server URL (for real-time updates) | `http://localhost:3001` |

If your backend runs on a different host/port, change these accordingly.

---

## 5. Running the Application

Use two terminals (or a process manager). Backend and frontend can also run in one terminal with a tool like `concurrently` if you add it.

### 5.1 Start PostgreSQL and Redis (Docker)

From the **project root**:

```bash
docker compose up -d postgres redis
```

Wait until both are healthy (about 15–20 seconds):

```bash
docker ps
# gw-postgres and gw-redis should show "healthy"
```

### 5.2 Install backend dependencies and run backend

```bash
cd backend
npm install
npm run start:dev
```

Wait until you see:

- `Nest application successfully started`
- `GetWell RhythmX Backend running on port 3000`
- `Dev seed: created default user` or `Dev seed: reset default user password to Test1234!`

The backend will:

- Connect to Postgres and Redis
- Run TypeORM schema sync in development (create/update tables)
- In **development only**, ensure a default user exists (see [Default Login](#6-default-login--dev-seed))

Backend base URL: **http://localhost:3000**  
API prefix: **/api** (e.g. `http://localhost:3000/api/health`)

### 5.3 Install frontend dependencies and run frontend

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Vite will print something like:

- `Local:   http://localhost:5173/`
- `Network: http://<your-ip>:5173/`

Open **http://localhost:5173** in your browser.

### 5.4 Verify

| Check | URL / Action |
|-------|----------------|
| Backend liveness | [http://localhost:3000/api/health](http://localhost:3000/api/health) → `{"status":"ok"}` |
| Backend readiness (Redis) | [http://localhost:3000/api/health/ready](http://localhost:3000/api/health/ready) → `{"status":"ready","redis":"connected"}` |
| API docs | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger UI) |
| Frontend | [http://localhost:5173](http://localhost:5173) → Login page |
| Login | Use credentials from [Default Login](#6-default-login--dev-seed) |

---

## 6. Default Login & Dev Seed

In **development** (`NODE_ENV=development`), the backend runs a **dev seed** on startup:

- If user **nurse1@rhythmx.dev** does not exist → it is **created** with password **Test1234!**
- If it already exists → its password is **reset** to **Test1234!**

Use these credentials to log in from the Nurse Console:

| Field    | Value                |
|----------|----------------------|
| Email    | `nurse1@rhythmx.dev` |
| Password | `Test1234!`          |

You can also **register** a new account via the “No account? Register here” link on the login page. The dev seed does not run in production.

---

## 7. API Documentation

- **Swagger UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)  
  Explore and call all API endpoints. Use **Authorize** with a JWT from `/api/auth/login` to test protected routes.

Main endpoints:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/register` | No  | Register (nurse/admin) |
| POST   | `/api/auth/login`    | No  | Login, returns JWT |
| GET    | `/api/auth/profile`  | JWT | Current user profile |
| POST   | `/api/calls`         | JWT | Initiate call (Digital Knock) |
| POST   | `/api/calls/webhook` | No  | Patient action (ACCEPTED/DECLINED) |
| POST   | `/api/calls/:sessionId/end` | JWT | End call |
| GET    | `/api/health`        | No  | Liveness |
| GET    | `/api/health/ready`  | No  | Readiness (Redis) |

---

## 8. Amazon Chime SDK Integration (Audio/Video)

The application uses **Amazon Chime SDK** for real-time WebRTC audio and video. This section explains how it works and how to test it.

### 8.1 Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Nurse Console│────▶│   Backend    │────▶│   Amazon Chime   │
│  (Vue.js)    │     │  (NestJS)    │     │      SDK         │
└──────────────┘     └──────────────┘     └──────────────────┘
      │                     │                       │
      └──── MeetingSession ─┴────────────────────────┘
          (JoinToken, MediaPlacement)
```

**Flow:**
1. **Nurse initiates call** → Backend calls `ChimeService.createMeetingSession()` → Creates a meeting in the optimal AWS region.
2. Backend returns `meeting` and `attendee` objects with `JoinToken` to the frontend.
3. **Frontend** initializes `amazon-chime-sdk-js` → `MeetingSessionConfiguration` → `DefaultMeetingSession` → binds audio/video to DOM `<video>` elements.
4. **Patient device** (camera) also joins the same meeting using its own attendee token.
5. **Media streams** flow directly between peers via WebRTC (audio/video traffic bypasses the backend).

### 8.2 Backend Chime Implementation

**Service:** `backend/src/modules/chime/chime.service.ts`

- Uses `@aws-sdk/client-chime-sdk-meetings` (correct namespace per Amazon Chime SDK Developer Guide).
- Creates meetings with `ClientRequestToken` for idempotency.
- Supports region selection: frontend pings `/api/chime/nearest-region`, backend creates meeting in that region for optimal latency.
- Returns `MeetingSession` with:
  - `meeting.MeetingId`
  - `meeting.MediaPlacement` (signalingUrl, audioHostUrl, etc.)
  - `attendee.JoinToken`

**Endpoints:**
- `GET /api/chime/nearest-region` (public) — Returns nearest Chime media region (e.g., `us-east-1`).

### 8.3 Frontend Chime Implementation

**Composable:** `frontend/src/composables/useChimeSession.ts`

This composable encapsulates all Chime SDK logic:
- `initializeSession(meeting, attendee)` — Creates `MeetingSessionConfiguration` and `DefaultMeetingSession`.
- `startAudioVideo()` — Enumerates devices, requests permissions, binds video elements, starts audio/video.
- `stopAudioVideo()` — Stops media streams and disconnects.
- `toggleMute()` / `toggleVideo()` — Control audio and video state.
- **Observers:** Listens for `videoTileDidUpdate` events to bind remote video streams.

**Component:** `frontend/src/components/call/CallVideoView.vue`

- Displays local (nurse) and remote (patient) video streams in `<video>` elements.
- Automatically initializes Chime SDK when call status reaches `CONNECTED` or `ACCEPTED`.
- Shows "Ringing..." state while waiting for patient to accept.
- Provides mute/unmute, video on/off controls.

### 8.4 Testing Audio/Video Locally

**Prerequisites:**
- **AWS Credentials:** The backend needs valid AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) with permissions to call Chime SDK APIs (`chime:CreateMeeting`, `chime:CreateAttendee`).
- **Browser Permissions:** Chrome/Firefox will request microphone and camera access when you start a call.

**Steps:**

1. **Configure AWS credentials** in `backend/.env`:
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
   AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
   ```

2. **Restart backend**:
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Open Nurse Console** in browser: [http://localhost:5173](http://localhost:5173)

4. **Initiate a call** from the dashboard (select a room, click "Call").

5. **Browser will prompt for mic/camera permissions** → Click "Allow".

6. **Local video preview** appears in the bottom right (your camera feed).

7. **Simulate patient joining** (for testing):
   - Open a **second browser tab** (or Incognito window) at [http://localhost:5173](http://localhost:5173).
   - Log in again (or register a second user).
   - Initiate a call to the **same room** → Both tabs will join the same Chime meeting.
   - You should see the **remote video** (other tab's camera) appear in the main video area.

8. **Test controls**:
   - Click **microphone** button → Should mute/unmute audio.
   - Click **video** button → Should turn camera on/off.
   - Click **End Call** → Stops streams and closes the meeting.

**Note:** Without a real patient device (camera), use a second browser tab/window to simulate a remote participant.

### 8.5 Troubleshooting Chime SDK

**Error: "Failed to initialize Chime session"**
- Check browser console for detailed Chime SDK errors.
- Ensure AWS credentials are valid and have Chime permissions.
- Verify network allows WebRTC (UDP ports 3478, 5349; TCP 443).

**No video / audio**
- Check browser permissions (Settings → Privacy → Camera/Microphone).
- Try a different browser (Chrome/Firefox recommended; Safari can be finicky).
- Check device selection: Chime SDK auto-selects first available device.

**Remote video not showing**
- Ensure both participants are in the **same meeting** (check `meetingId` in browser console logs).
- Check WebSocket connection (`[Chime] Video tile updated` logs).
- Verify patient device or second tab successfully joined (listen for `videoTileDidUpdate` events).

**High latency / poor quality**
- Backend should create meeting in the nearest region (check `/api/chime/nearest-region`).
- Network congestion or low bandwidth → Chime SDK auto-adjusts bitrate (simulcast).

---

## 10. Running Tests

### Backend (unit tests)

```bash
cd backend
npm run test
```

With coverage:

```bash
npm run test:cov
```

### Frontend

The project uses Vite + Vue 3. Add a test runner (e.g. Vitest) if needed; there are no test scripts in `package.json` by default.

---

## 11. Optional: AWS Resources (Minimal)

To use **Amazon Chime SDK** (e.g. create meetings, optional recording to S3), you need AWS credentials and optionally a minimal set of resources.

### 11.1 AWS CLI (optional)

```bash
# macOS (Homebrew)
brew install awscli

# Configure (use your Access Key and Secret from IAM)
aws configure
# Default region: us-east-1
# Output format: json
```

Verify:

```bash
aws sts get-caller-identity
```

### 11.2 Minimal Terraform (S3, KMS, ECR)

From the repo, a **minimal** Terraform config creates only:

- S3 bucket (Chime recording, SSE-KMS)
- KMS key
- ECR repository (for backend Docker image)
- IAM policy (Chime + S3 permissions)

```bash
cd infrastructure/terraform/environments/minimal
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Then set in `backend/.env` (from Terraform outputs):

- `CHIME_RECORDING_BUCKET` = recording bucket ARN
- `CHIME_KMS_KEY_ARN` = KMS key ARN
- `CHIME_REGION` = `us-east-1`

Without these, the app still runs; only Chime recording (and possibly some Chime operations that need the bucket) will be limited.

---

## 12. Troubleshooting

### Login returns 401 “Invalid credentials”

- Ensure backend is running and **dev seed** has run (check logs for `Dev seed: created default user` or `Dev seed: reset default user password`).
- Use **nurse1@rhythmx.dev** / **Test1234!** or an account you created via **Register**.
- If you changed the default user’s password in DB manually, restart the backend so the seed resets it to **Test1234!** again (dev only).

### Login fails with network / CORS error

- Backend `CORS_ORIGIN` must include the exact frontend origin, e.g. `http://localhost:5173`.
- Use comma-separated list for multiple: `http://localhost:5173,http://localhost:8080`.
- Restart the backend after changing `.env`.

### Port 3000 or 5173 already in use

- Stop the process using the port, or change port in backend (`.env` `PORT`) or frontend (Vite config / `npm run dev -- --port 5174`).
- On Mac/Linux, find and kill: `lsof -ti:3000 | xargs kill -9`

### Docker: Postgres or Redis not healthy

- Ensure Docker Desktop (or Docker Engine) is running.
- Run: `docker compose up -d postgres redis` from project root.
- Check: `docker ps` and wait until health status is “healthy”.
- If you change DB credentials, ensure `backend/.env` matches `docker-compose.yml` (user, password, database name).

### Backend: “REDIS_CLIENT” or dependency injection errors

- The app uses a global `RedisModule`; ensure you didn’t remove or duplicate the Redis provider. If you see “REDIS_CLIENT” in error messages, check `config/redis.module.ts` and `app.module.ts` (RedisModule imported, no duplicate REDIS_CLIENT in AppModule providers).

### Frontend: “Cannot reach server” or blank after login

- Confirm backend is up: [http://localhost:3000/api/health](http://localhost:3000/api/health).
- Confirm `frontend/.env`: `VITE_API_BASE_URL=http://localhost:3000/api` (no trailing slash).
- Restart the frontend dev server after changing `.env`.

### Node version warning (Vite)

- Frontend expects Node **20.19+** or **22.12+**. If you see a version warning, upgrade Node (e.g. `nvm install 20` and `nvm use 20`) or use the version in `frontend/package.json` engines.

---

## Quick Reference: Commands Summary

```bash
# 1. From project root: start DB and cache
docker compose up -d postgres redis

# 2. Backend
cd backend && cp .env.example .env
# Edit .env (at least CORS_ORIGIN for frontend URL)
npm install && npm run start:dev

# 3. Frontend (new terminal)
cd frontend && cp .env.example .env
# Edit .env if backend not on localhost:3000
npm install && npm run dev

# 4. Open
# Frontend: http://localhost:5173
# API docs:  http://localhost:3000/api/docs
# Login:     nurse1@rhythmx.dev / Test1234!
```

---

*For product and architecture context, see `project_context.md` and `README.md` in the repository root.*
