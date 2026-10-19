/**
 * Nghiệp vụ chấm công (hàm thuần, không phụ thuộc CSDL) theo mẫu bảng chấm công của Phòng TCHC.
 *
 * Ký hiệu truyền thống: 
 *   "+" làm việc | CT công tác | H hội nghị, học tập | P nghỉ phép | L nghỉ lễ | Nb nghỉ bù |
 *   Lb làm bù | Lđ lao động nghĩa vụ | Ô ốm | Cô con ốm | T tai nạn | Ts thai sản | No nghỉ không lương |
 *   Vr nghỉ việc riêng (hiếu, hỉ) | K nghỉ khác.
 *   Hậu tố "/2" = nghỉ nửa ngày (nửa còn lại làm việc), ví dụ "P/2".
 *
 * Ký hiệu làm thêm giờ (Overtime):
 *   - Ngày thường: "+2h", "+3h", "+4h", "+1.5h" (công chuẩn 8h + số giờ làm thêm) hoặc "2h", "4h", "OT2".
 *   - Thứ 7 & Chủ nhật: "+" (8h OT), "+/2" (4h OT), "T7", "CN", hoặc nhập số giờ: "2h", "4h", "8h".
 *   - Ngày Lễ, Tết: "L+" (8h OT), "L+4h", hoặc "4h", "8h" vào ngày lễ.
 */

export type NhomCong = 'LUONG_THOI_GIAN' | 'CONG_TAC_HOC_TAP' | 'NGHI_KHAC' | 'NGHI_BHXH' | 'NGHI_KHONG_LUONG';

export const KY_HIEU: Record<string, { ten: string; nhom: NhomCong }> = {
  '+': { ten: 'Làm việc (lương thời gian)', nhom: 'LUONG_THOI_GIAN' },
  Lb: { ten: 'Làm bù', nhom: 'LUONG_THOI_GIAN' },
  CT: { ten: 'Công tác', nhom: 'CONG_TAC_HOC_TAP' },
  H: { ten: 'Hội nghị, học tập', nhom: 'CONG_TAC_HOC_TAP' },
  P: { ten: 'Nghỉ phép', nhom: 'NGHI_KHAC' },
  L: { ten: 'Nghỉ lễ', nhom: 'NGHI_KHAC' },
  Nb: { ten: 'Nghỉ bù', nhom: 'NGHI_KHAC' },
  Lđ: { ten: 'Lao động nghĩa vụ', nhom: 'NGHI_KHAC' },
  Vr: { ten: 'Nghỉ việc riêng (hiếu, hỉ)', nhom: 'NGHI_KHAC' },
  K: { ten: 'Nghỉ khác', nhom: 'NGHI_KHAC' },
  Ô: { ten: 'Ốm điều dưỡng', nhom: 'NGHI_BHXH' },
  Cô: { ten: 'Con ốm', nhom: 'NGHI_BHXH' },
  T: { ten: 'Tai nạn', nhom: 'NGHI_BHXH' },
  Ts: { ten: 'Thai sản', nhom: 'NGHI_BHXH' },
  No: { ten: 'Nghỉ không lương', nhom: 'NGHI_KHONG_LUONG' },
};

/** Ký hiệu cho phép nửa ngày. */
const CHO_NUA_NGAY = ['CT', 'H', 'P', 'Ô', 'Cô', 'T', 'No', 'Vr', 'K', 'Nb', '+', 'T7', 'CN'];

/** Kiểm tra ký hiệu có hợp lệ không (bao gồm cả ký hiệu làm thêm giờ). */
export function hopLe(kyHieu: string): boolean {
  if (!kyHieu) return false;
  const k = kyHieu.trim();
  if (k in KY_HIEU) return true;
  if (k.endsWith('/2') && CHO_NUA_NGAY.includes(k.slice(0, -2))) return true;
  if (['T7', 'CN', 'L+'].includes(k)) return true;

  // Làm thêm ngày thường: +2h, +3h, +1.5h, +2, +3, +4...
  if (/^\+(\d+(\.\d+)?h?)$/i.test(k)) return true;
  // Số giờ trực tiếp: 1h, 2h, 3h, 4h, 8h, 1.5h hoặc số 1, 2, 4, 8
  if (/^\d+(\.\d+)?h?$/i.test(k)) return true;
  // OT prefix: OT2, OT4, OT8, OT2h...
  if (/^OT\d+(\.\d+)?h?$/i.test(k)) return true;
  // Ngày lễ làm thêm: L+2h, L+4h, L+8h...
  if (/^L\+\d+(\.\d+)?h?$/i.test(k)) return true;

  return false;
}

