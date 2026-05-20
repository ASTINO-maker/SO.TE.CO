import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../../common/dto/list-query.dto";

export class ListClientsDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}
