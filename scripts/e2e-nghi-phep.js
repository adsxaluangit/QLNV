// Kiểm thử end-to-end nghỉ phép qua HTTP. Chạy: node scripts/e2e-nghi-phep.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const B = 'http://localhost:4000/api';
const call = async (m, p, body, t) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { s: r.status, j };
};
const login = async (u, p) => (await call('POST', '/auth/dang-nhap', { tenDangNhap: u, matKhau: p })).j;
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

async function main() {
  const gv = await prisma.nhanSu.findFirst({ where: { laGiangVien: false, trangThai: 'DANG_LAM_VIEC', taiKhoan: { vaiTro: 'CAN_BO' } }, include: { taiKhoan: true, donVi: true } });
  const giangVien = await prisma.nhanSu.findFirst({ where: { laGiangVien: true, taiKhoan: { vaiTro: 'CAN_BO' } }, include: { taiKhoan: true } });
  console.log('Cán bộ:', gv.hoTen, gv.maCanBo, '| GV:', giangVien.hoTen);
  const bcrypt = require('bcryptjs');
  const ids = [gv.taiKhoan.id, giangVien.taiKhoan.id];
  await prisma.taiKhoan.updateMany({ where: { id: { in: ids } }, data: { phaiDoiMatKhau: false } });
  await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } });
  await prisma.taiKhoan.create({ data: { tenDangNhap: 'e2e_admin', tenHienThi: 'E2E', vaiTro: 'QUAN_TRI', matKhauHash: await bcrypt.hash('E2e@12345', 10), phaiDoiMatKhau: false } });
  try {
    await chay(gv, giangVien);
  } finally {
    await prisma.donNghi.deleteMany({ where: { nhanSuId: { in: [gv.id, giangVien.id] } } });
    await prisma.taiKhoan.updateMany({ where: { id: { in: ids } }, data: { phaiDoiMatKhau: true } });
    await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } }).catch((e) => console.log('Không xoá được e2e_admin:', e.message));
  }
}

async function chay(gv, giangVien) {
  let r = { phaiDoiMatKhau: true };
  r = await login(gv.maCanBo, '123456@');
  const tk = r.accessToken || r.token;
  const q = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
  console.log('Quỹ:', JSON.stringify(q.j));
  // đơn vượt phép
  let d = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-10-19', denNgay: '2026-11-30', lyDo: 'thử vượt phép' }, tk);
  ok(d.s === 400, 'từ chối vượt phép: ' + d.j.message);
  d = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-10-19', denNgay: '2026-10-21', lyDo: 'nghỉ phép thử' }, tk);
  ok(d.s === 201, 'gửi đơn 3 ngày: ' + JSON.stringify(d.j));
  const id = d.j.id;
  d = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-10-20', denNgay: '2026-10-20', lyDo: 'trùng' }, tk);
  ok(d.s === 400, 'từ chối trùng ngày: ' + d.j.message);
  d = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-10-24', denNgay: '2026-10-25', lyDo: 'T7 CN' }, tk);
  ok(d.s === 400, 'từ chối T7/CN: ' + d.j.message);
  const q2 = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
  ok(q2.j.choDuyet === 3, 'chờ duyệt = 3, khả dụng ' + q2.j.khaDung);
  // giảng viên
  const rg = await login(giangVien.maCanBo, '123456@');
  const tg = rg.accessToken || rg.token;
  d = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-10-19', denNgay: '2026-10-19', lyDo: 'gv thử' }, tg);
  ok(d.s === 400, 'giảng viên bị chặn phép năm: ' + d.j.message);
  d = await call('POST', '/nghi-phep/don', { loai: 'OM_DAU', tuNgay: '2026-10-19', denNgay: '2026-10-19', lyDo: 'gv ốm' }, tg);
  ok(d.s === 201, 'giảng viên nghỉ ốm được gửi');
  if (d.j.id) await call('PATCH', `/nghi-phep/don/${d.j.id}/huy`, null, tg);
  // duyệt bởi admin
  const ad = await login('e2e_admin', 'E2e@12345');
  const ta = ad.accessToken || ad.token;
  if (!ta) { console.log('Không đăng nhập được admin, bỏ qua bước duyệt', JSON.stringify(ad)); return; }
  const cd = await call('GET', '/nghi-phep/don/cho-duyet', null, ta);
  console.log('Admin thấy', cd.j.length, 'đơn chờ');
  let st = (cd.j.find((x) => x.id === id) || {}).trangThai;
  console.log('Trạng thái đơn:', st);
  for (let i = 0; i < 2 && st !== 'DA_DUYET'; i++) {
    const x = await call('POST', `/nghi-phep/don/${id}/duyet`, { ghiChu: 'ok' }, ta);
    st = x.j.trangThai;
    console.log('duyệt →', st, x.j.message || '');
  }
  const q3 = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
  ok(q3.j.daNghi === 3 && q3.j.choDuyet === 0, `sau duyệt: đã nghỉ ${q3.j.daNghi}, còn lại ${q3.j.conLai}`);
  const h = await call('PATCH', `/nghi-phep/don/${id}/huy`, null, ta);
  ok(h.s === 200, 'TCHC/Admin hủy đơn đã duyệt (hoàn phép)');
  const tong = await call('GET', '/nghi-phep/quy-phep?nam=2026', null, ta);
  console.log('Tổng hợp:', tong.s, Array.isArray(tong.j) ? tong.j.length + ' dòng' : JSON.stringify(tong.j));
}
main().catch(console.error).finally(() => prisma.$disconnect());
