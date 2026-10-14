@echo off
chcp 65001 > nul
title Cấu hình Mạng Nội bộ (LAN) - Quản lý Nhân sự

:: Kiểm tra quyền Administrator và tự động xin quyền nếu cần
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Đang yêu cầu quyền Administrator để mở tường lửa Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ==============================================================================
echo   CẤU HÌNH MỞ TƯỜNG LỬA (FIREWALL) CHO MẠNG NỘI BỘ (LAN) - QLNS
echo ==============================================================================
echo.

:: 1. Mở Firewall cho Port 3100 (Docker Web Production)
netsh advfirewall firewall show rule name="QLNS_Web_3100" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="QLNS_Web_3100" dir=in action=allow protocol=TCP localport=3100 profile=any >nul
    echo [+] Đã mở Port 3100 (Web Production) trên Windows Firewall.
) else (
    echo [v] Port 3100 đã được mở trước đó.
)

:: 2. Mở Firewall cho Port 5173 (Vite Dev Server)
netsh advfirewall firewall show rule name="QLNS_Web_5173" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="QLNS_Web_5173" dir=in action=allow protocol=TCP localport=5173 profile=any >nul
    echo [+] Đã mở Port 5173 (Web Dev) trên Windows Firewall.
) else (
    echo [v] Port 5173 đã được mở trước đó.
)

:: 3. Mở Firewall cho Port 4000 (Backend API)
netsh advfirewall firewall show rule name="QLNS_API_4000" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="QLNS_API_4000" dir=in action=allow protocol=TCP localport=4000 profile=any >nul
    echo [+] Đã mở Port 4000 (Backend API) trên Windows Firewall.
) else (
    echo [v] Port 4000 đã được mở trước đó.
)

echo.
echo ==============================================================================
echo   THÔNG TIN ĐỊA CHỈ TRUY CẬP TỪ CÁC MÁY KHÁC TRONG MẠNG LAN:
echo ==============================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.InterfaceAlias -notlike '*vEthernet*' -and $_.IPAddress -notlike '169.254*' }
foreach ($ip in $ips) {
    Write-Host '   >> Địa chỉ IP LAN (' $ip.InterfaceAlias '): ' -NoNewline -ForegroundColor Cyan
    Write-Host $ip.IPAddress -ForegroundColor Yellow
    Write-Host '      Đường dẫn truy cập 1 (Chính thức): ' -NoNewline
    Write-Host ('http://' + $ip.IPAddress + ':3100') -ForegroundColor Green
    Write-Host '      Đường dẫn truy cập 2 (Phát triển): ' -NoNewline
    Write-Host ('http://' + $ip.IPAddress + ':5173') -ForegroundColor Green
    Write-Host ''
}
"

echo   >> Ngoài ra có thể dùng tên máy:
echo      http://%COMPUTERNAME%:3100
echo      http://%COMPUTERNAME%:5173
echo.
echo ==============================================================================
echo   LƯU Ý: Các máy tính, điện thoại, máy tính bảng phải kết nối cùng mạng Wi-Fi
echo   hoặc mạng dây LAN nội bộ của Trường Cao đẳng Hàng hải và Đường thủy I.
echo ==============================================================================
echo.
pause
