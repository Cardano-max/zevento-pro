import { IsIn, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsIn(['CUSTOMER', 'PLANNER', 'SUPPLIER', 'ADMIN'], {
    message: 'role must be one of: CUSTOMER, PLANNER, SUPPLIER, ADMIN',
  })
  role: string;

  @IsOptional()
  @IsString()
  contextId?: string;
}
