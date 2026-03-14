import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Msg91Service } from './msg91.service';
import { OtpService } from './otp.service';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otp: OtpService,
    private readonly msg91: Msg91Service,
    private readonly rateLimit: RateLimitService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async sendOtp(phone: string): Promise<{ message: string; phone: string }> {
    const limit = await this.rateLimit.checkSendLimit(phone);
    if (!limit.allowed) {
      throw new HttpException(
        {
          message: 'Too many OTP requests. Please try again later.',
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.otp.generateOtp();
    await this.otp.storeOtp(phone, code);
    await this.msg91.sendOtp(phone, code);

    // Mask phone: show last 4 digits only (e.g. ****1234)
    const masked = `****${phone.slice(-4)}`;

    // Return OTP in response when bypass code is active
    if (process.env.OTP_BYPASS_CODE) {
      return { message: 'OTP sent', phone: masked, otp: process.env.OTP_BYPASS_CODE } as any;
    }

    return { message: 'OTP sent', phone: masked };
  }

  async verifyOtp(
    phone: string,
    submittedOtp: string,
    requestedRole?: string,
  ): Promise<{
    accessToken: string;
    user: {
      id: string;
      phone: string;
      name: string | null;
      roles: Array<{ id: string; role: string; isActive: boolean }>;
      activeRole: string;
    };
  }> {
    // Check verify rate limit
    const limit = await this.rateLimit.checkVerifyLimit(phone);
    if (!limit.allowed) {
      throw new HttpException(
        {
          message: 'Too many failed attempts. Please try again later.',
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Verify OTP
    const isValid = await this.otp.verifyOtp(phone, submittedOtp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { roles: true },
    });

    if (!user) {
      // Create user with the requested role (or CUSTOMER by default)
      const initialRole = requestedRole ?? 'CUSTOMER';
      user = await this.prisma.user.create({
        data: {
          phone,
          roles: {
            create: { role: initialRole },
          },
        },
        include: { roles: true },
      });
      this.logger.log(`New user created: ${user.id} (${phone}) with role ${initialRole}`);
    }

    // If user has no active roles, grant the requested role (or CUSTOMER)
    const activeRoles = user.roles.filter((r) => r.isActive);
    if (activeRoles.length === 0) {
      const newRole = await this.prisma.userRole.create({
        data: {
          userId: user.id,
          role: requestedRole ?? 'CUSTOMER',
        },
      });
      user.roles.push(newRole);
    }

    const refreshedActiveRoles = user.roles.filter((r) => r.isActive);

    // Determine active role
    let activeRole: string;
    if (requestedRole) {
      const hasRole = refreshedActiveRoles.some((r) => r.role === requestedRole);
      if (!hasRole) {
        // Grant the requested role on-the-fly (handles existing users switching roles)
        await this.prisma.userRole.create({
          data: { userId: user.id, role: requestedRole },
        });
      }
      activeRole = requestedRole;
    } else {
      // Default to CUSTOMER if present, otherwise first active role
      const customerRole = refreshedActiveRoles.find((r) => r.role === 'CUSTOMER');
      activeRole = customerRole
        ? 'CUSTOMER'
        : refreshedActiveRoles[0].role;
    }

    // Generate JWT
    const payload = { userId: user.id, phone: user.phone, activeRole };
    const accessToken = this.jwt.sign(payload);

    // Reset verify rate limit on success
    await this.rateLimit.resetOnSuccess(phone);

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        roles: user.roles.map((r) => ({
          id: r.id,
          role: r.role,
          isActive: r.isActive,
        })),
        activeRole,
      },
    };
  }
}
