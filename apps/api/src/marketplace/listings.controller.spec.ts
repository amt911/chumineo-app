import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('ListingsController', () => {
  let service: jest.Mocked<
    Pick<
      ListingsService,
      'create' | 'listPublic' | 'getById' | 'update' | 'remove' | 'availability'
    >
  >;
  let controller: ListingsController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      listPublic: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      availability: jest.fn(),
    };
    controller = new ListingsController(service as unknown as ListingsService);
  });

  it('GET :id forwards the current user id when present (owner preview)', () => {
    controller.get(user, 'listing1');
    expect(service.getById).toHaveBeenCalledWith('listing1', 'u1');
  });

  it('GET :id forwards undefined when no user is authenticated (anonymous)', () => {
    controller.get(undefined, 'listing1');
    expect(service.getById).toHaveBeenCalledWith('listing1', undefined);
  });

  it('POST forwards the current user id + dto to create', () => {
    const dto = {
      collectionItemId: 'ci1',
      quantity: 1,
      condition: 'MINT',
      price: '19.99',
    };
    controller.create(user, dto as never);
    expect(service.create).toHaveBeenCalledWith('u1', dto);
  });

  it('GET forwards the query to listPublic (anonymous public browse)', () => {
    const query = { page: 1 };
    controller.list(query as never);
    expect(service.listPublic).toHaveBeenCalledWith(query);
  });

  it('GET /mine forwards the current user id as owner filter', () => {
    controller.listMine(user);
    expect(service.listPublic).toHaveBeenCalledWith({ page: 1 }, 'u1');
  });

  it('GET /availability forwards the user id + collectionItemId', () => {
    controller.availability(user, { collectionItemId: 'ci1' });
    expect(service.availability).toHaveBeenCalledWith('u1', 'ci1');
  });

  it('PATCH forwards the current user id, id and dto to update', () => {
    const dto = { price: '9.99' };
    controller.update(user, 'listing1', dto as never);
    expect(service.update).toHaveBeenCalledWith('u1', 'listing1', dto);
  });

  it('DELETE forwards the current user id and id to remove', () => {
    controller.remove(user, 'listing1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'listing1');
  });
});
