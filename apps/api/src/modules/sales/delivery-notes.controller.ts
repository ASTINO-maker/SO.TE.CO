import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQueryDto } from "../../common/dto/list-query.dto";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { SalesService } from "./sales.service";
import { CreateDeliveryNoteDto } from "./dto/create-delivery-note.dto";
import { UpdateDeliveryNoteDto } from "./dto/update-delivery-note.dto";

@ApiTags("Sales")
@ApiBearerAuth()
@Controller("sales/delivery-notes")
export class DeliveryNotesController {
  constructor(private readonly salesService: SalesService) {}

  @ApiOperation({ summary: "List delivery notes" })
  @RequirePermissions("delivery_notes.read")
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: ListQueryDto) {
    return this.salesService.deliveryNotes(user, pagination);
  }

  @ApiOperation({ summary: "Create a delivery note" })
  @RequirePermissions("delivery_notes.create")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateDeliveryNoteDto) {
    return this.salesService.createDeliveryNote(user, payload);
  }

  @ApiOperation({ summary: "Get delivery note by id" })
  @RequirePermissions("delivery_notes.read")
  @Get(":id")
  byId(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.deliveryNoteById(user, id);
  }

  @ApiOperation({ summary: "Update a delivery note" })
  @RequirePermissions("delivery_notes.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() payload: UpdateDeliveryNoteDto,
  ) {
    return this.salesService.updateDeliveryNote(user, id, payload);
  }

  @ApiOperation({ summary: "Delete a delivery note" })
  @RequirePermissions("delivery_notes.update")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.salesService.deleteDeliveryNote(user, id);
  }
}
