// Kiểm thử giảng viên kiêm nhiệm qua HTTP. Chạy: node scripts/e2e-kiem-nhiem.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const B = 'http://localhost:4000/api';
const call = async (m, p, body, t) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const login = async (u, p) => { const r = (await call('POST', '/auth/dang-nhap', { tenDangNhap: u, matKhau: p })).j; return r.accessToken || r.token; };
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);

async function main() {
  const gv = await prisma.nhanSu.findFirst({
    where: { laGiangVien: true, kiemNhiem: false, trangThai: 'DANG_LAM_VIEC', donVi: { loai: 'PHONG' }, taiKhoan: { vaiTro: 'CAN_BO' } },
    include: { taiKhoan: true, donVi: true },
  });
  const khoa = await prisma.nhanSu.findFirst({ where: { laGiangVien: true, donVi: { loai: 'KHOA' }, taiKhoan: { vaiTro: 'CAN_BO' } }, include: { taiKhoan: true } });
  console.log('GV phòng:', gv.hoTen, '|', gv.donVi.ten, '| ngày tuyển dụng:', gv.ngayTuyenDung?.toISOString().slice(0, 10));
  const ids = [gv.taiKhoan.id, khoa.taiKhoan.id];
  await prisma.taiKhoan.updateMany({ where: { id: { in: ids } }, data: { phaiDoiMatKhau: false } });
  await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } });
  await prisma.taiKhoan.create({ data: { tenDangNhap: 'e2e_admin', tenHienThi: 'E2E', vaiTro: 'QUAN_TRI', matKhauHash: await bcrypt.hash('E2e@12345', 10), phaiDoiMatKhau: false } });
  try {
    const ad = await login('e2e_admin', 'E2e@12345');
    const tk = await login(gv.maCanBo, '123456@');
    const tkKhoa = await login(khoa.maCanBo, '123456@');
    let q = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
    ok(q.j.tongPhep === 0, 'trước: giảng viên 0 phép (tongPhep=' + q.j.tongPhep + ')');
    const ds = await call('GET', '/nghi-phep/giang-vien?chiKhongKhoa=true', null, ad);
    ok(ds.s === 200 && ds.j.length > 0 && ds.j.every((x) => x.loaiDonVi !== 'KHOA'), 'danh sách GV phòng/trung tâm: ' + ds.j.length + ' người');
    const dsAll = await call('GET', '/nghi-phep/giang-vien', null, ad);
    ok(dsAll.j.length > ds.j.length, 'bỏ lọc: ' + dsAll.j.length + ' giảng viên');
    let r = await call('GET', '/nghi-phep/giang-vien', null, tk);
    ok(r.s === 403, 'cán bộ thường không xem được danh sách tích');
    r = await call('PUT', '/nghi-phep/giang-vien/kiem-nhiem', { ids: [gv.id], kiemNhiem: true }, tk);
    ok(r.s === 403, 'cán bộ thường không tích được');
    r = await call('PUT', '/nghi-phep/giang-vien/kiem-nhiem', { ids: [gv.id], kiemNhiem: true }, ad);
    ok(r.s === 200 && r.j.soLuong === 1, 'Quản trị đánh dấu kiêm nhiệm');
    q = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
    ok(q.j.tongPhep >= 12 && q.j.kiemNhiem === true && q.j.laGiangVien === false, 'sau: có phép năm = ' + q.j.tongPhep + ' (cơ bản ' + q.j.phepCoBan + ', thâm niên ' + q.j.phepThamNien + ')');
    r = await call('POST', '/nghi-phep/don', { loai: 'PHEP_NAM', tuNgay: '2026-12-14', denNgay: '2026-12-14', lyDo: 'nghỉ phép thử' }, tk);
    ok(r.s === 201, 'GVKN xin nghỉ phép năm được');
    if (r.j.id) await prisma.donNghi.delete({ where: { id: r.j.id } });
    r = await call('PUT', '/nghi-phep/giang-vien/kiem-nhiem', { ids: [khoa.id], kiemNhiem: true }, ad);
    console.log('  (GV khoa cũng tích được:', r.s, ') — hoàn tác sau');
    r = await call('PUT', '/nghi-phep/giang-vien/kiem-nhiem', { ids: [khoa.id], kiemNhiem: false }, ad);
    const qk = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tkKhoa);
    ok(qk.j.tongPhep === 0, 'GV khoa (không tích) vẫn 0 phép');
    const bang = await call('GET', `/cham-cong/bang?donViId=${gv.donViId}&nam=2026&thang=9`, null, ad);
    const dong = bang.j.rows?.find((x) => x.nhanSuId === gv.id);
    ok(dong?.chucVu === 'GVKN' || (dong && gv && ['TP', 'P.TP', 'HT', 'P.HT', 'GĐ', 'P.GĐ'].includes(dong.chucVu)), 'chấm công hiển thị chức vụ: ' + dong?.chucVu);
    r = await call('PUT', '/nghi-phep/giang-vien/kiem-nhiem', { ids: [gv.id], kiemNhiem: false }, ad);
    q = await call('GET', '/nghi-phep/quy-phep/cua-toi?nam=2026', null, tk);
    ok(q.j.tongPhep === 0, 'bỏ đánh dấu: trở lại 0 phép');
  } finally {
    await prisma.donNghi.deleteMany({ where: { nhanSuId: { in: [gv.id, khoa.id] } } });
    await prisma.quyPhep.updateMany({ where: { nhanSuId: { in: [gv.id, khoa.id] } }, data: { dieuChinh: 0 } });
    await prisma.nhanSu.updateMany({ where: { id: { in: [gv.id, khoa.id] } }, data: { kiemNhiem: false } });
    await prisma.taiKhoan.updateMany({ where: { id: { in: ids } }, data: { phaiDoiMatKhau: true } });
    await prisma.taiKhoan.deleteMany({ where: { tenDangNhap: 'e2e_admin' } }).catch((e) => console.log('Không xoá e2e_admin', e.message));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
