const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('D:/Code/QLNV/chamcong.xlsx');
  console.log('SHEETS:', wb.worksheets.map((w) => w.name).join(', '));
  const ws = wb.worksheets.find((w) => w.name.startsWith('T12'));
  const show = (r, cols) => {
    const row = ws.getRow(r);
    const out = [];
    for (const c of cols) {
      let v = row.getCell(c).value;
      if (v && typeof v === 'object') v = v.formula ? 'F:' + v.formula : v.richText ? v.richText.map((t) => t.text).join('') : JSON.stringify(v);
      if (v !== null && v !== undefined && v !== '') out.push(c + ':' + String(v).slice(0, 80));
    }
    console.log(r, out.join(' | '));
  };
  show(13, [1, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
  show(14, [1, 35, 36, 37, 38, 39, 40, 41]);
  for (let r = 23; r <= 44; r++) show(r, Array.from({ length: 49 }, (_, i) => i + 1).filter((c) => c < 4 || c > 34 || r > 30));
})();
