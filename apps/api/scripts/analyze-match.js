const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const path = 'd:/Code/QLNV/CBVC.xlsx';

function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanCccd(val) {
  if (!val) return '';
  let s = String(val).trim().replace(/\D/g, '');
  if (s.length > 0 && s.length < 12) {
    s = s.padStart(12, '0');
  }
  return s;
}

async function main() {
  const currentStaff = await prisma.nhanSu.findMany({
    include: { donVi: true, chucVu: true }
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const excelRecords = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const tenCcVc = row.getCell(3).text.trim();
    const cccd = row.getCell(12).value || row.getCell(2).value;
    if (!tenCcVc || tenCcVc.includes('Trường cao đẳng')) continue;

    excelRecords.push({
      row: r,
      hoTen: tenCcVc,
      cccd: cleanCccd(cccd),
      donVi: row.getCell(38).text.trim(),
      chucVu: row.getCell(39).text.trim(),
    });
  }

  console.log(`Excel records: ${excelRecords.length}`);

  let matchExact = 0;
  let matchNoAccent = 0;
  let remainingUnmatched = [];

  for (const s of currentStaff) {
    const exactMatches = excelRecords.filter(e => e.hoTen.toLowerCase() === s.hoTen.toLowerCase());
    if (exactMatches.length === 1) {
      matchExact++;
    } else if (exactMatches.length > 1) {
      console.log(`Multiple exact matches for DB staff: "${s.hoTen}" (ID: ${s.maCanBo}, ĐV: ${s.donVi?.ten}) -> count: ${exactMatches.length}`);
    } else {
      // try without accents
      const noAccentMatches = excelRecords.filter(e => removeAccents(e.hoTen) === removeAccents(s.hoTen));
      if (noAccentMatches.length === 1) {
        matchNoAccent++;
        console.log(`Matched without accent: DB "${s.hoTen}" -> Excel "${noAccentMatches[0].hoTen}"`);
      } else if (noAccentMatches.length > 1) {
        console.log(`Multiple no-accent matches for "${s.hoTen}":`, noAccentMatches.map(m => m.hoTen));
      } else {
        // try special cases like 'Trịnh T Bạch Tuyết'
        const specialMatches = excelRecords.filter(e => {
          const sWords = s.hoTen.toLowerCase().split(/\s+/);
          const eWords = e.hoTen.toLowerCase().split(/\s+/);
          if (sWords[0] === eWords[0] && sWords[sWords.length - 1] === eWords[eWords.length - 1]) {
            return true;
          }
          return false;
        });
        remainingUnmatched.push({ db: s, candidates: specialMatches.map(m => m.hoTen) });
      }
    }
  }

  console.log(`Exact matches: ${matchExact}`);
  console.log(`No-accent matches: ${matchNoAccent}`);
  console.log(`Remaining unmatched: ${remainingUnmatched.length}`);
  for (const item of remainingUnmatched) {
    console.log(`Unmatched: "${item.db.hoTen}" (${item.db.maCanBo}, ${item.db.donVi?.ten}) Candidates:`, item.candidates);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
