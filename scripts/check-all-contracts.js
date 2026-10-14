const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function checkAllContracts() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const hdldInExcel = [];

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    if (!ten || ten === 'Tên CC/VC' || ten.includes('Trường cao đẳng')) continue;

    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');

    const doiTuong = (row.getCell(37).value || '').toString().trim();
    const loaiHD = (row.getCell(43).value || '').toString().trim();
    const congViec = (row.getCell(30).value || '').toString().trim();

    if (doiTuong.toLowerCase().includes('hợp đồng') || loaiHD.toLowerCase().includes('lao động') || loaiHD.toLowerCase().includes('hđlđ') || doiTuong.toLowerCase().includes('111') || doiTuong.toLowerCase().includes('68')) {
      hdldInExcel.push({
        row: r,
        cccd,
        ten,
        doiTuong,
        loaiHD,
        congViec
      });
    }
  }

  console.log('Tổng số người có tính chất Hợp đồng lao động trong Excel:', hdldInExcel.length);
  hdldInExcel.forEach((h, i) => {
    console.log(`${i + 1}. [${h.cccd}] ${h.ten} | ĐT: ${h.doiTuong} | HĐ: ${h.loaiHD} | Việc: ${h.congViec}`);
  });
}

checkAllContracts().catch(console.error).finally(() => prisma.$disconnect());
