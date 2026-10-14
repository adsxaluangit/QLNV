const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMilestones() {
  const ngachList = await prisma.ngachLuong.findMany();
  const staff = await prisma.nhanSu.findMany({
    include: {
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' }, take: 1 }
    }
  });

  const homNay = new Date('2026-10-13');
  const den3Thang = new Date('2027-01-13');
  const den6Thang = new Date('2027-04-13');
  const den12Thang = new Date('2027-10-13');

  let denHan3m = 0;
  let denHan6m = 0;
  let denHan12m = 0;
  let quaHan = 0;
  let vuotKhung = 0;

  const samples = [];

  for (const ns of staff) {
    const qtl = ns.quaTrinhLuongs[0];
    if (!qtl || !qtl.heSo) continue;

    const cd = (ns.chucDanhNgheNghiep || '').trim();
    let ngach = ngachList.find(n => n.ma.toLowerCase() === cd.toLowerCase());
    if (!ngach) {
      const candidates = ngachList.filter(n => n.heSo.includes(qtl.heSo));
      if (candidates.length > 0) {
        ngach = candidates.find(c => c.ma === 'V.09.02.03') || candidates[0];
      }
    }
    if (!ngach) continue;

    let bac = ngach.heSo.indexOf(qtl.heSo) + 1;
    if (bac <= 0) bac = 1;

    // Tính mốc nâng bậc dựa trên ngày tuyển dụng
    const ntd = ns.ngayTuyenDung ? new Date(ns.ngayTuyenDung) : new Date('2020-01-01');
    const chuKyNam = ngach.thangNangBac / 12; // 3 năm hoặc 2 năm
    
    // Mốc nâng bậc = ntd + (bac - 1) * chuKyNam
    let moc = new Date(ntd);
    moc.setFullYear(moc.getFullYear() + (bac - 1) * chuKyNam);

    // Ngày đến hạn nâng bậc kế tiếp
    let denHan = new Date(moc);
    denHan.setMonth(denHan.getMonth() + ngach.thangNangBac);

    // Nếu denHan quá xa trong quá khứ (ví dụ cán bộ lâu năm chưa có QĐ mới), có thể tính chu kỳ xoay vòng gần nhất
    if (denHan < homNay) {
      quaHan++;
    } else if (denHan <= den3Thang) {
      denHan3m++;
    } else if (denHan <= den6Thang) {
      denHan6m++;
    } else if (denHan <= den12Thang) {
      denHan12m++;
    }

    if (samples.length < 15) {
      samples.push({
        hoTen: ns.hoTen,
        ngach: ngach.ma,
        bac,
        heSo: qtl.heSo,
        mocNangBac: moc.toISOString().slice(0, 10),
        ngayDenHan: denHan.toISOString().slice(0, 10),
        trangThai: denHan < homNay ? 'QUÁ HẠN' : (denHan <= den3Thang ? 'ĐẾN HẠN 3 THÁNG' : 'TƯƠNG LAI')
      });
    }
  }

  console.log('--- KẾT QUẢ THỬ NGHIỆM TÍNH MỐC NÂNG BẬC ---');
  console.log({ quaHan, denHan3m, denHan6m, denHan12m });
  console.log('\nMẫu 15 cán bộ:');
  console.table(samples);
}

testMilestones().catch(console.error).finally(() => prisma.$disconnect());
