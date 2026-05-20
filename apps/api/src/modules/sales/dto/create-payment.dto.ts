import { PaymentMethod, PaymentStatus } from "@sotec/database";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePaymentDto {
  @IsString()
  @MaxLength(160)
  client!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  project?: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
