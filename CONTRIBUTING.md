# Contributing to Trainelo

## Local Development Setup

### Why We Don't Use `vercel dev`

On Windows, `vercel dev` has a known bug where it returns incorrect MIME types for Vite's JavaScript modules, causing the frontend to fail. We use a custom two-server approach instead.

### Quick Start

```bash
npm run dev:full
```

This starts:
- **Vite** (frontend) on `http://127.0.0.1:8080`
- **Express API server** on `http://localhost:3001`

Vite automatically proxies `/api/*` requests to the API server.

### Access the App

1. Open `http://127.0.0.1:8080/auth`
2. Login or create an account
3. You'll be redirected to `/dashboard`

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend only (Vite on port 8080) |
| `npm run dev:api` | API server only (Express on port 3001) |
| `npm run dev:full` | Both together (recommended) |

### Testing API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Get today's recommendation
curl -X POST http://127.0.0.1:8080/api/recommendation/today \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## Adding New API Endpoints

When you create a new Vercel serverless function under `/api/`, you must also register it for local development.

### Step 1: Create the Vercel function

```
api/your/new/endpoint.ts
```

### Step 2: Register in the route registry

Open `scripts/dev/apiRoutes.ts` and add your route:

```typescript
export const API_ROUTES: ApiRoute[] = [
  // ... existing routes
  { method: "post", path: "/api/your/new/endpoint", handler: "../api/your/new/endpoint.js" },
];
```

### Step 3: Restart the dev server

```bash
# Ctrl+C to stop, then:
npm run dev:full
```

Your new route will appear in the startup log.

---

## Production Deployment

Production deployment works normally via Vercel - no special steps needed. The Express dev server is only for local development.

```bash
git push origin main
# or
vercel --prod
```

---

## Troubleshooting

### Blank dashboard page
1. Check if you're logged in (go to `/auth` first)
2. Verify both servers are running (`npm run dev:full`)
3. Check browser console for errors

### API returns 404 locally
Make sure the route is registered in `scripts/dev/apiRoutes.ts`

### Port already in use
```powershell
# Kill existing node processes
taskkill /F /IM node.exe
```
