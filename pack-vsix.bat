@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  Vertex Code - Quick Build ^& Package
echo ========================================
echo.

:: ── Step 0: Check pnpm ──
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm not found. Please install pnpm first.
    pause
    exit /b 1
)

:: ── Step 1: Clean previous build artifacts ──
echo [1/4] Cleaning previous build artifacts...
call pnpm clean
if %errorlevel% neq 0 (
    echo [WARN] Clean failed, continuing anyway...
)

:: ── Step 2: Build everything (types → webview-ui → extension bundle) ──
echo.
echo [2/4] Building all packages ^& extension...
call pnpm bundle
if %errorlevel% neq 0 (
    echo [ERROR] Bundle failed!
    pause
    exit /b 1
)

:: ── Step 3: Package into .vsix ──
echo.
echo [3/4] Packaging into .vsix...
call pnpm vsix
if %errorlevel% neq 0 (
    echo [ERROR] VSIX packaging failed!
    pause
    exit /b 1
)

:: ── Step 4: Locate the output ──
echo.
echo [4/4] Locating output file...
for %%f in (bin\vertex-*.vsix) do (
    set vsix_file=%%f
)
if defined vsix_file (
    echo.
    echo ========================================
    echo   Build ^& Package SUCCESS!
    echo ========================================
    echo.
    echo   VSIX: %cd%\!vsix_file!
    echo   Size: 
    for %%A in ("!vsix_file!") do echo        %%~zA bytes
    echo.
    echo   To install:
    echo     code --install-extension !vsix_file!
    echo     OR drag !vsix_file! into VS Code Extensions panel
    echo.
) else (
    echo [WARN] VSIX file not found in bin\ directory.
    echo        Check src\package.json version field.
)

pause
