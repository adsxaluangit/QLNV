const ExcelJS = require('exceljs');
const path = 'd:/Code/QLNV/CBVC.xlsx';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const rowsByName = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const stt = row.getCell(1).text.trim();
    const ma = row.getCell(2).text.trim();
    const name = row.getCell(3).text.trim();
    const cccd = row.getCell(12).text.trim() || ma;
    const ns = row.getCell(6).text.trim();
    const dv = row.getCell(38).text.trim();
    const cv = row.getCell(39).text.trim();
    const ngach = row.getCell(42).text.trim();

    if (!name || name.includes('Trường cao đẳng')) continue;

    if (!rowsByName.has(name)) {
      rowsByName.set(name, []);
    }
    rowsByName.get(name).push({ r, stt, ma, name, cccd, ns, dv, cv, ngach });
  }

  console.log('Unique names in Excel:', rowsByName.size);

  const duplicates = [];
  for (const [name, rows] of rowsByName.entries()) {
    if (rows.length > 1) {
      duplicates.push({ name, rows });
    }
  }

  console.log(`Names with > 1 row in Excel: ${duplicates.length}`);
  for (const d of duplicates) {
    console.log(`\nName "${d.name}" (${d.rows.length} rows):`);
    d.rows.forEach(r => console.log(`  Row ${r.r}: STT=${r.stt}, CCCD=${r.cccd}, NS=${r.ns}, DV=${r.dv}, CV=${r.cv}, Ngạch=${r.ngach}`));
  }
}

main().catch(console.error);
