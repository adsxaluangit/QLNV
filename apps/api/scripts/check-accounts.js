const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.taiKhoan.findMany({ include: { nhanSu: true } });
  console.log('Total accounts:', users.length);
  users.forEach(u => console.log('User:', u.tenDangNhap, 'vaiTro:', u.vaiTro, 'nhanSuId:', u.nhanSuId, 'nhanSuMa:', u.nhanSu?.maCanBo));
}

main().catch(console.error).finally(() => prisma.$disconnect());
