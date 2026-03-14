import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLANNER', 'SUPPLIER')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  getPlans(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.getPlansForRole(user.activeRole);
  }

  @Post('checkout')
  @UseGuards(VendorOwnerGuard)
  checkout(@Req() req: any, @Body() dto: CheckoutDto) {
    return this.subscriptionService.initiateCheckout(req.vendorId, dto.planId);
  }

  @Get('me')
  @UseGuards(VendorOwnerGuard)
  getMySubscription(@Req() req: any) {
    return this.subscriptionService.getMySubscription(req.vendorId);
  }

  @Post('cancel')
  @UseGuards(VendorOwnerGuard)
  cancelSubscription(@Req() req: any) {
    return this.subscriptionService.cancelSubscription(req.vendorId);
  }
}
