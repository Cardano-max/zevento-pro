import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enable CORS for all frontend apps
  app.enableCors({
    origin: [
      'http://localhost:3000', // web (customer)
      'http://localhost:3002', // vendor
      'http://localhost:3003', // admin
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Register IoAdapter for Socket.IO — shares HTTP port (no separate port)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Zevento API running on http://localhost:${port}`);
}

bootstrap();
