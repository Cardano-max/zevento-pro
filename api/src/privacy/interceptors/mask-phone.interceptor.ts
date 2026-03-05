import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ContactMaskingService } from '../contact-masking.service';
import { ConsentService } from '../consent.service';

@Injectable()
export class MaskPhoneInterceptor implements NestInterceptor {
  constructor(
    private readonly contactMaskingService: ContactMaskingService,
    private readonly consentService: ConsentService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const viewer = request.user as
      | { id: string; activeRole?: string; role?: string }
      | undefined;

    if (!viewer) {
      // No authenticated user — mask everything
      return next.handle().pipe(
        map((data) =>
          this.contactMaskingService.maskUserData(data, ['phone', 'email']),
        ),
      );
    }

    const viewerRole = viewer.activeRole ?? viewer.role ?? 'CUSTOMER';

    // ADMIN sees everything unmasked
    if (viewerRole === 'ADMIN') {
      return next.handle();
    }

    return next.handle().pipe(
      map(async (data) => {
        const needsMasking = this.contactMaskingService.shouldMaskForRole(
          viewerRole,
          'CUSTOMER',
        );

        if (!needsMasking) return data;

        // Check consent: if viewer has PHONE_REVEAL consent for specific data owner,
        // skip masking (handled at field level — mask all unless consent exists)
        // For bulk responses, we mask universally and let specific endpoints handle reveal
        return this.contactMaskingService.maskUserData(data, ['phone', 'email']);
      }),
    );
  }
}
