import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SearchProductsDto } from './dto/search-products.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  searchProducts(@Query() dto: SearchProductsDto) {
    return this.catalogService.searchProducts(dto);
  }

  @Get('products/:id')
  getProductDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getProductDetail(id);
  }

  @Get('categories')
  getCategories() {
    return this.catalogService.getCategories();
  }
}
