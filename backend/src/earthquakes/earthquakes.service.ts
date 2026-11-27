import { HttpException, Injectable } from '@nestjs/common';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto.js';

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1';

const EMPTY_COLLECTION = {
  type: 'FeatureCollection',
  metadata: { count: 0 },
  features: [],
};

// ─── In-memory response cache ─────────────────────────────────────────────────
// Caches USGS API responses to avoid redundant third-party calls.
// Shared motivation: if USGS introduces rate limits or per-call pricing in
// future, this layer absorbs repeated identical requests at zero extra cost.

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes — matches USGS near-realtime cadence

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

@Injectable()
export class EarthquakesService {
  private readonly cache = new Map<string, CacheEntry>();

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async count(
    dto: EarthquakeQueryDto,
  ): Promise<{ count: number; maxAllowed: number }> {
    const params = this.buildParams(dto);
    const key = `count:${params.toString()}`;

    const cached = this.getCached<{ count: number; maxAllowed: number }>(key);
    if (cached) return cached;

    const res = await fetch(`${USGS_BASE}/count?${params}`);

    let result: { count: number; maxAllowed: number };
    if (res.status === 204) {
      result = { count: 0, maxAllowed: 20000 };
    } else {
      const data = (await res.json()) as {
        count: number;
        maxAllowed: number;
        error?: string;
      };
      result = { count: data.count, maxAllowed: data.maxAllowed };
    }

    this.setCache(key, result);
    return result;
  }

  async query(dto: EarthquakeQueryDto): Promise<unknown> {
    const params = this.buildParams(dto);
    const key = `query:${params.toString()}`;

    const cached = this.getCached<unknown>(key);
    if (cached) return cached;

    const { count } = await this.count(dto);

    if (count > 20000) {
      throw new HttpException({ error: 'too_many_events', count }, 422);
    }

    let result: unknown;
    if (count === 0) {
      result = EMPTY_COLLECTION;
    } else {
      const res = await fetch(`${USGS_BASE}/query?${params}`);
      result = res.status === 204 ? EMPTY_COLLECTION : await res.json();
    }

    this.setCache(key, result);
    return result;
  }

  private buildParams(dto: EarthquakeQueryDto): URLSearchParams {
    let { minlongitude, maxlongitude, minlatitude, maxlatitude, ...rest } = dto;

    // Antimeridian: minLon > maxLon means the box wraps — add 360 to max
    if (
      minlongitude !== undefined &&
      maxlongitude !== undefined &&
      minlongitude > maxlongitude
    ) {
      maxlongitude += 360;
    }

    // When the longitude span covers the full globe (≥360°) drop the bounds —
    // Leaflet emits values like -276/322 when zoomed all the way out
    if (minlongitude !== undefined && maxlongitude !== undefined) {
      if (maxlongitude - minlongitude >= 360) {
        minlongitude = undefined;
        maxlongitude = undefined;
      } else {
        // Clamp to USGS accepted range [-360, 360]
        minlongitude = Math.max(-360, minlongitude);
        maxlongitude = Math.min(360, maxlongitude);
      }
    }

    // Clamp latitude to [-90, 90]; drop bounds when they cover the full range
    if (minlatitude !== undefined) minlatitude = Math.max(-90, minlatitude);
    if (maxlatitude !== undefined) maxlatitude = Math.min(90, maxlatitude);
    if (minlatitude !== undefined && maxlatitude !== undefined) {
      if (minlatitude <= -90 && maxlatitude >= 90) {
        minlatitude = undefined;
        maxlatitude = undefined;
      }
    }

    const params = new URLSearchParams({ format: 'geojson' });

    const all: Record<string, number | string | undefined> = {
      ...rest,
      minlongitude,
      maxlongitude,
      minlatitude,
      maxlatitude,
    };

    for (const [key, value] of Object.entries(all)) {
      if (value !== undefined) params.set(key, String(value));
    }

    return params;
  }
}
