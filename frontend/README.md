# GetWell RhythmX — Frontend

Vue 3 Nurse Console and Patient Room UI. Built with Vite, Vuetify, Pinia.

## Quick Start

```bash
# From project root: ensure backend + postgres + redis are running
cp .env.example .env
# Defaults: VITE_API_BASE_URL=http://localhost:3000/api, VITE_WS_URL=http://localhost:3000
npm install
npm run dev
```

Open http://localhost:5173. See [docs/DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md) for full setup.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (Vite) |
| `npm run build` | Production build |
| `npm run type-check` | TypeScript check |
| `npm run preview` | Preview production build |

## Key Routes

- `/login` — Nurse login
- `/register` — Nurse registration
- `/` — Dashboard (after login)
- `/patient/:locationId` — Patient room (e.g. `/patient/room-101`)

## Environment

| Variable | Local | Production |
|----------|-------|------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | `/api` (relative) |
| `VITE_WS_URL` | `http://localhost:3000` | '' (empty → same origin) |

## Libraries

- Vue 3, Vue Router, Pinia
- Vuetify 3
- Vite 7
- amazon-chime-sdk-js (WebRTC)
- socket.io-client
- axios
