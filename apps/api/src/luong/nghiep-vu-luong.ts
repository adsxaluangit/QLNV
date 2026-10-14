import { NgachLuong, PhuCap, QuaTrinhLuong } from '@prisma/client';

export const NHAN_LOAI_PHU_CAP = {
  CHUC_VU: 'Phụ cấp chức vụ',
  TRACH_NHIEM: 'Phụ cấp trách nhiệm',
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

export function congThang(d: Date, thang: number): Date {
  const kq = new Date(d);
  kq.setUTCMonth(kq.getUTCMonth() + thang);
  return kq;
}

export function soThangGiua(tu: Date, den: Date): number {
  let m = (den.getUTCFullYear() - tu.getUTCFullYear()) * 12 + den.getUTCMonth() - tu.getUTCMonth();
  if (den.getUTCDate() < tu.getUTCDate()) m--;
  return m;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface DeXuatNangLuong {
  loai: 'NANG_BAC' | 'VUOT_KHUNG';
  ngayDenHan: Date;
  bacMoi: number;
  heSoMoi: number;
  vuotKhungMoi: number;
}

/**
 * Tính lần nâng lương thường xuyên kế tiếp (NĐ 204/2004, TT 08/2013/TT-BNV):
 *  - Chưa tới bậc cuối: sau `thangNangBac` tháng (36 với A0 trở lên, 24 với B/C) → lên 1 bậc.
 *  - Ở bậc cuối: sau `thangNangBac` tháng → vượt khung 5%; sau đó mỗi 12 tháng +1%.
 * Chưa tính kéo dài do kỷ luật / không hoàn thành nhiệm vụ (giai đoạn sau).
 */
export function deXuatNangLuong(qtl: QuaTrinhLuong, ngach: NgachLuong | null): DeXuatNangLuong | null {
  if (!ngach || !qtl.bac || qtl.luongThoaThuan) return null;
  const soBac = ngach.heSo.length;
  const bacCuoi = ngach.heSo[soBac - 1];
  if (qtl.bac < soBac) {
    return {
      loai: 'NANG_BAC',
      ngayDenHan: congThang(qtl.mocNangBac, ngach.thangNangBac),
      bacMoi: qtl.bac + 1,
      heSoMoi: ngach.heSo[qtl.bac],
      vuotKhungMoi: 0,
    };
  }
  const lanDau = qtl.phanTramVuotKhung === 0;
  return {
    loai: 'VUOT_KHUNG',
    ngayDenHan: congThang(qtl.mocNangBac, lanDau ? ngach.thangNangBac : 12),
    bacMoi: soBac,
    heSoMoi: bacCuoi,
    vuotKhungMoi: lanDau ? 5 : qtl.phanTramVuotKhung + 1,
  };
}

/** Thâm niên nhà giáo: đủ 5 năm hưởng 5%, từ năm thứ 6 mỗi năm thêm 1%. */
export function phanTramThamNien(moc: Date, ngay: Date): number {
  const nam = Math.floor(soThangGiua(moc, ngay) / 12);
  return nam >= 5 ? nam : 0;
}

export interface UocTinhLuong {
  luongCoSo: number;
  heSo: number;
  vuotKhung: number;
  heSoPhuCapChucVu: number;
  heSoPhuCapKhac: number;
  phanTramUuDai: number;
  phanTramThamNien: number;
  /** đồng/tháng, trước khấu trừ */
  tongThuNhap: number;
}

/**
 * Ước tính lương ngạch bậc + phụ cấp tại một ngày (tham khảo cho TCHC;
 * bảng lương chính thức sẽ do phân hệ Lương tính, có khấu trừ BH, thuế).
 *  - Vượt khung = % × hệ số bậc cuối
 *  - Ưu đãi nghề, thâm niên nhà giáo tính trên (hệ số + PC chức vụ + vượt khung)
 */
export function uocTinhLuong(
  qtl: (QuaTrinhLuong & { ngach: NgachLuong | null }) | null,
  phuCaps: PhuCap[],
  luongCoSo: number,
  ngay: Date,
): UocTinhLuong | null {
  if (!qtl) return null;
  const hl = phuCaps.filter((p) => p.tuNgay <= ngay && (!p.denNgay || p.denNgay >= ngay));
  const tong = (l: PhuCap['loai']) => hl.filter((p) => p.loai === l).reduce((a, p) => a + (p.heSo ?? 0), 0);
  const heSo = qtl.heSo ?? 0;
  const vk = (heSo * qtl.phanTramVuotKhung) / 100;
  const pcCv = tong('CHUC_VU');
  const pcKhac = tong('TRACH_NHIEM') + tong('KHAC');
  const uuDai = hl.filter((p) => p.loai === 'UU_DAI_NGHE').reduce((a, p) => a + (p.phanTram ?? 0), 0);
  const tnMoc = hl.find((p) => p.loai === 'THAM_NIEN_NHA_GIAO');
  const tn = tnMoc ? phanTramThamNien(tnMoc.tuNgay, ngay) : 0;
  const nen = heSo + vk + pcCv;
  const tongHeSo = nen + pcKhac + (nen * (uuDai + tn)) / 100;
  const tongThuNhap = qtl.luongThoaThuan ?? Math.round(tongHeSo * luongCoSo);
  return {
    luongCoSo,
    heSo,
    vuotKhung: qtl.phanTramVuotKhung,
    heSoPhuCapChucVu: pcCv,
    heSoPhuCapKhac: pcKhac,
    phanTramUuDai: uuDai,
    phanTramThamNien: tn,
    tongThuNhap,
  };
}
