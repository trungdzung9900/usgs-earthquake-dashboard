import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EarthquakeQueryDto } from './earthquake-query.dto.js';

async function check(plain: Record<string, unknown>) {
  const instance = plainToInstance(EarthquakeQueryDto, plain);
  const errors = await validate(instance);
  return { instance, errors, errorFields: errors.map((e) => e.property) };
}

describe('EarthquakeQueryDto', () => {
  describe('required fields', () => {
    it('passes with starttime and endtime only', async () => {
      const { errors } = await check({
        starttime: '2024-01-01',
        endtime: '2024-01-07',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when starttime is missing', async () => {
      const { errorFields } = await check({ endtime: '2024-01-07' });
      expect(errorFields).toContain('starttime');
    });

    it('fails when endtime is missing', async () => {
      const { errorFields } = await check({ starttime: '2024-01-01' });
      expect(errorFields).toContain('endtime');
    });

    it('fails when starttime is not a valid ISO 8601 string', async () => {
      const { errorFields } = await check({
        starttime: 'yesterday',
        endtime: '2024-01-07',
      });
      expect(errorFields).toContain('starttime');
    });

    it('accepts full ISO 8601 datetime strings', async () => {
      const { errors } = await check({
        starttime: '2024-01-01T00:00:00Z',
        endtime: '2024-01-07T23:59:59Z',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('optional numeric fields — coercion and validation', () => {
    const base = { starttime: '2024-01-01', endtime: '2024-01-07' };

    it('coerces string numbers to numbers', async () => {
      const { instance, errors } = await check({
        ...base,
        minmagnitude: '2.5',
        maxmagnitude: '8',
        minlatitude: '-10',
        maxlatitude: '10',
        minlongitude: '-180',
        maxlongitude: '180',
      });
      expect(errors).toHaveLength(0);
      expect(instance.minmagnitude).toBe(2.5);
      expect(instance.maxmagnitude).toBe(8);
      expect(instance.minlatitude).toBe(-10);
      expect(instance.maxlatitude).toBe(10);
      expect(instance.minlongitude).toBe(-180);
      expect(instance.maxlongitude).toBe(180);
    });

    it('accepts native numbers', async () => {
      const { errors } = await check({
        ...base,
        minmagnitude: 5.0,
        minlatitude: 35,
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when minmagnitude is a non-numeric string', async () => {
      const { errorFields } = await check({ ...base, minmagnitude: 'big' });
      expect(errorFields).toContain('minmagnitude');
    });

    it('fails when minlatitude is a non-numeric string', async () => {
      const { errorFields } = await check({ ...base, minlatitude: 'north' });
      expect(errorFields).toContain('minlatitude');
    });

    it('all optional fields can be omitted', async () => {
      const { errors } = await check(base);
      expect(errors).toHaveLength(0);
    });
  });
});
