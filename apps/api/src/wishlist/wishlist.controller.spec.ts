import { WishlistPriority } from '@sobrebox/shared';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('WishlistController', () => {
  let service: jest.Mocked<
    Pick<WishlistService, 'add' | 'update' | 'remove' | 'listMine'>
  >;
  let controller: WishlistController;

  beforeEach(() => {
    service = {
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listMine: jest.fn(),
    };
    controller = new WishlistController(service as unknown as WishlistService);
  });

  it('POST forwards user id + dto', () => {
    const dto = {
      collectionItemId: 'ci1',
      priority: WishlistPriority.MEDIUM,
      isPublic: true,
    };
    controller.add(user, dto);
    expect(service.add).toHaveBeenCalledWith('u1', dto);
  });

  it('GET forwards user id', () => {
    controller.list(user);
    expect(service.listMine).toHaveBeenCalledWith('u1');
  });

  it('PATCH forwards user id, id, dto', () => {
    controller.update(user, 'w1', { priority: WishlistPriority.LOW });
    expect(service.update).toHaveBeenCalledWith('u1', 'w1', {
      priority: WishlistPriority.LOW,
    });
  });

  it('DELETE forwards user id + id', () => {
    controller.remove(user, 'w1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'w1');
  });
});
