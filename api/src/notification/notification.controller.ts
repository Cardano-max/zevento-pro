import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('register-device')
  async registerDevice(
    @CurrentUser() user: any,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.notificationService.registerDevice(
      user.id,
      dto.token,
      dto.platform,
    );
    return { success: true };
  }
}
