const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const path = 'd:/Code/QLNV/CBVC.xlsx';

function normalizeVietnamese(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // Standardize accent placement:
    .replace(/òa/g, 'oà').replace(/óa/g, 'oá').replace(/ỏa/g, 'oả').replace(/õa/g, 'oã').replace(/ọa/g, 'oạ')
    .replace(/òe/g, 'oè').replace(/óe/g, 'oé').replace(/ỏe/g, 'oẻ').replace(/õe/g, 'oẽ').replace(/ọe/g, 'oẹ')
    .replace(/ùy/g, 'uỳ').replace(/úy/g, 'uý').replace(/ủy/g, 'uỷ').replace(/ũy/g, 'uỹ').replace(/ụy/g, 'uỵ');
}

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

  const excelRows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const tenCcVc = row.getCell(3).text.trim();
    if (!tenCcVc || tenCcVc.includes('Trường cao đẳng')) continue;

    const cccd = cleanCccd(row.getCell(12).value || row.getCell(2).value);
    const email = row.getCell(4).text.trim();
    const sdt = row.getCell(5).text.trim().replace(/^'\+/, '+').replace(/^\+840/, '0').replace(/^\+84/, '0');
    const ngaySinhVal = row.getCell(6).value;
    const gioiTinh = row.getCell(7).text.trim();
    const danToc = row.getCell(10).text.trim();
    const tonGiao = row.getCell(11).text.trim();
    const ngayCapCccd = row.getCell(13).value;
    const noiSinh = row.getCell(14).text.trim();
    const queQuan = row.getCell(15).text.trim();
    const diaChi = row.getCell(16).text.trim();
    const soBhxh = row.getCell(17).text.trim();
    const ngayTuyenDung = row.getCell(20).value || row.getCell(40).value;
    const trinhDo = row.getCell(27).text.trim() || row.getCell(47).text.trim();
    const chuyenNganh = row.getCell(48).text.trim();
    const hocHam = row.getCell(28).text.trim();
    const danhHieu = row.getCell(29).text.trim();
    const congViec = row.getCell(30).text.trim();
    const lyLuanChinhTri = row.getCell(51).text.trim();
    const ngoaiNgu = row.getCell(53).text.trim();
    const ngayVaoDang = row.getCell(62).value;
    const ngayChinhThucDang = row.getCell(63).value;

    excelRows.push({
      row: r,
      hoTen: tenCcVc,
      cccd,
      email,
      sdt,
      ngaySinhVal,
      gioiTinh,
      danToc,
      tonGiao,
      ngayCapCccd,
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
      lyLuanChinhTri,
      ngoaiNgu,
      ngayVaoDang,
      ngayChinhThucDang,
    });
  }

  console.log(`Loaded ${excelRows.length} rows from Excel Sheet1.`);

  const matchPlan = [];
  const unmatched = [];

  for (const s of currentStaff) {
    const sNorm = normalizeVietnamese(s.hoTen);
    
    // 1. Direct normalized match
    let candidates = excelRows.filter(e => normalizeVietnamese(e.hoTen) === sNorm);

    // 2. Special name mappings if no candidates
    if (candidates.length === 0) {
      if (s.hoTen === 'Trịnh T Bạch Tuyết') {
        candidates = excelRows.filter(e => normalizeVietnamese(e.hoTen) === normalizeVietnamese('Trịnh Thị Bạch Tuyết'));
      }
    }

    if (candidates.length === 0) {
      unmatched.push({ staff: s, reason: 'No candidates found in Excel' });
      continue;
    }

    // If multiple candidates, disambiguate
    let selected = null;
    if (candidates.length === 1) {
      selected = candidates[0];
    } else {
      // Check if all candidates have same CCCD (duplicate rows in Excel)
      const uniqueCccds = Array.from(new Set(candidates.map(c => c.cccd).filter(Boolean)));
      if (uniqueCccds.length === 1) {
        selected = candidates[0];
      } else {
        // Multi-person case! Disambiguate based on department, rank, or specialty
        if (s.hoTen === 'Phạm Ngọc Anh') {
          if (s.chucVu?.ten === 'Trưởng khoa' || s.maCanBo === 'TAM-0095') {
            selected = candidates.find(c => c.cccd === '031070013643'); // born 1970
          } else {
            selected = candidates.find(c => c.cccd === '015080000168'); // born 1980
          }
        } else if (s.hoTen === 'Hoàng Thị Vân Anh') {
          if (s.donVi?.ten.includes('Cơ – Điện') || s.maCanBo === 'TAM-0149') {
            selected = candidates.find(c => c.cccd === '001173018070'); // xây dựng
          } else {
            selected = candidates.find(c => c.cccd === '030186010273'); // quản trị kinh doanh
          }
        } else if (s.hoTen === 'Nguyễn Thị Thu Hà') {
          if (s.donVi?.ten.includes('Cơ – Điện') || s.maCanBo === 'TAM-0150') {
            selected = candidates.find(c => c.cccd === '031177015985'); // sinh 1977, sư phạm kỹ thuật công nghiệp
          } else if (s.donVi?.ten.includes('Kinh tế') || s.maCanBo === 'TAM-0128') {
            selected = candidates.find(c => c.cccd === '031176012628'); // sinh 1976, quản lý vận tải
          } else if (s.donVi?.ten.includes('Trung tâm Đào tạo kỹ thuật nghiệp vụ Giao thông') || s.maCanBo === 'TAM-0238') {
            selected = candidates.find(c => c.cccd === '034300002690'); // sinh 2000, kế toán
          }
        } else {
          // fallback to first candidate
          selected = candidates[0];
        }
      }
    }

    if (!selected) {
      unmatched.push({ staff: s, reason: 'Failed to disambiguate multi-person' });
    } else {
      matchPlan.push({
        staffId: s.id,
        maCu: s.maCanBo,
        hoTen: s.hoTen,
        donVi: s.donVi?.ten,
        chucVu: s.chucVu?.ten,
        newCccd: selected.cccd,
        selected,
      });
    }
  }

  console.log(`\n================ MATCH RESULTS ================`);
  console.log(`Matched: ${matchPlan.length} / ${currentStaff.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('Unmatched items:', JSON.stringify(unmatched, null, 2));
  }

  // Check CCCD duplicates in matchPlan
  const cccdCounts = {};
  for (const m of matchPlan) {
    if (m.newCccd) {
      cccdCounts[m.newCccd] = (cccdCounts[m.newCccd] || 0) + 1;
    }
  }
  const duplicatedCccds = Object.entries(cccdCounts).filter(([_, count]) => count > 1);
  console.log(`Duplicate CCCDs in planned assignments: ${duplicatedCccds.length}`);
  if (duplicatedCccds.length > 0) {
    console.log('Duplicated CCCDs:', duplicatedCccds);
    duplicatedCccds.forEach(([cccd]) => {
      const owners = matchPlan.filter(m => m.newCccd === cccd);
      console.log(`CCCD ${cccd} assigned to:`, owners.map(o => `${o.hoTen} (${o.maCu}, ${o.donVi})`));
    });
  }

  // Check how many have valid CCCD (12 digits)
  const validCccds = matchPlan.filter(m => /^\d{12}$/.test(m.newCccd));
  console.log(`Valid 12-digit CCCDs: ${validCccds.length} / ${matchPlan.length}`);
  const non12Digits = matchPlan.filter(m => !/^\d{12}$/.test(m.newCccd));
  if (non12Digits.length > 0) {
    console.log('Non 12-digit CCCDs:', non12Digits.map(n => ({ hoTen: n.hoTen, cccd: n.newCccd })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
