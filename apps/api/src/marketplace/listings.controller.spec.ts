import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('ListingsController', () => {
  let service: jest.Mocked<
    Pick<
      ListingsService,
      'create' | 'listPublic' | 'getById' | 'update' | 'remove'
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
});
