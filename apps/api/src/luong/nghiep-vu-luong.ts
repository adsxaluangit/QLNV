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

export interface DonNghiLuong {
  loai: string;
  trangThai: string;
  tuNgay: Date;
  denNgay: Date;
}

export function isEndOfMonth(d: Date): boolean {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1;
}

/**
 * Tính số tháng của một khoảng thời gian nghỉ (áp dụng cho nghỉ không lương theo TT 08/2013/TT-BNV, TT 03/2021/TT-BNV).
 * - Trường hợp nghỉ trọn tháng theo lịch (từ ngày 01 đến hết ngày cuối tháng): tính theo số tháng tròn.
 * - Trường hợp khác: tính quy đổi ngày (~30.4375 ngày/tháng, làm tròn số tháng gần nhất).
 * - Dưới 1 tháng (dưới 30 ngày) không tính kéo dài theo quy định.
 */
export function tinhSoThangNghi(tu: Date, den: Date): number {
  if (den < tu) return 0;
  if (tu.getUTCDate() === 1 && isEndOfMonth(den)) {
    return (den.getUTCFullYear() - tu.getUTCFullYear()) * 12 + (den.getUTCMonth() - tu.getUTCMonth()) + 1;
  }
  const soNgay = Math.round((den.getTime() - tu.getTime()) / 86_400_000) + 1;
  const th = Math.round(soNgay / 30.4375);
  return th >= 1 ? th : 0;
}

/**
 * Tính tổng số tháng kéo dài nâng bậc do nghỉ không lương trong kỳ giữ bậc hiện tại
 * (các đơn nghỉ không lương ĐÃ DUYỆT có thời gian giao với kỳ giữ bậc từ mocNangBac trở đi).
 */
export function tinhTongThangKeoDai(mocNangBac: Date, dons: DonNghiLuong[]): { soThang: number; lyDo?: string } {
  let tongThang = 0;
  for (const don of dons) {
    if (don.loai !== 'KHONG_LUONG' || don.trangThai !== 'DA_DUYET') continue;
    if (don.denNgay < mocNangBac) continue;
    const tu = don.tuNgay < mocNangBac ? mocNangBac : don.tuNgay;
    const den = don.denNgay;
    const th = tinhSoThangNghi(tu, den);
    tongThang += th;
  }
  return {
    soThang: tongThang,
    lyDo: tongThang > 0 ? `Nghỉ không lương ${tongThang} tháng` : undefined,
  };
}

export interface DeXuatNangLuong {
  loai: 'NANG_BAC' | 'VUOT_KHUNG';
  ngayDenHan: Date;
  bacMoi: number;
  heSoMoi: number;
  vuotKhungMoi: number;
  thangKeoDai?: number;
  mocNangBacGoc?: Date;
  mocNangBacDieuChinh?: Date;
}

/**
 * Tính lần nâng lương thường xuyên kế tiếp (NĐ 204/2004, TT 08/2013/TT-BNV, TT 03/2021/TT-BNV):
 *  - Chưa tới bậc cuối: sau `thangNangBac` tháng (36 với A0 trở lên, 24 với B/C) -> lên 1 bậc.
 *  - Ở bậc cuối: sau `thangNangBac` tháng -> vượt khung 5%; sau đó mỗi 12 tháng +1%.
 *  - Tự động kéo dài thời hạn nâng bậc nếu có thời gian nghỉ không lương (ví dụ nghỉ 14 tháng -> lùi 14 tháng).
 */
