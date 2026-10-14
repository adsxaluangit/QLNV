const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLoaiNhanSu() {
  const staff = await prisma.nhanSu.findMany({
    select: {
      id: true,
      maCanBo: true,
      hoTen: true,
      loaiNhanSu: true,
      chucDanhNgheNghiep: true,
      donVi: { select: { ten: true } },
      hopDongs: { select: { loai: true } },
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' }, take: 1 }
    }
  });

  const vc = staff.filter(s => s.loaiNhanSu === 'VIEN_CHUC');
  const hd = staff.filter(s => s.loaiNhanSu === 'HOP_DONG');
  const tg = staff.filter(s => s.loaiNhanSu === 'THINH_GIANG');

  console.log('Tổng số cán bộ:', staff.length);
  console.log('Viên chức:', vc.length);
  console.log('Hợp đồng:', hd.length);
  console.log('Thỉnh giảng:', tg.length);

  console.log('\nDanh sách cán bộ Hợp đồng:');
  hd.forEach((s, idx) => {
    const qtl = s.quaTrinhLuongs[0];
    console.log(`${idx + 1}. [${s.maCanBo}] ${s.hoTen} | ĐV: ${s.donVi.ten} | HĐ: ${s.hopDongs[0]?.loai} | HeSo: ${qtl?.heSo} | LuongTT: ${qtl?.luongThoaThuan}`);
  });
}

checkLoaiNhanSu().catch(console.error).finally(() => prisma.$disconnect());
