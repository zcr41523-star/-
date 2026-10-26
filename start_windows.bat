@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo 请先按 README 创建 .venv 并安装依赖。
  pause
  exit /b 1
)
if not defined CARE_TOKEN (
  for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "CARE_TOKEN=%%i"
)
if not defined CARE_INPUT_MODE set "CARE_INPUT_MODE=browser"
echo 当前输入模式: %CARE_INPUT_MODE%
echo 本次令牌仅供本人本机查看，请勿提交或截图传播: %CARE_TOKEN%
echo 浏览器打开 http://localhost:8000
".venv\Scripts\python.exe" -m uvicorn backend.app:create_app --factory --host 0.0.0.0 --port 8000
pause
