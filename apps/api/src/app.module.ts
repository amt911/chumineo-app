import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { CollectionsModule } from './collections/collections.module';

@Module({
  imports: [PrismaModule, CollectionsModule],
  controllers: [HealthController],
})
export class AppModule {}
