import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocumentType, Role, VendorStatus } from '@zevento/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { UpdateServiceAreaDto } from './dto/update-service-area.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const MAX_PORTFOLIO_PHOTOS = 20;

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createOrGetProfile(userId: string, role: string) {
    const existing = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        serviceAreas: { include: { market: true } },
        kycDocuments: true,
        subscription: { include: { plan: true } },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.vendorProfile.create({
      data: {
        userId,
        role,
        businessName: '',
        status: VendorStatus.DRAFT,
        onboardingStep: 1,
      },
      include: {
        categories: { include: { category: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        serviceAreas: { include: { market: true } },
        kycDocuments: true,
        subscription: { include: { plan: true } },
      },
    });
  }

  async updateBusinessDetails(vendorId: string, dto: CreateProfileDto) {
    const profile = await this.findProfileOrThrow(vendorId);

    // Validate pricingMax >= pricingMin
    if (
      dto.pricingMin !== undefined &&
      dto.pricingMax !== undefined &&
      dto.pricingMax < dto.pricingMin
    ) {
      throw new BadRequestException(
        'pricingMax must be greater than or equal to pricingMin',
      );
    }

    // Validate all categoryIds exist
    const categories = await this.prisma.eventCategory.findMany({
      where: { id: { in: dto.categoryIds }, isActive: true },
      select: { id: true },
    });
    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException(
        'One or more category IDs are invalid or inactive',
      );
    }

    // Transaction: update profile + replace categories
    return this.prisma.$transaction(async (tx) => {
      // Delete existing categories
      await tx.vendorCategory.deleteMany({ where: { vendorId } });

      // Insert new categories
      await tx.vendorCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({
          vendorId,
          categoryId,
        })),
      });

      // Update profile
      return tx.vendorProfile.update({
        where: { id: vendorId },
        data: {
          businessName: dto.businessName,
          description: dto.description,
          pricingMin: dto.pricingMin,
          pricingMax: dto.pricingMax,
          onboardingStep: Math.max(profile.onboardingStep, 2),
          // Allow re-editing after rejection
          ...(profile.status === VendorStatus.REJECTED
            ? { status: VendorStatus.DRAFT, rejectionReason: null }
            : {}),
        },
        include: {
          categories: { include: { category: true } },
          photos: { orderBy: { sortOrder: 'asc' } },
          serviceAreas: { include: { market: true } },
          kycDocuments: true,
          subscription: { include: { plan: true } },
        },
      });
    });
  }

  async uploadPhoto(
    vendorId: string,
    file: Express.Multer.File,
    dto: UpdatePortfolioDto,
  ) {
    const profile = await this.findProfileOrThrow(vendorId);

    // Check max photos
    const photoCount = await this.prisma.portfolioPhoto.count({
      where: { vendorId },
    });
    if (photoCount >= MAX_PORTFOLIO_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${MAX_PORTFOLIO_PHOTOS} portfolio photos allowed`,
      );
    }

    // Validate categoryId if provided
    if (dto.categoryId) {
      const category = await this.prisma.eventCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Invalid category ID');
      }
    }

    // Upload to Cloudinary
    const uploadResult = await this.cloudinary.uploadImage(
      file,
      `vendors/${vendorId}/portfolio`,
    );

    // Create photo record
    const photo = await this.prisma.portfolioPhoto.create({
      data: {
        vendorId,
        categoryId: dto.categoryId,
        cloudinaryPublicId: uploadResult.publicId,
        cloudinaryUrl: uploadResult.url,
        caption: dto.caption,
        sortOrder: dto.sortOrder ?? photoCount,
      },
    });

    // Update onboarding step
    await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: {
        onboardingStep: Math.max(profile.onboardingStep, 3),
      },
    });

    return photo;
  }

  async deletePhoto(vendorId: string, photoId: string) {
    const photo = await this.prisma.portfolioPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.vendorId !== vendorId) {
      throw new NotFoundException('Photo not found');
    }

    await this.cloudinary.deleteImage(photo.cloudinaryPublicId);
    await this.prisma.portfolioPhoto.delete({ where: { id: photoId } });
  }

  async getPhotos(vendorId: string) {
    await this.findProfileOrThrow(vendorId);

    return this.prisma.portfolioPhoto.findMany({
      where: { vendorId },
      orderBy: { sortOrder: 'asc' },
      include: { category: true },
    });
  }

  async updateServiceAreas(vendorId: string, dto: UpdateServiceAreaDto) {
    const profile = await this.findProfileOrThrow(vendorId);

    // Validate all marketIds exist and are ACTIVE
    const marketIds = dto.serviceAreas.map((sa) => sa.marketId);
    const markets = await this.prisma.market.findMany({
      where: { id: { in: marketIds }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (markets.length !== marketIds.length) {
      throw new BadRequestException(
        'One or more market IDs are invalid or not active',
      );
    }

    // Transaction: delete existing + insert new
    return this.prisma.$transaction(async (tx) => {
      await tx.vendorServiceArea.deleteMany({ where: { vendorId } });

      await tx.vendorServiceArea.createMany({
        data: dto.serviceAreas.map((sa) => ({
          vendorId,
          marketId: sa.marketId,
          radiusKm: sa.radiusKm ?? 25,
        })),
      });

      await tx.vendorProfile.update({
        where: { id: vendorId },
        data: {
          onboardingStep: Math.max(profile.onboardingStep, 4),
        },
      });

      return tx.vendorServiceArea.findMany({
        where: { vendorId },
        include: { market: true },
      });
    });
  }

  async uploadKycDocument(
    vendorId: string,
    file: Express.Multer.File,
    dto: SubmitKycDto,
  ) {
    const profile = await this.findProfileOrThrow(vendorId);

    // Validate document type is appropriate for vendor role
    if (
      profile.role === Role.PLANNER &&
      dto.documentType === KycDocumentType.GST_CERTIFICATE
    ) {
      throw new BadRequestException(
        'Planners cannot upload GST certificates. Upload Aadhaar or PAN instead.',
      );
    }

    // Upload to Cloudinary
    const uploadResult = await this.cloudinary.uploadImage(
      file,
      `vendors/${vendorId}/kyc`,
    );

    return this.prisma.kycDocument.create({
      data: {
        vendorId,
        documentType: dto.documentType,
        cloudinaryPublicId: uploadResult.publicId,
        cloudinaryUrl: uploadResult.url,
      },
    });
  }

  async deleteKycDocument(vendorId: string, docId: string) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.vendorId !== vendorId) {
      throw new NotFoundException('KYC document not found');
    }

    await this.cloudinary.deleteImage(doc.cloudinaryPublicId);
    await this.prisma.kycDocument.delete({ where: { id: docId } });
  }

  async submitForKyc(vendorId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: { kycDocuments: true },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }

    if (profile.onboardingStep < 4) {
      throw new BadRequestException(
        'Complete all onboarding steps before submitting for KYC review',
      );
    }

    if (profile.status === VendorStatus.PENDING_KYC) {
      throw new ConflictException('KYC review already submitted');
    }

    if (profile.kycDocuments.length === 0) {
      throw new BadRequestException(
        'Upload at least one KYC document before submitting',
      );
    }

    // Suppliers must have GST certificate
    if (profile.role === Role.SUPPLIER) {
      const hasGst = profile.kycDocuments.some(
        (doc) => doc.documentType === KycDocumentType.GST_CERTIFICATE,
      );
      if (!hasGst) {
        throw new BadRequestException(
          'Suppliers must upload a GST certificate',
        );
      }
    }

    // Update profile status and create admin notification in transaction
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendorProfile.update({
        where: { id: vendorId },
        data: {
          status: VendorStatus.PENDING_KYC,
          onboardingStep: 5,
          submittedAt: new Date(),
        },
        include: {
          categories: { include: { category: true } },
          photos: { orderBy: { sortOrder: 'asc' } },
          serviceAreas: { include: { market: true } },
          kycDocuments: true,
          subscription: { include: { plan: true } },
        },
      });

      // Create admin notification
      await tx.adminNotification.create({
        data: {
          type: 'KYC_SUBMISSION',
          title: 'New KYC submission',
          message: `Vendor "${profile.businessName}" (${profile.role}) has submitted KYC documents for review.`,
          referenceId: vendorId,
        },
      });

      return updated;
    });
  }

  async getProfile(vendorId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: {
        categories: { include: { category: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        serviceAreas: { include: { market: true } },
        kycDocuments: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return profile;
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        serviceAreas: { include: { market: true } },
        kycDocuments: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Vendor profile not found. Create a profile first.',
      );
    }

    return profile;
  }

  // ── VendorService CRUD ──

  async createService(vendorId: string, dto: CreateServiceDto) {
    return this.prisma.vendorService.create({
      data: { vendorId, ...dto },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async listServices(vendorId: string) {
    return this.prisma.vendorService.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async updateService(vendorId: string, serviceId: string, dto: UpdateServiceDto) {
    const svc = await this.prisma.vendorService.findFirst({ where: { id: serviceId, vendorId } });
    if (!svc) throw new NotFoundException('Service not found');
    return this.prisma.vendorService.update({
      where: { id: serviceId },
      data: dto,
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async deleteService(vendorId: string, serviceId: string) {
    const svc = await this.prisma.vendorService.findFirst({ where: { id: serviceId, vendorId } });
    if (!svc) throw new NotFoundException('Service not found');
    await this.prisma.vendorService.delete({ where: { id: serviceId } });
    return { deleted: true };
  }

  // ── Messaging (Vendor Side) ──

  async listConversations(vendorId: string) {
    return this.prisma.conversation.findMany({
      where: { vendorId },
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getConversationMessages(vendorId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, vendorId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    // Mark customer messages as read
    await this.prisma.message.updateMany({
      where: { conversationId, senderRole: 'CUSTOMER', readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessageAsVendor(vendorId: string, conversationId: string, body: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, vendorId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      select: { userId: true },
    });
    const msg = await this.prisma.message.create({
      data: { conversationId, senderId: vendorProfile!.userId, senderRole: 'VENDOR', body },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return msg;
  }

  private async findProfileOrThrow(vendorId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return profile;
  }
}
