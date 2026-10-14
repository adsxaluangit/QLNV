const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const qtls = await prisma.quaTrinhLuong.findMany({
    include: { ngach: true, nhanSu: true }
  });
  console.log('Total QuaTrinhLuong:', qtls.length);
  const withNgach = qtls.filter(q => q.ngachId !== null);
  const withBac = qtls.filter(q => q.bac !== null);
  const withMoc = qtls.filter(q => q.mocNangBac !== null);
  console.log('With ngachId:', withNgach.length);
  console.log('With bac:', withBac.length);
  console.log('With mocNangBac:', withMoc.length);

  console.log('\nSample 5 QuaTrinhLuong:', JSON.stringify(qtls.slice(0, 5).map(q => ({
    nhanSu: q.nhanSu?.hoTen,
    ngachId: q.ngachId,
    ngach: q.ngach?.ma,
    bac: q.bac,
    heSo: q.heSo,
    mocNangBac: q.mocNangBac,
    tuNgay: q.tuNgay,
    luongThoaThuan: q.luongThoaThuan,
  })), null, 2));

  // Let's also check if any DeXuatNangLuong would trigger
  const { deXuatNangLuong } = require('../dist/luong/nghiep-vu-luong.js');
  let deXuatCount = 0;
  for (const q of qtls) {
    if (q.ngach) {
      const dx = deXuatNangLuong(q, q.ngach);
      if (dx) deXuatCount++;
    }
  }
  console.log('\nTotal deXuatNangLuong possible:', deXuatCount);
}

check().catch(console.error).finally(() => prisma.$disconnect());
