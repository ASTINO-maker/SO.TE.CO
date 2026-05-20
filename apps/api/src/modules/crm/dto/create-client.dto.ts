import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateClientDto {
  @ApiProperty({ enum: ["Company", "Individual"] })
  @IsIn(["Company", "Individual"])
  type!: "Company" | "Individual";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxIdentifier?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openingBalance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
