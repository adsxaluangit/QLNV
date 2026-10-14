const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function inspectMissing() {
  const existingStaff = await prisma.nhanSu.findMany({
    select: { id: true, maCanBo: true, hoTen: true }
  });
  const cccdSet = new Set(existingStaff.map(s => s.maCanBo));
  console.log('Hiện có trong DB:', existingStaff.length, 'nhân sự');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0]; // Sheet 1

  const allInExcel = [];
  const missing = [];

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    if (!ten || ten === 'Tên CC/VC' || ten.includes('Trường cao đẳng')) continue;

    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    // format cccd (padding 12 digits if purely numeric and 9 or 11 digits)
    if (/^\d+$/.test(cccd) && cccd.length < 12) {
      cccd = cccd.padStart(12, '0');
    }

    const item = {
      row: r,
      ten,
      cccd,
      ngaySinh: row.getCell(6).value,
      gioiTinh: row.getCell(7).value,
      dienThoai: row.getCell(5).value,
      email: typeof row.getCell(4).value === 'object' ? row.getCell(4).value?.text : row.getCell(4).value,
      congViec: row.getCell(30).value,
      chucVu: row.getCell(39).value,
      ngayTuyenDung: row.getCell(40).value || row.getCell(20).value,
      ngach: row.getCell(42).value,
      loaiHD: row.getCell(43).value,
      donViText: row.getCell(38).value
    };

    allInExcel.push(item);

    if (!cccdSet.has(cccd)) {
      missing.push(item);
    }
  }

  console.log('Tổng số người trong Sheet 1:', allInExcel.length);
  console.log('Số người còn thiếu (chưa có trong DB):', missing.length);
  console.log('\nDanh sách cán bộ còn thiếu:');
  missing.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.cccd}] ${m.ten} | ĐV/Việc: ${m.congViec || m.chucVu || ''} | Ngạch: ${m.ngach || ''} | HĐ: ${m.loaiHD || ''}`);
  });
}

inspectMissing().catch(console.error).finally(() => prisma.$disconnect());
