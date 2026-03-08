import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuoteController } from './quote.controller';
import { QuoteExpiryProcessor } from './quote.processor';
import { QuoteService } from './quote.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'quote-expiry' }),
  ],
  providers: [QuoteService, QuoteExpiryProcessor],
  controllers: [QuoteController],
  exports: [QuoteService],
})
export class QuoteModule {}
