import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { DeclineLeadDto } from './dto/decline-lead.dto';
import { InboxService } from './inbox.service';

/**
 * InboxController: Vendor lead management endpoints.
 *
 * All endpoints require:
 * - JwtAuthGuard: valid JWT in Authorization header
 * - RolesGuard + @Roles('VENDOR'): only VENDOR role allowed
 * - VendorOwnerGuard: resolves vendorId from userId and attaches to req.vendorId
 */
@ApiTags('Vendor Inbox')
@ApiBearerAuth('JWT')
@Controller('inbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('VENDOR')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  /**
   * GET /inbox
   * Returns the vendor's lead assignments ordered by recency with quote status.
   * Does NOT include customer phone — revealed only via acceptLead.
   */
  @Get()
  @UseGuards(VendorOwnerGuard)
  getInbox(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.inboxService.getInbox(req.vendorId, page, limit);
  }

  /**
   * PATCH /inbox/assignments/:id/accept
   * Accept a lead assignment: NOTIFIED → ACCEPTED.
   * Returns unmasked customer phone + creates PHONE_REVEAL consent log in one transaction.
   */
  @Patch('assignments/:id/accept')
  @UseGuards(VendorOwnerGuard)
  acceptLead(
    @Param('id', ParseUUIDPipe) assignmentId: string,
    @Req() req: any,
  ) {
    return this.inboxService.acceptLead(assignmentId, req.vendorId);
  }

  /**
   * PATCH /inbox/assignments/:id/decline
   * Decline a lead assignment: NOTIFIED → DECLINED with a reason.
   */
  @Patch('assignments/:id/decline')
  @UseGuards(VendorOwnerGuard)
  declineLead(
    @Param('id', ParseUUIDPipe) assignmentId: string,
    @Req() req: any,
    @Body() dto: DeclineLeadDto,
  ) {
    return this.inboxService.declineLead(assignmentId, req.vendorId, dto.reason);
  }
}
