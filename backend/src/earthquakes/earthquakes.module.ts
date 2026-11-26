import { Module } from '@nestjs/common';
import { EarthquakesController } from './earthquakes.controller.js';
import { EarthquakesService } from './earthquakes.service.js';

@Module({
  controllers: [EarthquakesController],
  providers: [EarthquakesService],
})
export class EarthquakesModule {}
