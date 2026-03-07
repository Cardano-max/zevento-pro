import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VendorScoreFactors } from './types/vendor-score.interface';

/** Scoring weight constants */
const WEIGHTS = {
  SUBSCRIPTION_TIER: 0.3,
  RATING: 0.2,
  RESPONSE_RATE: 0.2,
  LOCATION_MATCH: 0.2,
  FAIRNESS_ROTATION: 0.1,
} as const;

/** Redis TTL for cached score factors (seconds) */
const SCORE_CACHE_TTL = 300;

/** Fairness rotation window in days */
const FAIRNESS_WINDOW_DAYS = 7;

/** Fairness window TTL in seconds (7 days) */
const FAIRNESS_WINDOW_TTL = FAIRNESS_WINDOW_DAYS * 24 * 60 * 60;

/** Maximum leads per vendor in the fairness rotation window */
const MAX_LEADS_PER_WINDOW = 50;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Pure function: compute a vendor's score using the weighted 5-factor formula.
   *
   * Factors:
   *   - Subscription Tier (30%): PREMIUM=1.0, BASIC=0.5
   *   - Rating (20%): averageRating / 5.0
   *   - Response Rate (20%): responseRate (already 0-1)
   *   - Location Match (20%): binary 1.0 / 0.0
   *   - Fairness Rotation (10%): inverse of leads in window
   */
  computeScore(factors: VendorScoreFactors): number {
    const tierScore = factors.subscriptionTier === 'PREMIUM' ? 1.0 : 0.5;
    const ratingScore = factors.averageRating / 5.0;
    const responseScore = factors.responseRate;
    const locationScore = factors.locationMatch ? 1.0 : 0.0;
    const fairnessScore = Math.max(
      0,
      1.0 - factors.fairnessCount / MAX_LEADS_PER_WINDOW,
    );

    return (
      tierScore * WEIGHTS.SUBSCRIPTION_TIER +
      ratingScore * WEIGHTS.RATING +
      responseScore * WEIGHTS.RESPONSE_RATE +
      locationScore * WEIGHTS.LOCATION_MATCH +
      fairnessScore * WEIGHTS.FAIRNESS_ROTATION
    );
  }

  /**
   * Find vendors whose service area covers the event location using PostGIS.
   *
   * Uses ST_DWithin on geography types so distances are in meters.
   * Filters on vendor status APPROVED and subscription status ACTIVE or AUTHENTICATED.
   * Optionally filters by categoryId.
   */
  async findVendorsInRange(
    latitude: number,
    longitude: number,
    categoryId?: string,
  ): Promise<string[]> {
    if (categoryId) {
      const rows = await this.prisma.$queryRaw<{ vendor_id: string }[]>`
        SELECT DISTINCT vsa.vendor_id
        FROM vendor_service_areas vsa
        JOIN markets m ON m.id = vsa.market_id
        JOIN vendor_profiles vp ON vp.id = vsa.vendor_id
        JOIN vendor_subscriptions vs ON vs.vendor_id = vp.id
        JOIN vendor_categories vc ON vc.vendor_id = vp.id
        WHERE ST_DWithin(
          ST_MakePoint(m.longitude, m.latitude)::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography,
          vsa.radius_km * 1000
        )
        AND vp.status = 'APPROVED'
        AND vs.status IN ('ACTIVE', 'AUTHENTICATED')
        AND vc.category_id = ${categoryId}::uuid
      `;
      return rows.map((r) => r.vendor_id);
    }

    const rows = await this.prisma.$queryRaw<{ vendor_id: string }[]>`
      SELECT DISTINCT vsa.vendor_id
      FROM vendor_service_areas vsa
      JOIN markets m ON m.id = vsa.market_id
      JOIN vendor_profiles vp ON vp.id = vsa.vendor_id
      JOIN vendor_subscriptions vs ON vs.vendor_id = vp.id
      WHERE ST_DWithin(
        ST_MakePoint(m.longitude, m.latitude)::geography,
        ST_MakePoint(${longitude}, ${latitude})::geography,
        vsa.radius_km * 1000
      )
      AND vp.status = 'APPROVED'
      AND vs.status IN ('ACTIVE', 'AUTHENTICATED')
    `;
    return rows.map((r) => r.vendor_id);
  }

  /**
   * Get score factors for a vendor, with Redis caching for non-location factors.
   *
   * Cache key: vendor:score:factors:{vendorId}
   * Cached data: subscriptionTier, averageRating, responseRate (5-min TTL).
   * locationMatch is always computed fresh for the specific event location.
   * fairnessCount is always read fresh from Redis counter.
   */
  async getScoreFactors(
    vendorId: string,
    eventLat: number,
    eventLng: number,
  ): Promise<VendorScoreFactors> {
    const cacheKey = `vendor:score:factors:${vendorId}`;

    // Check if the vendor's service area covers the event location
    const locationRows = await this.prisma.$queryRaw<{ found: boolean }[]>`
      SELECT EXISTS(
        SELECT 1
        FROM vendor_service_areas vsa
        JOIN markets m ON m.id = vsa.market_id
        WHERE vsa.vendor_id = ${vendorId}::uuid
        AND ST_DWithin(
          ST_MakePoint(m.longitude, m.latitude)::geography,
          ST_MakePoint(${eventLng}, ${eventLat})::geography,
          vsa.radius_km * 1000
        )
      ) AS found
    `;
    const locationMatch = locationRows[0]?.found ?? false;

    // Get fairness count from Redis (always fresh)
    const fairnessKey = `fairness:${vendorId}`;
    const fairnessRaw = await this.redis.get(fairnessKey);
    const fairnessCount = fairnessRaw ? parseInt(fairnessRaw, 10) : 0;

    // Try cache for non-location factors
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as {
        subscriptionTier: string;
        averageRating: number;
        responseRate: number;
      };
      return {
        vendorId,
        subscriptionTier: parsed.subscriptionTier,
        averageRating: parsed.averageRating,
        responseRate: parsed.responseRate,
        locationMatch,
        fairnessCount,
      };
    }

    // Query fresh data from DB
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: {
        subscription: { include: { plan: true } },
        stats: true,
      },
    });

    const subscriptionTier = vendor?.subscription?.plan?.tier ?? 'BASIC';
    const averageRating = vendor?.stats?.averageRating ?? 3.0;
    const responseRate = vendor?.stats?.responseRate ?? 0.5;

    // Cache non-location factors
    await this.redis.set(
      cacheKey,
      JSON.stringify({ subscriptionTier, averageRating, responseRate }),
      SCORE_CACHE_TTL,
    );

    return {
      vendorId,
      subscriptionTier,
      averageRating,
      responseRate,
      locationMatch,
      fairnessCount,
    };
  }

  /**
   * Score a list of vendors for a given event location.
   * Returns vendors sorted by score descending.
   */
  async scoreVendors(
    vendorIds: string[],
    eventLat: number,
    eventLng: number,
  ): Promise<Array<{ vendorId: string; score: number }>> {
    const scored = await Promise.all(
      vendorIds.map(async (vendorId) => {
        const factors = await this.getScoreFactors(vendorId, eventLat, eventLng);
        const score = this.computeScore(factors);
        return { vendorId, score };
      }),
    );

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Increment the fairness counter for a vendor.
   * Sets a 7-day TTL on first increment.
   */
  async incrementFairnessCount(vendorId: string): Promise<void> {
    const key = `fairness:${vendorId}`;
    const count = await this.redis.incr(key);
    // Set TTL only on first increment (count === 1)
    if (count === 1) {
      await this.redis.expire(key, FAIRNESS_WINDOW_TTL);
    }
  }

  /**
   * Invalidate the cached score factors for a vendor.
   */
  async invalidateScoreCache(vendorId: string): Promise<void> {
    await this.redis.del(`vendor:score:factors:${vendorId}`);
  }
}
