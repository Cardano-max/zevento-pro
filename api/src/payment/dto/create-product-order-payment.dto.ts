import { IsUUID } from 'class-validator';

export class CreateProductOrderPaymentDto {
  @IsUUID()
  orderId: string;
}
