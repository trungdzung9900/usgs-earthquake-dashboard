import { HttpException, Injectable } from '@nestjs/common';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto.js';

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1';

const EMPTY_COLLECTION = {
  type: 'FeatureCollection',
  metadata: { count: 0 },
  features: [],
};

@Injectable()
export class EarthquakesService {
  async count(dto: EarthquakeQueryDto): Promise<{ count: number; maxAllowed: number }> {
    const params = this.buildParams(dto);
    const res = await fetch(`${USGS_BASE}/count?${params}`);

    if (res.status === 204) return { count: 0, maxAllowed: 20000 };

    const data = (await res.json()) as { count: number; maxAllowed: number; error?: string };
    return { count: data.count, maxAllowed: data.maxAllowed };
  }

  async query(dto: EarthquakeQueryDto): Promise<unknown> {
    const { count } = await this.count(dto);

    if (count > 20000) {
      throw new HttpException({ error: 'too_many_events', count }, 422);
    }

    if (count === 0) return EMPTY_COLLECTION;

    const params = this.buildParams(dto);
    const res = await fetch(`${USGS_BASE}/query?${params}`);

    if (res.status === 204) return EMPTY_COLLECTION;

    return res.json();
  }

  private buildParams(dto: EarthquakeQueryDto): URLSearchParams {
    let { minlongitude, maxlongitude, minlatitude, maxlatitude, ...rest } = dto;

    // Antimeridian: minLon > maxLon means the box wraps — add 360 to max
    if (minlongitude !== undefined && maxlongitude !== undefined && minlongitude > maxlongitude) {
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
