const ExcelJS = require('exceljs');
const path = 'd:/Code/QLNV/CBVC.xlsx';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const targetNames = ['Phạm Ngọc Anh', 'Hoàng Thị Vân Anh', 'Nguyễn Thị Thu Hà'];
  
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = row.getCell(3).text.trim();
    if (targetNames.includes(name)) {
      const data = {};
      row.eachCell((cell, colNumber) => {
        const header = ws.getRow(1).getCell(colNumber).text.trim();
        const val = cell.text.trim();
        if (val) {
          data[`[${colNumber}] ${header}`] = val;
        }
      });
      console.log(`\nRow ${r}: Name = "${name}"`);
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

main().catch(console.error);
