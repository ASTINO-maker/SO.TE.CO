import { PartialType } from "@nestjs/swagger";
import { CreateDeliveryNoteDto } from "./create-delivery-note.dto";

export class UpdateDeliveryNoteDto extends PartialType(CreateDeliveryNoteDto) {}
