const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function inspectMissingDetails() {
  const existingStaff = await prisma.nhanSu.findMany({ select: { maCanBo: true } });
  const cccdSet = new Set(existingStaff.map(s => s.maCanBo));

  const donViList = await prisma.donVi.findMany({ select: { id: true, ma: true, ten: true } });
  console.log('Các đơn vị hiện có trong DB:');
  donViList.forEach(d => console.log(`- [${d.id}] ${d.ma}: ${d.ten}`));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const missing = new Map();

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    if (!ten || ten === 'Tên CC/VC' || ten.includes('Trường cao đẳng')) continue;

    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');

    if (!cccdSet.has(cccd) && !missing.has(cccd)) {
      missing.set(cccd, {
        row: r,
        cccd,
        ten,
        congViec: row.getCell(30).value,
        chucVu: row.getCell(39).value,
        donViExcel: row.getCell(38).value,
        ngach: row.getCell(42).value,
        loaiHD: row.getCell(43).value,
        ngaySinh: row.getCell(6).value,
        gioiTinh: row.getCell(7).value,
        ngayTuyenDung: row.getCell(40).value || row.getCell(20).value
      });
    }
  }

  console.log('\nTổng số cán bộ duy nhất cần import:', missing.size);
  let idx = 1;
  for (const [cccd, m] of missing.entries()) {
    console.log(`${idx++}. ${m.ten} (CCCD: ${m.cccd}) | Việc: ${m.congViec} | CV: ${m.chucVu} | Ngạch: ${m.ngach} | HĐ: ${m.loaiHD}`);
  }
}

inspectMissingDetails().catch(console.error).finally(() => prisma.$disconnect());
