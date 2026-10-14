const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const cc = await prisma.chamCong.groupBy({ by: ['nguoiCham'], _count: true, _min: { ngay: true }, _max: { ngay: true, updatedAt: true } });
  console.log('Chấm công:', JSON.stringify(cc));
  const dn = await prisma.donNghi.findMany({ include: { nhanSu: { select: { hoTen: true } } } });
  console.log('Đơn nghỉ:', JSON.stringify(dn.map((d) => [d.nhanSu.hoTen, d.loai, d.tuNgay, d.denNgay, d.trangThai, d.createdAt])));
  const kn = await prisma.nhanSu.findMany({ where: { kiemNhiem: true }, select: { hoTen: true, donVi: { select: { ten: true } } } });
  console.log('Kiêm nhiệm:', JSON.stringify(kn));
  const nk = await prisma.nhatKy.findMany({ orderBy: { thoiGian: 'desc' }, take: 8, select: { thoiGian: true, tenDangNhap: true, moTa: true } });
  nk.forEach((n) => console.log(' -', n.thoiGian.toISOString(), n.tenDangNhap, n.moTa));
})().finally(() => prisma.$disconnect());
