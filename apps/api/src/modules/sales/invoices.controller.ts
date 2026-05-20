import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { SalesService } from "./sales.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";

@ApiTags("Sales")
@ApiBearerAuth()
@Controller("sales/invoices")
export class InvoicesController {
  constructor(private readonly salesService: SalesService) {}

  @ApiOperation({ summary: "List invoices" })
  @RequirePermissions("invoices.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvoicesDto) {
    return this.salesService.invoices(user, query);
  }

  @ApiOperation({ summary: "Get invoice by id" })
  @RequirePermissions("invoices.read")
  @Get(":id")
  byId(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.invoiceById(user, id);
  }

  @ApiOperation({ summary: "Create an invoice" })
  @RequirePermissions("invoices.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateInvoiceDto) {
    return this.salesService.createInvoice(user, payload);
  }

  @ApiOperation({ summary: "Update an invoice" })
  @RequirePermissions("invoices.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateInvoiceDto,
  ) {
    return this.salesService.updateInvoice(user, id, payload);
  }

  @ApiOperation({ summary: "Delete an invoice" })
  @RequirePermissions("invoices.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.deleteInvoice(user, id);
  }
}
