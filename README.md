# Phần mềm Quản lý Nhân sự – Trường Cao đẳng Nghề

Giai đoạn 1 gồm: cơ cấu tổ chức nhiều cơ sở, hồ sơ cán bộ (mã cán bộ = số CCCD), phân quyền theo vai trò và phạm vi dữ liệu, nhập/xuất Excel, tổng quan & nhắc việc, nhật ký thao tác.

## Chạy bằng Docker (máy chủ của trường)

```powershell
copy .env.example .env      # rồi sửa DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD
docker compose up -d --build
```

Mở `http://<địa-chỉ-máy-chủ>:3100` — đăng nhập `admin` / mật khẩu trong `ADMIN_PASSWORD` (bắt buộc đổi lần đầu).

| Dịch vụ | Vai trò |
|---|---|
| `web` | Nginx phục vụ giao diện + chuyển tiếp `/api` |
| `api` | NestJS; tự chạy migration và khởi tạo dữ liệu khi khởi động |
| `db` | PostgreSQL 16 (chỉ mở `127.0.0.1:5440`) |
| `backup` | `pg_dump` lúc 01:00 hằng ngày vào `./backups`, giữ 30 bản |

Khôi phục bản sao lưu:

```powershell
docker exec -i qlns_postgres pg_restore -U qlns -d qlns --clean --if-exists < backups\qlns_YYYYMMDD_0100.dump
```

> Đặt `SEED_DEMO=true` để có dữ liệu mẫu dùng thử (chỉ khi CSDL chưa có cơ sở nào). Khi chạy thật để `false`.

## Phát triển

```powershell
docker compose up -d db
cd apps/api; npm ci; npx prisma migrate dev; npm run build; npm run seed; npm run dev   # cổng 4000
cd apps/web; npm ci; npm run dev                                                       # cổng 5173
```

## Quy ước nghiệp vụ chính

- **Mã cán bộ = số CCCD 12 số** (người nước ngoài: số hộ chiếu). Khóa nội bộ là UUID nên đổi CCCD không làm hỏng dữ liệu liên quan; tên đăng nhập tự đổi theo.
- Form cảnh báo (không chặn) khi CCCD không khớp giới tính / năm sinh / mã tỉnh.
- Phạm vi dữ liệu: Quản trị & BGH – toàn trường; TCHC/Kế toán/Đào tạo – toàn trường hoặc một cơ sở; Trưởng đơn vị – đơn vị mình và đơn vị con; Cán bộ – chỉ bản thân.
- Mật khẩu tạm sinh ngẫu nhiên (không dùng ngày sinh vì đồng nghiệp đều biết CCCD + ngày sinh của nhau).
- Danh sách sắp xếp theo **tên** rồi họ tên.

## Cấu trúc

```
apps/api   NestJS + Prisma (src/nhan-su, to-chuc, tai-khoan, thong-ke, auth, common)
apps/web   React + Vite + Ant Design (src/pages, components)
```
