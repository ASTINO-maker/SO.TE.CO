import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "@sotec/database";
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MaxLength(160)
  client!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  quotationLink?: string;

  @IsOptional()
  @IsDateString()
  targetDelivery?: string;

  @IsString()
  @MaxLength(220)
  address!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
