const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateContractFixedSalary() {
  console.log('=== CẬP NHẬT LƯƠNG CỐ ĐỊNH CHO CÁN BỘ HỢP ĐỒNG LAO ĐỘNG ===');

  const contractStaff = await prisma.nhanSu.findMany({
    where: { loaiNhanSu: 'HOP_DONG' },
    include: {
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' } },
      hopDongs: { orderBy: { tuNgay: 'desc' } }
    }
  });

  console.log(`Tìm thấy ${contractStaff.length} cán bộ thuộc diện Hợp đồng lao động.`);

  for (const ns of contractStaff) {
    const hd = ns.hopDongs[0];
    const congViec = (hd?.ghiChu || ns.ghiChu || '').toLowerCase();
    
    // Xác định mức lương cố định thỏa thuận theo vị trí công việc
    let luongCoDinh = 5500000; // Mức cơ bản cho nhân viên phục vụ / lao động

    if (congViec.includes('lái xe') || ns.hoTen.includes('Khắc Thơ') || ns.hoTen.includes('Mạnh Chiến')) {
      luongCoDinh = 7000000; // Lái xe chuyên dùng
    } else if (congViec.includes('thủy thủ') || ns.hoTen.includes('Kim Chính')) {
      luongCoDinh = 7000000; // Thủy thủ tàu huấn luyện
    } else if (congViec.includes('ktx') || congViec.includes('quản sinh') || congViec.includes('y tế') || congViec.includes('điện nước')) {
      luongCoDinh = 6500000; // KTX, quản sinh, y tế, kỹ thuật điện nước
    } else if (congViec.includes('bảo vệ')) {
      luongCoDinh = 6000000; // Nhân viên bảo vệ
    }

    const tuNgay = ns.ngayTuyenDung || new Date('2023-07-01T00:00:00.000Z');

    if (ns.quaTrinhLuongs.length > 0) {
      // Cập nhật tất cả các quá trình lương hiện có về lương cố định không có ngạch/bậc/hệ số
      for (const qtl of ns.quaTrinhLuongs) {
        await prisma.quaTrinhLuong.update({
          where: { id: qtl.id },
          data: {
            ngachId: null,
            bac: null,
            heSo: null,
            phanTramVuotKhung: 0,
            luongThoaThuan: luongCoDinh,
            ghiChu: 'Lương cố định theo HĐLĐ (không theo hệ số)'
          }
        });
      }
    } else {
      // Tạo quá trình lương mới
      await prisma.quaTrinhLuong.create({
        data: {
          nhanSuId: ns.id,
          tuNgay,
          mocNangBac: tuNgay,
          ngachId: null,
          bac: null,
          heSo: null,
          phanTramVuotKhung: 0,
          luongThoaThuan: luongCoDinh,
          ghiChu: 'Lương cố định theo HĐLĐ (không theo hệ số)'
        }
      });
    }

    console.log(`- [${ns.maCanBo}] ${ns.hoTen.padEnd(24, ' ')} | Vị trí: ${(congViec.replace('vị trí: ', '')).padEnd(20, ' ')} | Lương cố định: ${luongCoDinh.toLocaleString('vi-VN')} đ/tháng`);
  }

  console.log('\n=== HOÀN TẤT CẬP NHẬT LƯƠNG CỐ ĐỊNH CHO CÁN BỘ HỢP ĐỒNG ===');
}

updateContractFixedSalary().catch(console.error).finally(() => prisma.$disconnect());
