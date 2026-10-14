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
    // Match DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      return new Date(Date.UTC(y, m, d));
    }
    // Match YYYY-MM-DD
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      return new Date(Date.UTC(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])));
    }
    // Check if valid Date string
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseTrinhDo(val) {
  if (!val) return null;
  const s = val.toLowerCase();
  if (s.includes('tiến sĩ')) return 'TIEN_SI';
  if (s.includes('thạc sĩ')) return 'THAC_SI';
  if (s.includes('đại học') || s.includes('cử nhân') || s.includes('kỹ sư')) return 'DAI_HOC';
  if (s.includes('cao đẳng')) return 'CAO_DANG';
  if (s.includes('trung cấp') || s.includes('trung học')) return 'TRUNG_CAP';
  if (s.includes('sơ cấp')) return 'SO_CAP';
  return 'KHAC';
}

function parseGioiTinh(val) {
  if (!val) return null;
  const s = val.trim().toLowerCase();
  if (s === 'nữ' || s === 'nu') return 'NU';
  if (s === 'nam') return 'NAM';
  return null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const dateCols = [6, 13, 20, 40, 62, 63];
  const trinhDoSet = new Set();
  const gioiTinhSet = new Set();
  let invalidBirthDates = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = row.getCell(3).text.trim();
    if (!name || name.includes('Trường cao đẳng')) continue;

    const nsRaw = row.getCell(6).value;
    const nsParsed = parseDate(nsRaw);
    if (!nsParsed) {
      console.log(`Row ${r}: Invalid birth date for ${name}:`, nsRaw);
      invalidBirthDates++;
    }

    const gtRaw = row.getCell(7).text.trim();
    gioiTinhSet.add(gtRaw);

    const tdRaw = row.getCell(27).text.trim() || row.getCell(47).text.trim();
    if (tdRaw) trinhDoSet.add(tdRaw);
  }

  console.log(`Total invalid birth dates: ${invalidBirthDates}`);
  console.log('Distinct genders in Excel:', Array.from(gioiTinhSet));
  console.log('Distinct qualifications in Excel:', Array.from(trinhDoSet));
}

main().catch(console.error);
