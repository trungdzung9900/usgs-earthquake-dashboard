---
name: testing
description: Run, write, and debug tests for the USGS Earthquake Dashboard monorepo (Vitest, backend + frontend)
---

# Testing skill

## Test runners

| Workspace | Runner | Config |
|---|---|---|
| `backend/` | Vitest 4 | `backend/vitest.config.ts` (unit), `backend/vitest.config.e2e.ts` (e2e) |
| `frontend/` | Vitest 5 | `frontend/vitest.config.ts` |

No Jest anywhere. `@testing-library/jest-dom` is a DOM assertion library — the name is historical.

## Commands

```bash
# Run all unit tests
npm test --workspace=backend
npm test --workspace=frontend

# Backend e2e (hits live USGS API — requires network)
npm run test:e2e --workspace=backend

# Watch mode
npm run test:watch --workspace=backend
npm run test:watch --workspace=frontend

# Coverage
npm run test:cov --workspace=backend
```

## File layout

```
backend/
├── vitest.setup.ts                              # imports reflect-metadata
├── vitest.config.ts                             # unit: src/**/*.spec.ts
├── vitest.config.e2e.ts                         # e2e:  test/**/*.e2e-spec.ts
├── src/earthquakes/
│   ├── earthquakes.service.spec.ts
│   ├── earthquakes.controller.spec.ts
│   └── dto/earthquake-query.dto.spec.ts
└── test/
    └── app.e2e-spec.ts

frontend/
├── vitest.config.ts                             # jsdom, src/**/*.spec.{ts,tsx}
└── src/
    ├── test/setup.ts                            # imports @testing-library/jest-dom
    ├── App.spec.tsx
    ├── api/earthquakes.spec.ts
    ├── hooks/
    │   ├── useEarthquakes.spec.ts
    │   └── useGeocoder.spec.ts
    └── components/
        ├── FilterPanel.spec.tsx
        ├── MapView.spec.tsx
        └── SearchBar.spec.tsx
```

## Backend patterns

### reflect-metadata
`vitest.setup.ts` loads `reflect-metadata` before every test file. Required because NestJS
decorators (`@Injectable`, `@Controller`, etc.) call `Reflect.defineMetadata` at import time.
Without it the decorators throw.

### Instantiate directly — don't use the DI container for unit tests
esbuild (Vitest's default transform) does not emit `design:paramtypes` metadata, so
NestJS cannot resolve constructor-injected dependencies from types alone.
Avoid `Test.createTestingModule` for unit tests; instantiate directly:

```typescript
// Good
const service = new EarthquakesService()
const controller = new EarthquakesController(mockService as any)

// Avoid for unit tests — DI resolution fails without emitDecoratorMetadata
const module = await Test.createTestingModule({ providers: [EarthquakesService] }).compile()
```

`Test.createTestingModule` is fine in e2e tests where you pass `useValue` for every provider
(no type-based resolution needed).

### Testing buildParams (private method)
Spy on `fetch`, call `service.count()`, then inspect the URL:

```typescript
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(...)
await service.count(dto({ minlongitude: 170, maxlongitude: -170 }))
const url = new URL(fetchSpy.mock.calls[0][0] as string)
expect(url.searchParams.get('maxlongitude')).toBe('190') // antimeridian fix
```

### DTO validation tests
`class-validator` stores its own metadata when decorators run — no `design:paramtypes`
needed. `@Type(() => Number)` is an explicit factory (also no metadata needed).
Both work correctly with esbuild:

```typescript
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

const instance = plainToInstance(EarthquakeQueryDto, { starttime: '2024-01-01', ... })
const errors = await validate(instance)
```

## Frontend patterns

### Mocking fetch
Use `vi.stubGlobal` (cleans up automatically with `vi.unstubAllGlobals`):

```typescript
beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())
```

### Mocking Leaflet
Leaflet requires a real browser layout engine — it throws in jsdom.
Mock the entire module with `vi.hoisted` so mock references are available inside `vi.mock`:

```typescript
const { mockFlyTo } = vi.hoisted(() => ({ mockFlyTo: vi.fn() }))

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({ flyTo: mockFlyTo, ... })),
    ...
  }
}))
```

### Mocking module dependencies
```typescript
vi.mock('../api/earthquakes', () => ({ fetchEarthquakes: vi.fn() }))
const mockFetch = vi.mocked((await import('../api/earthquakes')).fetchEarthquakes)
// or at top level:
import * as api from '../api/earthquakes'
const mockFetch = vi.mocked(api.fetchEarthquakes)
```

### Testing debounced hooks (useEarthquakes)
```typescript
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// advance past the 500ms debounce and flush all async work
await act(() => vi.runAllTimersAsync())
```

### Ref mocking for SearchBar
`createRef` makes `current` non-configurable. Use a plain mutable object:

```typescript
const flyTo = vi.fn()
const mapRef = { current: { flyTo } } as React.RefObject<MapViewHandle | null>
```

### URLSearchParams encodes spaces as `+`
`decodeURIComponent` does NOT decode `+` → space. Use `URLSearchParams.get()`:

```typescript
const url = new URL(fetchSpy.mock.calls[0][0] as string)
expect(url.searchParams.get('q')).toBe('New York') // correctly decoded
```

## Known gaps

| Area | Reason not tested |
|---|---|
| 422 too-many-events via e2e | USGS count endpoint too slow (>15s) for ranges large enough to exceed 20k; covered by `earthquakes.service.spec.ts` |
| Leaflet DOM rendering | Requires real browser layout engine; marker positioning verified via mock call assertions |
| `App.tsx` with real hooks | MapView and useEarthquakes mocked to keep tests fast and deterministic |
