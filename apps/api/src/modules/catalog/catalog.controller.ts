import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CatalogService } from "./catalog.service";

@ApiTags("Catalog")
@Controller("catalog/items")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: "List catalog items" })
  @RequirePermissions("catalog.read")
  @Get()
  list(@Query() pagination: ListQueryDto) {
    return { ...this.catalogService.list(), pagination };
  }
}
