@echo off
REM Local Garmin sync — run via Windows Task Scheduler
REM Garmin blocks GitHub Actions cloud IPs, so sync must run locally.

cd /d "%~dp0"
.\venv\Scripts\python.exe sync.py --days 3
