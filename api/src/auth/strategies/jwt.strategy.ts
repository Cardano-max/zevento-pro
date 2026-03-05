import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-this-secret-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { roles: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account inactive');
    }

    const hasActiveRole = user.roles.some(
      (r) => r.role === payload.activeRole && r.isActive,
    );

    if (!hasActiveRole) {
      throw new UnauthorizedException(
        `Active role ${payload.activeRole} not found for user`,
      );
    }

    // Attach user (with activeRole from JWT) to request
    return { ...user, activeRole: payload.activeRole };
  }
}
