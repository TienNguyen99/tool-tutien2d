param([string]$NodePath=(Get-Command node -ErrorAction Stop).Source)
$ErrorActionPreference='Stop'
$taskBuildRoot=Split-Path -Parent $PSScriptRoot
$taskVersion=(Get-Content (Join-Path $taskBuildRoot 'extension/manifest.json') -Raw | ConvertFrom-Json).version
$taskDist=Join-Path $taskBuildRoot 'dist'
New-Item -ItemType Directory -Path $taskDist -Force | Out-Null
$taskBuild=Join-Path $taskDist ("TienLo-$taskVersion-"+[Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $taskBuild -Force | Out-Null
# Explicit allowlist: never copy accounts, profiles, logs, model settings or browser storage.
foreach($taskFile in @('index.html','clones.html','quest-line.html','patch-notes.html','patch-notes.json','setup.html')){Copy-Item -LiteralPath (Join-Path $taskBuildRoot $taskFile) -Destination $taskBuild}
foreach($taskDir in @('assets','extension','tools')){Copy-Item -LiteralPath (Join-Path $taskBuildRoot $taskDir) -Destination $taskBuild -Recurse}
New-Item -ItemType Directory -Path (Join-Path $taskBuild 'scripts'),(Join-Path $taskBuild 'runtime'),(Join-Path $taskBuild 'data/crawl/sources') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'launch-portable.ps1') -Destination (Join-Path $taskBuild 'scripts')
Copy-Item -LiteralPath (Join-Path $taskBuildRoot 'data/crawl/sources/src__systems__quest.js') -Destination (Join-Path $taskBuild 'data/crawl/sources')
Copy-Item -LiteralPath (Join-Path $taskBuildRoot 'data/crawl/catalog.json') -Destination (Join-Path $taskBuild 'data/crawl')
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $taskBuild 'runtime/node.exe')
$taskNodeVersion=(& $NodePath -p 'process.version').Trim()
$taskCachedLicense=Join-Path $PSScriptRoot "NODE-$taskNodeVersion-LICENSE.txt"
if(Test-Path -LiteralPath $taskCachedLicense){Copy-Item -LiteralPath $taskCachedLicense -Destination (Join-Path $taskBuild 'runtime/NODE-LICENSE.txt')}
else {Invoke-WebRequest "https://raw.githubusercontent.com/nodejs/node/$taskNodeVersion/LICENSE" -OutFile (Join-Path $taskBuild 'runtime/NODE-LICENSE.txt') -TimeoutSec 30}
@'
@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-portable.ps1"
if errorlevel 1 pause
'@ | Set-Content -LiteralPath (Join-Path $taskBuild 'CHAY-TOOL.bat') -Encoding ascii
@'
Giai nen ZIP vao thu muc rieng, sau do bam CHAY-TOOL.bat.
Khong can cai Node.js. Lan dau trang huong dan se mo.
Extension: Chrome/Edge > Extensions > Developer mode > Load unpacked > chon extension.
Tu dang nhap game, bam Tro Thu. Cac lan sau bam shortcut Tien Lo Tro Thu tren Desktop.
Giu thu muc da giai nen; shortcut tro den thu muc nay.
AI Ollama la tuy chon, khong di kem model. Khong can AI de dung planner va quy tac hien co.
De tat server: Task Manager > node.exe cua tool > End task.
Khong chua tai khoan, log hay du lieu ca nhan cua nguoi dong goi.
'@ | Set-Content -LiteralPath (Join-Path $taskBuild 'DOC-TRUOC.txt') -Encoding utf8
$taskZip=Join-Path $taskDist "TienLo-$taskVersion-Windows-x64.zip"
Compress-Archive -Path (Join-Path $taskBuild '*') -DestinationPath $taskZip -Force
Write-Output $taskZip
