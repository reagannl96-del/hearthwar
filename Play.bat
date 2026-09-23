@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing game files for the first time...
  call npm install
)
echo Starting Hearthwar - your browser will open in a moment. Close this window to stop the game.
call npm run dev
