import { Injectable } from '@nestjs/common';
import { BrandDto, brandSchema } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<BrandDto[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    return rows.map((r) => brandSchema.parse(r));
  }
}
