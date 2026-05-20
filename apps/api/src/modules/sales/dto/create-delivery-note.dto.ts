import { DeliveryStatus } from "@sotec/database";
import { IsDateString, IsEnum, IsString, MaxLength } from "class-validator";

export class CreateDeliveryNoteDto {
  @IsString()
  @MaxLength(200)
  project!: string;

  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;

  @IsString()
  @MaxLength(220)
  destination!: string;

  @IsString()
  @MaxLength(120)
  responsible!: string;

  @IsString()
  @MaxLength(160)
  vehicle!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  itemsNote!: string;
}
