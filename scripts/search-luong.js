const ExcelJS = require('exceljs');

async function searchInLuong() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('d:/Code/QLNV/luong.xlsx');
  const targetNames = ['Bùi Khắc Thơ', 'Hoàng Đình Huy', 'Mai Thế Hải', 'Võ Đức Hòa', 'Vũ Hà Việt', 'Bùi Hiền Phong', 'Vũ Mạnh Chiến'];
  wb.worksheets.forEach(ws => {
    console.log('Searching in sheet:', ws.name);
    ws.eachRow((r, rowNum) => {
      const rowStr = r.values ? JSON.stringify(r.values) : '';
      targetNames.forEach(n => {
        if (rowStr.toLowerCase().includes(n.toLowerCase())) {
          console.log(`Found [${n}] at row ${rowNum} in ${ws.name}:`, r.getCell(4).value, 'Hệ số:', r.getCell(6).value);
        }
      });
    });
  });
}

searchInLuong().catch(console.error);
