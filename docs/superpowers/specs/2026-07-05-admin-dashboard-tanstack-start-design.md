# Admin Dashboard TanStack Start Design

Date: 2026-07-05

## Goal

Move the current PalmGate admin dashboard from one vanilla HTML/CSS/JS page to a separate TanStack Start frontend while keeping FastAPI as the backend API.

The first version must preserve the current UI and behavior, then add only:

- better access logs: search/filter, date range, CSV export;
- user management: edit NIM/name and safer delete.

## Chosen Approach

Use a thin TanStack Start app in `frontend/` and keep FastAPI API-only.

```text
frontend/                  TanStack Start UI service
app/                       FastAPI API service
  routes/                  existing /api routes
```

Development runs two processes:

- TanStack Start dev server for the dashboard;
- `uvicorn app.main:app` for `/api/*`, MJPEG preview, and SSE.

The frontend proxies API calls to FastAPI in development. Production also runs two services.

Rejected approaches:

1. TanStack server functions/BFF: adds a second backend layer without enough benefit.
2. Full admin redesign: higher risk and not requested; preserve the current camera-first UI instead.

## Frontend Structure

Use the current three-tab layout: `Scan`, `Register`, `Log`.

```text
frontend/
  app/
    routes/
      __root.tsx
      index.tsx
    components/
      AppHeader.tsx
      NavTabs.tsx
      ScanPanel.tsx
      RegisterPanel.tsx
      LogPanel.tsx
      UserList.tsx
    lib/
      api.ts
      store.ts
      camera.ts
      mediapipe.ts
      registration.ts
```

Use Zustand for shared UI state:

- app state: current tab, USB mode, dev features, device status;
- scan state: auto/manual mode, busy flag, stats, latest result;
- registration state: selected hands, mode, sample counts, guidance;
- log state: search, status filter, date range, page.

Keep browser-only objects local to components/hooks, not in Zustand:

- `MediaStream`;
- `EventSource`;
- video/canvas element refs;
- uploaded file/base64 arrays.

## Backend API Changes

Keep all current endpoints and add the smallest endpoints required by the new features.

### User edit

```http
PATCH /api/users/{user_id}
Content-Type: application/json

{ "nim": "...", "name": "..." }
```

Rules:

- trim both fields;
- reject empty NIM or name;
- reject duplicate NIM;
- preserve embeddings;
- preserve historical access logs.

### Log filtering

Extend existing log endpoints:

```http
GET /api/logs?limit=&offset=&q=&status=&start_date=&end_date=
GET /api/logs/count?q=&status=&start_date=&end_date=
GET /api/logs/export.csv?q=&status=&start_date=&end_date=
```

Rules:

- `q` searches matched name, description, and current user NIM when `user_id` still points to a user;
- `status` accepts `ALLOWED` or `DENIED`;
- `start_date` and `end_date` use native `YYYY-MM-DD` values;
- CSV export returns the current filtered rows using Python stdlib `csv`.

## UI Behavior

### Scan

The Scan tab keeps the current behavior:

- browser mode uses webcam and client MediaPipe hand guidance;
- USB mode uses `/api/device-registration/preview.mjpg` and `/api/device-registration/scan-events`;
- manual/auto scan submits base64 images to `/api/recognize`;
- result card, ROI preview in dev mode, device status, and mini stats stay equivalent.

### Register

The Register tab keeps the guided registration flow:

- NIM and full name are required;
- user chooses left, right, or both hands;
- each selected hand captures 5 samples;
- browser mode uses client MediaPipe guidance;
- USB mode polls `/api/device-registration/status` and finalizes through existing USB endpoints;
- upload registration remains dev-only and uses the existing `/api/register` path.

### Logs

The Log tab adds controls above the existing table:

- search input;
- status select: all, allowed, denied;
- native start/end date inputs;
- CSV export button.

Changing a filter resets pagination to page 1. Refresh reloads both count and current page. CSV export downloads exactly the filtered rows.

### Users

The enrolled users section moves into React.

User edit:

- opens a small inline form or modal;
- edits only NIM and full name;
- reloads users after save.

Safer delete:

- confirmation names the user;
- explains that historical logs stay but lose the user link;
- requires typing the user's NIM before deletion;
- reloads users and logs after delete.

## Error Handling

- API helpers surface FastAPI `detail` messages.
- Camera or MediaPipe failure falls back to manual scan like today.
- Log/user failures show inline errors, not browser alerts.
- Edit/delete failures reload users so the UI does not lie.
- CSV export failure shows an error and does not download a partial file.

## Security Boundary

No authentication is added in this iteration by product choice.

This is acceptable only for localhost or a trusted LAN demo. Do not expose edit/delete/export actions publicly without adding authentication first.

## Tests

Backend tests:

- updating a user trims fields, rejects empty values, rejects duplicate NIM, and preserves embeddings;
- log list/count/export use the same filters for search, status, and date range.

Frontend checks:

- Zustand log filter changes reset the page;
- the TanStack dev proxy reaches FastAPI;
- manual run verifies the Scan, Register, and Log tabs render and call the expected APIs.

## Out of Scope

- Authentication/login.
- Re-enrolling an existing user.
- Per-user hand/template detail pages.
- Charts and summary cards.
- TanStack server functions/BFF.
- Full browser E2E tests.
