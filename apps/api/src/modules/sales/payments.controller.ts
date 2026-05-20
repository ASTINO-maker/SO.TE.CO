import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { SalesService } from "./sales.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";

@ApiTags("Sales")
@ApiBearerAuth()
@Controller("sales/payments")
export class PaymentsController {
  constructor(private readonly salesService: SalesService) {}

  @ApiOperation({ summary: "List payments" })
  @RequirePermissions("payments.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: ListQueryDto) {
    return this.salesService.payments(user, pagination);
  }

  @ApiOperation({ summary: "Create a payment" })
  @RequirePermissions("payments.record")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreatePaymentDto) {
    return this.salesService.createPayment(user, payload);
  }

  @ApiOperation({ summary: "Update a payment" })
  @RequirePermissions("payments.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdatePaymentDto,
  ) {
    return this.salesService.updatePayment(user, id, payload);
  }

  @ApiOperation({ summary: "Delete a payment" })
  @RequirePermissions("payments.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.deletePayment(user, id);
  }
}
