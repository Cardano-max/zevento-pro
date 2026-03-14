import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enable CORS for all frontend apps
  const staticOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:3003',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow all Vercel preview and production deployments
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      // Allow configured static origins
      if (staticOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
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

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Zevento Pro API')
    .setDescription(
      'Zevento Pro — India\'s multi-sided event marketplace API.\n\n' +
      '## Authentication\n' +
      '1. Send OTP: `POST /auth/otp/send` with `{ "phone": "+919876543210" }`\n' +
      '2. Verify OTP: `POST /auth/otp/verify` with `{ "phone": "+919876543210", "otp": "123456" }` (in dev mode, OTP is logged to console)\n' +
      '3. Copy the `accessToken` from the response\n' +
      '4. Click **Authorize** button above → paste `Bearer <your-token>`\n\n' +
      '## Roles\n' +
      '- **CUSTOMER** — Browse vendors, submit inquiries, accept quotes, pay for bookings\n' +
      '- **PLANNER** — Event planner vendor role (decorators, organizers)\n' +
      '- **SUPPLIER** — B2B product supplier role\n' +
      '- **ADMIN** — Platform management, analytics, overrides\n\n' +
      '## Test Flow\n' +
      '1. Register & get token → 2. Browse categories/vendors → 3. Submit inquiry → 4. (As vendor) Accept lead, submit quote → 5. (As customer) Accept quote → 6. Pay for booking',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('Auth', 'OTP-based authentication (no guards)')
    .addTag('Customer Browsing', 'Public endpoints — browse categories, vendors (no auth)')
    .addTag('Leads', 'Submit and view event inquiries')
    .addTag('Vendor Profile', 'Vendor onboarding and profile management')
    .addTag('Subscriptions', 'Vendor subscription billing via Razorpay')
    .addTag('Vendor Inbox', 'Real-time lead inbox — accept/decline leads')
    .addTag('Quotes', 'Quote creation, submission, comparison, acceptance')
    .addTag('Bookings', 'Booking status management and vendor calendar')
    .addTag('Payments', 'Payment orders, verification, and webhooks')
    .addTag('Reviews', 'Post-booking reviews and vendor responses')
    .addTag('Products', 'Supplier product catalog management')
    .addTag('Product Catalog', 'Public product browsing (no auth)')
    .addTag('Orders', 'B2B product orders and lifecycle')
    .addTag('Privacy', 'Consent management and audit trail')
    .addTag('Notifications', 'Device token registration for push notifications')
    .addTag('Admin', 'Platform management — users, vendors, KYC, payments, analytics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Zevento Pro API — Interactive Testing',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Zevento API running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
}

bootstrap();
