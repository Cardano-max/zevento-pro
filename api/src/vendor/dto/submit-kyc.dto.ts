import { IsEnum } from 'class-validator';
import { KycDocumentType } from '@zevento/shared';

export class SubmitKycDto {
  @IsEnum(KycDocumentType)
  documentType: KycDocumentType;
}
