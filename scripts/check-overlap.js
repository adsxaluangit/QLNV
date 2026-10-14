const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function checkOverlap() {
  const staff = await prisma.nhanSu.findMany({ select: { maCanBo: true, hoTen: true } });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];
  const cccdInExcel = new Set();
  const nameInExcel = new Set();
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');
    if (cccd) cccdInExcel.add(cccd);
    if (ten) nameInExcel.add(ten.toLowerCase());
  }
  const inDbNotInExcel = staff.filter(s => !cccdInExcel.has(s.maCanBo) && !nameInExcel.has(s.hoTen.toLowerCase()));
  console.log('In DB but not in Sheet 1 (by CCCD and name):', inDbNotInExcel.length);
  inDbNotInExcel.forEach(s => console.log('-', s.maCanBo, s.hoTen));
}

checkOverlap().catch(console.error).finally(() => prisma.$disconnect());
