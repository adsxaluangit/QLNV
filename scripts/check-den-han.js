const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDenHan() {
  const staff = await prisma.nhanSu.findMany({
    where: { trangThai: 'DANG_LAM_VIEC' },
    select: {
      id: true,
      maCanBo: true,
      hoTen: true,
      donVi: { select: { ten: true } },
      quaTrinhLuongs: { orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }], take: 1, include: { ngach: true } }
    }
  });

  function congThang(d, thang) {
    const kq = new Date(d);
    kq.setUTCMonth(kq.getUTCMonth() + thang);
    return kq;
  }

  function deXuatNangLuong(qtl, ngach) {
    if (!ngach || !qtl.bac) return null;
    const soBac = ngach.heSo.length;
    const bacCuoi = ngach.heSo[soBac - 1];
    if (qtl.bac < soBac) {
      return {
        loai: 'NANG_BAC',
        ngayDenHan: congThang(qtl.mocNangBac, ngach.thangNangBac),
        bacMoi: qtl.bac + 1,
        heSoMoi: ngach.heSo[qtl.bac],
        vuotKhungMoi: 0
      };
    }
    const lanDau = qtl.phanTramVuotKhung === 0;
    return {
      loai: 'VUOT_KHUNG',
      ngayDenHan: congThang(qtl.mocNangBac, lanDau ? ngach.thangNangBac : 12),
      bacMoi: soBac,
      heSoMoi: bacCuoi,
      vuotKhungMoi: lanDau ? 5 : qtl.phanTramVuotKhung + 1
    };
  }

  const homNay = new Date('2026-10-13T00:00:00.000Z');
  const denNgay3Thang = congThang(homNay, 3);
  const denNgay6Thang = congThang(homNay, 6);
  const denNgay12Thang = congThang(homNay, 12);

  const list3m = [];
  const list12m = [];

  for (const ns of staff) {
    const qtl = ns.quaTrinhLuongs[0];
    if (!qtl || !qtl.ngach) continue;
    const dx = deXuatNangLuong(qtl, qtl.ngach);
    if (!dx) continue;

    const item = {
      maCanBo: ns.maCanBo,
      hoTen: ns.hoTen,
      donVi: ns.donVi.ten,
      ngach: qtl.ngach.ma,
      bacHienTai: qtl.bac,
      heSoHienTai: qtl.heSo,
      bacMoi: dx.bacMoi,
      heSoMoi: dx.heSoMoi,
      loai: dx.loai,
      ngayDenHan: dx.ngayDenHan.toISOString().slice(0, 10),
      quaHan: dx.ngayDenHan < homNay
    };

    if (dx.ngayDenHan <= denNgay3Thang) list3m.push(item);
    if (dx.ngayDenHan <= denNgay12Thang) list12m.push(item);
  }

  console.log('Tổng số cán bộ đang làm việc:', staff.length);
  console.log('Số cán bộ đến hạn trong 3 tháng tới:', list3m.length);
  console.log('Số cán bộ đến hạn trong 12 tháng tới:', list12m.length);
  console.log('\nMẫu 10 cán bộ đến hạn trong 3 tháng tới:');
  console.table(list3m.slice(0, 10));
}

checkDenHan().catch(console.error).finally(() => prisma.$disconnect());
