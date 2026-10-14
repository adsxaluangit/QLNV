const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
  const staff = await prisma.nhanSu.findMany({
    select: {
      maCanBo: true,
      hoTen: true,
      ngayTuyenDung: true,
      ngayVaoTruong: true
    }
  });

  const coNgayTD = staff.filter(s => s.ngayTuyenDung).length;
  const coNgayVT = staff.filter(s => s.ngayVaoTruong).length;

  console.log('Tổng số cán bộ:', staff.length);
  console.log({ coNgayTD, coNgayVT });

  console.log('\nMẫu 10 cán bộ có ngày tuyển dụng:');
  staff.filter(s => s.ngayTuyenDung).slice(0, 10).forEach(s => {
    console.log(s.hoTen, '| Ngày TD:', s.ngayTuyenDung.toISOString().slice(0, 10));
  });
}

checkDates().catch(console.error).finally(() => prisma.$disconnect());
