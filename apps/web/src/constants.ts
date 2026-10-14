import dayjs, { Dayjs } from 'dayjs';

export type VaiTro = 'QUAN_TRI' | 'BAN_GIAM_HIEU' | 'TCHC' | 'KE_TOAN' | 'DAO_TAO' | 'TRUONG_DON_VI' | 'CAN_BO';

export const NHAN_VAI_TRO: Record<VaiTro, string> = {
  QUAN_TRI: 'Quản trị hệ thống',
  BAN_GIAM_HIEU: 'Ban giám hiệu',
  TCHC: 'Phòng Tổ chức – Hành chính',
  KE_TOAN: 'Kế toán',
  DAO_TAO: 'Phòng Đào tạo',
  TRUONG_DON_VI: 'Trưởng đơn vị',
  CAN_BO: 'Cán bộ',
};

export const MAU_VAI_TRO: Record<VaiTro, string> = {
  QUAN_TRI: 'magenta',
  BAN_GIAM_HIEU: 'gold',
  TCHC: 'cyan',
  KE_TOAN: 'green',
  DAO_TAO: 'blue',
  TRUONG_DON_VI: 'purple',
  CAN_BO: 'default',
};

/** Vai trò cần chọn phạm vi cơ sở / đơn vị */
export const VAI_TRO_THEO_CO_SO: VaiTro[] = ['TCHC', 'KE_TOAN', 'DAO_TAO'];

export const NHAN_GIOI_TINH = { NAM: 'Nam', NU: 'Nữ' } as const;

export const NHAN_LOAI_NS = {
  VIEN_CHUC: 'Viên chức',
  HOP_DONG: 'Hợp đồng lao động',
  THINH_GIANG: 'Thỉnh giảng',
} as const;

export const NHAN_TRANG_THAI = {
  DANG_LAM_VIEC: 'Đang làm việc',
  TAM_NGHI: 'Tạm nghỉ',
  NGHI_HUU: 'Nghỉ hưu',
  THOI_VIEC: 'Thôi việc',
  CHUYEN_CONG_TAC: 'Chuyển công tác',
} as const;

export const MAU_TRANG_THAI: Record<keyof typeof NHAN_TRANG_THAI, string> = {
  DANG_LAM_VIEC: 'success',
  TAM_NGHI: 'warning',
  NGHI_HUU: 'default',
  THOI_VIEC: 'error',
  CHUYEN_CONG_TAC: 'processing',
};

export const NHAN_TRINH_DO = {
  TIEN_SI: 'Tiến sĩ',
  THAC_SI: 'Thạc sĩ',
  DAI_HOC: 'Đại học',
  CAO_DANG: 'Cao đẳng',
  TRUNG_CAP: 'Trung cấp',
  SO_CAP: 'Sơ cấp',
  KHAC: 'Khác',
} as const;

export const NHAN_LOAI_DON_VI = {
  KHOA: 'Khoa',
  PHONG: 'Phòng',
  TRUNG_TAM: 'Trung tâm',
  TO_BO_MON: 'Tổ bộ môn',
  KHAC: 'Khác',
} as const;

export const NHAN_LOAI_VB = { VAN_BANG: 'Văn bằng', CHUNG_CHI: 'Chứng chỉ' } as const;

export const LY_LUAN_CT = ['Sơ cấp', 'Trung cấp', 'Cao cấp', 'Cử nhân'];

export const NHAN_LOAI_PHU_CAP = {
  CHUC_VU: 'Phụ cấp chức vụ',
  TRACH_NHIEM: 'Phụ cấp trách nhiệm / kiêm nhiệm',
  UU_DAI_NGHE: 'Phụ cấp ưu đãi nghề',
  THAM_NIEN_NHA_GIAO: 'Phụ cấp thâm niên nhà giáo',
  KHAC: 'Phụ cấp khác',
} as const;

export const NHAN_LOAI_HOP_DONG = {
  HDLV_KHONG_XAC_DINH: 'HĐ làm việc không xác định thời hạn',
  HDLV_XAC_DINH: 'HĐ làm việc xác định thời hạn',
  HDLD_KHONG_XAC_DINH: 'HĐ lao động không xác định thời hạn',
  HDLD_XAC_DINH: 'HĐ lao động xác định thời hạn',
  THINH_GIANG: 'Hợp đồng thỉnh giảng',
  KHAC: 'Khác',
} as const;

export const fmtTien = (v?: number | null) => (v === null || v === undefined ? '' : v.toLocaleString('vi-VN'));
export const fmtHeSo = (v?: number | null) => (v === null || v === undefined ? '' : v.toFixed(2));

export function tuyChon<T extends Record<string, string>>(m: T) {
  return Object.entries(m).map(([value, label]) => ({ value, label }));
}

export const coQuyenSua = (v?: VaiTro) => v === 'QUAN_TRI' || v === 'TCHC';
export const xemDanhSach = (v?: VaiTro) => !!v && v !== 'CAN_BO';

export const fmtNgay = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '');
export const fmtNgayGio = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '');
export const toIso = (d?: Dayjs | null) => (d ? d.format('YYYY-MM-DD') : null);
export const toDayjs = (v?: string | null) => (v ? dayjs(v) : null);

export function chuCaiDau(hoTen: string) {
  const p = hoTen.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
