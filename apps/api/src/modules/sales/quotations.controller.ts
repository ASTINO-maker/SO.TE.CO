import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { SalesService } from "./sales.service";
import { CreateQuotationDto } from "./dto/create-quotation.dto";
import { ListQuotationsDto } from "./dto/list-quotations.dto";
import { UpdateQuotationDto } from "./dto/update-quotation.dto";

@ApiTags("Sales")
@ApiBearerAuth()
@Controller("sales/quotations")
export class QuotationsController {
  constructor(private readonly salesService: SalesService) {}

  @ApiOperation({ summary: "List quotations" })
  @RequirePermissions("quotations.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQuotationsDto) {
    return this.salesService.quotations(user, query);
  }

  @ApiOperation({ summary: "Get quotation by id" })
  @RequirePermissions("quotations.read")
  @Get(":id")
  byId(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.quotationById(user, id);
  }

  @ApiOperation({ summary: "Create a quotation" })
  @RequirePermissions("quotations.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateQuotationDto) {
    return this.salesService.createQuotation(user, payload);
  }

  @ApiOperation({ summary: "Update a quotation" })
  @RequirePermissions("quotations.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateQuotationDto,
  ) {
    return this.salesService.updateQuotation(user, id, payload);
  }

  @ApiOperation({ summary: "Delete a quotation" })
  @RequirePermissions("quotations.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.deleteQuotation(user, id);
  }
}
