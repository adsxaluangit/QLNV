/**
 * Nghiệp vụ chấm công (hàm thuần, không phụ thuộc CSDL) theo mẫu bảng chấm công của Phòng TCHC.
 *
 * Ký hiệu: "+" làm việc | CT công tác | H hội nghị, học tập | P nghỉ phép | L nghỉ lễ | Nb nghỉ bù |
 * Lb làm bù | Lđ lao động nghĩa vụ | Ô ốm | Cô con ốm | T tai nạn | Ts thai sản | No nghỉ không lương |
 * Vr nghỉ việc riêng (hiếu, hỉ) | K nghỉ khác.
 * Hậu tố "/2" = nghỉ nửa ngày (nửa còn lại làm việc), ví dụ "P/2".
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
const CHO_NUA_NGAY = ['CT', 'H', 'P', 'Ô', 'Cô', 'T', 'No', 'Vr', 'K', 'Nb'];

export function hopLe(kyHieu: string): boolean {
  if (kyHieu in KY_HIEU) return true;
  return kyHieu.endsWith('/2') && CHO_NUA_NGAY.includes(kyHieu.slice(0, -2));
}

/** Tách ký hiệu thành các phần (ký hiệu gốc, trọng số). */
function tachPhan(kyHieu: string): [string, number][] {
  if (kyHieu.endsWith('/2')) return [[kyHieu.slice(0, -2), 0.5], ['+', 0.5]];
  return [[kyHieu, 1]];
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
}

export function tongHopCong(kyHieus: string[]): TongCong {
  const t: TongCong = { luongThoiGian: 0, congTacHocTap: 0, nghiKhac: 0, nghiBhxh: 0, nghiKhongLuong: 0, huongLuong: 0, theoKyHieu: {} };
  for (const k of kyHieus) {
    for (const [goc, tr] of tachPhan(k)) {
      const nhom = KY_HIEU[goc]?.nhom;
      if (!nhom) continue;
      t.theoKyHieu[goc] = (t.theoKyHieu[goc] ?? 0) + tr;
      if (nhom === 'LUONG_THOI_GIAN') t.luongThoiGian += tr;
      else if (nhom === 'CONG_TAC_HOC_TAP') t.congTacHocTap += tr;
      else if (nhom === 'NGHI_KHAC') t.nghiKhac += tr;
      else if (nhom === 'NGHI_BHXH') t.nghiBhxh += tr;
      else t.nghiKhongLuong += tr;
    }
  }
  t.huongLuong = t.luongThoiGian + t.congTacHocTap + t.nghiKhac;
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
