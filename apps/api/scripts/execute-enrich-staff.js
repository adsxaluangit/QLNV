const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const path = 'd:/Code/QLNV/CBVC.xlsx';

const DRY_RUN = !process.argv.includes('--execute');

function normalizeVietnamese(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/òa/g, 'oà').replace(/óa/g, 'oá').replace(/ỏa/g, 'oả').replace(/õa/g, 'oã').replace(/ọa/g, 'oạ')
    .replace(/òe/g, 'oè').replace(/óe/g, 'oé').replace(/ỏe/g, 'oẻ').replace(/õe/g, 'oẽ').replace(/ọe/g, 'oẹ')
    .replace(/ùy/g, 'uỳ').replace(/úy/g, 'uý').replace(/ủy/g, 'uỷ').replace(/ũy/g, 'uỹ').replace(/ụy/g, 'uỵ');
}

function cleanCccd(val) {
  if (!val) return '';
  let s = String(val).trim().replace(/\D/g, '');
  if (s.length > 0 && s.length < 12) {
    s = s.padStart(12, '0');
  }
  return s;
}

function cleanPhone(val) {
  if (!val) return null;
  let s = String(val).trim().replace(/^'\+/, '+').replace(/^\+840/, '0').replace(/^\+84/, '0').replace(/\s+/g, '');
  if (s.startsWith('84') && s.length >= 11) s = '0' + s.slice(2);
  return s || null;
}

function cleanEmail(val) {
  if (!val) return null;
  let s = String(val).trim();
  if (s && s.includes('@')) return s.toLowerCase();
  return null;
}

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

function cleanTonGiao(val) {
  if (!val) return null;
  const s = val.trim();
  if (s.toLowerCase().includes('không')) return 'Không';
  return s;
}

async function main() {
  console.log(`=== RUNNING ENRICH STAFF SCRIPT (DRY_RUN = ${DRY_RUN}) ===`);

  const currentStaff = await prisma.nhanSu.findMany({
    include: { donVi: true, chucVu: true }
  });
  console.log(`Current DB staff count: ${currentStaff.length}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const excelRows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const tenCcVc = row.getCell(3).text.trim();
    if (!tenCcVc || tenCcVc.includes('Trường cao đẳng')) continue;

    const cccd = cleanCccd(row.getCell(12).value || row.getCell(2).value);
    const email = cleanEmail(row.getCell(4).text);
    const sdt = cleanPhone(row.getCell(5).text);
    const ngaySinh = parseDate(row.getCell(6).value);
    const gioiTinh = parseGioiTinh(row.getCell(7).text);
    const danToc = row.getCell(10).text.trim() || 'Kinh';
    const tonGiao = cleanTonGiao(row.getCell(11).text);
    const ngayCapCccd = parseDate(row.getCell(13).value);
    const noiSinh = row.getCell(14).text.trim() || null;
    const queQuan = row.getCell(15).text.trim() || null;
    const diaChi = row.getCell(16).text.trim() || null;
    const soBhxh = row.getCell(17).text.trim() || null;
    const ngayTuyenDung = parseDate(row.getCell(20).value || row.getCell(40).value);
    const trinhDo = parseTrinhDo(row.getCell(27).text.trim() || row.getCell(47).text.trim());
    const chuyenNganh = row.getCell(48).text.trim() || null;
    const hocHam = row.getCell(28).text.trim() || null;
    const danhHieu = row.getCell(29).text.trim() || null;
    const congViec = row.getCell(30).text.trim() || null;
    const ngach = row.getCell(42).text.trim() || null;
    const lyLuanChinhTri = row.getCell(51).text.trim() || null;
    const ngoaiNgu = row.getCell(53).text.trim() || null;
    const ngayVaoDang = parseDate(row.getCell(62).value);
    const ngayChinhThucDang = parseDate(row.getCell(63).value);

    excelRows.push({
      row: r,
      hoTen: tenCcVc,
      cccd,
      email,
      sdt,
      ngaySinh,
      gioiTinh,
      danToc,
      tonGiao,
      ngayCapCccd,
      noiCapCccd: 'Cục Cảnh sát QLHC về TTXH',
      noiSinh,
      queQuan,
      diaChi,
      soBhxh,
      ngayTuyenDung,
      trinhDo,
      chuyenNganh,
      hocHam,
      danhHieu,
      congViec,
      ngach,
      lyLuanChinhTri,
      ngoaiNgu,
      ngayVaoDang,
      ngayChinhThucDang,
    });
  }

  console.log(`Loaded ${excelRows.length} valid employee rows from Excel.`);

  const updates = [];
  const unmatched = [];

  for (const s of currentStaff) {
    const sNorm = normalizeVietnamese(s.hoTen);
    let candidates = excelRows.filter(e => normalizeVietnamese(e.hoTen) === sNorm);

    if (candidates.length === 0 && s.hoTen === 'Trịnh T Bạch Tuyết') {
      candidates = excelRows.filter(e => normalizeVietnamese(e.hoTen) === normalizeVietnamese('Trịnh Thị Bạch Tuyết'));
    }

    if (candidates.length === 0) {
      unmatched.push(s);
      continue;
    }

    let selected = null;
    if (candidates.length === 1) {
      selected = candidates[0];
    } else {
      const uniqueCccds = Array.from(new Set(candidates.map(c => c.cccd).filter(Boolean)));
      if (uniqueCccds.length === 1) {
        selected = candidates[0];
      } else {
        if (s.hoTen === 'Phạm Ngọc Anh') {
          if (s.chucVu?.ten === 'Trưởng khoa' || s.maCanBo === 'TAM-0095') {
            selected = candidates.find(c => c.cccd === '031070013643');
          } else {
            selected = candidates.find(c => c.cccd === '015080000168');
          }
        } else if (s.hoTen === 'Hoàng Thị Vân Anh') {
          if (s.donVi?.ten.includes('Cơ – Điện') || s.maCanBo === 'TAM-0149') {
            selected = candidates.find(c => c.cccd === '001173018070');
          } else {
            selected = candidates.find(c => c.cccd === '030186010273');
          }
        } else if (s.hoTen === 'Nguyễn Thị Thu Hà') {
          if (s.donVi?.ten.includes('Cơ – Điện') || s.maCanBo === 'TAM-0150') {
            selected = candidates.find(c => c.cccd === '031177015985');
          } else if (s.donVi?.ten.includes('Kinh tế') || s.maCanBo === 'TAM-0128') {
            selected = candidates.find(c => c.cccd === '031176012628');
          } else if (s.donVi?.ten.includes('Trung tâm Đào tạo kỹ thuật nghiệp vụ Giao thông') || s.maCanBo === 'TAM-0238') {
            selected = candidates.find(c => c.cccd === '034300002690');
          }
        } else {
          selected = candidates[0];
        }
      }
    }

    if (!selected) {
      unmatched.push(s);
    } else {
      updates.push({
        id: s.id,
        maCu: s.maCanBo,
        hoTen: s.hoTen,
        data: {
          maCanBo: selected.cccd,
          gioiTinh: selected.gioiTinh,
          ngaySinh: selected.ngaySinh,
          noiSinh: selected.noiSinh,
          queQuan: selected.queQuan,
          choOHienNay: selected.diaChi,
          diaChiThuongTru: selected.queQuan || selected.diaChi,
          danToc: selected.danToc,
          tonGiao: selected.tonGiao,
          quocTich: 'Việt Nam',
          ngayCapCccd: selected.ngayCapCccd,
          noiCapCccd: selected.noiCapCccd,
          dienThoai: selected.sdt,
          email: selected.email,
          soBhxh: selected.soBhxh,
          ngayTuyenDung: selected.ngayTuyenDung,
          trinhDoChuyenMon: selected.trinhDo,
          chuyenNganh: selected.chuyenNganh,
          hocHam: selected.hocHam,
          danhHieu: selected.danhHieu,
          chucDanhNgheNghiep: selected.ngach,
          lyLuanChinhTri: selected.lyLuanChinhTri,
          ngoaiNgu: selected.ngoaiNgu,
          ngayVaoDang: selected.ngayVaoDang,
          ngayChinhThucDang: selected.ngayChinhThucDang,
        }
      });
    }
  }

  console.log(`Matched updates ready: ${updates.length}`);
  console.log(`Unmatched count: ${unmatched.length}`);

  if (updates.length > 0) {
    console.log('\nSample prepared update [0]:');
    console.log(JSON.stringify(updates[0], null, 2));
    console.log('\nSample prepared update [100]:');
    console.log(JSON.stringify(updates[100], null, 2));
  }

  if (DRY_RUN) {
    console.log('\n>>> DRY RUN COMPLETED. No database changes were made. Set EXECUTE=1 to apply updates. <<<');
    return;
  }

  console.log('\n>>> EXECUTING DATABASE UPDATES IN TRANSACTION... <<<');

  let successCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.nhanSu.update({
        where: { id: u.id },
        data: u.data,
      });
      successCount++;
    }
  });

  console.log(`\nSUCCESS! Updated ${successCount} staff records in database.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
