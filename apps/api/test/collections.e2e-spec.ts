import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /collections (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  // Requires a migrated + seeded DB (make migration-run && make fixtures).
  it('returns the seeded published collections with only the DTO fields', async () => {
    const res = await request(app.getHttpServer()).get('/collections').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    const sample = res.body[0];
    expect(Object.keys(sample).sort()).toEqual([
      'category', 'id', 'name', 'slug', 'source', 'status',
    ]);
    // DB-only fields must be stripped from the public contract
    expect(sample).not.toHaveProperty('brandId');
    expect(sample).not.toHaveProperty('createdAt');
  });
});
