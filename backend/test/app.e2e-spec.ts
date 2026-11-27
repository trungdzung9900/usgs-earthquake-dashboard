import 'reflect-metadata'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import supertest from 'supertest'
import { AppModule, ObserveInstrument } from '../src/app.module.js'

describe('Earthquakes API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication({ instrument: ObserveInstrument })
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
    await app.init()
  }, 15_000)

  afterAll(() => app.close())

  describe('validation', () => {
    it('GET /earthquakes/count returns 400 when starttime and endtime are missing', async () => {
      await supertest(app.getHttpServer()).get('/earthquakes/count').expect(400)
    })

    it('GET /earthquakes returns 400 when starttime is missing', async () => {
      await supertest(app.getHttpServer()).get('/earthquakes').query({ endtime: '2024-01-07' }).expect(400)
    })

    it('GET /earthquakes returns 400 when starttime is not ISO 8601', async () => {
      await supertest(app.getHttpServer())
        .get('/earthquakes')
        .query({ starttime: 'yesterday', endtime: '2024-01-07' })
        .expect(400)
    })
  })

  describe('live USGS queries', () => {
    const params = { starttime: '2024-01-01', endtime: '2024-01-02', minmagnitude: '5' }

    it('GET /earthquakes/count returns a count object', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/earthquakes/count')
        .query(params)
        .expect(200)
      expect(res.body).toMatchObject({
        count: expect.any(Number),
        maxAllowed: expect.any(Number),
      })
    }, 10_000)

    it('GET /earthquakes returns a GeoJSON FeatureCollection', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/earthquakes')
        .query(params)
        .expect(200)
      expect(res.body.type).toBe('FeatureCollection')
      expect(Array.isArray(res.body.features)).toBe(true)
    }, 10_000)

  })
})
