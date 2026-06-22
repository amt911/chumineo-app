import { Test } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  const collections = {
    findPage: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      hasMore: false,
    }),
    findBySlug: jest.fn().mockResolvedValue({ slug: 's' }),
  };
  let controller: CollectionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: collections }],
    }).compile();
    controller = moduleRef.get(CollectionsController);
  });

  it('delegates list to findPage with the parsed query', async () => {
    const query = { page: 1, limit: 20, sort: 'newest' as const };
    await controller.findAll(query);
    expect(collections.findPage).toHaveBeenCalledWith(query);
  });

  it('delegates detail to findBySlug', async () => {
    await controller.findOne('s');
    expect(collections.findBySlug).toHaveBeenCalledWith('s');
  });
});
