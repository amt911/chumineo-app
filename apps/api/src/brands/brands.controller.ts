import { Controller, Get } from '@nestjs/common';
import { BrandDto } from '@sobrebox/shared';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  findAll(): Promise<BrandDto[]> {
    return this.brands.findAll();
  }
}
