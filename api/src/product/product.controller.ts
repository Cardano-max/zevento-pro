import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

function imageFileFilter(
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!IMAGE_MIMETYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Only image files (JPEG, PNG, WebP) are allowed',
      ),
      false,
    );
  }
  callback(null, true);
}

@ApiTags('Products')
@ApiBearerAuth('JWT')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, VendorOwnerGuard)
@Roles('SUPPLIER')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  createProduct(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productService.createProduct(req.vendorId, dto);
  }

  @Patch(':id')
  updateProduct(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(req.vendorId, id, dto);
  }

  @Delete(':id')
  deleteProduct(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productService.deleteProduct(req.vendorId, id);
  }

  @Get('mine')
  getMyProducts(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productService.getMyProducts(
      req.vendorId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  addImage(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.productService.addImage(req.vendorId, id, file);
  }

  @Delete('images/:imageId')
  deleteImage(
    @Req() req: any,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productService.deleteImage(req.vendorId, imageId);
  }

  @Patch(':id/stock')
  adjustStock(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('adjustment') adjustment: number,
  ) {
    return this.productService.adjustStock(req.vendorId, id, adjustment);
  }
}
