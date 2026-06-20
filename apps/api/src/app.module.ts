import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { CollectionsModule } from './collections/collections.module';

@Module({
  imports: [
    // Loads the repo-root .env (api/web run on host in Phase 0); already-set env wins,
    // so make-exported vars take precedence. Removes reliance on a hand-made apps/api/.env.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    PrismaModule,
    CollectionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
