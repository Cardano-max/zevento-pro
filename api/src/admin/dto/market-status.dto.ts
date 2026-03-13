import { IsIn } from 'class-validator';

export class MarketStatusDto {
  @IsIn(['PLANNED', 'ACTIVE', 'PAUSED', 'DECOMMISSIONED'])
  status: string;
}
