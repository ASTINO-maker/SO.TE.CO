# Folder Structure

## Workspace

```text
apps/
  api/
    src/
      common/
        dto/
        filters/
        prisma/
        swagger/
      modules/
        audit/
        auth/
        catalog/
        crm/
        dashboard/
        documents/
        finance/
        health/
        pdf/
        projects/
        roles/
        sales/
        storage/
        users/
  web/
    src/
      app/
      components/
        ui/
      lib/
docs/
packages/
  config/
  contracts/
  database/
  tsconfig/
  ui/
```

## Backend Layering

- `common/dto`: reusable query and transport contracts
- `common/filters`: consistent API error formatting
- `common/prisma`: database client module and lifecycle handling
- `common/swagger`: OpenAPI bootstrap helpers
- `modules/*`: domain and infrastructure modules

## Frontend Layering

- `app/`: routes and layouts
- `components/ui`: reusable low-level primitives in shadcn style
- `components/`: composed module-level UI
- `lib/`: navigation, utility helpers, future API clients and auth helpers

