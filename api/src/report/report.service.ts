import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto, ReviewReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a report from an authenticated user.
   */
  async createReport(reporterId: string, dto: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Admin: list all reports with optional status filter.
   */
  async listReports(
    status?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          reason: true,
          description: true,
          status: true,
          adminNote: true,
          reviewedBy: true,
          reviewedAt: true,
          createdAt: true,
          reporter: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: review or action a report.
   */
  async reviewReport(id: string, adminId: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        adminNote: dto.adminNote,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        adminNote: true,
        reviewedBy: true,
        reviewedAt: true,
      },
    });
  }
}
