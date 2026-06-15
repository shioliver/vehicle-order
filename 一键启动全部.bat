@echo off
chcp 65001 >nul
title 车辆检测系统 - 一键启动

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║            车辆检测系统  一键启动               ║
echo  ╠══════════════════════════════════════════════════╣
echo  ║  租赁调度系统：http://localhost:5173             ║
echo  ║  检测报告工具：http://localhost:5178             ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo  下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: ── 启动 车辆租赁调度系统 ──────────────────────────────────────
echo  [1/2] 启动 车辆租赁调度系统...

if not exist "%~dp0vehicle-rental-inspection-dispatch\node_modules" (
    echo       首次运行，安装依赖中...
    pushd "%~dp0vehicle-rental-inspection-dispatch"
    call npm install >nul 2>&1
    popd
    echo       依赖安装完成
)

start "车辆租赁调度系统 :5173" cmd /k "chcp 65001 >nul && cd /d "%~dp0vehicle-rental-inspection-dispatch" && echo 启动中... && npm run dev"

:: ── 启动 检测报告工具 ──────────────────────────────────────────
echo  [2/2] 启动 检测报告工具...

if not exist "%~dp0inspection-report-tool\node_modules" (
    echo       首次运行，安装依赖中...
    pushd "%~dp0inspection-report-tool"
    call npm install >nul 2>&1
    popd
    echo       依赖安装完成
)

start "检测报告工具 :5178" cmd /k "chcp 65001 >nul && cd /d "%~dp0inspection-report-tool" && echo 启动中... && npm run dev"

:: ── 自动打开浏览器 ─────────────────────────────────────────────
echo.
echo  [等待] 服务启动中，5 秒后自动打开浏览器...
timeout /t 5 >nul

start http://localhost:5173
timeout /t 1 >nul
start http://localhost:5178

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║  两个系统已在独立窗口中运行，关闭窗口即停止     ║
echo  ║  租赁调度系统：http://localhost:5173             ║
echo  ║  检测报告工具：http://localhost:5178             ║
echo  ╚══════════════════════════════════════════════════╝
echo.
pause
