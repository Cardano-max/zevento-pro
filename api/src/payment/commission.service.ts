import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * CommissionService: Database-driven commission rate lookup.
 *
 * Specificity cascade (most specific wins):
 *   1. categoryId + vendorRole (exact match)
 *   2. categoryId only (category default)
 *   3. vendorRole only (role default)
 *   4. null + null (global default)
 *
 * Rates are stored in basis points (bps): 500 = 5%, 1000 = 10%.
 * Only active rates are returned (effectiveFrom <= now, effectiveTo is null or >= now).
 */
@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up the most specific commission rate for a vendor and optional category.
   * @returns rateBps (basis points, e.g. 500 = 5%)
   * @throws InternalServerErrorException if no rate is configured
   */
  async getRate(vendorId: string, categoryId?: string | null): Promise<number> {
    // Fetch vendor role for role-based rate lookup
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      select: { role: true },
    });

    const vendorRole = vendor?.role ?? null;
    const now = new Date();

    // Build OR conditions for specificity cascade
    const orConditions: any[] = [];

    // Most specific: category + role
    if (categoryId && vendorRole) {
      orConditions.push({ categoryId, vendorRole });
    }
    // Category only
    if (categoryId) {
      orConditions.push({ categoryId, vendorRole: null });
    }
    // Role only
    if (vendorRole) {
      orConditions.push({ categoryId: null, vendorRole });
    }
    // Global default (always included)
    orConditions.push({ categoryId: null, vendorRole: null });

    const rate = await this.prisma.commissionRate.findFirst({
      where: {
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        AND: {
          OR: orConditions,
        },
      },
      orderBy: [
        { categoryId: { sort: 'desc', nulls: 'last' } },
        { vendorRole: { sort: 'desc', nulls: 'last' } },
      ],
    });

    if (!rate) {
      this.logger.error(
        `No commission rate found for vendorId=${vendorId}, categoryId=${categoryId}, vendorRole=${vendorRole}`,
      );
      throw new InternalServerErrorException('No commission rate configured');
    }

    this.logger.debug(
      `Commission rate for vendorId=${vendorId}: ${rate.rateBps} bps (rateId=${rate.id})`,
    );

    return rate.rateBps;
  }
}
