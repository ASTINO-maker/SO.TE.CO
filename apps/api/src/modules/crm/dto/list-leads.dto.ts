import { ApiPropertyOptional } from "@nestjs/swagger";
import { LeadSource, LeadStatus } from "@sotec/database";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../../common/dto/list-query.dto";

export class ListLeadsDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
