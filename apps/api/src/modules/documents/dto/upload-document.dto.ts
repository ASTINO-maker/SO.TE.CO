import { FileKind, FileVisibility } from "@sotec/database";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UploadDocumentDto {
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
