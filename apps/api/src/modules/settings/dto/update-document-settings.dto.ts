import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateDocumentSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerCompanySubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerAddressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerPhoneSecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerRc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerTaxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerCapital?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerArabicCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headerArabicAddressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invoiceFooterConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankIban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankBic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankAccountHolder?: string;
}
