import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private mockMode = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.logger.log('Firebase Admin SDK initialized');
    } else {
      this.mockMode = true;
      this.logger.warn(
        'Firebase not configured — push notifications will be mocked',
      );
    }
  }

  /**
   * Register or upsert a device token for push notifications.
   * Deactivates any existing token with the same string (may belong to another user/device),
   * then creates a new active token for this user/platform.
   */
  async registerDevice(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    // Deactivate old tokens with same token string
    await this.prisma.deviceToken.updateMany({
      where: { token, isActive: true },
      data: { isActive: false },
    });

    // Create new active token
    await this.prisma.deviceToken.create({
      data: {
        userId,
        token,
        platform,
        isActive: true,
      },
    });

    this.logger.log(
      `Device token registered for user ${userId} (${platform})`,
    );
  }

  /**
   * Send a push notification to all active devices of a vendor.
   * In mock mode, logs the notification instead of sending via Firebase.
   */
  async sendPushToVendor(
    vendorId: string,
    leadData: { leadId: string; eventType: string; city: string },
  ): Promise<void> {
    // Resolve vendor's userId
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      select: { userId: true },
    });

    if (!vendor) {
      this.logger.warn(`Vendor ${vendorId} not found — skipping push`);
      return;
    }

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: vendor.userId, isActive: true },
    });

    if (devices.length === 0) {
      this.logger.debug(
        `No active device tokens for vendor ${vendorId} — skipping push`,
      );
      return;
    }

    if (this.mockMode) {
      this.logger.log(
        `[MOCK PUSH] Vendor ${vendorId}: New ${leadData.eventType} inquiry in ${leadData.city} (leadId: ${leadData.leadId}) — ${devices.length} device(s)`,
      );
      return;
    }

    for (const device of devices) {
      try {
        await admin.messaging().send({
          token: device.token,
          notification: {
            title: 'New Lead Received',
            body: `New ${leadData.eventType} inquiry in ${leadData.city}`,
          },
          data: {
            leadId: leadData.leadId,
            type: 'NEW_LEAD',
          },
        });
      } catch (error: any) {
        const code = error?.code ?? error?.errorInfo?.code ?? '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          this.logger.warn(
            `Invalid/expired FCM token ${device.id} — deactivating`,
          );
          await this.prisma.deviceToken.update({
            where: { id: device.id },
            data: { isActive: false },
          });
        } else {
          this.logger.error(
            `FCM send failed for device ${device.id}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Send a push notification to all active devices of a customer.
   * Mirrors sendPushToVendor but accepts customerId directly (no vendor→userId lookup).
   * In mock mode, logs the notification instead of sending via Firebase.
   */
  async sendPushToCustomer(
    customerId: string,
    payload: { title: string; body: string; data: Record<string, string> },
  ): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: customerId, isActive: true },
    });

    if (devices.length === 0) {
      this.logger.debug(
        `No active device tokens for customer ${customerId} — skipping push`,
      );
      return;
    }

    if (this.mockMode) {
      this.logger.log(
        `[MOCK PUSH] Customer ${customerId}: ${payload.title} — ${payload.body} — ${devices.length} device(s)`,
      );
      return;
    }

    for (const device of devices) {
      try {
        await admin.messaging().send({
          token: device.token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
        });
      } catch (error: any) {
        const code = error?.code ?? error?.errorInfo?.code ?? '';
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          await this.prisma.deviceToken.update({
            where: { id: device.id },
            data: { isActive: false },
          });
        } else {
          this.logger.error(
            `FCM send failed for device ${device.id}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Send push notifications to multiple vendors.
   * Uses Promise.allSettled to avoid failing the whole batch if one push fails.
   */
  async sendPushToMultipleVendors(
    vendorIds: string[],
    leadData: { leadId: string; eventType: string; city: string },
  ): Promise<void> {
    const results = await Promise.allSettled(
      vendorIds.map((vendorId) => this.sendPushToVendor(vendorId, leadData)),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(
        `${failed.length}/${vendorIds.length} push notifications failed`,
      );
    }
  }
}
