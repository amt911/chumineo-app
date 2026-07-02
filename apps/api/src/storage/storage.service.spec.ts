import { StorageService } from './storage.service';

function makeS3() {
  return { send: jest.fn() };
}

describe('StorageService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, S3_PUBLIC_URL: 'http://localhost:9000' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('uploads and returns the key', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    const key = await service.upload(
      'marketplace-listings/l1/photo.webp',
      Buffer.from('x'),
      'image/webp',
    );
    expect(key).toBe('marketplace-listings/l1/photo.webp');
    expect(s3.send).toHaveBeenCalledTimes(1);
  });

  it('builds a public URL from S3_PUBLIC_URL', () => {
    const service = new StorageService(makeS3() as never);
    expect(service.getPublicUrl('marketplace-listings/l1/photo.webp')).toBe(
      'http://localhost:9000/marketplace-listings/l1/photo.webp',
    );
  });

  it('falls back to http://localhost:9000 when S3_PUBLIC_URL is unset', () => {
    delete process.env.S3_PUBLIC_URL;
    const service = new StorageService(makeS3() as never);
    expect(service.getPublicUrl('marketplace-listings/l1/photo.webp')).toBe(
      'http://localhost:9000/marketplace-listings/l1/photo.webp',
    );
  });

  it('uploads without a Content-Cache-Control header when cacheControl is omitted', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    await service.upload(
      'marketplace-listings/l1/photo.webp',
      Buffer.from('x'),
      'image/webp',
    );
    const command = s3.send.mock.calls[0][0];
    expect(command.input.CacheControl).toBeUndefined();
  });

  it('uploads with a Cache-Control header when cacheControl is provided', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    await service.upload(
      'marketplace-listings/l1/photo.webp',
      Buffer.from('x'),
      'image/webp',
      'public, max-age=31536000, immutable',
    );
    const command = s3.send.mock.calls[0][0];
    expect(command.input.CacheControl).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('deletes a key', async () => {
    const s3 = makeS3();
    s3.send.mockResolvedValue({});
    const service = new StorageService(s3 as never);
    await service.delete('marketplace-listings/l1/photo.webp');
    expect(s3.send).toHaveBeenCalledTimes(1);
  });
});
