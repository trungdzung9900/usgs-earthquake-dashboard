---
name: project-map-library
description: "Map library decision — Leaflet.js with OpenStreetMap tiles, no account required"
metadata: 
  node_type: memory
  type: project
  originSessionId: 079146e6-11cd-4733-8974-2b4d069d8d92
---

Chosen: Leaflet.js + OpenStreetMap raster tiles. Completely free, no API key, no signup.

**Why:** Assignment project; zero friction setup; built-in zoom; massive tutorial coverage.

**How to apply:** Use Leaflet for all map work. `map.getBounds()` clamps to ±180 — antimeridian truncation is a known accepted limitation. Add Leaflet.markercluster if marker density becomes a problem.

See DECISIONS.md. [[project-area-filter]]
