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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { AssignRoleDto } from './dto/manage-role.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';

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
}
