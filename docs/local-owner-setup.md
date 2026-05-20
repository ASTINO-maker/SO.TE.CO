# Local Owner Setup

This guide now assumes a Windows customer machine first. The app stays local on the owner's PC and runs in the browser like a local logiciel.

This delivery is intended to run locally on the owner's machine. The application still opens in a browser, but the web app, API, PostgreSQL data, and uploaded documents stay on the same device.

## Recommended Local Stack

Install these on the customer machine:

1. `PostgreSQL 15+`
2. `Node.js 22 LTS`
3. `pnpm 10`

The application then runs entirely on `localhost`:

- Web app: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Database: local PostgreSQL
- Files: local filesystem in `storage/`

## 1. Install PostgreSQL

Preferred for customer delivery:

- PostgreSQL installer on Windows

Optional for developer machines:

- `Postgres.app` on macOS
- `brew install postgresql@15`

Create the local database:

On Windows, create the database with `psql` or pgAdmin and name it:

```text
sotec_owner
```

## 2. Configure the Environment

From the project root:

```bash
cp .env.example .env
```

Then edit `.env` and set the correct local PostgreSQL URL. Example:

```env
DATABASE_URL=postgresql://YOUR_LOCAL_POSTGRES_USER@localhost:5432/sotec_owner
```

Keep these values:

- `WEB_PORT=3000`
- `API_PORT=4000`
- `STORAGE_DRIVER=local`
- `LOCAL_STORAGE_PATH=./storage`

## 3. Install Dependencies and Build

```bash
pnpm install
pnpm --filter @sotec/api build
pnpm --filter @sotec/web build
```

## 4. Start the Local App

Quick one-click launchers from project root:

- Windows: double-click `SO.TE.CO ERP.bat`
- macOS: double-click `SO.TE.CO ERP.command`

Or use scripts directly:

```bash
./scripts/local-start.sh
```

On Windows, use:

```bat
scripts\local-start.bat
```

Check status on Windows:

```bat
scripts\local-status.bat
```

Check status:

```bash
./scripts/local-status.sh
```

Stop it:

```bash
./scripts/local-stop.sh
```

On Windows:

```bat
scripts\local-stop.bat
```

Installer-style Windows shortcuts:

```bat
scripts\install-local-windows.bat
```

This now creates the main Desktop launcher and an update launcher:

- `SO.TE.CO ERP`
- `SO.TE.CO ERP - Mise a jour`

The launcher starts local services if needed and opens the app automatically.

Installer-style macOS launcher:

```bash
./scripts/install-local-macos.sh
```

This creates one Desktop app launcher:

- `SO.TE.CO ERP.app`

Recommended owner usage on Windows:

1. double-click `SO.TE.CO ERP`
2. wait a few seconds
3. the browser opens automatically on `http://localhost:3000`

## 5. First Login

Initial owner account:

- Email: `admin@sotec.local`
- Password: `ChangeMe123!`

On first login the owner is forced to:

1. change the default password
2. complete the local workspace setup

This replaces the previous demo bootstrap flow.

## 6. Backups

Create a local backup:

```bash
./scripts/local-backup.sh
```

On Windows:

```bat
scripts\local-backup.bat
```

Restore a backup:

```bash
./scripts/local-restore.sh /absolute/path/to/.data/backups/<timestamp>
```

On Windows:

```bat
scripts\local-restore.bat C:\SOTECO-ERP\.data\backups\YYYYMMDD-HHMMSS
```

Each backup includes:

- PostgreSQL dump
- `storage/` archive
- `.env` copy

## Delivery Notes

For customer delivery, I recommend:

1. install PostgreSQL once on the machine
2. keep the app local-only on that one device
3. use the backup script daily
4. keep the owner account private
5. do not expose ports 3000 or 4000 externally

## Remaining Pre-Delivery Checks

Before final handoff, manually verify:

