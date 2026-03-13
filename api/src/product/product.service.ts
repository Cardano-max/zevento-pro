import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectQueue('stock-alerts') private readonly stockAlertQueue: Queue,
  ) {}

  /**
   * Create a new product for a vendor.
   */
  async createProduct(vendorId: string, dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        vendorId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        pricePaise: dto.pricePaise,
        stock: dto.stock,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        moq: dto.moq ?? 1,
        fulfillmentSource: dto.fulfillmentSource ?? 'SUPPLIER',
      },
      include: { category: true },
    });

    this.logger.log(`Product created: ${product.id} by vendor ${vendorId}`);
    return product;
  }

  /**
   * Update a product. Enforces vendor ownership.
   */
  async updateProduct(
    vendorId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.pricePaise !== undefined && { pricePaise: dto.pricePaise }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.lowStockThreshold !== undefined && {
          lowStockThreshold: dto.lowStockThreshold,
        }),
        ...(dto.moq !== undefined && { moq: dto.moq }),
        ...(dto.fulfillmentSource !== undefined && {
          fulfillmentSource: dto.fulfillmentSource,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  /**
   * Delete a product and its images (Cloudinary + DB).
   * Deletes Cloudinary assets outside transaction, then deletes DB records atomically.
   */
  async deleteProduct(vendorId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    // Delete Cloudinary assets outside transaction (network calls)
    for (const image of product.images) {
      try {
        await this.cloudinaryService.deleteImage(image.cloudinaryPublicId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete Cloudinary asset ${image.cloudinaryPublicId}: ${error}`,
        );
      }
    }

    // Delete images and product atomically
    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({
        where: { productId },
      }),
      this.prisma.product.delete({
        where: { id: productId },
      }),
    ]);

    this.logger.log(`Product deleted: ${productId} by vendor ${vendorId}`);
    return { deleted: true };
  }

  /**
   * Upload a product image. Enforces vendor ownership.
   */
  async addImage(
    vendorId: string,
    productId: string,
    file: Express.Multer.File,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const uploadResult = await this.cloudinaryService.uploadImage(
      file,
      'product-images',
    );

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        cloudinaryPublicId: uploadResult.publicId,
        cloudinaryUrl: uploadResult.url,
      },
    });

    return image;
  }

  /**
   * Delete a product image. Enforces vendor ownership via product relation.
   */
  async deleteImage(vendorId: string, imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
      include: { product: true },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    await this.cloudinaryService.deleteImage(image.cloudinaryPublicId);

    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    return { deleted: true };
  }

  /**
   * Adjust stock for a product. Positive = restock, negative = decrement.
   * Enqueues a low-stock alert if stock falls below threshold after adjustment.
   */
  async adjustStock(
    vendorId: string,
    productId: string,
    adjustment: number,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: adjustment } },
    });

    // Check if stock has fallen below threshold
    if (updated.stock <= updated.lowStockThreshold) {
      await this.stockAlertQueue.add('low-stock', {
        productId: updated.id,
        currentStock: updated.stock,
      });
      this.logger.log(
        `Low stock alert enqueued: product=${productId}, stock=${updated.stock}, threshold=${updated.lowStockThreshold}`,
      );
    }

    return updated;
  }

  /**
   * List a vendor's own products with pagination.
   */
  async getMyProducts(vendorId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { vendorId },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              cloudinaryUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { vendorId } }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full product details by ID.
   */
  async getProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            cloudinaryPublicId: true,
            cloudinaryUrl: true,
            sortOrder: true,
          },
        },
        vendor: {
          select: { id: true, businessName: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
