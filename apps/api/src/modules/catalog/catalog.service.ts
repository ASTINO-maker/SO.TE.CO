import { Injectable } from "@nestjs/common";

@Injectable()
export class CatalogService {
  list() {
    return {
      items: [],
      itemTypes: ["PRODUCT", "SERVICE", "CUSTOM_WORK"],
      intendedUse: "Reusable lines for quotations, invoices, and delivery notes",
    };
  }
}

