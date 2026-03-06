import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus, VendorStatus } from '@zevento/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  async getPlansForRole(vendorRole: string) {
    return this.prisma.subscriptionPlan.findMany({
      where: { vendorRole, isActive: true },
      orderBy: { amountPaise: 'asc' },
    });
  }

  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ vendorRole: 'asc' }, { amountPaise: 'asc' }],
    });
  }

  async initiateCheckout(vendorId: string, planId: string) {
    // 1. Find vendor and verify APPROVED status
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    if (vendor.status !== VendorStatus.APPROVED) {
      throw new BadRequestException(
        'Vendor must be KYC-approved before subscribing',
      );
    }

    // 2. Find plan and verify active
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

    // 3. Verify plan role matches vendor role
    if (plan.vendorRole !== vendor.role) {
      throw new BadRequestException(
        `This plan is for ${plan.vendorRole} vendors, not ${vendor.role}`,
      );
    }

    // 4. Check for existing active subscription
    const existing = await this.prisma.vendorSubscription.findUnique({
      where: { vendorId },
    });

    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      throw new ConflictException(
        'Vendor already has an active subscription',
      );
    }

    // 5. Lazy sync: create Razorpay plan if needed
    let razorpayPlanId = plan.razorpayPlanId;
    if (!razorpayPlanId) {
      this.logger.log(
        `Creating Razorpay plan for "${plan.name}" (lazy sync)`,
      );
      const rzpPlan = await this.razorpay.createPlan({
        period: 'monthly',
        interval: plan.periodMonths,
        item: {
          name: plan.name,
          amount: plan.amountPaise,
          currency: 'INR',
          description: plan.name,
        },
      });

      razorpayPlanId = rzpPlan.id;

      await this.prisma.subscriptionPlan.update({
        where: { id: planId },
        data: { razorpayPlanId },
      });
    }

    // 6. Create Razorpay subscription
    const rzpSubscription = await this.razorpay.createSubscription({
      plan_id: razorpayPlanId,
      total_count: 120, // 10 years of monthly billing
      customer_notify: 1,
      notes: { vendorId, planId },
    });

    // 7. Create or update VendorSubscription record
    if (existing) {
      await this.prisma.vendorSubscription.update({
        where: { vendorId },
        data: {
          planId,
          razorpaySubscriptionId: rzpSubscription.id,
          status: SubscriptionStatus.CREATED,
        },
      });
    } else {
      await this.prisma.vendorSubscription.create({
        data: {
          vendorId,
          planId,
          razorpaySubscriptionId: rzpSubscription.id,
          status: SubscriptionStatus.CREATED,
        },
      });
    }

    // 8. Return checkout details
    return {
      subscriptionId: rzpSubscription.id,
      shortUrl: rzpSubscription.short_url,
    };
  }

  async getMySubscription(vendorId: string) {
    const subscription = await this.prisma.vendorSubscription.findUnique({
      where: { vendorId },
      include: {
        plan: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    return subscription;
  }

  async cancelSubscription(vendorId: string) {
    const subscription = await this.prisma.vendorSubscription.findUnique({
      where: { vendorId },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active subscriptions can be cancelled',
      );
    }

    // Cancel at cycle end so vendor keeps access until period expires
    if (subscription.razorpaySubscriptionId) {
      await this.razorpay.cancelSubscription(
        subscription.razorpaySubscriptionId,
        true,
      );
    }

    return this.prisma.vendorSubscription.update({
      where: { vendorId },
      data: { status: SubscriptionStatus.CANCELLED },
      include: { plan: true },
    });
  }
}
