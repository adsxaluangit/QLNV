const ExcelJS = require('exceljs');
const path = 'd:/Code/QLNV/CBVC.xlsx';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      return new Date(Date.UTC(y, m, d));
    }
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      return new Date(Date.UTC(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])));
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  let sampleCount = 0;
  for (let r = 2; r <= Math.min(20, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const name = row.getCell(3).text.trim();
    if (!name || name.includes('Trường cao đẳng')) continue;

    console.log(`\nRow ${r}: ${name}`);
    console.log(`  CCCD: ${row.getCell(12).text} | NgayCap: ${row.getCell(13).value} -> ${parseDate(row.getCell(13).value)?.toISOString()?.slice(0, 10)}`);
    console.log(`  NoiSinh: ${row.getCell(14).text} | QueQuan: ${row.getCell(15).text}`);
    console.log(`  DiaChi: ${row.getCell(16).text}`);
    console.log(`  BHXH: ${row.getCell(17).text} | SDT: ${row.getCell(5).text} | Email: ${row.getCell(4).text}`);
    console.log(`  TuyenDung: ${row.getCell(20).value} -> ${parseDate(row.getCell(20).value)?.toISOString()?.slice(0, 10)}`);
    console.log(`  VaoDang: ${row.getCell(62).value} -> ${parseDate(row.getCell(62).value)?.toISOString()?.slice(0, 10)}`);
  }
}

main().catch(console.error);
