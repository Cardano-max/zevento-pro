import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RoutingOverrideDto {
  @IsUUID()
  vendorId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
