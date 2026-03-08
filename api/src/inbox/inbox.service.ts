import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * acceptLead: Transition assignment NOTIFIED → ACCEPTED and reveal customer phone.
   *
   * Uses a Prisma interactive transaction to atomically:
   * 1. Update assignment status (NOTIFIED → ACCEPTED)
   * 2. Fetch customer phone
   * 3. Record PHONE_REVEAL consent log (DPDP Act compliance)
   *
   * Redis scoring cache is invalidated outside the transaction to avoid
   * long-running TX (pitfall 4 from research).
   */
  async acceptLead(
    assignmentId: string,
    vendorId: string,
  ): Promise<{ assignmentId: string; phone: string; leadId: string }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Transition NOTIFIED → ACCEPTED (atomic — if status is wrong, count === 0)
      const updated = await tx.leadAssignment.updateMany({
        where: { id: assignmentId, vendorId, status: 'NOTIFIED' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'Assignment not found, not in NOTIFIED status, or does not belong to this vendor',
        );
      }

      // 2. Fetch assignment with customer phone
      const assignment = await tx.leadAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          lead: {
            include: {
              customer: {
                select: { phone: true, id: true },
              },
            },
          },
        },
      });

      if (!assignment) {
        throw new BadRequestException('Assignment not found after update');
      }

      const customer = assignment.lead.customer;

      // 3. Record PHONE_REVEAL consent (append-only DPDP log)
      await tx.consentLog.create({
        data: {
          userId: customer.id,
          consentType: 'PHONE_REVEAL',
          status: 'GRANTED',
          metadata: { revealedToVendorId: vendorId },
        },
      });

      return {
        assignmentId,
        phone: customer.phone,
        leadId: assignment.leadId,
      };
    });

    // Invalidate vendor scoring cache outside TX (avoids long-running transaction)
    await this.redis.del(`vendor:score:factors:${vendorId}`);
    this.logger.log(
      `Vendor ${vendorId} accepted assignment ${assignmentId} — phone revealed`,
    );

    return result;
  }

  /**
   * declineLead: Transition assignment NOTIFIED → DECLINED with a reason.
   *
   * Atomic updateMany with status filter prevents double-decline race condition.
   */
  async declineLead(
    assignmentId: string,
    vendorId: string,
    reason: string,
  ): Promise<{ assignmentId: string; status: string }> {
    const updated = await this.prisma.leadAssignment.updateMany({
      where: { id: assignmentId, vendorId, status: 'NOTIFIED' },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new BadRequestException(
        'Assignment not found, not in NOTIFIED status, or does not belong to this vendor',
      );
    }

    // Invalidate vendor scoring cache
    await this.redis.del(`vendor:score:factors:${vendorId}`);
    this.logger.log(
      `Vendor ${vendorId} declined assignment ${assignmentId}: ${reason}`,
    );

    return { assignmentId, status: 'DECLINED' };
  }

  /**
   * getInbox: Return the vendor's lead assignments ordered by recency.
   *
   * Includes lead details and quote status (if a quote exists for this vendor).
   * Customer phone is NOT included — only revealed via acceptLead.
   */
  async getInbox(
    vendorId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [assignments, total] = await Promise.all([
      this.prisma.leadAssignment.findMany({
        where: { vendorId },
        include: {
          lead: {
            select: {
              id: true,
              eventType: true,
              eventDate: true,
              city: true,
              budget: true,
              status: true,
              quotes: {
                where: { vendorId },
                select: { id: true, status: true, totalPaise: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leadAssignment.count({ where: { vendorId } }),
    ]);

    return { data: assignments, total, page, limit };
  }
}
