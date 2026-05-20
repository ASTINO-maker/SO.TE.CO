import { ApiPropertyOptional } from "@nestjs/swagger";
import { LeadSource, LeadStatus } from "@sotec/database";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateLeadDto {
  @IsString()
  @MaxLength(160)
  prospect!: string;

  @IsEnum(LeadSource)
  source!: LeadSource;

  @IsString()
  @MaxLength(160)
  contactPerson!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  budget!: number;

  @IsDateString()
  followUp!: string;

  @IsString()
  requestedWork!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}
