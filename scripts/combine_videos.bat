@echo off
rem Generate a list of video files recorded by Playwright
rem Assumes videos are stored under test-results with .webm extension
set "VIDEODIR=test-results"
set "LISTFILE=videos_to_concat.txt"

rem Clean previous list file
if exist %LISTFILE% del %LISTFILE%

rem Find all .webm files and create concat list
for /r "%VIDEODIR%" %%F in (*.webm) do (
    echo file '%%F'>>%LISTFILE%
)

if not exist %LISTFILE% (
    echo No video files found in %VIDEODIR%.
    exit /b 1
)

rem Concatenate using ffmpeg (must be installed and in PATH)
ffmpeg -f concat -safe 0 -i %LISTFILE% -c copy demo_combined.webm

if %errorlevel% neq 0 (
    echo Failed to combine videos.
    exit /b %errorlevel%
) else (
    echo Videos combined into demo_combined.webm
)
