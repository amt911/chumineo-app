import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /collections returns a paged published list', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections')
      .expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    expect(res.body.items[0]).toHaveProperty('brand.name');
    expect(res.body.items[0]).toHaveProperty('itemCount');
  });

  it('GET /collections filters by category', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections?category=TCG')
      .expect(200);
    expect(
      res.body.items.every((c: { category: string }) => c.category === 'TCG'),
    ).toBe(true);
  });

  it('GET /collections rejects an invalid sort', async () => {
    await request(app.getHttpServer())
      .get('/collections?sort=popularity')
      .expect(400);
  });

  it('GET /collections/:slug returns detail', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections/sv-obsidian-flames')
      .expect(200);
    expect(res.body).toMatchObject({ slug: 'sv-obsidian-flames' });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(Array.isArray(res.body.rarityDistribution)).toBe(true);
    expect(Array.isArray(res.body.packTypes)).toBe(true);
  });

  it('GET /collections/:slug 404s for an unknown slug', async () => {
    await request(app.getHttpServer())
      .get('/collections/does-not-exist')
      .expect(404);
  });

  it('GET /brands lists brands', async () => {
    const res = await request(app.getHttpServer()).get('/brands').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('slug');
  });
});
