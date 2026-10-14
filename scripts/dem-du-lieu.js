const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const bang = ['coSo', 'donVi', 'chucVu', 'nhanSu', 'taiKhoan', 'quaTrinhLuong', 'phuCap', 'hopDong', 'quaTrinhCongTac', 'vanBang', 'quanHeGiaDinh', 'ngachLuong', 'quyPhep', 'donNghi', 'ngayNghiLe', 'chamCong', 'bangChamCong', 'chamCongThang', 'nhatKy'];
  for (const b of bang) console.log(b.padEnd(18), await prisma[b].count());
  console.log('Kiêm nhiệm:', await prisma.nhanSu.count({ where: { kiemNhiem: true } }));
  console.log('Tài khoản test còn sót:', await prisma.taiKhoan.count({ where: { tenDangNhap: { startsWith: 'e2e' } } }));
})().finally(() => prisma.$disconnect());
