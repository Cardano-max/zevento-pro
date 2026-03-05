import { Controller, Get, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Controller()
class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zevento-api',
      version: '0.0.0',
    };
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
