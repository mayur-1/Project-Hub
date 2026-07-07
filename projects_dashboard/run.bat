@echo off
cd /d "%~dp0"
echo Starting Project Hub...
python -m uvicorn server:app --host 0.0.0.0 --port 8501 --reload
pause
