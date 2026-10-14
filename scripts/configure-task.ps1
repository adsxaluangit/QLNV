$task = Get-ScheduledTask -TaskName 'QLNS_AutoBackup_Weekly' -ErrorAction SilentlyContinue
if ($task) {
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Set-ScheduledTask -TaskName 'QLNS_AutoBackup_Weekly' -Settings $settings | Out-Null
    Write-Host "Da bat tinh nang StartWhenAvailable: Tu dong sao luu bu ngay khi bat may neu lo gio hen!" -ForegroundColor Green
}
