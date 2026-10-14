# Xoa task cu Weekly neu ton tai
try {
    Unregister-ScheduledTask -TaskName 'QLNS_AutoBackup_Weekly' -Confirm:$false -ErrorAction SilentlyContinue
} catch {}

# Tao task moi Daily luc 02:00 hang ngay
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File d:\Code\QLNV\scripts\auto-backup.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'QLNS_AutoBackup_Daily' -Action $action -Trigger $trigger -Settings $settings -Description 'Tu dong sao luu CSDL QLNS hang ngay luc 02:00, giu 7 ngay gan nhat' -Force

Write-Host "DA THIET LAP THANH CONG LICH SAO LUU HANG NGAY (QLNS_AutoBackup_Daily):" -ForegroundColor Green
Get-ScheduledTask -TaskName 'QLNS_AutoBackup_Daily' | Format-List TaskName, State, Description
