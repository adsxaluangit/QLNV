// Kiểm thử chấm công qua HTTP. Chạy: node scripts/e2e-cham-cong.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const prisma = new PrismaClient();
const B = 'http://localhost:4000/api';
const call = async (m, p, body, t, raw) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return { s: r.status, buf: Buffer.from(await r.arrayBuffer()) };
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const login = async (u, p) => { const r = (await call('POST', '/auth/dang-nhap', { tenDangNhap: u, matKhau: p })).j; return r.accessToken || r.token; };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

async function main() {
  const tp = await prisma.nhanSu.findFirst({ where: { maCanBo: '034079027112' }, include: { taiKhoan: true, donVi: true } });
  const khac = await prisma.nhanSu.findFirst({ where: { donViId: { not: tp.donViId }, taiKhoan: { vaiTro: 'CAN_BO' } }, include: { taiKhoan: true } });
  const dvKhac = khac.donViId;
  await prisma.taiKhoan.updateMany({ where: { id: { in: [tp.taiKhoan.id, khac.taiKhoan.id] } }, data: { phaiDoiMatKhau: false } });
  await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } });
  await prisma.taiKhoan.create({ data: { tenDangNhap: 'e2e_admin', tenHienThi: 'E2E', vaiTro: 'QUAN_TRI', matKhauHash: await bcrypt.hash('E2e@12345', 10), phaiDoiMatKhau: false } });
  try {
    console.log('Trưởng phòng:', tp.hoTen, tp.taiKhoan.vaiTro, '|', tp.donVi.ten);
    const t = await login(tp.maCanBo, '123456@');
    const cc = await login(khac.maCanBo, '123456@');
    const ad = await login('e2e_admin', 'E2e@12345');
    const dv = await call('GET', '/cham-cong/don-vi', null, t);
    ok(dv.s === 200 && dv.j.items.length >= 1 && dv.j.macDinh === tp.donViId, 'TĐV thấy đơn vị mặc định = phòng mình (' + dv.j.items.map((x) => x.ten).join(', ') + ')');
    const nam = 2026, thang = 9;
    const q = `donViId=${tp.donViId}&nam=${nam}&thang=${thang}`;
    let b = await call('GET', '/cham-cong/bang?' + q, null, t);
    ok(b.s === 200 && b.j.rows.length > 0, `bảng ${b.j.rows?.length} người, công chuẩn ${b.j.congChuan}`);
    const ns1 = b.j.rows[0].nhanSuId, ns2 = b.j.rows[1].nhanSuId;
    let r = await call('POST', '/cham-cong/dien-mac-dinh', { donViId: tp.donViId, nam, thang }, t);
    ok(r.s === 201 && r.j.soO > 0, 'điền sẵn ' + r.j.soO + ' ô');
    r = await call('PUT', '/cham-cong/bang', { donViId: tp.donViId, nam, thang, cells: [{ nhanSuId: ns1, ngay: 3, kyHieu: 'P' }, { nhanSuId: ns1, ngay: 4, kyHieu: 'Ô/x' }] }, t);
    ok(r.s === 400, 'ký hiệu sai bị từ chối: ' + r.j.message);
    r = await call('PUT', '/cham-cong/bang', { donViId: tp.donViId, nam, thang, cells: [{ nhanSuId: ns1, ngay: 3, kyHieu: 'P' }, { nhanSuId: ns1, ngay: 4, kyHieu: 'P/2' }, { nhanSuId: ns2, ngay: 7, kyHieu: 'Ts' }, { nhanSuId: ns2, ngay: 8, kyHieu: 'CT' }] }, t);
    ok(r.s === 200, 'TĐV chấm 4 ô');
    b = await call('GET', '/cham-cong/bang?' + q, null, t);
    const rw = b.j.rows.find((x) => x.nhanSuId === ns1);
    console.log('Tổng người 1:', JSON.stringify(rw.tong));
    ok(rw.cong['3'] === 'P' && rw.tong.nghiKhac >= 1.5, 'tổng công cập nhật (P + P/2)');
    r = await call('PUT', '/cham-cong/bang', { donViId: dvKhac, nam, thang, cells: [{ nhanSuId: khac.id, ngay: 3, kyHieu: '+' }] }, t);
    ok(r.s === 403, 'TĐV không chấm được đơn vị khác');
    r = await call('PUT', '/cham-cong/bang', { donViId: tp.donViId, nam, thang, cells: [{ nhanSuId: khac.id, ngay: 3, kyHieu: '+' }] }, t);
    ok(r.s === 400, 'không chấm người ngoài đơn vị');
    r = await call('GET', '/cham-cong/don-vi', null, cc);
    ok(r.s === 403, 'cán bộ thường không vào được chấm công');
    r = await call('PATCH', '/cham-cong/thang', { nhanSuId: ns1, nam, thang, luongKhoan: 1500000, theoQuyetDinh: 2 }, t);
    ok(r.s === 200, 'lưu lương khoán / theo QĐ');
    r = await call('POST', '/cham-cong/chot', { donViId: tp.donViId, nam, thang, chot: true }, t);
    ok(r.s === 201, 'TĐV chốt tháng');
    r = await call('PUT', '/cham-cong/bang', { donViId: tp.donViId, nam, thang, cells: [{ nhanSuId: ns1, ngay: 5, kyHieu: 'P' }] }, t);
    ok(r.s === 400, 'sau chốt TĐV không sửa được: ' + r.j.message);
    r = await call('POST', '/cham-cong/chot', { donViId: tp.donViId, nam, thang, chot: false }, t);
    ok(r.s === 403, 'TĐV không mở lại được');
    r = await call('POST', '/cham-cong/chot', { donViId: tp.donViId, nam, thang, chot: false }, ad);
    ok(r.s === 201, 'Quản trị mở lại');
    const x = await call('GET', '/cham-cong/xuat-excel?' + q, null, t, true);
    ok(x.s === 200 && x.buf.length > 5000, 'xuất Excel ' + x.buf.length + ' byte');
    fs.writeFileSync('d:/Code/QLNV/backups/_thu_chamcong.xlsx', x.buf);
    const th = await call('GET', `/cham-cong/xuat-tong-hop?nam=${nam}&thang=${thang}`, null, ad, true);
    ok(th.s === 200 && th.buf.length > 5000, 'xuất tổng hợp ' + th.buf.length + ' byte');
    const bad = await call('GET', `/cham-cong/xuat-tong-hop?nam=${nam}&thang=${thang}`, null, cc, true);
    ok(bad.s === 403, 'cán bộ thường không xuất tổng hợp');
  } finally {
    await prisma.chamCong.deleteMany({ where: { nhanSu: { donViId: tp.donViId } } });
    await prisma.chamCongThang.deleteMany({ where: { nhanSu: { donViId: tp.donViId } } });
    await prisma.bangChamCong.deleteMany({});
    await prisma.taiKhoan.updateMany({ where: { id: { in: [tp.taiKhoan.id, khac.taiKhoan.id] } }, data: { phaiDoiMatKhau: true } });
    await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } }).catch((e) => console.log('Không xoá e2e_admin', e.message));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
