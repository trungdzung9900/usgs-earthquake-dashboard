---
name: project-stack
description: "Full stack decision — NestJS backend, React+Vite frontend"
metadata: 
  node_type: memory
  type: project
  originSessionId: 079146e6-11cd-4733-8974-2b4d069d8d92
---

Backend: Node.js with NestJS — lives in /backend.
Frontend: React with Vite — lives in /frontend.
Map: Leaflet.js + OpenStreetMap tiles (no API key).
Repo: monorepo, npm workspaces, root package.json has dev/build scripts. No Nx/Turborepo.

**How to apply:** Backend is a NestJS service that proxies USGS FDSN API calls. Frontend is a React+Vite app that renders a Leaflet map and calls the NestJS backend.

See DECISIONS.md. [[project-map-library]] [[project-area-filter]]
