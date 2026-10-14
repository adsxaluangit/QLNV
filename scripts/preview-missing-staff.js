const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function previewMissingStaff() {
  const existingStaff = await prisma.nhanSu.findMany({ select: { maCanBo: true } });
  const cccdSet = new Set(existingStaff.map(s => s.maCanBo));

  const donViList = await prisma.donVi.findMany();
  const getDonVi = (ma) => donViList.find(d => d.ma === ma);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const toImport = [];
  const seenCccd = new Set();

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    if (!ten || ten === 'Tên CC/VC' || ten.includes('Trường cao đẳng')) continue;

    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');

    if (cccdSet.has(cccd) || seenCccd.has(cccd)) continue;
    seenCccd.add(cccd);

    const congViec = (row.getCell(30).value || '').toString().trim();
    const chucVu = (row.getCell(39).value || '').toString().trim();
    const chuyenNganh = (row.getCell(48).value || '').toString().trim();
    const ngach = (row.getCell(42).value || '').toString().trim();
    const loaiHD = (row.getCell(43).value || '').toString().trim();
    const loaiDoiTuong = (row.getCell(37).value || '').toString().trim();

    // Xác định đơn vị
    let dv = getDonVi('P.TCHC'); // Mặc định là TCHC cho lái xe, bảo vệ, phục vụ
    const textAll = (congViec + ' ' + chucVu + ' ' + chuyenNganh).toLowerCase();

    if (textAll.includes('ktx') || textAll.includes('quản sinh') || textAll.includes('y tế') || textAll.includes('hssv')) {
      dv = getDonVi('P.HSSV');
    } else if (textAll.includes('kế toán') || textAll.includes('tài chính')) {
      dv = getDonVi('P.KHTC');
    } else if (textAll.includes('đktb') || textAll.includes('điều khiển tàu') || textAll.includes('máy tàu')) {
      dv = getDonVi('K.DKMT');
    } else if (textAll.includes('tự động hóa') || textAll.includes('cơ điện')) {
      dv = getDonVi('K.CD');
    } else if (textAll.includes('hàng hải') || textAll.includes('thủy thủ') || textAll.includes('boong')) {
      dv = getDonVi('K.HH');
    }

    toImport.push({
      row: r,
      cccd,
      ten,
      congViec,
      chucVu,
      chuyenNganh,
      ngach,
      donViMa: dv.ma,
      donViTen: dv.ten,
      loaiNhanSu: loaiDoiTuong.includes('Viên chức') ? 'VIEN_CHUC' : 'HOP_DONG'
    });
  }

  console.log('Tổng số cán bộ chuẩn bị nạp:', toImport.length);
  console.log('\nChi tiết phân bổ đơn vị:');
  toImport.forEach((s, i) => {
    console.log(`${(i+1).toString().padStart(2, ' ')}. [${s.cccd}] ${s.ten.padEnd(24, ' ')} | ĐV: ${s.donViMa.padEnd(8, ' ')} (${s.donViTen}) | Việc: ${s.congViec || s.chucVu} | Loại: ${s.loaiNhanSu}`);
  });
}

previewMissingStaff().catch(console.error).finally(() => prisma.$disconnect());
