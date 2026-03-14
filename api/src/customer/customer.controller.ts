import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomerService } from './customer.service';
import { SearchVendorsDto } from './dto/search-vendors.dto';

@ApiTags('Customer Browsing')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('categories')
  listCategories() {
    return this.customerService.listCategories();
  }

  @Get('vendors')
  searchVendors(@Query() dto: SearchVendorsDto) {
    return this.customerService.searchVendors(dto);
  }

  @Get('vendors/:id')
  getVendorProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.getVendorProfile(id);
  }

  // ──────────────────────────────────────────────────
  // Phase 07.2: Favorites
  // ──────────────────────────────────────────────────

  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  getFavorites(@CurrentUser() user: { id: string }) {
    return this.customerService.getFavorites(user.id);
  }

  @Post('favorites/:vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  addFavorite(
    @CurrentUser() user: { id: string },
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.customerService.addFavorite(user.id, vendorId);
  }

  @Delete('favorites/:vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  removeFavorite(
    @CurrentUser() user: { id: string },
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.customerService.removeFavorite(user.id, vendorId);
  }

  @Get('favorites/:vendorId/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  checkFavorite(
    @CurrentUser() user: { id: string },
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ) {
    return this.customerService.checkFavorite(user.id, vendorId);
  }
}
