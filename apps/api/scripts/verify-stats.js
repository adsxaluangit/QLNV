const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const all = await prisma.nhanSu.findMany({
    include: { donVi: true, chucVu: true }
  });
  const tam = all.filter(s => s.maCanBo.startsWith('TAM-'));
  const validCccd = all.filter(s => /^\d{12}$/.test(s.maCanBo));
  const hasDob = all.filter(s => s.ngaySinh !== null);
  const hasGender = all.filter(s => s.gioiTinh !== null);
  const hasNoiSinh = all.filter(s => s.noiSinh !== null && s.noiSinh !== '');
  const hasQueQuan = all.filter(s => s.queQuan !== null && s.queQuan !== '');
  const hasPhone = all.filter(s => s.dienThoai !== null && s.dienThoai !== '');
  const hasEmail = all.filter(s => s.email !== null && s.email !== '');
  const hasBhxh = all.filter(s => s.soBhxh !== null && s.soBhxh !== '');
  const hasTrinhDo = all.filter(s => s.trinhDoChuyenMon !== null);
  const hasDang = all.filter(s => s.ngayVaoDang !== null);

  console.log('=== VERIFICATION STATS ===');
  console.log('Total staff:', all.length);
  console.log('Staff with temporary code (TAM-xxxx):', tam.length);
  console.log('Staff with valid 12-digit CCCD:', validCccd.length);
  console.log('Staff with Date of Birth:', hasDob.length);
  console.log('Staff with Gender:', hasGender.length);
  console.log('Staff with Place of Birth (Nơi sinh):', hasNoiSinh.length);
  console.log('Staff with Hometown (Quê quán):', hasQueQuan.length);
  console.log('Staff with Phone number:', hasPhone.length);
  console.log('Staff with Email:', hasEmail.length);
  console.log('Staff with Social Insurance (BHXH):', hasBhxh.length);
  console.log('Staff with Qualification (Trình độ):', hasTrinhDo.length);
  console.log('Staff with Party admission date (Ngày vào Đảng):', hasDang.length);
  
  console.log('\nSample 3 staff after update:');
  all.slice(0, 3).forEach(s => {
    console.log(`- ${s.hoTen} (${s.maCanBo}): ĐV=${s.donVi?.ten}, NS=${s.ngaySinh?.toISOString().slice(0,10)}, Nơi sinh=${s.noiSinh}, SĐT=${s.dienThoai}, Trình độ=${s.trinhDoChuyenMon}`);
  });
}

verify().catch(console.error).finally(() => prisma.$disconnect());
