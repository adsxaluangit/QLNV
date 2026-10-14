const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAllTypes() {
  const staff = await prisma.nhanSu.findMany({
    select: {
      id: true,
      maCanBo: true,
      hoTen: true,
      loaiNhanSu: true,
      chucDanhNgheNghiep: true,
      hopDongs: { select: { loai: true, ghiChu: true } },
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' }, take: 1 }
    }
  });

  const hdList = staff.filter(s => s.loaiNhanSu === 'HOP_DONG' || s.hopDongs[0]?.loai?.startsWith('HDLD'));
  console.log(`Tìm thấy ${hdList.length} cán bộ có tính chất Hợp đồng lao động:`);
  hdList.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.maCanBo}] ${s.hoTen} | Loại NS: ${s.loaiNhanSu} | HĐ: ${s.hopDongs[0]?.loai} | Ghi chú: ${s.hopDongs[0]?.ghiChu}`);
  });
}

inspectAllTypes().catch(console.error).finally(() => prisma.$disconnect());
