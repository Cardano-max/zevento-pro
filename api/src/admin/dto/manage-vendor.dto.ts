import { IsBoolean, IsOptional } from 'class-validator';

export class ManageVendorDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
