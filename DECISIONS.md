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

---

## Frontend Cache — Superset Containment Cache

**Decision:** Cache API responses in a module-level array in `useEarthquakes.ts`. Before making a network request, check whether any cached entry's bbox fully contains the new viewport and has identical non-spatial filters (`starttime`, `endtime`, `minmagnitude`, `maxmagnitude`). On a hit, filter the cached features client-side and skip the fetch entirely.

**Reason:** When the user zooms in, the new viewport is a subset of a previously fetched area. All relevant earthquakes for that sub-area are already in memory — there is no need to call the backend at all. This eliminates the most common redundant request pattern (exploration by zooming in after a wide view).

**Rules:**
- TTL: 3 minutes — aligns with USGS near-realtime update cadence; data older than that may have new events.
- Never cache a response with ≥ 20,000 features — this is the USGS event ceiling, meaning the result may be incomplete.
- Evict oldest entries when total cached features exceed 50,000 or entry count exceeds 10 — memory guard.
- Cache is **not** invalidated on zoom-out or pan to uncovered area; those simply miss and trigger a fresh fetch which is then added to the cache.
- Cache **is** automatically bypassed when any non-spatial filter changes (different TTL bucket, different starttime/endtime/magnitude).

**Constraints this decision carries:**
- The displayed event count after a cache hit reflects the client-side filtered subset, not the USGS total — a minor cosmetic discrepancy that is acceptable.
- Zooming out beyond the largest cached bbox always fetches (new area not covered).
- Panning to a region outside all cached bboxes always fetches.

---

## Backend Cache — In-Memory Response Cache

**Decision:** Cache USGS API responses in `EarthquakesService` using a private `Map<string, { data, expiresAt }>`. The cache key is the full USGS `URLSearchParams` string, prefixed with `count:` or `query:` to namespace the two endpoints. Both `count()` and `query()` check and populate the cache independently.

**Reason (dual):**
1. **Latency:** Even when the frontend cache misses (zoom out, fresh load), the backend cache absorbs repeated identical requests (e.g., two browser tabs, rapid filter changes that revert to a prior state).
2. **Third-party protection:** USGS currently has no rate limit or per-call cost, but that could change. A backend cache decouples our call volume from upstream policy changes at zero architectural cost today.

**Rules:**
- TTL: 3 minutes — same cadence as the frontend cache so both layers expire together.
- No maximum entry count enforced. In practice the number of distinct param combinations is small (bounded by map zoom levels × filter combinations a single session produces); a production deployment that sees many users could add an LRU eviction layer if memory becomes a concern.
- Cache is per-process and in-memory only — restarts clear it, which is acceptable since the data is live and the TTL is short. Redis is explicitly deferred until there is evidence of multi-process pressure.
- 422 `too_many_events` responses are **not** cached (thrown before `setCache` is called); the count result that produced them **is** cached so a repeat count query within TTL returns instantly.
