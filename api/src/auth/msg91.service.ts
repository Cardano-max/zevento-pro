import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    // Dev mode or test mode — just log
    if (process.env.NODE_ENV === 'development' || process.env.OTP_TEST_MODE === 'true') {
      this.logger.log(`[TEST MODE] OTP for ${phone}: ${otp}`);
      return;
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      this.logger.warn('MSG91 credentials not configured — OTP not sent via SMS');
      return; // Don't throw — OTP is still stored and verifiable
    }

    try {
      const response = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: authKey },
        body: JSON.stringify({ mobile: phone, template_id: templateId, otp }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`MSG91 API error: ${response.status} ${text}`);
      }
    } catch (err) {
      this.logger.error(`MSG91 request failed: ${(err as Error).message}`);
    }
  }
}
