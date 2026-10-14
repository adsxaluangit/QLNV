const ExcelJS = require('exceljs');

async function checkSheet1Unique() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/CBVC.xlsx');
  const ws = wb.worksheets[0];

  const uniqueCccd = new Map();
  const duplicateRows = [];
  const noCccdRows = [];

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = (row.getCell(3).value || '').toString().trim();
    if (!ten || ten === 'Tên CC/VC' || ten.includes('Trường cao đẳng')) continue;

    let cccd = (row.getCell(2).value || row.getCell(12).value || '').toString().trim();
    if (/^\d+$/.test(cccd) && cccd.length < 12) cccd = cccd.padStart(12, '0');

    if (!cccd) {
      noCccdRows.push({ row: r, ten });
    } else {
      if (uniqueCccd.has(cccd)) {
        duplicateRows.push({ row: r, ten, cccd, existing: uniqueCccd.get(cccd) });
      } else {
        uniqueCccd.set(cccd, { row: r, ten, cccd });
      }
    }
  }

  console.log('Total non-empty rows:', uniqueCccd.size + duplicateRows.length + noCccdRows.length);
  console.log('Unique CCCD count:', uniqueCccd.size);
  console.log('Duplicate rows count:', duplicateRows.length);
  console.log('Duplicate samples:', duplicateRows);
  console.log('No CCCD rows count:', noCccdRows.length);
  console.log('No CCCD samples:', noCccdRows);
}

checkSheet1Unique().catch(console.error);
