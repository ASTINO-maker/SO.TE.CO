import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { FinanceService } from "./finance.service";
import { CreateExpenseDto, UpdateExpenseDto } from "./dto";

@ApiTags("Finance")
@ApiBearerAuth()
@Controller("finance/expenses")
export class ExpensesController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiOperation({ summary: "List expenses" })
  @RequirePermissions("expenses.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: ListQueryDto) {
    return this.financeService.expenses(user, pagination);
  }

  @ApiOperation({ summary: "Create expense" })
  @RequirePermissions("expenses.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateExpenseDto) {
    return this.financeService.createExpense(user, body);
  }

  @ApiOperation({ summary: "Update expense" })
  @RequirePermissions("expenses.update")
  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() body: UpdateExpenseDto) {
    return this.financeService.updateExpense(user, id, body);
  }

  @ApiOperation({ summary: "Delete expense" })
  @RequirePermissions("expenses.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.financeService.deleteExpense(user, id);
  }
}
