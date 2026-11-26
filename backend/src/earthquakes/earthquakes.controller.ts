import { Controller, Get, Query } from '@nestjs/common';
import { EarthquakesService } from './earthquakes.service.js';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto.js';

@Controller('earthquakes')
export class EarthquakesController {
  constructor(private readonly service: EarthquakesService) {}

  @Get()
  query(@Query() dto: EarthquakeQueryDto) {
    return this.service.query(dto);
  }

  @Get('count')
  count(@Query() dto: EarthquakeQueryDto) {
    return this.service.count(dto);
  }
}
