import { GioiTinh, LoaiNhanSu, TrangThaiNhanSu, TrinhDo, VaiTro, LoaiDonVi } from '@prisma/client';

/** Bỏ dấu tiếng Việt, chữ thường — dùng để so khớp mềm. */
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function laVietNam(quocTich?: string | null): boolean {
  if (!quocTich) return true;
  const q = boDau(quocTich).replace(/\s+/g, '');
  return q === 'vietnam' || q === 'vn';
}

/**
 * Mã cán bộ = số CCCD 12 chữ số. Người nước ngoài (thỉnh giảng) dùng số hộ chiếu.
 * Trả về thông báo lỗi hoặc null nếu hợp lệ.
 */
export function kiemTraMaCanBo(ma: string, quocTich?: string | null): string | null {
  if (laVietNam(quocTich)) {
    return /^\d{12}$/.test(ma) ? null : 'Mã cán bộ phải là số CCCD gồm đúng 12 chữ số';
  }
  return /^[A-Z0-9]{6,15}$/.test(ma) ? null : 'Số hộ chiếu không hợp lệ (6–15 ký tự chữ hoặc số)';
}

/** "nguyễn  văn an" → "Nguyễn Văn An" */
export function chuanHoaHoTen(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi'))
    .join(' ');
}

export function layTen(hoTen: string): string {
  const parts = hoTen.trim().split(/\s+/);
  return parts[parts.length - 1] ?? hoTen;
}

/**
 * Ngày nghỉ hưu dự kiến theo lộ trình của Bộ luật Lao động 2019 / NĐ 135/2020
 * (điều kiện lao động bình thường): nam 60 tuổi 3 tháng (2021) +3 tháng/năm đến 62;
 * nữ 55 tuổi 4 tháng (2021) +4 tháng/năm đến 60. Chỉ dùng để nhắc việc.
 */
export function ngayNghiHuu(ngaySinh: Date, gioiTinh: GioiTinh): Date {
  const nam = gioiTinh === 'NAM';
  const cu = nam ? 60 * 12 : 55 * 12;
  const goc = nam ? 60 * 12 + 3 : 55 * 12 + 4;
  const buoc = nam ? 3 : 4;
  const tran = nam ? 62 * 12 : 60 * 12;
  const cong = (thang: number) => {
    const d = new Date(ngaySinh);
    d.setUTCMonth(d.getUTCMonth() + thang);
    return d;
  };
  const theoLuatCu = cong(cu);
  if (theoLuatCu.getUTCFullYear() < 2021) return theoLuatCu;
  for (let nam2 = 2021; nam2 < 2100; nam2++) {
    const d = cong(Math.min(tran, goc + buoc * (nam2 - 2021)));
    if (d.getUTCFullYear() <= nam2) return d;
  }
  return cong(tran);
}

export const NHAN_GIOI_TINH: Record<GioiTinh, string> = { NAM: 'Nam', NU: 'Nữ' };

export const NHAN_LOAI_NS: Record<LoaiNhanSu, string> = {
  VIEN_CHUC: 'Viên chức',
  HOP_DONG: 'Hợp đồng lao động',
  THINH_GIANG: 'Thỉnh giảng',
};

export const NHAN_TRANG_THAI: Record<TrangThaiNhanSu, string> = {
  DANG_LAM_VIEC: 'Đang làm việc',
  TAM_NGHI: 'Tạm nghỉ',
  NGHI_HUU: 'Nghỉ hưu',
  THOI_VIEC: 'Thôi việc',
  CHUYEN_CONG_TAC: 'Chuyển công tác',
};

export const NHAN_TRINH_DO: Record<TrinhDo, string> = {
  TIEN_SI: 'Tiến sĩ',
  THAC_SI: 'Thạc sĩ',
  DAI_HOC: 'Đại học',
  CAO_DANG: 'Cao đẳng',
  TRUNG_CAP: 'Trung cấp',
  SO_CAP: 'Sơ cấp',
  KHAC: 'Khác',
};

export const NHAN_VAI_TRO: Record<VaiTro, string> = {
  QUAN_TRI: 'Quản trị hệ thống',
  BAN_GIAM_HIEU: 'Ban giám hiệu',
  TCHC: 'Phòng Tổ chức – Hành chính',
  KE_TOAN: 'Kế toán',
  DAO_TAO: 'Phòng Đào tạo',
  TRUONG_DON_VI: 'Trưởng đơn vị',
  CAN_BO: 'Cán bộ',
};

export const NHAN_LOAI_DON_VI: Record<LoaiDonVi, string> = {
  KHOA: 'Khoa',
  PHONG: 'Phòng',
  TRUNG_TAM: 'Trung tâm',
  TO_BO_MON: 'Tổ bộ môn',
  KHAC: 'Khác',
};

/** Tra ngược nhãn → mã enum (so khớp không dấu). */
export function traNguoc<T extends string>(nhan: Record<T, string>, giaTri: string): T | undefined {
  const g = boDau(giaTri);
  for (const [k, v] of Object.entries(nhan) as [T, string][]) {
    if (boDau(v) === g || boDau(k) === g) return k;
  }
  return undefined;
}
