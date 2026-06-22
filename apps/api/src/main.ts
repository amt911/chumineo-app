import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3101')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });
  await app.listen(process.env.API_PORT ?? 3000);
}
void bootstrap();
