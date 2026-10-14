const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const ds = await prisma.nhanSu.findMany({
    where: { laGiangVien: true, trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } },
    select: { hoTen: true, chucDanhNgheNghiep: true, donVi: { select: { ten: true, loai: true } }, chucVu: { select: { ten: true } } },
  });
  const theoLoai = {};
  ds.forEach((n) => { const k = n.donVi.loai; theoLoai[k] = (theoLoai[k] || 0) + 1; });
  console.log('Tổng GV:', ds.length, JSON.stringify(theoLoai));
  const phong = ds.filter((n) => n.donVi.loai !== 'KHOA' && n.donVi.loai !== 'TO_BO_MON');
  console.log('GV thuộc phòng/trung tâm/khác:', phong.length);
  phong.slice(0, 60).forEach((n) => console.log(' -', n.hoTen, '|', n.donVi.ten, '|', n.chucVu?.ten ?? '', '|', n.chucDanhNgheNghiep ?? ''));
  const cd = {};
  ds.forEach((n) => { const k = n.chucDanhNgheNghiep ?? '(trống)'; cd[k] = (cd[k] || 0) + 1; });
  console.log('Chức danh GV:', JSON.stringify(cd));
})().finally(() => prisma.$disconnect());
