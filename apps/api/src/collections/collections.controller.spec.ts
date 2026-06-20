import { Test } from '@nestjs/testing';
import {
  CollectionCategory,
  CollectionResponseDto,
  CollectionSource,
  CollectionStatus,
} from '@sobrebox/shared';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  it('delegates findAll to the service', async () => {
    const expected: CollectionResponseDto[] = [
      {
        id: '1',
        slug: 's',
        name: 'N',
        category: CollectionCategory.TCG,
        status: CollectionStatus.PUBLISHED,
        source: CollectionSource.ADMIN,
      },
    ];
    const service = { findAll: jest.fn().mockResolvedValue(expected) };
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: service }],
    }).compile();
    const controller = moduleRef.get(CollectionsController);

    await expect(controller.findAll()).resolves.toBe(expected);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});
