import { Injectable } from "@nestjs/common";

@Injectable()
export class PdfService {
  supportedTemplates() {
    return ["quotation", "invoice", "delivery-note"];
  }
}

