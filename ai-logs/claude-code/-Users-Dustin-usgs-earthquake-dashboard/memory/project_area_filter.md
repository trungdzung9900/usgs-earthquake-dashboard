---
name: project-area-filter
description: "Area of interest filter decision — viewport as rectangle, plus place-name search"
metadata: 
  node_type: memory
  type: project
  originSessionId: 079146e6-11cd-4733-8974-2b4d069d8d92
---

Chosen: Option A — map viewport is the spatial filter (rectangle). User pans/zooms to frame area; bounds become minlat/maxlat/minlon/maxlon on every query.

Also decided: place-name search input that geocodes a name to lat/lon and flies the map to that point, making the new viewport the active filter. Geocoded coordinate is never sent to USGS directly.

**Why:** Best exploration UX; no draw mode needed; antimeridian handling is a single backend concern (pass maxLon > 180 through as-is).

**How to apply:** Backend must handle maxLon > 180 (pass through), minLon > maxLon (add 360 to maxLon), and call count endpoint before query to guard the 20,000-event ceiling. Geocoding is a frontend/backend concern separate from USGS.

See DECISIONS.md for full context. [[project-context]]
