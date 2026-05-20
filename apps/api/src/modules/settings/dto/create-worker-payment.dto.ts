import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";

export class CreateWorkerPaymentWorkerDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;
}

export class CreateWorkerPaymentDto {
  @IsOptional()
  @IsIn(["ADVANCE", "MONTH_END"])
  paymentType?: "ADVANCE" | "MONTH_END";

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkerPaymentWorkerDto)
  workers!: CreateWorkerPaymentWorkerDto[];
}
