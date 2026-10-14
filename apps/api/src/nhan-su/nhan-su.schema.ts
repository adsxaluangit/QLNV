import { GioiTinh, LoaiHopDong, LoaiNhanSu, LoaiPhuCap, LoaiVanBang, TrangThaiNhanSu, TrinhDo } from '@prisma/client';
import { z } from 'zod';
import { chuanHoaHoTen, kiemTraMaCanBo } from '../common/nghiep-vu';
import { ngay, ngayOpt, txt, uuidOpt } from '../common/zod';

const email = z
  .union([z.literal(''), z.string().trim().email('Email không hợp lệ')])
  .nullish()
  .transform((v) => (v ? v.toLowerCase() : null));

const soDienThoai = z
  .string()
  .trim()
  .regex(/^[0-9+ .()-]{8,20}$/, 'Số điện thoại không hợp lệ')
  .nullish()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

export const nhanSuSchema = z
  .object({
    maCanBo: z
      .string({ required_error: 'Nhập số CCCD' })
      .trim()
      .transform((s) => s.replace(/\s+/g, '').toUpperCase()),
    hoTen: z.string().trim().min(2, 'Họ tên quá ngắn').max(100).transform(chuanHoaHoTen),
    tenGoiKhac: txt(100),
    gioiTinh: z.nativeEnum(GioiTinh, { required_error: 'Chọn giới tính' }),
    ngaySinh: ngay,
    noiSinh: txt(200),
    queQuan: txt(200),
    quocTich: z
      .string()
      .trim()
      .max(50)
      .nullish()
      .transform((v) => v || 'Việt Nam'),
    danToc: txt(50),
    tonGiao: txt(50),
    ngayCapCccd: ngayOpt,
    noiCapCccd: txt(200),
    dienThoai: soDienThoai,
    email,
    diaChiThuongTru: txt(300),
    choOHienNay: txt(300),
    maSoThue: txt(20),
    soBhxh: txt(20),
    soTaiKhoan: txt(30),
    nganHang: txt(100),
    donViId: z.string({ required_error: 'Chọn đơn vị' }).uuid('Chọn đơn vị'),
    chucVuId: uuidOpt,
    loaiNhanSu: z.nativeEnum(LoaiNhanSu).default('VIEN_CHUC'),
    trangThai: z.nativeEnum(TrangThaiNhanSu).default('DANG_LAM_VIEC'),
    laGiangVien: z.boolean().default(false),
    kiemNhiem: z.boolean().default(false),
    chucDanhNgheNghiep: txt(100),
    ngayTuyenDung: ngayOpt,
    ngayVaoTruong: ngayOpt,
    trinhDoChuyenMon: z
      .nativeEnum(TrinhDo)
      .nullish()
      .transform((v) => v ?? null),
    chuyenNganh: txt(200),
    hocHam: txt(50),
    danhHieu: txt(100),
    lyLuanChinhTri: txt(50),
    ngoaiNgu: txt(100),
    tinHoc: txt(100),
    nghiepVuSuPham: txt(200),
    kyNangNghe: txt(200),
    ngayVaoDang: ngayOpt,
    ngayChinhThucDang: ngayOpt,
    ghiChu: txt(2000),
  })
  .superRefine((d, ctx) => {
    const loi = kiemTraMaCanBo(d.maCanBo, d.quocTich);
    if (loi) ctx.addIssue({ code: 'custom', path: ['maCanBo'], message: loi });
    if (d.ngaySinh > new Date()) ctx.addIssue({ code: 'custom', path: ['ngaySinh'], message: 'Ngày sinh ở tương lai' });
    if (d.ngayChinhThucDang && d.ngayVaoDang && d.ngayChinhThucDang < d.ngayVaoDang) {
      ctx.addIssue({ code: 'custom', path: ['ngayChinhThucDang'], message: 'Phải sau ngày vào Đảng' });
    }
  });

export type NhanSuInput = z.infer<typeof nhanSuSchema>;

