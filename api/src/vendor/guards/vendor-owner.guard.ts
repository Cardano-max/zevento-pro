import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // ADMIN role bypasses ownership check
    if (user.activeRole === Role.ADMIN) {
      return true;
    }

    // Find the vendor profile for the current user
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException(
        'Vendor profile not found. Create a profile first.',
      );
    }

    // Attach vendorId to request for controller use
    request.vendorId = vendorProfile.id;

    return true;
  }
}
