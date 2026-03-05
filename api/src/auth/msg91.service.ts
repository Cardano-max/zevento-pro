import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  async sendOtp(phone: string, otp: string): Promise<void> {
    if (this.isDevelopment) {
      this.logger.log(`[DEV MODE] OTP for ${phone}: ${otp}`);
      return;
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      this.logger.error('MSG91 credentials not configured');
      throw new HttpException(
        'Unable to send OTP. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const response = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify({
          mobile: phone,
          template_id: templateId,
          otp,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`MSG91 API error: ${response.status} ${text}`);
        throw new HttpException(
          'Unable to send OTP. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`MSG91 request failed: ${(err as Error).message}`);
      throw new HttpException(
        'Unable to send OTP. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
