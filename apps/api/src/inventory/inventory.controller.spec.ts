import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('InventoryController', () => {
  let service: jest.Mocked<
    Pick<
      InventoryService,
      | 'add'
      | 'update'
      | 'remove'
      | 'listMine'
      | 'progressSummaries'
      | 'collectionProgress'
    >
  >;
  let controller: InventoryController;

  beforeEach(() => {
    service = {
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listMine: jest.fn(),
      progressSummaries: jest.fn(),
      collectionProgress: jest.fn(),
    };
    controller = new InventoryController(
      service as unknown as InventoryService,
    );
  });

  it('POST forwards the current user id + dto', () => {
    controller.add(user, { collectionItemId: 'ci1', quantity: 1 });
    expect(service.add).toHaveBeenCalledWith('u1', {
      collectionItemId: 'ci1',
      quantity: 1,
    });
  });

  it('GET /progress forwards the user id', () => {
    controller.progress(user);
    expect(service.progressSummaries).toHaveBeenCalledWith('u1');
  });

  it('GET collection progress forwards user id + slug', () => {
    controller.collectionProgress(user, 'obsidian-flames');
    expect(service.collectionProgress).toHaveBeenCalledWith(
      'u1',
      'obsidian-flames',
    );
  });

  it('PATCH forwards user id, id, dto', () => {
    controller.update(user, 'inv1', { quantity: 3 });
    expect(service.update).toHaveBeenCalledWith('u1', 'inv1', { quantity: 3 });
  });

  it('DELETE forwards user id + id', () => {
    controller.remove(user, 'inv1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'inv1');
  });
});
