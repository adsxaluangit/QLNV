const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ds = await prisma.nhanSu.findMany({
    where: { chucVu: { ten: { in: ['Hiệu trưởng', 'Phó Hiệu trưởng', 'Trưởng phòng', 'Trưởng khoa', 'Giám đốc trung tâm'] } } },
    select: { hoTen: true, maCanBo: true, chucVu: { select: { ten: true } }, donVi: { select: { ma: true } }, taiKhoan: { select: { vaiTro: true } } },
    orderBy: { donVi: { ma: 'asc' } },
  });
  ds.forEach((n) => console.log(`${n.donVi.ma.padEnd(8)} | ${n.chucVu.ten.padEnd(20)} | ${n.hoTen} | ${n.maCanBo} | TK=${n.taiKhoan?.vaiTro ?? '-'}`));
  const maiTheHai = await prisma.nhanSu.findFirst({ where: { hoTen: 'Mai Thế Hải' }, select: { donVi: { select: { ma: true } }, chucVu: true, laGiangVien: true } });
  console.log('Mai Thế Hải:', JSON.stringify(maiTheHai));
}
main().catch(console.error).finally(() => prisma.$disconnect());
