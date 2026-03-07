import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../lead/scoring.service';
import { RedisService } from '../redis/redis.service';
import {
  FAIRNESS_WINDOW_SECONDS,
  MAX_LEADS_PER_WINDOW,
  TOP_N,
} from './routing.constants';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly notificationService: NotificationService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Mode A: Route a lead directly to the single target vendor.
   */
  async routeDirect(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead || !lead.targetVendorId) {
      this.logger.error(
        `routeDirect failed: lead ${leadId} not found or no targetVendorId`,
      );
      return;
    }

    const vendorId = lead.targetVendorId;

    // Create assignment
    const assignment = await this.prisma.leadAssignment.create({
      data: {
        leadId,
        vendorId,
        score: null,
        status: 'PENDING',
      },
    });

    // Update lead status to ROUTED
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ROUTED' },
    });

    // Increment fairness counter
    await this.incrementFairness(vendorId);

    // Mark as notified
    await this.prisma.leadAssignment.update({
      where: { id: assignment.id },
      data: { notifiedAt: new Date(), status: 'NOTIFIED' },
    });

    // Send push notification
    await this.notificationService.sendPushToVendor(vendorId, {
      leadId,
      eventType: lead.eventType,
      city: lead.city,
    });

    this.logger.log(
      `Mode A: Lead ${leadId} routed directly to vendor ${vendorId}`,
    );
  }

  /**
   * Mode B: Score all eligible vendors and assign to Top N.
   */
  async routeTopThree(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      this.logger.error(`routeTopThree failed: lead ${leadId} not found`);
      return;
    }

    // Update lead status to ROUTING
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ROUTING' },
    });

    // Find eligible vendors via PostGIS
    const vendorIds = await this.scoringService.findVendorsInRange(
      lead.latitude!,
      lead.longitude!,
      lead.categoryId ?? undefined,
    );

    if (vendorIds.length === 0) {
      this.logger.warn(`Mode B: No eligible vendors found for lead ${leadId}`);
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: 'ROUTED' },
      });
      return;
    }

    // Score all eligible vendors
    const scored = await this.scoringService.scoreVendors(
      vendorIds,
      lead.latitude!,
      lead.longitude!,
    );

    // Apply fairness cap: skip vendors at or over the limit
    const selected: Array<{ vendorId: string; score: number }> = [];
    for (const entry of scored) {
      if (selected.length >= TOP_N) break;

      const fairnessKey = `fairness:${entry.vendorId}`;
      const fairnessRaw = await this.redis.get(fairnessKey);
      const fairnessCount = fairnessRaw ? parseInt(fairnessRaw, 10) : 0;

      if (fairnessCount >= MAX_LEADS_PER_WINDOW) {
        this.logger.debug(
          `Vendor ${entry.vendorId} skipped (fairness cap: ${fairnessCount}/${MAX_LEADS_PER_WINDOW})`,
        );
        continue;
      }

      selected.push(entry);
    }

    if (selected.length === 0) {
      this.logger.warn(
        `Mode B: All eligible vendors hit fairness cap for lead ${leadId}`,
      );
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: 'ROUTED' },
      });
      return;
    }

    // Create assignments for selected vendors
    for (const entry of selected) {
      await this.prisma.leadAssignment.create({
        data: {
          leadId,
          vendorId: entry.vendorId,
          score: entry.score,
          status: 'PENDING',
        },
      });
    }

    // Update lead status to ROUTED
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ROUTED' },
    });

    // Increment fairness counters, mark as notified
    const assignedVendorIds: string[] = [];
    for (const entry of selected) {
      await this.incrementFairness(entry.vendorId);

      await this.prisma.leadAssignment.updateMany({
        where: { leadId, vendorId: entry.vendorId },
        data: { notifiedAt: new Date(), status: 'NOTIFIED' },
      });

      assignedVendorIds.push(entry.vendorId);
    }

    // Send push notifications to all assigned vendors
    await this.notificationService.sendPushToMultipleVendors(
      assignedVendorIds,
      {
        leadId,
        eventType: lead.eventType,
        city: lead.city,
      },
    );

    this.logger.log(
      `Mode B: Lead ${leadId} routed to ${selected.length} vendors (scores: ${selected.map((s) => s.score.toFixed(3)).join(', ')})`,
    );
  }

  /**
   * Increment the fairness counter for a vendor.
   * Sets a 7-day TTL on first increment only (to avoid resetting the window).
   */
  private async incrementFairness(vendorId: string): Promise<void> {
    const key = `fairness:${vendorId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, FAIRNESS_WINDOW_SECONDS);
    }
  }
}
