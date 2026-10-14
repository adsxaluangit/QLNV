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

function cleanStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v.text) return v.text.toString().trim();
  const s = v.toString().trim();
  return s.length > 0 ? s : null;
}

async function run() {
  const existing = await prisma.nhanSu.findMany({ select: { id: true, maCanBo: true, hoTen: true } });
  const cccdSet = new Set(existing.map(s => s.maCanBo));

  const donViList = await prisma.donVi.findMany();
  const getDonViId = (ma) => donViList.find(d => d.ma === ma)?.id;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const seenCccd = new Set();
  const toCreate = [];

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

    // Xác định đơn vị theo thứ tự ưu tiên
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

    // Xác định loại hợp đồng
    let loaiHopDong = 'HDLD_XAC_DINH';
    if (loaiHDCol.includes('không xác định') || loaiHDCol.includes('không thời hạn')) {
      loaiHopDong = doiTuongCol.includes('Viên chức') ? 'HDLV_KHONG_XAC_DINH' : 'HDLD_KHONG_XAC_DINH';
    } else if (doiTuongCol.includes('Viên chức')) {
      loaiHopDong = 'HDLV_XAC_DINH';
    }

    const parts = hoTen.split(/\s+/);
    const ten = parts[parts.length - 1];

    const ngaySinh = parseDate(row.getCell(6).value);
    const gioiTinhVal = cleanStr(row.getCell(7).value);
    const gioiTinh = (gioiTinhVal && gioiTinhVal.toLowerCase().includes('nữ')) ? 'NU' : 'NAM';

    toCreate.push({
      maCanBo: cccd,
      hoTen,
      ten,
      gioiTinh,
      ngaySinh: ngaySinh || new Date('1980-01-01T00:00:00.000Z'),
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
      chucDanhNgheNghiep: ngachCol,
      trinhDoChuyenMon: cleanStr(row.getCell(27).value) || cleanStr(row.getCell(46).value),
      chuyenNganh,
      lyLuanChinhTri: cleanStr(row.getCell(51).value),
      ngayTuyenDung: parseDate(row.getCell(40).value) || parseDate(row.getCell(20).value) || new Date('2020-01-01T00:00:00.000Z'),
      ngayVaoDang: parseDate(row.getCell(62).value),
      ngayChinhThucDang: parseDate(row.getCell(63).value),
      ghiChu: `Nạp bổ sung từ CBVC Sheet 1 (Dòng ${r} - ${congViec || chucVu})`,
      _extra: {
        loaiHopDong,
        ngachCol,
        congViec
      }
    });
  }

  console.log(`Tìm thấy ${toCreate.length} cán bộ còn thiếu từ Sheet 1.`);
  return toCreate;
}

run().then(list => {
  console.log('Xem trước 5 bản ghi đầu tiên:');
  console.log(JSON.stringify(list.slice(0, 5), null, 2));
}).catch(console.error).finally(() => prisma.$disconnect());
