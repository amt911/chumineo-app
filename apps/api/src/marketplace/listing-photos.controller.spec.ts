import { ListingPhotosController } from './listing-photos.controller';
import { ListingPhotosService } from './listing-photos.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('ListingPhotosController', () => {
  let service: jest.Mocked<Pick<ListingPhotosService, 'add' | 'remove'>>;
  let controller: ListingPhotosController;

  beforeEach(() => {
    service = {
      add: jest.fn(),
      remove: jest.fn(),
    };
    controller = new ListingPhotosController(
      service as unknown as ListingPhotosService,
    );
  });

  it('POST forwards the current user id, listing id and uploaded files', () => {
    const files = [
      { buffer: Buffer.from('x'), mimetype: 'image/png' },
    ] as Express.Multer.File[];
    controller.add(user, 'l1', files);
    expect(service.add).toHaveBeenCalledWith('u1', 'l1', files);
  });

  it('DELETE forwards the current user id, listing id and photo id', () => {
    controller.remove(user, 'l1', 'p1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'l1', 'p1');
  });
});
