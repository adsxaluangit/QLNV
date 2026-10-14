const ExcelJS = require('exceljs');
const path = 'd:/Code/QLNV/CBVC.xlsx';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  console.log('Worksheets count:', wb.worksheets.length);
  
  for (let idx = 0; idx < wb.worksheets.length; idx++) {
    const ws = wb.worksheets[idx];
    console.log(`\n=================== [${idx}] SHEET: "${ws.name}" (rows: ${ws.rowCount}, actual: ${ws.actualRowCount}) ===================`);
    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers.push(`[${colNumber}] ${String(cell.value).trim().replace(/\r?\n/g, ' ')}`);
    });
    console.log('Headers (Row 1):', headers.join(' | '));
  }
}

main().catch(console.error);
