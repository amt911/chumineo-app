import 'reflect-metadata';
import { RedisService } from './redis.service';
import type { Redis } from 'ioredis';

describe('RedisService', () => {
  const client = {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    disconnect: jest.fn(),
  };
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use direct instantiation rather than NestJS DI to avoid decorator metadata issues in tests
    service = new RedisService(client as unknown as Redis);
  });

  it('sets a TTL only on the first increment', async () => {
    client.incr.mockResolvedValueOnce(1);
    await service.incrWithTtl('k', 900);
    expect(client.expire).toHaveBeenCalledWith('k', 900);
  });

  it('does not reset TTL on later increments', async () => {
    client.incr.mockResolvedValueOnce(2);
    await service.incrWithTtl('k', 900);
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('delegates get and del', async () => {
    client.get.mockResolvedValueOnce('3');
    expect(await service.get('k')).toBe('3');
    await service.del('k');
    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('disconnects the client on module destroy', () => {
    service.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalled();
  });
});
