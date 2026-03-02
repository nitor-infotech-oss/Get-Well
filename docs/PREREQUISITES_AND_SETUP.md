# Prerequisites & Setup Checklist

Short checklist for developers who need to run the GetWell RhythmX application locally. For full detail, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

---

## Prerequisites (install before starting)

| # | Requirement | Min Version | How to Verify |
|---|-------------|-------------|---------------|
| 1 | **Node.js** | 20.19+ or 22.12+ (LTS) | `node --version` |
| 2 | **npm** | 10+ | `npm --version` |
| 3 | **Docker Desktop** (or Docker Engine + Docker Compose) | Latest | `docker --version` and `docker compose version` |
| 4 | **Git** | Any recent | `git --version` |

**Optional (for Amazon Chime video/audio):** AWS CLI configured and credentials set (`aws sts get-caller-identity`). The backend needs `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env` to create Chime meetings.

---

## One-Time Setup

```bash
# 1. Clone
git clone <repo-url> GetWell && cd GetWell

# 2. Backend env
cd backend && cp .env.example .env
# Edit .env:
#   - CORS_ORIGIN=http://localhost:5173 (or http://localhost:5173,http://localhost:8080)
#   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (for Chime SDK)

# 3. Frontend env
cd ../frontend && cp .env.example .env
# Defaults work if backend runs on localhost:3000:
#   VITE_API_BASE_URL=http://localhost:3000/api
#   VITE_WS_URL=http://localhost:3000
```

---

## Run the Application

**Terminal 1 — Infrastructure (PostgreSQL + Redis):**

```bash
# From project root
docker compose up -d postgres redis

# Wait ~15s for healthy: docker ps
# Both gw-postgres and gw-redis should show "healthy"
```

**Terminal 2 — Backend:**

```bash
cd backend
npm install
npm run start:dev

# Wait for:
# - "Nest application successfully started"
# - "GetWell RhythmX Backend running on port 3000"
# - "Dev seed: created default user" or "Dev seed: reset default user password"
```

**Terminal 3 — Frontend:**

```bash
cd frontend
npm install
npm run dev

# Open http://localhost:5173
```

---

## Testing the Video Call Flow

1. **Nurse:** Open http://localhost:5173, log in with `nurse1@rhythmx.dev` / `Test1234!`
2. **Patient:** Open a **second browser tab** (or Incognito) at http://localhost:5173/patient/room-101
3. Patient page will show "Online — Waiting for calls" (green indicator)
4. From the Nurse Dashboard, select room `room-101` and click **Call**
5. Patient tab will show "Incoming Video Call" dialog — click **Accept**
6. Both sides should see video/audio; allow microphone and camera when prompted

---

## Default Login (Development)

| Email | Password |
|-------|----------|
| nurse1@rhythmx.dev | Test1234! |

Or use **Register** on the login page to create a new account.

---

## URLs Reference

| What | URL |
|------|-----|
| Nurse Console (frontend) | http://localhost:5173 |
| Patient Room (example) | http://localhost:5173/patient/room-101 |
| Backend API base | http://localhost:3000/api |
| Swagger API docs | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/health |
| WebSocket (Socket.IO) | http://localhost:3000/socket.io/ (same host as backend) |

---

## Environment Variables Summary

### Backend (`backend/.env`)

| Variable | Required | Local Default | Notes |
|----------|----------|---------------|-------|
| `CORS_ORIGIN` | Yes | `http://localhost:5173` | Must include your frontend origin |
| `DB_HOST` | Yes | `localhost` | Use `postgres` if backend runs in Docker |
| `REDIS_HOST` | Yes | `localhost` | Use `redis` if backend runs in Docker |
| `AWS_ACCESS_KEY_ID` | For Chime | — | Required for video calls |
| `AWS_SECRET_ACCESS_KEY` | For Chime | — | Required for video calls |

### Frontend (`frontend/.env`)

| Variable | Required | Local Default | Notes |
|----------|----------|---------------|-------|
| `VITE_API_BASE_URL` | Yes | `http://localhost:3000/api` | Backend API base |
| `VITE_WS_URL` | Yes | `http://localhost:3000` | Socket.IO server (same host as API for local) |

For **production** (deployed behind Nginx), `VITE_WS_URL` is left empty so the client uses the same origin (HTTPS) for WebSocket.

---

## If Something Fails

| Problem | Solution |
|---------|----------|
| **401 on login** | Restart backend so dev seed runs; use nurse1@rhythmx.dev / Test1234! |
| **CORS / network error on login** | Set `CORS_ORIGIN` in `backend/.env` to include `http://localhost:5173` and restart backend |
| **Port 3000 or 5173 in use** | Change `PORT` in backend `.env` or run Vite on another port; update `VITE_API_BASE_URL` if needed. Or kill: `lsof -ti:3000 \| xargs kill -9` |
| **Containers not healthy** | Ensure Docker is running; `docker compose up -d postgres redis` from project root |
| **Patient not getting call** | Check `VITE_WS_URL` is set to `http://localhost:3000` (Socket.IO is on backend port). Patient must have page open before nurse initiates call |
| **Chime "Failed to initialize"** | Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to `backend/.env` with Chime permissions |

Full troubleshooting: [DEVELOPER_GUIDE.md § Troubleshooting](./DEVELOPER_GUIDE.md#12-troubleshooting).
