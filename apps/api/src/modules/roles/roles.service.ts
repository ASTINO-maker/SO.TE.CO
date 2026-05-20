import { Injectable } from "@nestjs/common";
import { permissionCatalog, roleTemplates } from "@sotec/config";

@Injectable()
export class RolesService {
  list() {
    return {
      items: roleTemplates.map((role) => ({
        code: role.code,
        name: role.name,
        defaultScope: role.defaultScope,
        description: role.description,
        permissionCount: role.permissionCodes.length,
      })),
      permissionFamilies: Array.from(
        new Set(permissionCatalog.map((permission) => permission.resource)),
      ),
    };
  }
}
