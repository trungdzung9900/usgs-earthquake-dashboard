# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

USGS Earthquake Dashboard — a full-stack web application that fetches earthquake data from the USGS FDSN Event API and displays it on an interactive map with filters for area, time, and magnitude.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + NestJS (ESM, port 3000) |
| Frontend | React + Vite (port 5173) |
| Map | Leaflet.js + OpenStreetMap tiles (no API key) |
| Geocoding | Nominatim (free, no API key) |
| Data source | USGS FDSN Event API |
| Repo structure | npm workspaces monorepo (`backend/`, `frontend/`) |

## Development

```bash
# Start both servers (from repo root)
npm run dev

# Backend only
npm run start:dev --workspace=backend

# Frontend only
npm run dev --workspace=frontend
```

Backend rebuilds on file save (NestJS watch mode). Frontend uses Vite HMR.

## Architecture

```
usgs-earthquake-dashboard/
├── backend/src/
│   ├── main.ts                        # CORS (any localhost), port 3000, ValidationPipe
│   ├── app.module.ts                  # Imports EarthquakesModule + ObserveModule
│   └── earthquakes/
│       ├── earthquakes.controller.ts  # GET /earthquakes, GET /earthquakes/count
│       ├── earthquakes.service.ts     # USGS proxy + coordinate normalisation
│       └── dto/earthquake-query.dto.ts
└── frontend/src/
    ├── App.tsx                        # Root layout, filter state, sidebar toggle
    ├── api/earthquakes.ts             # fetch wrappers + TypeScript types
    ├── hooks/
    │   ├── useEarthquakes.ts          # Debounced data fetching (500ms)
    │   └── useGeocoder.ts            # Nominatim place-name search
    └── components/
        ├── MapView.tsx                # Leaflet map, circle markers, popups
        ├── FilterPanel.tsx            # Date range, magnitude slider, status
        └── SearchBar.tsx             # Place search → map flyTo
```

## Key behaviour

**Spatial filter:** The map viewport is the spatial filter. On every pan/zoom end (debounced 500ms), the visible bounds are sent as `minlatitude/maxlatitude/minlongitude/maxlongitude`.

**Coordinate normalisation (backend `buildParams`):**
- Longitude span ≥ 360° → drop both bounds (global query). Leaflet emits values like `minLon=-276, maxLon=322` when zoomed all the way out.
- `minLon > maxLon` (antimeridian wrap) → `maxLon += 360`. USGS accepts `maxlongitude` up to 360.
- Latitude clamped to `[-90, 90]`; if it covers the full range the bounds are dropped.

**20,000-event ceiling:** The service calls the USGS `count` endpoint before `query`. If `count > 20000` it throws HTTP 422 `{ error: "too_many_events", count }`. The frontend shows "Too many events — zoom in or raise magnitude."

**Place search:** Nominatim geocodes the place name → `map.flyTo(lat, lon, zoom=8)` → the new viewport triggers a fresh query. The geocoded coordinate is never sent to USGS.

**Responsive layout:**
- Desktop (> 1024px): sidebar fixed at 260px in flow
- Tablet (769–1024px): sidebar narrows to 220px
- Mobile (≤ 768px): map fills full screen, sidebar is a slide-in drawer toggled by a hamburger button

## API endpoints

```
GET /earthquakes?starttime=&endtime=&minmagnitude=&[bbox params]
GET /earthquakes/count?starttime=&endtime=&minmagnitude=&[bbox params]
```

All params are query string. `starttime` and `endtime` (ISO 8601) are required. Returns GeoJSON FeatureCollection. Frontend proxies via Vite (`/api` → `http://localhost:3000`).

## Testing

**Runner:** Vitest only — no Jest. `@testing-library/jest-dom` is a DOM assertion library, not Jest.

**Backend** (`backend/`) — Vitest 4
```bash
npm test --workspace=backend          # unit tests (*.spec.ts beside source)
npm run test:e2e --workspace=backend  # e2e tests (test/*.e2e-spec.ts, hits live USGS API)
npm run test:cov --workspace=backend  # coverage
```
- Setup file: `backend/vitest.setup.ts` — imports `reflect-metadata` (required before any NestJS-decorated class)
- Unit tests instantiate classes directly (`new EarthquakesService()`) to avoid decorator-metadata DI issues with esbuild
- Fetch is mocked via `vi.spyOn(globalThis, 'fetch')`
- `buildParams` normalisation is tested indirectly by checking the URL passed to `fetch`

**Frontend** (`frontend/`) — Vitest 5
```bash
npm test --workspace=frontend         # unit tests (src/**/*.spec.{ts,tsx})
```
- Environment: `jsdom` with `@testing-library/react`
- Setup file: `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom`
- Leaflet is fully mocked in `MapView.spec.tsx` via `vi.hoisted` + `vi.mock('leaflet', ...)`
- `useEarthquakes` debounce tests use `vi.useFakeTimers()` + `vi.runAllTimersAsync()`
- API modules mocked with `vi.mock('../api/earthquakes', ...)` where needed

**What is NOT tested here:**
- 422 too-many-events via e2e (covered by unit test; USGS count endpoint is too slow for large ranges)
- MapView Leaflet DOM rendering (Leaflet requires a real browser layout engine)

## Decisions

See `DECISIONS.md` for all recorded architecture decisions.
