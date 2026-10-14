@echo off
chcp 65001 > nul
title Sao lưu CSDL Quản lý Nhân sự - Trường CĐ Hàng hải và Đường thủy I
echo ====================================================================
echo   ĐANG TIẾN HÀNH SAO LƯU DỮ LIỆU CSDL QUẢN LÝ NHÂN SỰ (QLNS)...
echo ====================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto-backup.ps1"

echo.
echo ====================================================================
echo   HOÀN TẤT. Bấm phím bất kỳ để đóng cửa sổ này.
echo ====================================================================
pause > nul
