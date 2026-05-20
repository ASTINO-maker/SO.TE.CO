import { FileKind, FileVisibility } from "@sotec/database";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateDocumentDto {
  @IsString()
  @MaxLength(220)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  byteSize!: number;

  @IsEnum(FileKind)
  documentType!: FileKind;

  @IsOptional()
  @IsEnum(FileVisibility)
  visibility?: FileVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  targetReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
