import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/auth/token.util';
import { Condition, ListingStatus } from '@sobrebox/shared';

describe('Matches (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emailA = `match_a_e2e_${Date.now()}@test.com`;
  const emailB = `match_b_e2e_${Date.now()}@test.com`;
  let tokenA = '';
  let tokenB = '';
  let userBId = '';
  let collectionItemId = '';

  const registerVerifyLogin = async (
    email: string,
    knownToken: string,
  ): Promise<{ userId: string; accessToken: string }> => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ email, password: 'secret12' })
      .expect(201);
    const user = await prisma.user.findUnique({ where: { email } });
    const vt = await prisma.verificationToken.findFirst({
      where: { userId: user!.id, consumedAt: null },
    });
    await prisma.verificationToken.update({
      where: { id: vt!.id },
      data: { tokenHash: sha256(knownToken) },
    });
    await request(server)
      .post('/auth/verify')
      .send({ token: knownToken })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(201);
    return { userId: user!.id, accessToken: login.body.accessToken as string };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();

    const a = await registerVerifyLogin(emailA, 'match-a-e2e-token');
    tokenA = a.accessToken;
    const b = await registerVerifyLogin(emailB, 'match-b-e2e-token');
    userBId = b.userId;
    tokenB = b.accessToken;

    const page = await request(server).get('/collections?limit=1').expect(200);
    const slug = page.body.items[0].slug as string;
    const detail = await request(server)
      .get(`/collections/${slug}`)
      .expect(200);
    collectionItemId = detail.body.items[0].id as string;
  });

  afterAll(async () => {
    for (const email of [emailA, emailB]) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.wishlistItem.deleteMany({ where: { userId: user.id } });
        await prisma.listing.deleteMany({ where: { sellerId: user.id } });
        await prisma.session.deleteMany({ where: { userId: user.id } });
        await prisma.verificationToken.deleteMany({
          where: { userId: user.id },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    await app.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/marketplace/matches').expect(401);
  });

  it("returns only the caller's matches (owner-scoped)", async () => {
    const server = app.getHttpServer();

    // userA wishlists collectionItem X.
    await request(server)
      .post('/wishlist')
      .set(auth(tokenA))
      .send({ collectionItemId, priority: 'HIGH', maxPrice: '50.00' })
      .expect(201);

    // userB (the seller) lists X for sale, seeded directly since the HTTP
    // create path requires owning inventory of the item.
    await prisma.listing.create({
      data: {
        sellerId: userBId,
        collectionItemId,
        quantity: 1,
        condition: Condition.MINT,
        price: '40.00',
        status: ListingStatus.ACTIVE,
      },
    });

    const resA = await request(server)
      .get('/marketplace/matches')
      .set(auth(tokenA))
      .expect(200);

    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].item.id).toBe(collectionItemId);
    expect(resA.body[0].listings[0].inBudget).toBe(true);

    // userB (the seller) has no wishlist => no matches, and never sees A's.
    const resB = await request(server)
      .get('/marketplace/matches')
      .set(auth(tokenB))
      .expect(200);
    expect(resB.body).toEqual([]);
  });
});