1. login and forced password change
2. first-run workspace setup
3. client create/edit
4. lead create/edit
5. quotation create/view/download
6. invoice create/view/download
7. project create/view
8. payment create
9. expense create/edit
10. document upload/download
11. worker payments create/edit on `/finance/worker-payments`
12. payments page opens without validation error on `/finance/payments`

## Tomorrow Delivery Plan

Use this checklist tomorrow on the client machine.

### A. Prepare the Machine

1. Install `Node.js 22 LTS`.
2. Install `PostgreSQL 15+`.
3. Install `pnpm`.
4. Create a working folder such as:

```bash
mkdir -p ~/Applications/SOTECO-ERP
```

5. Copy the full project into that folder.

For Windows, use a folder like:

```text
C:\SOTECO-ERP
```

### B. Prepare the Local Database

1. Start PostgreSQL.
2. Create the database:

```bash
createdb sotec_owner
```

On Windows you can create it from pgAdmin or:

```bat
psql -U postgres -c "CREATE DATABASE sotec_owner;"
```

3. Edit `.env` and make sure `DATABASE_URL` points to the local machine database.

Example:

```env
DATABASE_URL=postgresql://YOUR_LOCAL_POSTGRES_USER@localhost:5432/sotec_owner
```

### C. Install and Build Once

Run from the project root:

```bash
pnpm install
pnpm --filter @sotec/api build
pnpm --filter @sotec/web build
```

### D. Start as a Local Software

Run:

```bash
./scripts/local-start.sh
```

On Windows:

```bat
scripts\local-start.bat
```

Windows startup is now one-click setup on first run:

1. creates `.env` from `.env.example` if missing
2. installs dependencies if needed
3. generates Prisma client
4. creates the PostgreSQL database from `DATABASE_URL` if it does not exist
5. applies migrations
6. builds API/web if build artifacts are missing
7. starts API + web services

Requirements still needed on the customer PC:

- PostgreSQL running locally
- `node` in PATH
- `pnpm` in PATH
- PostgreSQL `psql` tool available (PATH or default PostgreSQL install path)

If the user in `DATABASE_URL` cannot connect or create the database, startup also retries PostgreSQL users `postgres` then `admin` automatically.

Then open:

```text
http://localhost:3000
```

This is still a browser app, but for the client it behaves like a local software because:

- database is on the same machine
- files are on the same machine
- API is on the same machine
- web app is on the same machine
- nothing is hosted online

Recommended launcher setup:

1. Windows: run `scripts\install-local-windows.bat` once.
2. macOS: run `./scripts/install-local-macos.sh` once.
3. Then use only `SO.TE.CO ERP` (Windows) or `SO.TE.CO ERP.app` (macOS).

### E. First Login

Use:

- Email: `admin@sotec.local`
- Password: `ChangeMe123!`

After login:

1. change the default password
2. complete workspace setup
3. configure invoice footer and bank details in `Settings`
4. configure worker payments from `/finance/worker-payments`

### F. Daily Use

To start the app every day:

```bash
./scripts/local-start.sh
```

To stop it:

```bash
./scripts/local-stop.sh
```

On Windows:

```bat
scripts\local-stop.bat
```

To check if everything is running:

```bash
./scripts/local-status.sh
```

### G. Backup Before Leaving

Create one backup before delivery:

```bash
./scripts/local-backup.sh
```

Explain to the client that they should run this daily or at least every week.

### H. Best Delivery Option

For tomorrow, the simplest safe delivery is:

1. keep it as a `localhost` application
2. install PostgreSQL locally on the client machine
3. install Node locally on the client machine
4. create a desktop shortcut that opens `http://localhost:3000`
5. on Windows, pin `scripts\\local-start.bat` to the desktop as the launcher

If you want it to feel even more like a desktop software later, the next step is to wrap the web app in Electron. I do not recommend doing that before tomorrow's delivery because it adds packaging work and more risk.
