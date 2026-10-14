/**
 * Nghiệp vụ nghỉ phép năm (Bộ luật Lao động 2019 Điều 113–114, NĐ 145/2020 Điều 66)
 * theo quy định riêng của nhà trường:
 *  - Giảng viên KHÔNG có phép năm (đã có nghỉ hè); cán bộ thỉnh giảng cũng không có.
 *  - Không áp dụng mức 14/16 ngày độc hại: mọi cán bộ còn lại cơ bản 12 ngày/năm.
 *  - Cứ đủ 5 năm làm việc tại trường được thêm 1 ngày.
 *  - Phép chưa nghỉ hết trong năm thì mất, không chuyển sang năm sau.
 * Hàm thuần (không truy cập CSDL) để dễ kiểm thử.
 */

export const PHEP_CO_BAN = 12;
/** T7, CN nghỉ. Đổi thành true nếu nhà trường làm việc cả sáng thứ Bảy. */
export const LAM_THU_BAY = false;

export interface DauVaoQuyPhep {
  ngayTuyenDung: Date | null;
  laGiangVien: boolean;
  /** Giảng viên kiêm nhiệm (làm hành chính): phép năm tính như nhân viên */
  kiemNhiem?: boolean;
  loaiNhanSu: 'VIEN_CHUC' | 'HOP_DONG' | 'THINH_GIANG';
}

export interface KetQuaQuyPhep {
  soThang: number;
  phepCoBan: number;
  phepThamNien: number;
  tongPhep: number;
  ghiChu: string | null;
}

/** Làm tròn đến 0,5 ngày gần nhất. */
export const lamTron05 = (x: number) => Math.round(x * 2) / 2;

/**
 * Số tháng được tính trong `nam`: vào làm từ năm trước → 12; vào làm trong năm →
 * tính từ tháng vào làm (tháng vào làm sau ngày 15 thì không tính tháng đó,
 * vì chưa đủ 50% số ngày làm việc của tháng); vào làm sau năm tính → 0.
 */
export function soThangLamViec(ngayTuyenDung: Date | null, nam: number): number {
  if (!ngayTuyenDung) return 12;
  const y = ngayTuyenDung.getUTCFullYear();
  if (y > nam) return 0;
  if (y < nam) return 12;
  const thang = ngayTuyenDung.getUTCMonth(); // 0..11
  const ngay = ngayTuyenDung.getUTCDate();
  return Math.max(0, 12 - thang - (ngay > 15 ? 1 : 0));
}

/** Số năm làm việc tròn tính đến hết 31/12 của `nam`. */
export function soNamThamNien(ngayTuyenDung: Date | null, nam: number): number {
  if (!ngayTuyenDung) return 0;
  const hetNam = Date.UTC(nam, 11, 31);
  let n = nam - ngayTuyenDung.getUTCFullYear();
  const sinhNhat = Date.UTC(ngayTuyenDung.getUTCFullYear() + n, ngayTuyenDung.getUTCMonth(), ngayTuyenDung.getUTCDate());
  if (sinhNhat > hetNam) n--;
  return Math.max(0, n);
}

export function tinhQuyPhep(d: DauVaoQuyPhep, nam: number): KetQuaQuyPhep {
  if (d.laGiangVien && !d.kiemNhiem) {
    return { soThang: 12, phepCoBan: 0, phepThamNien: 0, tongPhep: 0, ghiChu: 'Giảng viên: nghỉ hè, không có phép năm' };
  }
  if (d.loaiNhanSu === 'THINH_GIANG') {
    return { soThang: 0, phepCoBan: 0, phepThamNien: 0, tongPhep: 0, ghiChu: 'Thỉnh giảng: không có phép năm' };
  }
  const soThang = soThangLamViec(d.ngayTuyenDung, nam);
  const phepThamNien = Math.floor(soNamThamNien(d.ngayTuyenDung, nam) / 5);
  const tongPhep = lamTron05(((PHEP_CO_BAN + phepThamNien) / 12) * soThang);
  return {
    soThang,
    phepCoBan: PHEP_CO_BAN,
    phepThamNien,
    tongPhep,
    ghiChu: soThang < 12 ? `Vào làm trong năm: tính ${soThang}/12 tháng` : null,
  };
}

const MOT_NGAY = 86_400_000;

/**
 * Đếm số ngày làm việc từ `tu` đến `den` (gồm cả hai đầu), bỏ T7/CN và ngày lễ.
 * `le` là tập các chuỗi YYYY-MM-DD.
 */
export function demNgayLamViec(tu: Date, den: Date, le: Set<string>, nuaNgay = false): number {
  if (den < tu) return 0;
  let n = 0;
  for (let t = tu.getTime(); t <= den.getTime(); t += MOT_NGAY) {
    const d = new Date(t);
    const thu = d.getUTCDay(); // 0 = CN, 6 = T7
    if (thu === 0) continue;
    if (thu === 6 && !LAM_THU_BAY) continue;
    if (le.has(d.toISOString().slice(0, 10))) continue;
    n++;
  }
  return nuaNgay && n === 1 ? 0.5 : n;
}

export const NHAN_LOAI_NGHI: Record<string, string> = {
  PHEP_NAM: 'Nghỉ phép năm',
  OM_DAU: 'Nghỉ ốm đau',
  THAI_SAN: 'Nghỉ thai sản',
  KHONG_LUONG: 'Nghỉ không lương',
  VIEC_RIENG: 'Nghỉ việc riêng (hiếu, hỉ)',
  KHAC: 'Nghỉ khác',
};

export const NHAN_TRANG_THAI_DON: Record<string, string> = {
  CHO_TRUONG_DON_VI: 'Chờ Trưởng đơn vị duyệt',
  CHO_BGH: 'Chờ Ban Giám hiệu duyệt',
  CHO_TCHC: 'Chờ Phòng TCHC xác nhận',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
  DA_HUY: 'Đã hủy',
};

/** Ngày lễ cố định theo dương lịch; âm lịch (Tết, Giỗ Tổ) do TCHC nhập thêm hằng năm. */
export function leCoDinh(nam: number): { ngay: string; ten: string }[] {
  const p = (m: number, d: number) => `${nam}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return [
    { ngay: p(1, 1), ten: 'Tết Dương lịch' },
    { ngay: p(4, 30), ten: 'Ngày Giải phóng miền Nam' },
    { ngay: p(5, 1), ten: 'Ngày Quốc tế Lao động' },
    { ngay: p(9, 2), ten: 'Quốc khánh' },
  ];
}
