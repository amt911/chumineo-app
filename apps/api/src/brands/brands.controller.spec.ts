import { Test } from '@nestjs/testing';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

describe('BrandsController', () => {
  const brands = {
    findAll: jest.fn().mockResolvedValue([{ slug: 'funko', name: 'Funko' }]),
  };
  let controller: BrandsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BrandsController],
      providers: [{ provide: BrandsService, useValue: brands }],
    }).compile();
    controller = moduleRef.get(BrandsController);
  });

  it('returns all brands', async () => {
    expect(await controller.findAll()).toEqual([
      { slug: 'funko', name: 'Funko' },
    ]);
  });
});
