/**
 * Kiểm tra mềm số CCCD 12 số theo cấu trúc của Bộ Công an:
 *   3 số đầu: mã tỉnh nơi đăng ký khai sinh
 *   số thứ 4: giới tính + thế kỷ sinh (0/1: nam/nữ 1900–1999; 2/3: nam/nữ 2000–2099)
 *   số thứ 5–6: hai số cuối năm sinh
 * Chỉ trả về CẢNH BÁO (không chặn lưu) để tránh chặn nhầm trường hợp đặc biệt.
 */
const MA_TINH = new Set(
  (
    '001 002 004 006 008 010 011 012 014 015 017 019 020 022 024 025 026 027 030 031 033 034 035 036 037 038 ' +
    '040 042 044 045 046 048 049 051 052 054 056 058 060 062 064 066 067 068 070 072 074 075 077 079 080 082 ' +
    '083 084 086 087 089 091 092 093 094 095 096'
  ).split(' '),
);

export function canhBaoCccd(ma?: string, gioiTinh?: 'NAM' | 'NU', namSinh?: number): string[] {
  if (!ma || !/^\d{12}$/.test(ma)) return [];
  const cb: string[] = [];
  if (!MA_TINH.has(ma.slice(0, 3))) cb.push(`Mã tỉnh "${ma.slice(0, 3)}" không có trong danh mục`);
  const so4 = Number(ma[3]);
  if (so4 > 3) {
    cb.push('Số thứ 4 (giới tính/thế kỷ) bất thường');
    return cb;
  }
  const nu = so4 % 2 === 1;
  const theKy = so4 < 2 ? 1900 : 2000;
  if (gioiTinh && (gioiTinh === 'NU') !== nu) cb.push(`CCCD cho biết giới tính ${nu ? 'Nữ' : 'Nam'}`);
  if (namSinh) {
    const nam = theKy + Number(ma.slice(4, 6));
    if (nam !== namSinh) cb.push(`CCCD cho biết năm sinh ${nam}`);
  }
  return cb;
}
