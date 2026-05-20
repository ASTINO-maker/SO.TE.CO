import { QuotationStatus } from "@sotec/database";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class CreateQuotationLineDto {
  @IsString()
  @MaxLength(240)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  unit?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  unitPrice!: number;
}

export class CreateQuotationDto {
  @IsString()
  @MaxLength(160)
  client!: string;

  @IsEnum(QuotationStatus)
  status!: QuotationStatus;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  validUntil!: string;

  @IsString()
  @MaxLength(200)
  chantier!: string;

  @IsString()
  scope!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemCount!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationLineDto)
  lines?: CreateQuotationLineDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
