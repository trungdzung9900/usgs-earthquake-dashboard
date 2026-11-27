import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { EarthquakesService } from './earthquakes.service.js';
import type { EarthquakeQueryDto } from './dto/earthquake-query.dto.js';

function dto(extra: Partial<EarthquakeQueryDto> = {}): EarthquakeQueryDto {
  return {
    starttime: '2024-01-01',
    endtime: '2024-01-07',
    ...extra,
  } as EarthquakeQueryDto;
}

function mockResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status < 400,
    json: async () => body,
  } as Response;
}

describe('EarthquakesService', () => {
  let service: EarthquakesService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new EarthquakesService();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureCountUrl(): URL {
    return new URL(fetchSpy.mock.calls[0][0] as string);
  }

  describe('buildParams — coordinate normalisation', () => {
    beforeEach(() => {
      fetchSpy.mockResolvedValue(mockResponse({ count: 5, maxAllowed: 20000 }));
    });

    it('passes a normal bbox through unchanged', async () => {
      await service.count(
        dto({
          minlongitude: -10,
          maxlongitude: 10,
          minlatitude: -20,
          maxlatitude: 20,
        }),
      );
      const url = captureCountUrl();
      expect(url.searchParams.get('minlongitude')).toBe('-10');
      expect(url.searchParams.get('maxlongitude')).toBe('10');
      expect(url.searchParams.get('minlatitude')).toBe('-20');
      expect(url.searchParams.get('maxlatitude')).toBe('20');
    });

    it('always adds format=geojson', async () => {
      await service.count(dto());
      expect(captureCountUrl().searchParams.get('format')).toBe('geojson');
    });

    it('fixes antimeridian wrap: minLon=170, maxLon=-170 → maxLon becomes 190', async () => {
      await service.count(dto({ minlongitude: 170, maxlongitude: -170 }));
      const url = captureCountUrl();
      expect(url.searchParams.get('minlongitude')).toBe('170');
      expect(url.searchParams.get('maxlongitude')).toBe('190');
    });

    it('drops longitude bounds when span ≥ 360° (Leaflet zoomed-out values)', async () => {
      await service.count(dto({ minlongitude: -276, maxlongitude: 322 }));
      const url = captureCountUrl();
      expect(url.searchParams.has('minlongitude')).toBe(false);
      expect(url.searchParams.has('maxlongitude')).toBe(false);
    });

    it('drops longitude bounds when span is exactly 360°', async () => {
      await service.count(dto({ minlongitude: -180, maxlongitude: 180 }));
      const url = captureCountUrl();
      expect(url.searchParams.has('minlongitude')).toBe(false);
      expect(url.searchParams.has('maxlongitude')).toBe(false);
    });

    it('clamps minLon to -360 and keeps valid span', async () => {
      await service.count(dto({ minlongitude: -400, maxlongitude: -200 }));
      const url = captureCountUrl();
      // span after clamp: -200 - (-360) = 160 < 360 → kept
      expect(url.searchParams.get('minlongitude')).toBe('-360');
      expect(url.searchParams.get('maxlongitude')).toBe('-200');
    });

    it('clamps maxLon to 360 and keeps valid span', async () => {
      await service.count(dto({ minlongitude: 200, maxlongitude: 400 }));
      const url = captureCountUrl();
      expect(url.searchParams.get('minlongitude')).toBe('200');
      expect(url.searchParams.get('maxlongitude')).toBe('360');
    });

    it('drops latitude bounds when they cover the full range [-90, 90]', async () => {
      await service.count(dto({ minlatitude: -90, maxlatitude: 90 }));
      const url = captureCountUrl();
      expect(url.searchParams.has('minlatitude')).toBe(false);
      expect(url.searchParams.has('maxlatitude')).toBe(false);
    });

    it('drops latitude bounds when clamping makes them span the full range', async () => {
      await service.count(dto({ minlatitude: -100, maxlatitude: 100 }));
      const url = captureCountUrl();
      expect(url.searchParams.has('minlatitude')).toBe(false);
      expect(url.searchParams.has('maxlatitude')).toBe(false);
    });

    it('keeps latitude bounds when they do not cover the full range', async () => {
      await service.count(dto({ minlatitude: -45, maxlatitude: 45 }));
      const url = captureCountUrl();
      expect(url.searchParams.get('minlatitude')).toBe('-45');
      expect(url.searchParams.get('maxlatitude')).toBe('45');
    });

    it('clamps minLatitude to -90 without dropping when partial range', async () => {
      await service.count(dto({ minlatitude: -100, maxlatitude: 45 }));
      const url = captureCountUrl();
      expect(url.searchParams.get('minlatitude')).toBe('-90');
      expect(url.searchParams.get('maxlatitude')).toBe('45');
    });

    it('omits undefined bbox params from the URL', async () => {
      await service.count(dto());
      const url = captureCountUrl();
      expect(url.searchParams.has('minlongitude')).toBe(false);
      expect(url.searchParams.has('maxlongitude')).toBe(false);
      expect(url.searchParams.has('minlatitude')).toBe(false);
      expect(url.searchParams.has('maxlatitude')).toBe(false);
    });
  });

  describe('count()', () => {
    it('returns count and maxAllowed from USGS', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ count: 42, maxAllowed: 20000 }),
      );
      expect(await service.count(dto())).toEqual({
        count: 42,
        maxAllowed: 20000,
      });
    });

    it('returns count=0 and maxAllowed=20000 on HTTP 204', async () => {
      fetchSpy.mockResolvedValue({ status: 204, ok: true } as Response);
      expect(await service.count(dto())).toEqual({
        count: 0,
        maxAllowed: 20000,
      });
    });

    it('calls the USGS count endpoint', async () => {
      fetchSpy.mockResolvedValue(mockResponse({ count: 1, maxAllowed: 20000 }));
      await service.count(dto());
      expect(fetchSpy.mock.calls[0][0]).toMatch(/\/count\?/);
    });
  });

  describe('query()', () => {
    it('throws HttpException 422 when count > 20000', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ count: 25000, maxAllowed: 20000 }),
      );
      await expect(service.query(dto())).rejects.toBeInstanceOf(HttpException);
    });

    it('includes error=too_many_events and the count in the 422 body', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse({ count: 25000, maxAllowed: 20000 }),
      );
      let caught: HttpException | undefined;
      await service.query(dto()).catch((e) => {
        caught = e as HttpException;
      });
      expect(caught?.getStatus()).toBe(422);
      expect(caught?.getResponse()).toMatchObject({
        error: 'too_many_events',
        count: 25000,
      });
    });

    it('returns an empty FeatureCollection when count=0, without calling the query endpoint', async () => {
      fetchSpy.mockResolvedValue(mockResponse({ count: 0, maxAllowed: 20000 }));
      const result = await service.query(dto());
      expect(result).toMatchObject({ type: 'FeatureCollection', features: [] });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns GeoJSON FeatureCollection on success', async () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature' }],
      };
      fetchSpy
        .mockResolvedValueOnce(mockResponse({ count: 1, maxAllowed: 20000 }))
        .mockResolvedValueOnce(mockResponse(geojson));
      expect(await service.query(dto())).toEqual(geojson);
    });

    it('returns an empty FeatureCollection when query endpoint returns 204', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse({ count: 5, maxAllowed: 20000 }))
        .mockResolvedValueOnce({ status: 204, ok: true } as Response);
      const result = await service.query(dto());
      expect(result).toMatchObject({ type: 'FeatureCollection', features: [] });
    });

    it('calls the USGS query endpoint on success', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse({ count: 1, maxAllowed: 20000 }))
        .mockResolvedValueOnce(
          mockResponse({ type: 'FeatureCollection', features: [] }),
        );
      await service.query(dto());
      expect(fetchSpy.mock.calls[1][0]).toMatch(/\/query\?/);
    });
  });
});
