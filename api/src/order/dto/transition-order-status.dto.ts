import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductOrderStatus } from '@zevento/shared';

export class TransitionOrderStatusDto {
  @IsEnum(ProductOrderStatus)
  status: ProductOrderStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
