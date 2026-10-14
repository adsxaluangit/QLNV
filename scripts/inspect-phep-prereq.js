const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tk = await prisma.taiKhoan.findMany({ select: { tenDangNhap: true, vaiTro: true, nhanSuId: true, hoatDong: true } });
  console.log('Tài khoản hiện có:', tk.length);
  tk.forEach((t) => console.log(' -', t.tenDangNhap, t.vaiTro, t.nhanSuId ? '(gắn cán bộ)' : ''));

  const cv = await prisma.chucVu.findMany({ include: { _count: { select: { nhanSus: true } } }, orderBy: { thuTu: 'asc' } });
  console.log('\nChức vụ:');
  cv.forEach((c) => console.log(` - ${c.ten}: ${c._count.nhanSus} người`));

  const gv = await prisma.nhanSu.count({ where: { laGiangVien: true } });
  const tong = await prisma.nhanSu.count();
  console.log(`\nGiảng viên (laGiangVien=true): ${gv}/${tong}`);

  const lanhDao = await prisma.nhanSu.findMany({
    where: { chucVuId: { not: null } },
    select: { hoTen: true, maCanBo: true, laGiangVien: true, chucVu: { select: { ten: true } }, donVi: { select: { ma: true, ten: true } } },
    orderBy: { donVi: { ma: 'asc' } },
  });
  console.log('\nCán bộ có chức vụ:');
  lanhDao.forEach((n) => console.log(` - [${n.donVi.ma}] ${n.hoTen} | ${n.chucVu.ten} | GV=${n.laGiangVien}`));

  const dv = await prisma.donVi.findMany({ include: { coSo: true, _count: { select: { nhanSus: true } } }, orderBy: { thuTu: 'asc' } });
  console.log('\nĐơn vị:');
  dv.forEach((d) => console.log(` - ${d.ma} | ${d.ten} | ${d.coSo.ma} | ${d._count.nhanSus} người`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
