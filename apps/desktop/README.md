# SO.TE.CO Desktop Installer

This desktop package is now the only supported Windows customer delivery path.

## Delivery behavior

- Installs a native `SO.TE.CO ERP` desktop application.
- Launches the app directly after installation.
- Opens the ERP inside an Electron window, not in the customer browser.
- Starts the local API and local web runtime in hidden background processes.
- Prepares the local PostgreSQL database if needed.
- Keeps customer data outside the installed app under `%APPDATA%\SO.TE.CO ERP\workspace`.

The packaged runtime is staged before the installer build:

- prebuilt Nest API runtime
- prebuilt Next standalone runtime
- Prisma CLI and generated client
- only the maintenance scripts still used by the desktop shell

The customer machine no longer needs `Node.js` or `pnpm`.

## Build Windows installer

From `client-delivery-package`:

```bash
pnpm install
pnpm desktop:dist:win
```

Output:

- `apps/desktop/dist/SO.TE.CO-ERP-Setup-0.1.11.exe`

## Build Windows portable package

```bash
pnpm desktop:dist:portable
```

## Included maintenance

The desktop app menu exposes:

- repair local installation
- run Windows preflight
- export diagnostics
- open data folder
- open `setup.log`

Diagnostics are exported to the Desktop as a zip file.
