import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ExpenseStatus } from "@sotec/database";
import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString } from "class-validator";

export class CreateExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsNumberString()
  amount!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expenseDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  project?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ExpenseStatus })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
