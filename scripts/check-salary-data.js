const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ngachList = await prisma.ngachLuong.findMany();
  console.log('--- DANH SÁCH NGẠCH LƯƠNG TRONG DB ---');
  ngachList.forEach(n => {
    console.log(`Mã: ${n.ma} | Tên: ${n.ten} | Nhóm: ${n.nhom} | Bậc heSo: [${n.heSo.join(', ')}] | ThangNangBac: ${n.thangNangBac}`);
  });

  const totalNhanSu = await prisma.nhanSu.count();
  const qtlCount = await prisma.quaTrinhLuong.count();
  const qtlCoNgach = await prisma.quaTrinhLuong.count({ where: { ngachId: { not: null } } });
  const qtlCoBac = await prisma.quaTrinhLuong.count({ where: { bac: { not: null } } });

  console.log('\n--- THỐNG KÊ QUÁ TRÌNH LƯƠNG ---');
  console.log({ totalNhanSu, qtlCount, qtlCoNgach, qtlCoBac });

  // Lấy 5 bản ghi mẫu của QuaTrinhLuong
  const sampleQtl = await prisma.quaTrinhLuong.findMany({
    take: 5,
    include: { nhanSu: { select: { maCanBo: true, hoTen: true, chucDanhNgheNghiep: true, ngayTuyenDung: true } }, ngach: true }
  });
  console.log('\n--- MẪU 5 BẢN GHI QUA TRINH LUONG ---');
  sampleQtl.forEach(q => {
    console.log({
      maCanBo: q.nhanSu?.maCanBo,
      hoTen: q.nhanSu?.hoTen,
      chucDanh: q.nhanSu?.chucDanhNgheNghiep,
      heSo: q.heSo,
      bac: q.bac,
      ngachId: q.ngachId,
      ngach: q.ngach ? q.ngach.ma : null,
      mocNangBac: q.mocNangBac,
      tuNgay: q.tuNgay
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
