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
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from './guards/vendor-owner.guard';
import { VendorService } from './vendor.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { UpdateServiceAreaDto } from './dto/update-service-area.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_MIMETYPES = [...IMAGE_MIMETYPES, 'application/pdf'];

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

function documentFileFilter(
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!DOCUMENT_MIMETYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Only image files (JPEG, PNG, WebP) and PDF are allowed',
      ),
      false,
    );
  }
  callback(null, true);
}

@ApiTags('Vendor Profile')
@ApiBearerAuth('JWT')
@Controller('vendor/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLANNER', 'SUPPLIER')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  createOrGetProfile(@CurrentUser() user: JwtPayload) {
    return this.vendorService.createOrGetProfile(user.userId, user.activeRole);
  }

  @Patch('business')
  @UseGuards(VendorOwnerGuard)
  updateBusinessDetails(
    @Req() req: any,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.vendorService.updateBusinessDetails(req.vendorId, dto);
  }

  @Post('photos')
  @UseGuards(VendorOwnerGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadPhoto(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdatePortfolioDto,
  ) {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }
    return this.vendorService.uploadPhoto(req.vendorId, file, dto);
  }

  @Get('photos')
  @UseGuards(VendorOwnerGuard)
  getPhotos(@Req() req: any) {
    return this.vendorService.getPhotos(req.vendorId);
  }

  @Delete('photos/:photoId')
  @UseGuards(VendorOwnerGuard)
  deletePhoto(
    @Req() req: any,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.vendorService.deletePhoto(req.vendorId, photoId);
  }

  @Put('service-areas')
  @UseGuards(VendorOwnerGuard)
  updateServiceAreas(
    @Req() req: any,
    @Body() dto: UpdateServiceAreaDto,
  ) {
    return this.vendorService.updateServiceAreas(req.vendorId, dto);
  }

  @Post('kyc/documents')
  @UseGuards(VendorOwnerGuard)
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: documentFileFilter,
    }),
  )
  uploadKycDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubmitKycDto,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }
    return this.vendorService.uploadKycDocument(req.vendorId, file, dto);
  }

  @Delete('kyc/documents/:docId')
  @UseGuards(VendorOwnerGuard)
  deleteKycDocument(
    @Req() req: any,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.vendorService.deleteKycDocument(req.vendorId, docId);
  }

  @Post('kyc/submit')
  @UseGuards(VendorOwnerGuard)
  submitForKyc(@Req() req: any) {
    return this.vendorService.submitForKyc(req.vendorId);
  }

  @Get('me')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.vendorService.getMyProfile(user.userId);
  }
}

/**
 * VendorServicesController
 * Routes for vendor-created service listings (their marketplace offerings).
 * Separate from VendorController (which handles profile/photos/KYC).
 */
@ApiTags('Vendor Services')
@ApiBearerAuth('JWT')
@Controller('vendor/services')
@UseGuards(JwtAuthGuard, RolesGuard, VendorOwnerGuard)
@Roles('PLANNER', 'SUPPLIER')
export class VendorServicesController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  listServices(@Req() req: any) {
    return this.vendorService.listServices(req.vendorId);
  }

  @Post()
  createService(@Req() req: any, @Body() dto: CreateServiceDto) {
    return this.vendorService.createService(req.vendorId, dto);
  }

  @Patch(':id')
  updateService(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.vendorService.updateService(req.vendorId, id, dto);
  }

  @Delete(':id')
  deleteService(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendorService.deleteService(req.vendorId, id);
  }
}

/**
 * VendorConversationsController
 * Routes for vendor messaging — read conversations sent by customers.
 */
@ApiTags('Vendor Messaging')
@ApiBearerAuth('JWT')
@Controller('vendor/conversations')
@UseGuards(JwtAuthGuard, RolesGuard, VendorOwnerGuard)
@Roles('PLANNER', 'SUPPLIER')
export class VendorConversationsController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  listConversations(@Req() req: any) {
    return this.vendorService.listConversations(req.vendorId);
  }

  @Get(':id/messages')
  getMessages(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendorService.getConversationMessages(req.vendorId, id);
  }

  @Post(':id/messages')
  sendMessage(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('body') body: string,
  ) {
    return this.vendorService.sendMessageAsVendor(req.vendorId, id, body);
  }
}
