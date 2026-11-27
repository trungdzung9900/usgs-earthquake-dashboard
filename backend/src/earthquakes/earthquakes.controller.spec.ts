import 'reflect-metadata';
import { EarthquakesController } from './earthquakes.controller.js';
import type { EarthquakesService } from './earthquakes.service.js';
import type { EarthquakeQueryDto } from './dto/earthquake-query.dto.js';

function makeService() {
  return {
    query: vi.fn(),
    count: vi.fn(),
  } as unknown as EarthquakesService;
}

describe('EarthquakesController', () => {
  let controller: EarthquakesController;
  let service: ReturnType<typeof makeService>;

  const base: EarthquakeQueryDto = {
    starttime: '2024-01-01',
    endtime: '2024-01-07',
  } as EarthquakeQueryDto;

  beforeEach(() => {
    service = makeService();
    controller = new EarthquakesController(service);
  });

  describe('query()', () => {
    it('delegates to service.query() and returns its result', async () => {
      const data = { type: 'FeatureCollection', features: [] };
      vi.mocked(service.query).mockResolvedValue(data);
      expect(await controller.query(base)).toBe(data);
      expect(service.query).toHaveBeenCalledWith(base);
    });

    it('propagates errors from service.query()', async () => {
      vi.mocked(service.query).mockRejectedValue(new Error('upstream'));
      await expect(controller.query(base)).rejects.toThrow('upstream');
    });
  });

  describe('count()', () => {
    it('delegates to service.count() and returns its result', async () => {
      const result = { count: 42, maxAllowed: 20000 };
      vi.mocked(service.count).mockResolvedValue(result);
      expect(await controller.count(base)).toEqual(result);
      expect(service.count).toHaveBeenCalledWith(base);
    });

    it('propagates errors from service.count()', async () => {
      vi.mocked(service.count).mockRejectedValue(new Error('upstream'));
      await expect(controller.count(base)).rejects.toThrow('upstream');
    });
  });
});
