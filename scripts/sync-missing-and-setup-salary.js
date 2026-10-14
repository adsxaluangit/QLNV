const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v;
  }
  const str = v.toString().trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00.000Z`);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function mapTrinhDo(v) {
  if (!v) return null;
  const s = v.toString().toLowerCase();
  if (s.includes('tiến sĩ')) return 'TIEN_SI';
  if (s.includes('thạc sĩ')) return 'THAC_SI';
  if (s.includes('đại học')) return 'DAI_HOC';
  if (s.includes('cao đẳng')) return 'CAO_DANG';
  if (s.includes('trung cấp')) return 'TRUNG_CAP';
  if (s.includes('sơ cấp')) return 'SO_CAP';
  return 'KHAC';
}

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.text) return v.text.toString().trim();
  const s = v.toString().trim();
  return s.length > 0 ? s : null;
}

async function main() {
  console.log('=== BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU CÁN BỘ & THIẾT LẬP NÂNG LƯƠNG ===');

  const existingStaff = await prisma.nhanSu.findMany({
    select: { id: true, maCanBo: true, hoTen: true }
  });
  const cccdSet = new Set(existingStaff.map(s => s.maCanBo));
  console.log(`Số cán bộ hiện có trong DB: ${existingStaff.length}`);

  const donViList = await prisma.donVi.findMany();
  const getDonViId = (ma) => donViList.find(d => d.ma === ma)?.id;

  const ngachList = await prisma.ngachLuong.findMany();
  const getNgach = (ma) => ngachList.find(n => n.ma.toLowerCase() === ma.toLowerCase());

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const seenCccd = new Set();
  const missingStaffToCreate = [];

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const hoTen = cleanStr(row.getCell(3).value);
    if (!hoTen || hoTen === 'Tên CC/VC' || hoTen.includes('Trường cao đẳng')) continue;

    let cccd = cleanStr(row.getCell(2).value) || cleanStr(row.getCell(12).value);
    if (!cccd) continue;
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');

    if (cccdSet.has(cccd) || seenCccd.has(cccd)) continue;
    seenCccd.add(cccd);

    const congViec = cleanStr(row.getCell(30).value) || '';
    const chucVu = cleanStr(row.getCell(39).value) || '';
    const chuyenNganh = cleanStr(row.getCell(48).value) || '';
    const ngachCol = cleanStr(row.getCell(42).value) || '';
    const loaiHDCol = cleanStr(row.getCell(43).value) || '';
    const doiTuongCol = cleanStr(row.getCell(37).value) || '';

    // Phân bổ đơn vị chính xác theo công việc & chuyên ngành
    let donViMa = 'P.TCHC';
    const textCv = (congViec + ' ' + chucVu).toLowerCase();
    const textAll = (congViec + ' ' + chucVu + ' ' + chuyenNganh).toLowerCase();

    if (textCv.includes('lái xe') || textCv.includes('bảo vệ') || textCv.includes('phục vụ') || textCv.includes('điện nước') || textCv.includes('lao động')) {
      donViMa = 'P.TCHC';
    } else if (textCv.includes('ktx') || textCv.includes('quản sinh') || textCv.includes('y tế')) {
      donViMa = 'P.HSSV';
    } else if (textCv.includes('kế toán')) {
      donViMa = 'P.KHTC';
    } else if (textCv.includes('đktb') || textAll.includes('điều khiển tàu') || textAll.includes('máy tàu')) {
      donViMa = 'K.DKMT';
    } else if (textAll.includes('tự động hóa') || textAll.includes('cơ điện')) {
      donViMa = 'K.CD';
    } else if (textAll.includes('hàng hải') || textAll.includes('thủy thủ') || textAll.includes('boong')) {
      donViMa = 'K.HH';
    }

    const donViId = getDonViId(donViMa);

    let loaiHopDong = 'HDLD_XAC_DINH';
    if (loaiHDCol.includes('không xác định') || loaiHDCol.includes('không thời hạn')) {
      loaiHopDong = doiTuongCol.includes('Viên chức') ? 'HDLV_KHONG_XAC_DINH' : 'HDLD_KHONG_XAC_DINH';
    } else if (doiTuongCol.includes('Viên chức')) {
      loaiHopDong = 'HDLV_XAC_DINH';
    }

    const parts = hoTen.split(/\s+/);
    const ten = parts[parts.length - 1];

    const ngaySinh = parseDate(row.getCell(6).value) || new Date('1980-01-01T00:00:00.000Z');
    const gioiTinhVal = cleanStr(row.getCell(7).value);
    const gioiTinh = (gioiTinhVal && gioiTinhVal.toLowerCase().includes('nữ')) ? 'NU' : 'NAM';
    const ngayTuyenDung = parseDate(row.getCell(40).value) || parseDate(row.getCell(20).value) || new Date('2020-01-01T00:00:00.000Z');

    missingStaffToCreate.push({
      maCanBo: cccd,
      hoTen,
      ten,
      gioiTinh,
      ngaySinh,
      noiSinh: cleanStr(row.getCell(14).value),
      queQuan: cleanStr(row.getCell(15).value),
      quocTich: cleanStr(row.getCell(9).value) || 'Việt Nam',
      danToc: cleanStr(row.getCell(10).value) || 'Kinh',
      tonGiao: cleanStr(row.getCell(11).value) || 'Không',
      ngayCapCccd: parseDate(row.getCell(13).value),
      noiCapCccd: cleanStr(row.getCell(14).value),
      dienThoai: cleanStr(row.getCell(5).value),
      email: cleanStr(row.getCell(4).value),
      choOHienNay: cleanStr(row.getCell(16).value),
      soBhxh: cleanStr(row.getCell(17).value),
      donViId,
      loaiNhanSu: doiTuongCol.includes('Viên chức') ? 'VIEN_CHUC' : 'HOP_DONG',
      trangThai: 'DANG_LAM_VIEC',
      laGiangVien: congViec.toLowerCase().includes('giảng') || chucVu.toLowerCase().includes('giảng'),
      chucDanhNgheNghiep: ngachCol || '00',
      trinhDoChuyenMon: mapTrinhDo(row.getCell(27).value) || mapTrinhDo(row.getCell(46).value) || 'KHAC',
      chuyenNganh,
      lyLuanChinhTri: cleanStr(row.getCell(51).value),
      ngayTuyenDung,
      ngayVaoDang: parseDate(row.getCell(62).value),
      ngayChinhThucDang: parseDate(row.getCell(63).value),
      ghiChu: `Bổ sung từ CBNV Sheet 1 (${congViec || chucVu})`,
      _extra: {
        loaiHopDong,
        ngachCol,
        congViec,
        ngayTuyenDung
      }
    });
  }

  console.log(`Tìm thấy ${missingStaffToCreate.length} cán bộ còn thiếu cần nạp bổ sung.`);

  // 1. Tạo các cán bộ mới
  for (const s of missingStaffToCreate) {
    const extra = s._extra;
    delete s._extra;

    const ns = await prisma.nhanSu.create({
      data: s
    });

    // Tạo hợp đồng
    await prisma.hopDong.create({
      data: {
        nhanSuId: ns.id,
        soHopDong: `HĐ-${ns.maCanBo.slice(-6)}`,
        loai: extra.loaiHopDong,
        tuNgay: extra.ngayTuyenDung,
        ghiChu: extra.congViec ? `Vị trí: ${extra.congViec}` : null
      }
    });

    // Xác định ngạch và bậc ban đầu cho cán bộ mới
    let ngach = null;
    let heSo = 1.86;
    let bac = 1;

    if (ns.laGiangVien || extra.ngachCol === 'V.09.02.03') {
      ngach = getNgach('V.09.02.03');
      heSo = 2.34;
      bac = 1;
    } else if (extra.ngachCol === '06.031') {
      ngach = getNgach('06.031');
      heSo = 2.34;
      bac = 1;
    } else if (extra.ngachCol === 'V.09.02.04') {
      ngach = getNgach('V.09.02.04');
      heSo = 2.10;
      bac = 1;
    } else {
      // Nhân viên hành chính / lái xe / bảo vệ / phục vụ
      ngach = getNgach('01.005'); // Nhân viên ngạch B
      heSo = 1.86;
      bac = 1;
    }

    await prisma.quaTrinhLuong.create({
      data: {
        nhanSuId: ns.id,
        tuNgay: extra.ngayTuyenDung,
        mocNangBac: extra.ngayTuyenDung,
        ngachId: ngach ? ngach.id : null,
        bac,
        heSo,
        phanTramVuotKhung: 0,
        ghiChu: 'Khởi tạo theo hồ sơ CBNV'
      }
    });
  }

  console.log(`Đã nạp thành công ${missingStaffToCreate.length} cán bộ bổ sung.`);

  // 2. Cập nhật Ngạch, Bậc và Mốc nâng bậc cho TOÀN BỘ cán bộ
  const allStaff = await prisma.nhanSu.findMany({
    include: {
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' }, take: 1 }
    }
  });

  console.log(`\nTiến hành ghép Ngạch, Bậc và tính Mốc nâng bậc cho ${allStaff.length} cán bộ...`);

  let countUpdated = 0;
  const homNay = new Date('2026-10-13T00:00:00.000Z');

  for (const ns of allStaff) {
    const qtl = ns.quaTrinhLuongs[0];
    if (!qtl || !qtl.heSo) continue;

    const cd = (ns.chucDanhNgheNghiep || '').trim();
    let ngach = getNgach(cd);

    if (!ngach) {
      // Tìm theo hệ số
      const candidates = ngachList.filter(n => n.heSo.includes(qtl.heSo));
      if (candidates.length === 1) {
        ngach = candidates[0];
      } else if (candidates.length > 1) {
        // Ưu tiên V.09.02.03 cho giảng viên/khoa, 01.003 cho phòng ban
        if (ns.laGiangVien || cd.startsWith('V.')) {
          ngach = candidates.find(c => c.ma === 'V.09.02.03') || candidates[0];
        } else {
          ngach = candidates.find(c => c.ma === '01.003') || candidates[0];
        }
      }
    }

    // Nếu vẫn chưa có (ví dụ các trường hợp đặc thù 3.63, 3.66...)
    if (!ngach) {
      if (qtl.heSo >= 4.40) ngach = getNgach('V.09.02.02') || getNgach('01.002');
      else if (qtl.heSo >= 2.34) ngach = getNgach('V.09.02.03') || getNgach('01.003');
      else ngach = getNgach('01.005');
    }

    if (!ngach) continue;

    // Tìm bậc trong ngạch
    let bac = ngach.heSo.indexOf(qtl.heSo) + 1;
    if (bac <= 0) {
      // Tìm bậc có hệ số gần nhất
      let minDiff = 999;
      let closestBac = 1;
      ngach.heSo.forEach((hs, idx) => {
        const diff = Math.abs(hs - qtl.heSo);
        if (diff < minDiff) {
          minDiff = diff;
          closestBac = idx + 1;
        }
      });
      bac = closestBac;
    }

    // Tính mốc nâng bậc (mocNangBac):
    // Dựa vào ngày tuyển dụng ns.ngayTuyenDung và bậc lương hiện hưởng
    const ntd = ns.ngayTuyenDung ? new Date(ns.ngayTuyenDung) : new Date('2020-01-01T00:00:00.000Z');
    const chuKyThang = ngach.thangNangBac; // 36 tháng hoặc 24 tháng

    // Cán bộ vào bậc `bac` sau: (bac - 1) * chuKyThang
    // moc = ntd + (bac - 1) * chuKyThang
    let moc = new Date(ntd);
    moc.setUTCMonth(moc.getUTCMonth() + (bac - 1) * chuKyThang);

    // Nếu mốc này rơi vào tương lai (> 10/2026), điều chỉnh về chu kỳ gần nhất
    if (moc > homNay) {
      // Giảm từng chu kỳ cho đến khi <= hôm nay
      while (moc > homNay) {
        moc.setUTCMonth(moc.getUTCMonth() - chuKyThang);
      }
    }

    // Nếu mốc này quá cũ trong quá khứ (> 4 năm trước) mà chưa có quyết định mới
    // (nhưng không phải bậc cuối): cán bộ này sẽ bị QUÁ HẠN nâng bậc, điều này là chính xác
    // theo thực tế hồ sơ để phần mềm cảnh báo TCHC.

    await prisma.quaTrinhLuong.update({
      where: { id: qtl.id },
      data: {
        ngachId: ngach.id,
        bac,
        mocNangBac: moc
      }
    });

    countUpdated++;
  }

  console.log(`Đã cập nhật thành công Ngạch, Bậc và Mốc nâng bậc cho ${countUpdated} cán bộ.`);

  // 3. Thống kê kết quả
  const totalInDb = await prisma.nhanSu.count();
  console.log(`\n=== TỔNG KẾT: TỔNG SỐ NHÂN SỰ TRONG DB HIỆN TẠI: ${totalInDb} (Khớp với hồ sơ CBNV) ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
