@echo off
echo ========================================
echo  Building Vertex Code Extension
echo ========================================

echo.
echo [1/3] Building @roo-code/types...
call pnpm --filter @roo-code/types build
if %errorlevel% neq 0 (
    echo ERROR: types build failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building webview-ui...
cd webview-ui
call pnpm build
if %errorlevel% neq 0 (
    echo ERROR: webview-ui build failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/3] Building extension...
cd src
call pnpm bundle
if %errorlevel% neq 0 (
    echo ERROR: extension build failed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo  Build completed successfully!
echo ========================================
echo.
echo Please reload VS Code window: Ctrl+Shift+P -^> Developer: Reload Window
pause