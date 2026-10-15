@echo off
setlocal

echo ========================================
echo  Building Vertex CLI
echo ========================================

call pnpm build
if %errorlevel% neq 0 (
    echo ERROR: CLI build failed
    exit /b 1
)

echo.
echo ========================================
echo  Build completed successfully!
echo ========================================
endlocal
