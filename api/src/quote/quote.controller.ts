import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteService } from './quote.service';

/**
 * QuoteController: Vendor quote building and customer comparison/acceptance.
 *
 * Vendor endpoints (VENDOR role + VendorOwnerGuard resolves req.vendorId):
 *   POST   /leads/:leadId/quotes       — create or update DRAFT quote
 *   PATCH  /quotes/:id/submit          — submit DRAFT → SUBMITTED
 *
 * Customer endpoints (CUSTOMER role, customerId from JWT):
 *   GET    /leads/:leadId/quotes       — list SUBMITTED quotes for comparison
 *   POST   /quotes/:id/accept          — accept one quote, creates Booking
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  // ─── Vendor Endpoints ─────────────────────────────────────────────────────

  /**
   * POST /leads/:leadId/quotes
   * Vendor creates or updates their DRAFT quote for a lead.
   * VendorOwnerGuard resolves vendorId from JWT userId → req.vendorId.
   */
  @Post('leads/:leadId/quotes')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  createOrUpdateQuote(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Req() req: any,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quoteService.createOrUpdateQuote(leadId, req.vendorId, dto);
  }

  /**
   * PATCH /quotes/:id/submit
   * Vendor submits their DRAFT quote. Transitions DRAFT → SUBMITTED.
   * VendorOwnerGuard resolves vendorId from JWT userId → req.vendorId.
   */
  @Patch('quotes/:id/submit')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.OK)
  submitQuote(
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Req() req: any,
  ) {
    return this.quoteService.submitQuote(quoteId, req.vendorId);
  }

  // ─── Customer Endpoints ───────────────────────────────────────────────────

  /**
   * GET /leads/:leadId/quotes
   * Customer views all SUBMITTED quotes for their lead (comparison view).
   * Returns quotes ordered by totalPaise ascending (cheapest first).
   */
  @Get('leads/:leadId/quotes')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  getQuotesForLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Req() req: any,
  ) {
    const user = req.user as JwtPayload;
    return this.quoteService.getQuotesForLead(leadId, user.userId);
  }

  /**
   * POST /quotes/:id/accept
   * Customer accepts a quote. Atomically creates Booking + rejects other quotes.
   */
  @Post('quotes/:id/accept')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  acceptQuote(
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Req() req: any,
  ) {
    const user = req.user as JwtPayload;
    return this.quoteService.acceptQuote(quoteId, user.userId);
  }
}
