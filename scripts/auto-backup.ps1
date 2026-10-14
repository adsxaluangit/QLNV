$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$backupDir = Join-Path $projectDir "backups"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timeStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpName = "qlns_backup_$timeStamp.dump"
$sqlName = "qlns_backup_$timeStamp.sql"
$dumpFile = Join-Path $backupDir $dumpName
$sqlFile = Join-Path $backupDir $sqlName
$logFile = Join-Path $backupDir "backup_history.log"

$timeNow = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$startMsg = "[$timeNow] Bat dau sao luu CSDL QLNS..."
Write-Host $startMsg
Add-Content -Path $logFile -Value $startMsg

try {
    # 1. Kiem tra docker container
    $containerRunning = docker inspect --format="{{.State.Running}}" qlns_postgres 2>$null
    if ($containerRunning -ne "true") {
        throw "Container qlns_postgres khong chay. Hay khoi dong Docker truoc khi sao luu."
    }

    # 2. Flush RAM to Disk
    docker exec qlns_postgres psql -U qlns -d qlns -c "CHECKPOINT;" | Out-Null

    # 3. Export dump file qua qlns_backup
    docker exec qlns_backup pg_dump -h db -U qlns -d qlns -Fc -f "/backups/$dumpName"

    # 4. Export SQL file qua qlns_backup
    docker exec qlns_backup pg_dump -h db -U qlns -d qlns -f "/backups/$sqlName"

    $dumpSizeKB = 0
    if (Test-Path $dumpFile) {
        $dumpSizeKB = [math]::Round((Get-Item $dumpFile).Length / 1024, 2)
    }
    $sqlSizeKB = 0
    if (Test-Path $sqlFile) {
        $sqlSizeKB = [math]::Round((Get-Item $sqlFile).Length / 1024, 2)
    }

    $finishTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $successMsg = "[$finishTime] SAO LUU THANH CONG! Dump: $dumpName ($dumpSizeKB KB) | SQL: $sqlName ($sqlSizeKB KB)"
    Write-Host $successMsg -ForegroundColor Green
    Add-Content -Path $logFile -Value $successMsg

    # 5. Xoa ban sao luu cu hon 7 ngay (chi giu 7 ngay gan nhat theo yeu cau)
    $limitDate = (Get-Date).AddDays(-7)
    Get-ChildItem -Path $backupDir -Filter "qlns_*" | Where-Object { 
        ($_.Extension -eq ".dump" -or $_.Extension -eq ".sql") -and ($_.LastWriteTime -lt $limitDate) 
    } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Add-Content -Path $logFile -Value "Da xoa ban cu (qua 7 ngay): $($_.Name)"
        Write-Host "Da xoa ban cu (qua 7 ngay): $($_.Name)" -ForegroundColor Yellow
    }

} catch {
    $errTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $errMsg = "[$errTime] LOI SAO LUU: $_"
    Write-Host $errMsg -ForegroundColor Red
    Add-Content -Path $logFile -Value $errMsg
    exit 1
}
