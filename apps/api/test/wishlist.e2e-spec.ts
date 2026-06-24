import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/auth/token.util';

describe('Wishlist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `wish_e2e_${Date.now()}@test.com`;
  let accessToken = '';
  let collectionItemId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ email, password: 'secret12' })
      .expect(201);
    const user = await prisma.user.findUnique({ where: { email } });
    const vt = await prisma.verificationToken.findFirst({
      where: { userId: user!.id, consumedAt: null },
    });
    const known = 'wish-e2e-token';
    await prisma.verificationToken.update({
      where: { id: vt!.id },
      data: { tokenHash: sha256(known) },
    });
    await request(server)
      .post('/auth/verify')
      .send({ token: known })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(201);
    accessToken = login.body.accessToken as string;

    const page = await request(server).get('/collections?limit=1').expect(200);
    const slug = page.body.items[0].slug as string;
    const detail = await request(server)
      .get(`/collections/${slug}`)
      .expect(200);
    collectionItemId = detail.body.items[0].id as string;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.wishlistItem.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/wishlist').expect(401);
  });

  it('adds, lists, updates and deletes a wishlist item', async () => {
    const server = app.getHttpServer();

    const added = await request(server)
      .post('/wishlist')
      .set(auth())
      .send({ collectionItemId, priority: 'HIGH', maxPrice: '80.00' })
      .expect(201);
    expect(added.body.maxPrice).toBe('80.00');
    const id = added.body.id as string;

    const list = await request(server).get('/wishlist').set(auth()).expect(200);
    expect(list.body.some((w: { id: string }) => w.id === id)).toBe(true);

    await request(server)
      .patch(`/wishlist/${id}`)
      .set(auth())
      .send({ maxPrice: null })
      .expect(200);

    await request(server).delete(`/wishlist/${id}`).set(auth()).expect(204);
  });

  it('404s patching a nonexistent row', async () => {
    await request(app.getHttpServer())
      .patch('/wishlist/nope')
      .set(auth())
      .send({ priority: 'LOW' })
      .expect(404);
  });
});
