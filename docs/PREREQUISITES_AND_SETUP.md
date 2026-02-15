# Prerequisites & Setup Checklist

Short checklist for developers who need to run the GetWell RhythmX application. For full detail, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

---

## Prerequisites (install before starting)

| # | Requirement | How to verify |
|---|-------------|----------------|
| 1 | **Node.js 20.19+** or **22.12+** | `node --version` |
| 2 | **npm 10+** | `npm --version` |
| 3 | **Docker Desktop** (or Docker Engine + Docker Compose) | `docker --version` and `docker compose version` |
| 4 | **Git** | `git --version` |

Optional for Chime/AWS: **AWS CLI** configured (`aws sts get-caller-identity`).

---

## One-time setup

```bash
# 1. Clone
git clone <repo-url> GetWell && cd GetWell

# 2. Backend env
cd backend && cp .env.example .env
# Set CORS_ORIGIN=http://localhost:5173,http://localhost:8080 (or your frontend URL)

# 3. Frontend env
cd ../frontend && cp .env.example .env
# Defaults are fine if backend runs on localhost:3000
```

---

## Run the application

**Terminal 1 — infrastructure:**

```bash
docker compose up -d postgres redis
# Wait ~15s for healthy: docker ps
```

**Terminal 2 — backend:**

```bash
cd backend
npm install
npm run start:dev
# Wait for "Backend running on port 3000" and "Dev seed..."
```

**Terminal 3 — frontend:**

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Default login (development)

| Email | Password |
|-------|----------|
| nurse1@rhythmx.dev | Test1234! |

Or use **Register** on the login page to create a new account.

---

## URLs

| What | URL |
|------|-----|
| Nurse Console (frontend) | http://localhost:5173 |
| Backend API base | http://localhost:3000/api |
| Swagger API docs | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/health |

---

## If something fails

- **401 on login:** Restart backend so dev seed runs; use nurse1@rhythmx.dev / Test1234!
- **CORS / network error on login:** Set `CORS_ORIGIN` in `backend/.env` to include `http://localhost:5173` and restart backend.
- **Port in use:** Change `PORT` in backend `.env` or use another port for Vite; update frontend `VITE_API_BASE_URL` if needed.
- **Containers not healthy:** Ensure Docker is running; run `docker compose up -d postgres redis` from project root.

Full troubleshooting: [DEVELOPER_GUIDE.md § 10. Troubleshooting](./DEVELOPER_GUIDE.md#10-troubleshooting).
