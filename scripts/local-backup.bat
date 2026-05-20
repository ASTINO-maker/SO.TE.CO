@echo off
setlocal

set ROOT_DIR=%~dp0..
set DATA_DIR=%ROOT_DIR%\.data
set BACKUP_ROOT=%DATA_DIR%\backups

if not exist "%ROOT_DIR%\.env" (
  echo Missing .env file. Copy .env.example to .env first.
  exit /b 1
)

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TIMESTAMP=%%i
set BACKUP_DIR=%BACKUP_ROOT%\%TIMESTAMP%

mkdir "%BACKUP_DIR%"

for /f "tokens=1,* delims==" %%a in ('findstr /B "DATABASE_URL=" "%ROOT_DIR%\.env"') do set DATABASE_URL=%%b

if "%DATABASE_URL%"=="" (
  echo DATABASE_URL is missing in .env
  exit /b 1
)

where pg_dump >nul 2>&1
if errorlevel 1 (
  echo pg_dump is required for backups. Install PostgreSQL command line tools.
  exit /b 1
)

echo Creating PostgreSQL backup...
pg_dump "%DATABASE_URL%" --no-owner --no-privileges > "%BACKUP_DIR%\database.sql"
if errorlevel 1 exit /b 1

echo Copying environment file...
copy "%ROOT_DIR%\.env" "%BACKUP_DIR%\.env.backup" >nul

if exist "%ROOT_DIR%\storage" (
  where powershell >nul 2>&1
  if errorlevel 1 (
    echo PowerShell is required to archive storage.
    exit /b 1
  )
  echo Archiving storage...
  powershell -NoProfile -Command "Compress-Archive -Path '%ROOT_DIR%\storage' -DestinationPath '%BACKUP_DIR%\storage.zip' -Force"
)

(
  echo SO.TE.CO local backup
  echo Created: %TIMESTAMP%
  echo Database dump: database.sql
  echo Storage archive: storage.zip
  echo Environment copy: .env.backup
) > "%BACKUP_DIR%\README.txt"

echo Backup created in %BACKUP_DIR%
