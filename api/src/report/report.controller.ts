import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReportDto, ReviewReportDto } from './dto/create-report.dto';
import { ReportService } from './report.service';

@ApiTags('Reports')
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * POST /reports — submit a report (JWT required).
   */
  @Post('reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  createReport(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReportDto,
  ) {
    return this.reportService.createReport(user.id, dto);
  }

  /**
   * GET /admin/reports — list reports (ADMIN only).
   */
  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listReports(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportService.listReports(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * PATCH /admin/reports/:id — review or action a report (ADMIN only).
   */
  @Patch('admin/reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT')
  reviewReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: { id: string },
    @Body() dto: ReviewReportDto,
  ) {
    return this.reportService.reviewReport(id, admin.id, dto);
  }
}
