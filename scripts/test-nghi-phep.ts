import assert from 'node:assert/strict';
import {
  demNgayLamViec,
  soNamThamNien,
  soThangLamViec,
  tinhQuyPhep,
} from '../apps/api/src/nghi-phep/nghiep-vu-phep';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const co = (ngayTuyenDung: string | null, nam: number, laGiangVien = false, loai: 'VIEN_CHUC' | 'HOP_DONG' | 'THINH_GIANG' = 'VIEN_CHUC', kiemNhiem = false) =>
  tinhQuyPhep({ ngayTuyenDung: ngayTuyenDung ? d(ngayTuyenDung) : null, laGiangVien, kiemNhiem, loaiNhanSu: loai }, nam);

let n = 0;
const test = (ten: string, f: () => void) => {
  f();
  n++;
  console.log('  ✓', ten);
};

test('Làm đủ năm, dưới 5 năm: 12 ngày', () => assert.equal(co('2023-07-01', 2026).tongPhep, 12));
test('Đủ 5 năm trong năm: 13 ngày', () => assert.equal(co('2021-03-01', 2026).tongPhep, 13));
test('Đủ 10 năm: 14 ngày', () => assert.equal(co('2016-01-01', 2026).tongPhep, 14));
test('Đủ 5 năm vào ngày 31/12: vẫn được +1', () => assert.equal(co('2021-12-31', 2026).tongPhep, 13));
test('Chưa đủ 5 năm (tròn 5 năm sang năm sau): 12', () => assert.equal(co('2022-01-01', 2026).tongPhep, 12));
test('Vào làm 01/07: 6 tháng = 6 ngày', () => assert.equal(co('2026-07-01', 2026).tongPhep, 6));
test('Vào làm 20/07: không tính tháng 7 → 5 tháng', () => assert.equal(soThangLamViec(d('2026-07-20'), 2026), 5));
test('Vào làm 15/07: vẫn tính tháng 7 → 6 tháng', () => assert.equal(soThangLamViec(d('2026-07-15'), 2026), 6));
test('Vào làm 01/01: 12 tháng', () => assert.equal(co('2026-01-01', 2026).tongPhep, 12));
test('Vào làm năm sau: 0', () => assert.equal(co('2027-02-01', 2026).tongPhep, 0));
test('Vào làm 10/08/2026: 5 tháng = 5 ngày', () => assert.equal(co('2026-08-10', 2026).tongPhep, 5));
test('Giảng viên: không có phép', () => assert.equal(co('2000-01-01', 2026, true).tongPhep, 0));
test('Giảng viên kiêm nhiệm: tính như nhân viên (>=10 năm = 14)', () => assert.equal(co('2016-01-01', 2026, true, 'VIEN_CHUC', true).tongPhep, 14));
test('Giảng viên kiêm nhiệm vào làm 01/07: 6 ngày', () => assert.equal(co('2026-07-01', 2026, true, 'VIEN_CHUC', true).tongPhep, 6));
test('Kiêm nhiệm nhưng không phải giảng viên: vẫn như nhân viên', () => assert.equal(co('2023-07-01', 2026, false, 'VIEN_CHUC', true).tongPhep, 12));
test('Giảng viên (không kiêm nhiệm) vẫn 0 phép', () => assert.equal(co('2016-01-01', 2026, true, 'VIEN_CHUC', false).tongPhep, 0));
test('Thỉnh giảng: không có phép', () => assert.equal(co('2020-01-01', 2026, false, 'THINH_GIANG').tongPhep, 0));
test('Không có ngày tuyển dụng: tính đủ 12', () => assert.equal(co(null, 2026).tongPhep, 12));
test('Thâm niên tính đến 31/12', () => assert.equal(soNamThamNien(d('2000-05-20'), 2026), 26));

const le = new Set(['2026-09-02']);
test('Đếm ngày: T2→T6 một tuần = 5', () => assert.equal(demNgayLamViec(d('2026-10-12'), d('2026-10-16'), new Set()), 5));
test('Đếm ngày: bỏ T7, CN', () => assert.equal(demNgayLamViec(d('2026-10-12'), d('2026-10-18'), new Set()), 5));
test('Đếm ngày: bỏ ngày lễ', () => assert.equal(demNgayLamViec(d('2026-08-31'), d('2026-09-04'), le), 4));
test('Đếm ngày: chỉ T7/CN = 0', () => assert.equal(demNgayLamViec(d('2026-10-17'), d('2026-10-18'), new Set()), 0));
test('Đếm ngày: nửa ngày = 0,5', () => assert.equal(demNgayLamViec(d('2026-10-14'), d('2026-10-14'), new Set(), true), 0.5));
test('Đếm ngày: nửa ngày vào ngày lễ = 0', () => assert.equal(demNgayLamViec(d('2026-09-02'), d('2026-09-02'), le, true), 0));
test('Đếm ngày: đến < từ = 0', () => assert.equal(demNgayLamViec(d('2026-10-15'), d('2026-10-14'), new Set()), 0));

console.log(`\nĐạt ${n} ca kiểm thử.`);
