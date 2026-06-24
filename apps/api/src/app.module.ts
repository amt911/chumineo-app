import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CollectionsModule } from './collections/collections.module';
import { BrandsModule } from './brands/brands.module';
import { InventoryModule } from './inventory/inventory.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Loads the repo-root .env (api/web run on host in Phase 0); already-set env wins,
    // so make-exported vars take precedence. Removes reliance on a hand-made apps/api/.env.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    CollectionsModule,
    BrandsModule,
    InventoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
