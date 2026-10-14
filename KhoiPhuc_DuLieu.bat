@echo off
chcp 65001 > nul
title Khôi phục CSDL Quản lý Nhân sự - Trường CĐ Hàng hải và Đường thủy I
echo ====================================================================
echo   KHÔI PHỤC DỮ LIỆU CSDL QUẢN LÝ NHÂN SỰ TỪ BẢN SAO LƯU GẦN NHẤT
echo ====================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
    $backupDir = '%~dp0backups';
    $latest = Get-ChildItem -Path $backupDir -Filter 'qlns_weekly_*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1;
    if (-not $latest) {
        $latest = Get-ChildItem -Path $backupDir -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1;
    }
    if (-not $latest) {
        Write-Host 'Không tìm thấy file sao lưu .dump nào trong thư mục backups!' -ForegroundColor Red;
        exit 1;
    }
    Write-Host ('Tìm thấy bản sao lưu mới nhất: ' + $latest.Name) -ForegroundColor Cyan;
    Write-Host 'Đang khôi phục dữ liệu vào CSDL PostgreSQL...';
    docker exec -i qlns_postgres pg_restore -U qlns -d qlns --clean --if-exists ('/backups/' + $latest.Name);
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {
        Write-Host 'KHÔI PHỤC THÀNH CÔNG!' -ForegroundColor Green;
    } else {
        Write-Host 'Có cảnh báo hoặc lỗi trong quá trình khôi phục.' -ForegroundColor Yellow;
    }
}"

echo.
echo ====================================================================
echo   Bấm phím bất kỳ để đóng cửa sổ này.
echo ====================================================================
pause > nul
