# Architecture Decisions

## Map Library — Leaflet.js + OpenStreetMap tiles

**Decision:** Use Leaflet.js with OpenStreetMap raster tiles.

**Reasons:** Completely free, no account or API key required, zero sign-up. Built-in zoom (scroll wheel, pinch, +/− buttons, `map.zoomIn()`/`map.zoomOut()`). Large plugin ecosystem and tutorial coverage.

**Constraints this decision carries:**

- `map.getBounds()` clamps longitude to ±180. A Pacific-spanning viewport returns `maxLon=180` not `200`, silently truncating the western half. Treat this as a known limitation for now — the majority of earthquake activity is not near 180°.
- For dense result sets, add `Leaflet.markercluster` (free plugin) to avoid marker overload.

---


## Repo Structure — Monorepo

**Decision:** Single repository with two packages under one root.

```
usgs-earthquake-dashboard/
├── backend/        # NestJS app
├── frontend/       # React + Vite app
├── package.json    # root — workspace scripts only, no shared code
└── DECISIONS.md
```

Root `package.json` uses npm workspaces to let `npm run dev` start both. No Nx or Turborepo — unnecessary complexity for an assignment.

---

## Backend — Node.js with NestJS

**Decision:** NestJS (Node.js) for the backend API server.

**Role:** Receives filter parameters from the frontend, constructs and forwards requests to the USGS FDSN API, returns GeoJSON to the frontend. Handles the `maxLon > 180` passthrough, `minLon > maxLon` correction, and the `count`-before-`query` guard.

---

## Frontend — React with Vite

**Decision:** React for UI, Vite as the build tool and dev server.

---

## Area of Interest Filter — Option A: Viewport as Rectangle

**Decision:** The map viewport is the spatial filter at all times. No draw interaction. The user pans and zooms to frame the area they want; the visible bounds become `minlatitude/maxlatitude/minlongitude/maxlongitude` on every query.

**Additionally:** A place-name search input lets the user type a location name. The name is resolved to a latitude/longitude coordinate (geocoding), and the map flies to that point, making the new viewport the active filter.

**Rejected alternatives:**
- Option B (draw a bounding box) — more UI chrome, mode-switching friction, same antimeridian complexity without the exploration benefit.
- Option C (click + radius circle) — natural for point-of-interest use but unintuitive for region-shaped areas of interest; requires users to think in kilometers.

**Constraints this decision carries:**

- Backend must detect `maxLongitude > 180` from the viewport and pass it through to the USGS API unchanged (single-call antimeridian strategy confirmed working).
- Backend must detect `minLongitude > maxLongitude` after any coordinate normalization and convert by adding 360 to `maxLongitude`.
- Returned event coordinates are always in ±180; no remapping needed for display.
- A whole-world viewport (low zoom) can exceed the 20,000-event ceiling. The backend must call the USGS `count` endpoint before `query` and reject the fetch if count > 20,000, returning a message so the frontend can prompt the user to zoom in or raise the magnitude floor.
- Place-name search requires a geocoding service (e.g., Nominatim, Mapbox Geocoding API, or similar). The geocoder is called by the frontend or backend; the result is a coordinate the map flies to — the geocoded coordinate itself is never sent to USGS directly.
