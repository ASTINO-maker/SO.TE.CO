import { DeliveryStatus } from "@sotec/database";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDeliveryNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  client?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  project?: string;

  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsible?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vehicle?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsString()
  itemsNote!: string;
}
