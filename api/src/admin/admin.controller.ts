import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { InitiateRefundDto } from './dto/initiate-refund.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/manage-category.dto';
import {
  CreateCommissionRateDto,
  UpdateCommissionRateDto,
} from './dto/manage-commission.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/manage-plan.dto';
import { AssignRoleDto } from './dto/manage-role.dto';
import { MarketStatusDto } from './dto/market-status.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { RoutingOverrideDto } from './dto/routing-override.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('role') role?: string,
  ) {
    return this.adminService.listUsers(
      parseInt(page, 10),
      parseInt(limit, 10),
      role,
    );
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Post('users/:id/roles')
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.adminService.assignRole(
      userId,
      dto.role,
      currentUser.id,
      dto.contextId,
    );
  }

  @Delete('users/:id/roles/:roleId')
  async revokeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.adminService.revokeRole(userId, roleId, currentUser.id);
  }

  // ──────────────────────────────────────────────────
  // Vendor Management & KYC Review
  // ──────────────────────────────────────────────────

  @Get('vendors')
  async listVendors(
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.listVendors(
      status,
      role,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('vendors/kyc-queue')
  async getKycQueue(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getKycQueue(
      status,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('vendors/:vendorId')
  async getVendorDetail(@Param('vendorId') vendorId: string) {
    return this.adminService.getVendorDetail(vendorId);
  }

  @Post('vendors/:vendorId/kyc-review')
  async reviewKyc(
    @Param('vendorId') vendorId: string,
    @Body() dto: ReviewKycDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.adminService.reviewKyc(vendorId, dto, currentUser.id);
  }

  @Patch('vendors/:vendorId/suspend')
  async suspendVendor(@Param('vendorId') vendorId: string) {
    return this.adminService.suspendVendor(vendorId);
  }

  @Patch('vendors/:vendorId/reactivate')
  async reactivateVendor(@Param('vendorId') vendorId: string) {
    return this.adminService.reactivateVendor(vendorId);
  }

  // ──────────────────────────────────────────────────
  // Event Category Management
  // ──────────────────────────────────────────────────

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:categoryId')
  async updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminService.updateCategory(categoryId, dto);
  }

  @Get('categories')
  async listCategories(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.adminService.listCategories(includeInactive === 'true');
  }

  @Get('categories/:categoryId')
  async getCategoryDetail(@Param('categoryId') categoryId: string) {
    return this.adminService.getCategoryDetail(categoryId);
  }

  // ──────────────────────────────────────────────────
  // Subscription Plan Management
  // ──────────────────────────────────────────────────

  @Post('subscription-plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.adminService.createPlan(dto);
  }

  @Patch('subscription-plans/:planId')
  async updatePlan(
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.adminService.updatePlan(planId, dto);
  }

  @Get('subscription-plans')
  async listPlans(
    @Query('vendorRole') vendorRole?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.adminService.listPlans(vendorRole, includeInactive === 'true');
  }

  @Get('subscription-plans/:planId')
  async getPlanDetail(@Param('planId') planId: string) {
    return this.adminService.getPlanDetail(planId);
  }

  // ──────────────────────────────────────────────────
  // Admin Notifications
  // ──────────────────────────────────────────────────

  @Get('notifications')
  async getNotifications(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.adminService.getNotifications(
      parseInt(page, 10),
      parseInt(limit, 10),
      unreadOnly === 'true',
    );
  }

  @Get('notifications/unread-count')
  async getUnreadCount() {
    return this.adminService.getUnreadCount();
  }

  @Patch('notifications/:notificationId/read')
  async markNotificationRead(
    @Param('notificationId') notificationId: string,
  ) {
    return this.adminService.markNotificationRead(notificationId);
  }

  @Post('notifications/mark-all-read')
  async markAllNotificationsRead() {
    return this.adminService.markAllNotificationsRead();
  }

  // ──────────────────────────────────────────────────
  // Payment Management (Phase 5)
  // ──────────────────────────────────────────────────

  @Get('payments')
  async getPaymentLog(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('vendorId') vendorId?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getPaymentLog(
      parseInt(page, 10),
      parseInt(limit, 10),
      { dateFrom, dateTo, vendorId, type },
    );
  }

  @Post('payments/refund')
  async initiateRefund(@Body() dto: InitiateRefundDto) {
    return this.adminService.initiateRefund(dto);
  }

  @Get('payments/reconciliation')
  async getReconciliation() {
    return this.adminService.getReconciliation();
  }

  // ──────────────────────────────────────────────────
  // Commission Rate Management (Phase 5)
  // ──────────────────────────────────────────────────

  @Post('commission-rates')
  async createCommissionRate(@Body() dto: CreateCommissionRateDto) {
    return this.adminService.createCommissionRate(dto);
  }

  @Patch('commission-rates/:id')
  async updateCommissionRate(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRateDto,
  ) {
    return this.adminService.updateCommissionRate(id, dto);
  }

  @Get('commission-rates')
  async listCommissionRates(
    @Query('categoryId') categoryId?: string,
    @Query('vendorRole') vendorRole?: string,
  ) {
    return this.adminService.listCommissionRates(categoryId, vendorRole);
  }

  @Delete('commission-rates/:id')
  async deleteCommissionRate(@Param('id') id: string) {
    return this.adminService.deleteCommissionRate(id);
  }

  // ──────────────────────────────────────────────────
  // Analytics Dashboard (Phase 7)
  // ──────────────────────────────────────────────────

  @Get('analytics/dashboard')
  async getAnalyticsDashboard(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getAnalyticsDashboard(query);
  }

  // ──────────────────────────────────────────────────
  // Lead Routing Audit & Override (Phase 7)
  // ──────────────────────────────────────────────────

  @Get('leads/:leadId/routing-trace')
  async getLeadRoutingTrace(@Param('leadId') leadId: string) {
    return this.adminService.getLeadRoutingTrace(leadId);
  }

  @Patch('leads/:leadId/routing-override')
  async overrideRouting(
    @Param('leadId') leadId: string,
    @Body() dto: RoutingOverrideDto,
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.adminService.overrideRouting(leadId, dto, currentUser.id);
  }

  // ──────────────────────────────────────────────────
  // Market Status Management (Phase 7)
  // ──────────────────────────────────────────────────

  @Get('markets')
  async listMarkets() {
    return this.adminService.listMarkets();
  }

  @Patch('markets/:marketId/status')
  async updateMarketStatus(
    @Param('marketId') marketId: string,
    @Body() dto: MarketStatusDto,
  ) {
    return this.adminService.updateMarketStatus(marketId, dto);
  }
}
