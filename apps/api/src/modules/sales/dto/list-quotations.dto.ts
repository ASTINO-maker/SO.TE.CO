import { ApiPropertyOptional } from "@nestjs/swagger";
import { QuotationStatus } from "@sotec/database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../../common/dto/list-query.dto";

export class ListQuotationsDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client?: string;
}
