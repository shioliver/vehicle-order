@echo off
chcp 65001 >nul
title 二手车检测报告工具

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       二手车检测报告工具  启动中     ║
echo  ║       http://localhost:5178          ║
echo  ╚══════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo  下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: 进入项目目录
cd /d "%~dp0inspection-report-tool"

:: 检查依赖
if not exist "node_modules" (
    echo  [提示] 首次运行，正在安装依赖，请稍候...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [错误] 依赖安装失败，请检查网络或手动运行 npm install
        pause
        exit /b 1
    )
    echo.
)

:: 延迟后自动打开浏览器
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5178"

echo  [启动] 正在启动开发服务器...
echo  [地址] http://localhost:5178
echo  [提示] 按 Ctrl+C 停止服务
echo.

npm run dev
pause
