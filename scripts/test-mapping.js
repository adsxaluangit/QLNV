const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMapping() {
  const ngachList = await prisma.ngachLuong.findMany();
  const staff = await prisma.nhanSu.findMany({
    include: {
      quaTrinhLuongs: { orderBy: { tuNgay: 'desc' }, take: 1 }
    }
  });

  let matched = 0;
  let unMatched = 0;
  const unMatchedList = [];

  for (const ns of staff) {
    const qtl = ns.quaTrinhLuongs[0];
    if (!qtl || !qtl.heSo) {
      unMatched++;
      unMatchedList.push({ name: ns.hoTen, reason: 'Không có hệ số lương' });
      continue;
    }

    const cd = (ns.chucDanhNgheNghiep || '').trim();
    // 1. Thử khớp ngạch theo chucDanhNgheNghiep trước
    let ngach = ngachList.find(n => n.ma.toLowerCase() === cd.toLowerCase());
    
    // 2. Nếu không khớp trực tiếp, thử tìm ngạch chứa hệ số này
    if (!ngach) {
      const candidates = ngachList.filter(n => n.heSo.includes(qtl.heSo));
      if (candidates.length === 1) {
        ngach = candidates[0];
      } else if (candidates.length > 1) {
        ngach = candidates.find(c => c.ma === 'V.09.02.03') || candidates[0];
      }
    }

    if (ngach) {
      const bacIndex = ngach.heSo.indexOf(qtl.heSo);
      if (bacIndex !== -1) {
        matched++;
      } else {
        unMatched++;
        unMatchedList.push({ name: ns.hoTen, cd, heSo: qtl.heSo, ngach: ngach.ma, reason: 'Hệ số không nằm trong ngạch' });
      }
    } else {
      unMatched++;
      unMatchedList.push({ name: ns.hoTen, cd, heSo: qtl.heSo, reason: 'Không tìm thấy ngạch phù hợp' });
    }
  }

  console.log('Total:', staff.length, 'Matched:', matched, 'Unmatched:', unMatched);
  if (unMatchedList.length > 0) {
    console.log('Unmatched count:', unMatchedList.length);
    console.log('Unmatched samples:', unMatchedList.slice(0, 15));
  }
}

testMapping().catch(console.error).finally(() => prisma.$disconnect());
