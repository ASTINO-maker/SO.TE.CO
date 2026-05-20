@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0..\.."
if "%SOTECO_WORKSPACE_DIR%"=="" (
  set "WORKSPACE_DIR=%ROOT_DIR%"
) else (
  set "WORKSPACE_DIR=%SOTECO_WORKSPACE_DIR%"
)
if "%SOTECO_DATA_DIR%"=="" (
  set "DATA_DIR=%WORKSPACE_DIR%\.data"
) else (
  set "DATA_DIR=%SOTECO_DATA_DIR%"
)
if "%SOTECO_ENV_FILE%"=="" (
  set "ENV_FILE=%WORKSPACE_DIR%\.env"
) else (
  set "ENV_FILE=%SOTECO_ENV_FILE%"
)

if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /R "^[A-Za-z_][A-Za-z0-9_]*=" "%ENV_FILE%"`) do (
    set "%%A=%%B"
  )
)

if "%WEB_PORT%"=="" set "WEB_PORT=3000"
if "%API_PORT%"=="" set "API_PORT=4000"

call :stop_pid_file "%DATA_DIR%\api.pid"
call :stop_pid_file "%DATA_DIR%\web.pid"
call :free_port "%API_PORT%"
call :free_port "%WEB_PORT%"

echo Stopped local SO.TE.CO services.
exit /b 0

:stop_pid_file
if not exist "%~1" goto :eof
set /p SERVICE_PID=<"%~1"
if not "%SERVICE_PID%"=="" (
  taskkill /PID %SERVICE_PID% /T /F >nul 2>&1
)
del /f /q "%~1" >nul 2>&1
set "SERVICE_PID="
goto :eof

:free_port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do (
  taskkill /PID %%P /T /F >nul 2>&1
)
goto :eof
