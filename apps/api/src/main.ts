import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Chạy sau Nginx → lấy IP thật của người dùng cho nhật ký
  app.set('trust proxy', 1);
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API đang chạy tại cổng ${port} (mọi interface 0.0.0.0)`, 'Bootstrap');
}
bootstrap();
