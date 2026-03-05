import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentService } from './consent.service';
import { ContactMaskingService } from './contact-masking.service';
import { AuditLogService } from './audit-log.service';
import { ConsentController } from './consent.controller';
import { MaskPhoneInterceptor } from './interceptors/mask-phone.interceptor';
import { ConsentRequiredGuard } from './guards/consent-required.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    ConsentService,
    ContactMaskingService,
    AuditLogService,
    ConsentRequiredGuard,
    MaskPhoneInterceptor,
  ],
  controllers: [ConsentController],
  exports: [
    ConsentService,
    ContactMaskingService,
    MaskPhoneInterceptor,
    AuditLogService,
    ConsentRequiredGuard,
  ],
})
export class PrivacyModule {}
