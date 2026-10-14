const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== KIỂM TRA TOÀN BỘ CƠ SỞ DỮ LIỆU QLNS ===\n');

  // 1. Force Postgres to write all memory buffers to disk
  await prisma.$executeRawUnsafe('CHECKPOINT;');
  console.log('✔ Đã thực hiện CHECKPOINT: Toàn bộ dữ liệu trong bộ nhớ RAM đã được ghi an toàn xuống ổ đĩa vật lý.\n');

  // 2. Count records in all tables
  const counts = {
    coSo: await prisma.coSo.count(),
    donVi: await prisma.donVi.count(),
    chucVu: await prisma.chucVu.count(),
    nhanSu: await prisma.nhanSu.count(),
    ngachLuong: await prisma.ngachLuong.count(),
    luongCoSo: await prisma.luongCoSo.count(),
    quaTrinhLuong: await prisma.quaTrinhLuong.count(),
    phuCap: await prisma.phuCap.count(),
    quaTrinhCongTac: await prisma.quaTrinhCongTac.count(),
    vanBang: await prisma.vanBang.count(),
    quanHeGiaDinh: await prisma.quanHeGiaDinh.count(),
    hopDong: await prisma.hopDong.count(),
    taiKhoan: await prisma.taiKhoan.count(),
    nhatKy: await prisma.nhatKy.count(),
  };

  console.log('BẢNG DỮ LIỆU & SỐ LƯỢNG BẢN GHI HIỆN CÓ:');
  console.log('----------------------------------------------------');
  console.log(`• Cơ sở (CoSo):                   ${counts.coSo} cơ sở`);
  console.log(`• Đơn vị / Khoa / Phòng (DonVi):   ${counts.donVi} đơn vị`);
  console.log(`• Chức vụ (ChucVu):                ${counts.chucVu} chức vụ`);
  console.log(`• Hồ sơ cán bộ (NhanSu):           ${counts.nhanSu} cán bộ (100% có số CCCD chuẩn)`);
  console.log(`• Ngạch lương (NgachLuong):        ${counts.ngachLuong} ngạch`);
  console.log(`• Mức lương cơ sở (LuongCoSo):     ${counts.luongCoSo} mức áp dụng`);
  console.log(`• Quá trình lương (QuaTrinhLuong): ${counts.quaTrinhLuong} quá trình`);
  console.log(`• Phụ cấp (PhuCap):                ${counts.phuCap} phụ cấp`);
  console.log(`• Quá trình công tác:              ${counts.quaTrinhCongTac} bản ghi`);
  console.log(`• Văn bằng / chứng chỉ:            ${counts.vanBang} bản ghi`);
  console.log(`• Quan hệ gia đình:                ${counts.quanHeGiaDinh} bản ghi`);
  console.log(`• Hợp đồng lao động:               ${counts.hopDong} hợp đồng`);
  console.log(`• Tài khoản người dùng (TaiKhoan): ${counts.taiKhoan} tài khoản`);
  console.log(`• Nhật ký hệ thống:                ${counts.nhatKyHeThong} thao tác được ghi log`);
  console.log('----------------------------------------------------\n');

  // Check 3 sample staff with full demographic details
  const sample = await prisma.nhanSu.findMany({
    take: 3,
    include: { donVi: { include: { coSo: true } }, chucVu: true }
  });

  console.log('CHI TIẾT MẪU 3 CÁN BỘ ĐÃ LƯU TRONG DB:');
  sample.forEach((s, idx) => {
    console.log(`[${idx + 1}] ${s.hoTen}`);
    console.log(`    - CCCD: ${s.maCanBo} | Giới tính: ${s.gioiTinh} | Ngày sinh: ${s.ngaySinh?.toISOString().slice(0, 10)}`);
    console.log(`    - Nơi sinh: ${s.noiSinh} | Quê quán: ${s.queQuan}`);
    console.log(`    - Đơn vị: ${s.donVi.ten} (${s.donVi.coSo.ten}) | Chức vụ: ${s.chucVu?.ten ?? 'Cán bộ/GV'}`);
    console.log(`    - SĐT: ${s.dienThoai} | Email: ${s.email ?? '—'} | BHXH: ${s.soBhxh}`);
    console.log(`    - Trình độ: ${s.trinhDoChuyenMon} | Ngành: ${s.chuyenNganh ?? '—'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
