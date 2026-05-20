@echo off
setlocal

set ROOT_DIR=%~dp0..
set BACKUP_DIR=%~1

if "%BACKUP_DIR%"=="" (
  echo Usage: scripts\local-restore.bat C:\SOTECO-ERP\.data\backups\YYYYMMDD-HHMMSS
  exit /b 1
)

if not exist "%BACKUP_DIR%" (
  echo Backup directory not found: %BACKUP_DIR%
  exit /b 1
)

if not exist "%ROOT_DIR%\.env" (
  echo Missing .env file. Copy .env.example to .env first.
  exit /b 1
)

for /f "tokens=1,* delims==" %%a in ('findstr /B "DATABASE_URL=" "%ROOT_DIR%\.env"') do set DATABASE_URL=%%b

if "%DATABASE_URL%"=="" (
  echo DATABASE_URL is missing in .env
  exit /b 1
)

where psql >nul 2>&1
if errorlevel 1 (
  echo psql is required for restore. Install PostgreSQL command line tools.
  exit /b 1
)

if exist "%BACKUP_DIR%\database.sql" (
  echo Restoring PostgreSQL database...
  psql "%DATABASE_URL%" -f "%BACKUP_DIR%\database.sql"
  if errorlevel 1 exit /b 1
)

if exist "%BACKUP_DIR%\storage.zip" (
  where powershell >nul 2>&1
  if errorlevel 1 (
    echo PowerShell is required to restore storage.
    exit /b 1
  )
  echo Restoring storage...
  powershell -NoProfile -Command "Expand-Archive -Path '%BACKUP_DIR%\storage.zip' -DestinationPath '%ROOT_DIR%' -Force"
)

echo Restore completed from %BACKUP_DIR%
