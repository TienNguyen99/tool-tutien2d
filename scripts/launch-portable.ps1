param([switch]$NoOpen,[switch]$NoShortcut)
$ErrorActionPreference='Stop'
$taskPackageRoot=Split-Path -Parent $PSScriptRoot
$taskUrl='http://127.0.0.1:8765'
try {
  $taskExisting=$null
  try {$taskExisting=Invoke-RestMethod "$taskUrl/api/package-info" -TimeoutSec 2} catch {}
  if($taskExisting -and $taskExisting.app -eq 'tienlo-companion') {
    if(!$NoOpen){Start-Process "$taskUrl/index.html"}
    exit 0
  }
  $taskPortBusy=Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
  if($taskPortBusy){throw 'Cong 8765 dang duoc ung dung khac su dung. Tat server tool cu roi thu lai.'}
  $taskNode=Join-Path $taskPackageRoot 'runtime/node.exe'
  if(!(Test-Path -LiteralPath $taskNode)){throw 'Thieu runtime/node.exe. Hay giai nen toan bo goi ZIP truoc khi chay.'}
  $taskLogPath=Join-Path $taskPackageRoot 'data/logs'
  New-Item -ItemType Directory -Path $taskLogPath -Force | Out-Null
  $taskServer=Start-Process -FilePath $taskNode -ArgumentList 'tools/dev-server.cjs 8765' -WorkingDirectory $taskPackageRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogPath 'server-output.log') -RedirectStandardError (Join-Path $taskLogPath 'server-error.log')
  $taskReady=$false
  for($taskRetry=0;$taskRetry -lt 30;$taskRetry++){
    Start-Sleep -Milliseconds 200
    try {$taskInfo=Invoke-RestMethod "$taskUrl/api/package-info" -TimeoutSec 1;if($taskInfo.app -eq 'tienlo-companion'){$taskReady=$true;break}} catch {}
    if($taskServer.HasExited){break}
  }
  if(!$taskReady){throw 'Server chua khoi dong. Xem data/logs/server-error.log.'}
  if(!$NoShortcut){
    $taskShell=New-Object -ComObject WScript.Shell
    $taskLink=$taskShell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Tien Lo Tro Thu.lnk'))
    $taskLink.TargetPath=Join-Path $taskPackageRoot 'CHAY-TOOL.bat';$taskLink.WorkingDirectory=$taskPackageRoot;$taskLink.Save()
  }
  if(!$NoOpen){Start-Process "$taskUrl/setup.html"}
} catch {Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red;exit 1}
