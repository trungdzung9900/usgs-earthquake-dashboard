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

## Decisions

See `DECISIONS.md` for all recorded architecture decisions.
