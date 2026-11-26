import { IsISO8601, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class EarthquakeQueryDto {
  @IsISO8601()
  starttime: string;

  @IsISO8601()
  endtime: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minmagnitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxmagnitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minlatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxlatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minlongitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxlongitude?: number;
}