export function deXuatNangLuong(
  qtl: QuaTrinhLuong,
  ngach: NgachLuong | null,
  thangKeoDai = 0,
): DeXuatNangLuong | null {
  if (!ngach || !qtl.bac || qtl.luongThoaThuan) return null;
  const soBac = ngach.heSo.length;
  const bacCuoi = ngach.heSo[soBac - 1];
  const mocDieuChinh = thangKeoDai > 0 ? congThang(qtl.mocNangBac, thangKeoDai) : qtl.mocNangBac;

  if (qtl.bac < soBac) {
    return {
      loai: 'NANG_BAC',
      ngayDenHan: congThang(qtl.mocNangBac, ngach.thangNangBac + thangKeoDai),
      bacMoi: qtl.bac + 1,
      heSoMoi: ngach.heSo[qtl.bac],
      vuotKhungMoi: 0,
      thangKeoDai,
      mocNangBacGoc: qtl.mocNangBac,
      mocNangBacDieuChinh: mocDieuChinh,
    };
  }
  const lanDau = qtl.phanTramVuotKhung === 0;
  return {
    loai: 'VUOT_KHUNG',
    ngayDenHan: congThang(qtl.mocNangBac, (lanDau ? ngach.thangNangBac : 12) + thangKeoDai),
    bacMoi: soBac,
    heSoMoi: bacCuoi,
    vuotKhungMoi: lanDau ? 5 : qtl.phanTramVuotKhung + 1,
    thangKeoDai,
    mocNangBacGoc: qtl.mocNangBac,
    mocNangBacDieuChinh: mocDieuChinh,
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
  /** Đồng/tháng, trước khấu trừ */
  tongThuNhap: number;
}

/**
 * Ước tính lương ngạch bậc + phụ cấp tại một ngày (tham khảo cho TCHC;
 * bảng lương chính thức sẽ do phân hệ Lương tính, có khấu trừ BH, thuế).
 *  - Vượt khung = % * hệ số bậc cuối
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

// ================================================================
// NÂNG BẬC LƯƠNG TRƯỚC THỜI HẠN DO LẬP THÀNH TÍCH XUẤT SẮC
// (Thông tư 08/2013/TT-BNV, Thông tư 03/2021/TT-BNV)
// ================================================================

export interface UngVienNangLuongTruocThoiHan {
  nhanSuId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  chucVu?: string;
  ngach: { id: string; ma: string; ten: string };
  bacHienTai: number;
  heSoHienTai: number;
  vuotKhungHienTai?: number;
  mocNangBac: string;
  mocNangBacDieuChinh?: string;
  soThangKeoDai?: number;
  lyDoKeoDai?: string;
  ngayDenHanThuongXuyen: string;
  soThangConThieu: number; // Tính đến ngày mốc xét (1 - 12 tháng)
  bacMoi: number;
  heSoMoi: number;
  daNangTruocThoiHanLanTruoc: boolean;
  lyDoKhongDuDieuKien?: string;
  // Ngày hưởng mới ứng với 3 mức rút ngắn
  ngayHuong12Thang: string;
  ngayHuong9Thang: string;
  ngayHuong6Thang: string;
}

/**
 * Kiểm tra xem viên chức đã từng nâng lương trước thời hạn ở lần nâng liền kề trước hay chưa
 * (Quy định: Không thực hiện hai lần liên tiếp nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong cùng ngạch).
 */
export function kiemTraNangTruocThoiHanLanTruoc(
  qtlHienTai: QuaTrinhLuong,
  qtlTruoc?: QuaTrinhLuong | null,
  ngach?: NgachLuong | null,
): { daNang: boolean; lyDo?: string } {
  const ghiChu = (qtlHienTai.ghiChu || '').toLowerCase();
  if (
    ghiChu.includes('trước thời hạn') ||
    ghiChu.includes('truoc thoi han') ||
    ghiChu.includes('ttxs') ||
    ghiChu.includes('thành tích xuất sắc') ||
    ghiChu.includes('thanh tich xuat sac')
  ) {
    return {
      daNang: true,
      lyDo: `Lần nâng liền kề trước (${iso(qtlHienTai.tuNgay)}) đã được nâng trước thời hạn (QĐ: ${qtlHienTai.soQuyetDinh || 'đã lưu'}).`,
    };
  }
  if (qtlTruoc && ngach && qtlTruoc.ngachId === qtlHienTai.ngachId && qtlTruoc.tuNgay && qtlHienTai.tuNgay) {
    const khoangThang = soThangGiua(qtlTruoc.tuNgay, qtlHienTai.tuNgay);
    if (khoangThang > 0 && khoangThang < ngach.thangNangBac) {
      return {
        daNang: true,
        lyDo: `Lần nâng liền kề trước sau ${khoangThang} tháng (< ${ngach.thangNangBac} tháng chuẩn của ngạch).`,
      };
    }
  }
  return { daNang: false };
}