export const danhSachQuerySchema = z.object({
  q: z.string().trim().optional(),
  coSoId: z.string().uuid().optional(),
  donViId: z.string().uuid().optional(),
  chucVuId: z.string().uuid().optional(),
  loaiNhanSu: z.nativeEnum(LoaiNhanSu).optional(),
  trangThai: z.nativeEnum(TrangThaiNhanSu).optional(),
  trinhDo: z.nativeEnum(TrinhDo).optional(),
  gioiTinh: z.nativeEnum(GioiTinh).optional(),
  laGiangVien: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Chỉ hồ sơ mã tạm, chưa có CCCD */
  thieuCccd: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type DanhSachQuery = z.infer<typeof danhSachQuerySchema>;

// ---------------------------------------------------------------- Hồ sơ con

export const quaTrinhSchema = z
  .object({
    tuNgay: ngay,
    denNgay: ngayOpt,
    noiCongTac: z.string().trim().min(2).max(300),
    chucVu: txt(100),
    soQuyetDinh: txt(50),
    ghiChu: txt(500),
  })
  .refine((d) => !d.denNgay || d.denNgay >= d.tuNgay, { path: ['denNgay'], message: 'Đến ngày phải sau từ ngày' });

export const vanBangSchema = z
  .object({
    loai: z.nativeEnum(LoaiVanBang),
    ten: z.string().trim().min(2).max(200),
    chuyenNganh: txt(200),
    noiCap: txt(200),
    soHieu: txt(50),
    ngayCap: ngayOpt,
    ngayHetHan: ngayOpt,
    xepLoai: txt(50),
    ghiChu: txt(500),
  })
  .refine((d) => !d.ngayHetHan || !d.ngayCap || d.ngayHetHan >= d.ngayCap, {
    path: ['ngayHetHan'],
    message: 'Ngày hết hạn phải sau ngày cấp',
  });

export const giaDinhSchema = z.object({
  quanHe: z.string().trim().min(1).max(50),
  hoTen: z.string().trim().min(2).max(100).transform(chuanHoaHoTen),
  namSinh: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce
      .number()
      .int()
      .min(1900, 'Năm sinh không hợp lệ')
      .max(new Date().getFullYear(), 'Năm sinh không hợp lệ')
      .nullable(),
  ),
  ngheNghiep: txt(200),
  noiO: txt(300),
  ghiChu: txt(500),
});

// ---------------------------------------------------------------- Lương, phụ cấp, hợp đồng

/** Số tùy chọn: null/''/undefined → null (z.coerce sẽ biến null thành 0 nên phải xử lý trước). */
const soOpt = (min = 0, max = 1e9) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(min).max(max).nullable(),
  ) as unknown as z.ZodType<number | null, z.ZodTypeDef, unknown>;

export const quaTrinhLuongSchema = z
  .object({
    tuNgay: ngay,
    ngachId: uuidOpt,
    bac: soOpt(1, 20).transform((v) => (v === null ? null : Math.round(v))),
    heSo: soOpt(0, 20),
    phanTramVuotKhung: z.coerce.number().int().min(0).max(100).default(0),
    mocNangBac: ngayOpt,
    luongThoaThuan: soOpt(0, 1e10).transform((v) => (v === null ? null : Math.round(v))),
    soQuyetDinh: txt(50),
    ngayQuyetDinh: ngayOpt,
    ghiChu: txt(500),
  })
  .refine((d) => d.luongThoaThuan || (d.ngachId && d.bac), {
    path: ['ngachId'],
    message: 'Chọn ngạch và bậc, hoặc nhập lương thỏa thuận',
  })
  // Mặc định mốc nâng bậc = ngày hưởng
  .transform((d) => ({ ...d, mocNangBac: d.mocNangBac ?? d.tuNgay }));

export const phuCapSchema = z
  .object({
    loai: z.nativeEnum(LoaiPhuCap),
    ten: txt(100),
    heSo: soOpt(0, 10),
    phanTram: soOpt(0, 100),
    tuNgay: ngay,
    denNgay: ngayOpt,
    soQuyetDinh: txt(50),
    ghiChu: txt(500),
  })
  .superRefine((d, ctx) => {
    if (['CHUC_VU', 'TRACH_NHIEM', 'KHAC'].includes(d.loai) && d.heSo === null) {
      ctx.addIssue({ code: 'custom', path: ['heSo'], message: 'Nhập hệ số phụ cấp' });
    }
    if (d.loai === 'UU_DAI_NGHE' && d.phanTram === null) {
      ctx.addIssue({ code: 'custom', path: ['phanTram'], message: 'Nhập tỷ lệ %' });
    }
    if (d.denNgay && d.denNgay < d.tuNgay) ctx.addIssue({ code: 'custom', path: ['denNgay'], message: 'Phải sau từ ngày' });
  });

export const hopDongSchema = z
  .object({
    soHopDong: txt(50),
    loai: z.nativeEnum(LoaiHopDong),
    ngayKy: ngayOpt,
    tuNgay: ngay,
    denNgay: ngayOpt,
    chucDanh: txt(150),
    luongThoaThuan: soOpt(0, 1e10).transform((v) => (v === null ? null : Math.round(v))),
    ghiChu: txt(500),
  })
  .superRefine((d, ctx) => {
    if (d.denNgay && d.denNgay < d.tuNgay) ctx.addIssue({ code: 'custom', path: ['denNgay'], message: 'Phải sau từ ngày' });
    if (['HDLV_XAC_DINH', 'HDLD_XAC_DINH', 'THINH_GIANG'].includes(d.loai) && !d.denNgay) {
      ctx.addIssue({ code: 'custom', path: ['denNgay'], message: 'Hợp đồng xác định thời hạn cần ngày kết thúc' });
    }
  });
