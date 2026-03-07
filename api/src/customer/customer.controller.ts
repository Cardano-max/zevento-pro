import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { SearchVendorsDto } from './dto/search-vendors.dto';

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
}