export interface KetQuaPhanTichO {
  /** Ký hiệu gốc tính công hành chính (ví dụ: '+', 'P', 'CT'...) */
  goc: string;
  /** Trọng số công hành chính (1.0, 0.5, hoặc 0) */
  trongSo: number;
  /** Ký hiệu thứ 2 (cho trường hợp nửa ngày P/2 = 0.5 P + 0.5 +) */
  goc2?: string;
  trongSo2?: number;
  /** Số giờ làm thêm ngày thường (150%) */
  gioThemNgayThuong: number;
  /** Số giờ làm thêm Thứ 7 & Chủ nhật (200%) */
  gioThemCuoiTuan: number;
  /** Số giờ làm thêm Ngày Lễ, Tết (300%) */
  gioThemNgayLe: number;
  /** Nhãn hiển thị số giờ làm thêm trên Sheet Làm thêm giờ (ví dụ: '2h', '4h', '8h') */
  nhanThemGio?: string;
}

/** Phân tích chi tiết một ô chấm công dựa trên ngày và tính chất ngày (thường, cuối tuần, ngày lễ). */
export function phanTichO(k: string | null | undefined, laCuoiTuan: boolean, laNgayLe: boolean): KetQuaPhanTichO {
  if (!k) {
    return { goc: '', trongSo: 0, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
  }
  const s = k.trim();

  // 1. Ngày Lễ
  if (laNgayLe) {
    if (s === 'L') {
      return { goc: 'L', trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
    }
    if (s === '+' || s === 'L+') {
      return { goc: 'L', trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 8, nhanThemGio: '8h' };
    }
    const mL = s.match(/^(?:L\+?|\+)?(\d+(?:\.\d+)?)h?$/i);
    if (mL) {
      const h = parseFloat(mL[1]);
      return { goc: 'L', trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: h, nhanThemGio: `${h}h` };
    }
    return { goc: 'L', trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
  }

  // 2. Ngày cuối tuần (Thứ 7 & Chủ nhật)
  if (laCuoiTuan) {
    if (['+', 'T7', 'CN'].includes(s)) {
      return { goc: '', trongSo: 0, gioThemNgayThuong: 0, gioThemCuoiTuan: 8, gioThemNgayLe: 0, nhanThemGio: '8h' };
    }
    if (['+/2', 'T7/2', 'CN/2'].includes(s)) {
      return { goc: '', trongSo: 0, gioThemNgayThuong: 0, gioThemCuoiTuan: 4, gioThemNgayLe: 0, nhanThemGio: '4h' };
    }
    const mOt = s.match(/^(?:OT|\+)?(\d+(?:\.\d+)?)h?$/i);
    if (mOt) {
      const h = parseFloat(mOt[1]);
      return { goc: '', trongSo: 0, gioThemNgayThuong: 0, gioThemCuoiTuan: h, gioThemNgayLe: 0, nhanThemGio: `${h}h` };
    }
    return { goc: '', trongSo: 0, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
  }

  // 3. Ngày thường (Thứ 2 đến Thứ 6)
  if (s === '+') {
    return { goc: '+', trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
  }
  if (s.endsWith('/2')) {
    const goc = s.slice(0, -2);
    return { goc, trongSo: 0.5, goc2: '+', trongSo2: 0.5, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
  }

  // Kết hợp công ngày thường + làm thêm giờ: ví dụ "+2h", "+3h", "+4h"
  const mPlus = s.match(/^\+(\d+(?:\.\d+)?)h?$/i);
  if (mPlus) {
    const h = parseFloat(mPlus[1]);
    return { goc: '+', trongSo: 1, gioThemNgayThuong: h, gioThemCuoiTuan: 0, gioThemNgayLe: 0, nhanThemGio: `${h}h` };
  }

  // Chỉ làm thêm giờ (không có công ngày thường): ví dụ "2h", "4h", "OT2"
  const mOnlyOt = s.match(/^(?:OT)?(\d+(?:\.\d+)?)h?$/i);
  if (mOnlyOt) {
    const h = parseFloat(mOnlyOt[1]);
    return { goc: '', trongSo: 0, gioThemNgayThuong: h, gioThemCuoiTuan: 0, gioThemNgayLe: 0, nhanThemGio: `${h}h` };
  }

  return { goc: s, trongSo: 1, gioThemNgayThuong: 0, gioThemCuoiTuan: 0, gioThemNgayLe: 0 };
}

export interface TongCong {
  luongThoiGian: number;
  congTacHocTap: number;
  nghiKhac: number;
  nghiBhxh: number;
  nghiKhongLuong: number;
  /** Tổng công hưởng lương do nhà trường chi trả = lương thời gian + công tác/học tập + nghỉ khác */
  huongLuong: number;
  /** Số ngày theo từng ký hiệu gốc (để xuất báo cáo chi tiết) */
  theoKyHieu: Record<string, number>;
  /** Giờ làm thêm ngày thường (150%) */
  gioLamThemNgayThuong: number;
  /** Giờ làm thêm Thứ 7 & Chủ nhật (200%) */
  gioLamThemCuoiTuan: number;
  /** Giờ làm thêm Ngày Lễ, Tết (300%) */
  gioLamThemNgayLe: number;
  /** Tổng cộng số giờ làm thêm trong tháng */
  tongGioLamThem: number;
  /** Chi tiết giờ làm thêm theo từng ngày trong tháng */
  chiTietLamThem: Record<number, { gio: number; loai: 'NGAY_THUONG' | 'CUOI_TUAN' | 'NGAY_LE'; nhan: string }>;
}

/**
 * Tổng hợp công và làm thêm giờ trong tháng.
 * Hỗ trợ cả 2 cách gọi:
 *   - tongHopCong(kyHieus: string[]) - tương thích ngược
 *   - tongHopCong(congTheoNgay: Record<number, string>, nam: number, thang: number, ngayLe?: Set<number>)
 */
export function tongHopCong(
  input: Record<number, string> | string[],
  nam?: number,
  thang?: number,
  ngayLe: Set<number> = new Set(),
): TongCong {
  const t: TongCong = {
    luongThoiGian: 0,
    congTacHocTap: 0,
    nghiKhac: 0,
    nghiBhxh: 0,
    nghiKhongLuong: 0,
    huongLuong: 0,
    theoKyHieu: {},
    gioLamThemNgayThuong: 0,
    gioLamThemCuoiTuan: 0,
    gioLamThemNgayLe: 0,
    tongGioLamThem: 0,
    chiTietLamThem: {},
  };

  const congTheoNgay: Record<number, string> = Array.isArray(input)
    ? Object.fromEntries(input.map((k, i) => [i + 1, k]))
    : input;

  for (const [ngayStr, k] of Object.entries(congTheoNgay)) {
    const ngay = Number(ngayStr);
    const cuoiTuan = nam && thang ? laCuoiTuan(nam, thang, ngay) : false;
    const le = ngayLe.has(ngay);

    const pt = phanTichO(k, cuoiTuan, le);

    // 1. Tính công hành chính
    const congItems: [string, number][] = [];
    if (pt.goc) congItems.push([pt.goc, pt.trongSo]);
    if (pt.goc2 && pt.trongSo2) congItems.push([pt.goc2, pt.trongSo2]);

    for (const [goc, tr] of congItems) {
      const nhom = KY_HIEU[goc]?.nhom;
      if (!nhom) continue;
      t.theoKyHieu[goc] = (t.theoKyHieu[goc] ?? 0) + tr;
      if (nhom === 'LUONG_THOI_GIAN') t.luongThoiGian += tr;
      else if (nhom === 'CONG_TAC_HOC_TAP') t.congTacHocTap += tr;
      else if (nhom === 'NGHI_KHAC') t.nghiKhac += tr;
      else if (nhom === 'NGHI_BHXH') t.nghiBhxh += tr;
      else t.nghiKhongLuong += tr;
    }

    // 2. Tính làm thêm giờ
    if (pt.gioThemNgayThuong > 0) {
      t.gioLamThemNgayThuong += pt.gioThemNgayThuong;
      t.chiTietLamThem[ngay] = {
        gio: pt.gioThemNgayThuong,
        loai: 'NGAY_THUONG',
        nhan: pt.nhanThemGio || `${pt.gioThemNgayThuong}h`,
      };
    } else if (pt.gioThemCuoiTuan > 0) {
      t.gioLamThemCuoiTuan += pt.gioThemCuoiTuan;
      t.chiTietLamThem[ngay] = {
        gio: pt.gioThemCuoiTuan,
        loai: 'CUOI_TUAN',
        nhan: pt.nhanThemGio || `${pt.gioThemCuoiTuan}h`,
      };
    } else if (pt.gioThemNgayLe > 0) {
      t.gioLamThemNgayLe += pt.gioThemNgayLe;
      t.chiTietLamThem[ngay] = {
        gio: pt.gioThemNgayLe,
        loai: 'NGAY_LE',
        nhan: pt.nhanThemGio || `${pt.gioThemNgayLe}h`,
      };
    }
  }

  t.huongLuong = t.luongThoiGian + t.congTacHocTap + t.nghiKhac;
  t.tongGioLamThem = t.gioLamThemNgayThuong + t.gioLamThemCuoiTuan + t.gioLamThemNgayLe;
  return t;
}

/** Ký hiệu chấm công tương ứng với loại nghỉ đã được duyệt. */
export const KY_HIEU_THEO_LOAI_NGHI: Record<string, string> = {
  PHEP_NAM: 'P',
  OM_DAU: 'Ô',
  THAI_SAN: 'Ts',
  KHONG_LUONG: 'No',
  VIEC_RIENG: 'Vr',
  KHAC: 'K',
};

export const soNgayTrongThang = (nam: number, thang: number) => new Date(Date.UTC(nam, thang, 0)).getUTCDate();
/** 0 = Chủ nhật … 6 = Thứ bảy */
export const thuTrongTuan = (nam: number, thang: number, ngay: number) => new Date(Date.UTC(nam, thang - 1, ngay)).getUTCDay();
export const laCuoiTuan = (nam: number, thang: number, ngay: number) => [0, 6].includes(thuTrongTuan(nam, thang, ngay));

/** Số ngày làm việc chuẩn của tháng (T2–T6, kể cả ngày lễ vì vẫn hưởng lương). */
export function congChuanThang(nam: number, thang: number): number {
  let n = 0;
  for (let d = 1; d <= soNgayTrongThang(nam, thang); d++) if (!laCuoiTuan(nam, thang, d)) n++;
  return n;
}

export const TEN_THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Rút gọn chức vụ như mẫu: TP, P.TP, GV, NV... */
export function chucVuVietTat(chucVu: string | null | undefined, laGiangVien: boolean, kiemNhiem = false): string {
  const c = (chucVu ?? '').toLowerCase();
  if (c.includes('hiệu trưởng')) return c.includes('phó') ? 'P.HT' : 'HT';
  if (c.includes('trưởng phòng') || c.includes('trưởng khoa')) return c.includes('phó') ? 'P.TP' : 'TP';
  if (c.includes('phó trưởng')) return 'P.TP';
  if (c.includes('giám đốc')) return c.includes('phó') ? 'P.GĐ' : 'GĐ';
  if (c.includes('trưởng')) return 'TP';
  if (c.includes('phó')) return 'P.TP';
  if (laGiangVien && kiemNhiem) return 'GVKN';
  return laGiangVien ? 'GV' : 'NV';
}
