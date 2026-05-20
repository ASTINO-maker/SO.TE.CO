import { ApiPropertyOptional } from "@nestjs/swagger";
import { InvoiceStatus } from "@sotec/database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../../common/dto/list-query.dto";

export class ListInvoicesDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client?: string;
}
