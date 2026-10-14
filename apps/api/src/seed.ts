/**
 * Khởi tạo dữ liệu ban đầu (chạy mỗi lần khởi động, an toàn khi chạy lại):
 *  - Tài khoản quản trị `admin` nếu chưa có quản trị nào.
 *  - Danh mục chức vụ mặc định nếu trống.
 *  - Dữ liệu MẪU (cơ sở, đơn vị, ~60 cán bộ giả) khi SEED_DEMO=true và chưa có cơ sở nào.
 */
import { GioiTinh, LoaiDonVi, LoaiNhanSu, PrismaClient, TrinhDo } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { layTen } from './common/nghiep-vu';

const prisma = new PrismaClient();

const CHUC_VU = [
  'Hiệu trưởng',
  'Phó Hiệu trưởng',
  'Trưởng phòng',
  'Phó Trưởng phòng',
  'Trưởng khoa',
  'Phó Trưởng khoa',
  'Giám đốc trung tâm',
  'Phó Giám đốc trung tâm',
  'Tổ trưởng bộ môn',
  'Tổ phó bộ môn',
  'Giảng viên',
  'Chuyên viên',
  'Kế toán viên',
  'Nhân viên',
];

async function main() {
  const coAdmin = await prisma.taiKhoan.count({ where: { vaiTro: 'QUAN_TRI' } });
  if (!coAdmin) {
    const mk = process.env.ADMIN_PASSWORD || 'Admin@123';
    await prisma.taiKhoan.create({
      data: {
        tenDangNhap: 'admin',
        tenHienThi: 'Quản trị hệ thống',
        vaiTro: 'QUAN_TRI',
        matKhauHash: await bcrypt.hash(mk, 10),
        phaiDoiMatKhau: true,
      },
    });
    console.log(`✔ Đã tạo tài khoản quản trị: admin / ${process.env.ADMIN_PASSWORD ? '(theo ADMIN_PASSWORD)' : mk}`);
  }

  if (!(await prisma.chucVu.count())) {
    await prisma.chucVu.createMany({ data: CHUC_VU.map((ten, i) => ({ ten, thuTu: i })) });
    console.log('✔ Đã tạo danh mục chức vụ');
  }

  if (process.env.SEED_DEMO === 'true' && !(await prisma.coSo.count())) {
    await duLieuMau();
    console.log('✔ Đã tạo dữ liệu mẫu');
  }

  if (!(await prisma.ngachLuong.count())) {
    await prisma.ngachLuong.createMany({ data: NGACH.map((n, i) => ({ ...n, thuTu: i })) });
    console.log('✔ Đã tạo danh mục ngạch & hệ số lương (cần đối chiếu văn bản hiện hành)');
  }
  if (!(await prisma.luongCoSo.count())) {
    await prisma.luongCoSo.create({
      data: { tuNgay: d('2024-07-01'), mucLuong: 2_340_000, canCu: 'NĐ 73/2024/NĐ-CP (cần đối chiếu, cập nhật khi có mức mới)' },
    });
    console.log('✔ Đã tạo mức lương cơ sở');
  }
  if (process.env.SEED_DEMO === 'true' && !(await prisma.quaTrinhLuong.count()) && (await prisma.nhanSu.count())) {
    await luongMau();
    console.log('✔ Đã tạo dữ liệu lương, phụ cấp, hợp đồng mẫu');
  }
}

// ------------------------------------------------------------------ Ngạch & hệ số

const day = (dau: number, buoc: number, soBac: number) =>
  Array.from({ length: soBac }, (_, i) => Math.round((dau + buoc * i) * 100) / 100);

/** Bảng hệ số theo NĐ 204/2004/NĐ-CP — mã ngạch/CDNN cần đối chiếu văn bản hiện hành. */
const NGACH = [
  { ma: 'V.09.02.01', ten: 'Giảng viên GDNN cao cấp (hạng I)', nhom: 'A3.1', heSo: day(6.2, 0.36, 6), thangNangBac: 36 },
  { ma: 'V.09.02.02', ten: 'Giảng viên GDNN chính (hạng II)', nhom: 'A2.1', heSo: day(4.4, 0.34, 8), thangNangBac: 36 },
  { ma: 'V.09.02.03', ten: 'Giảng viên GDNN lý thuyết (hạng III)', nhom: 'A1', heSo: day(2.34, 0.33, 9), thangNangBac: 36 },
  { ma: 'V.09.02.04', ten: 'Giảng viên GDNN thực hành (hạng III)', nhom: 'A0', heSo: day(2.1, 0.31, 10), thangNangBac: 36 },
  { ma: '01.002', ten: 'Chuyên viên chính', nhom: 'A2.1', heSo: day(4.4, 0.34, 8), thangNangBac: 36 },
  { ma: '01.003', ten: 'Chuyên viên', nhom: 'A1', heSo: day(2.34, 0.33, 9), thangNangBac: 36 },
  { ma: '06.031', ten: 'Kế toán viên', nhom: 'A1', heSo: day(2.34, 0.33, 9), thangNangBac: 36 },
  { ma: '01.004', ten: 'Cán sự', nhom: 'A0', heSo: day(2.1, 0.31, 10), thangNangBac: 36 },
  { ma: '01.005', ten: 'Nhân viên', nhom: 'B', heSo: day(1.86, 0.2, 12), thangNangBac: 24 },
];

// ------------------------------------------------------------------ Dữ liệu mẫu

let hatGiong = 20261013;
function ngauNhien() {
  hatGiong = (hatGiong * 1103515245 + 12345) % 2147483648;
  return hatGiong / 2147483648;
}
const chon = <T>(ds: readonly T[]): T => ds[Math.floor(ngauNhien() * ds.length)];
const soNgauNhien = (a: number, b: number) => a + Math.floor(ngauNhien() * (b - a + 1));

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý'];
const DEM_NAM = ['Văn', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Thanh', 'Công', 'Xuân'];
const DEM_NU = ['Thị', 'Thu', 'Ngọc', 'Thanh', 'Minh', 'Hồng', 'Thùy', 'Phương'];
const TEN_NAM = ['An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Hùng', 'Khánh', 'Long', 'Nam', 'Phong', 'Quân', 'Sơn', 'Thắng', 'Tuấn', 'Việt'];
const TEN_NU = ['Anh', 'Chi', 'Dung', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Lan', 'Linh', 'Mai', 'Nga', 'Oanh', 'Phương', 'Thảo', 'Trang', 'Yến'];
const TINH = [
  { ma: '001', ten: 'Hà Nội' },
  { ma: '030', ten: 'Hải Dương' },
  { ma: '033', ten: 'Hưng Yên' },
  { ma: '036', ten: 'Nam Định' },
  { ma: '037', ten: 'Ninh Bình' },
  { ma: '038', ten: 'Thanh Hóa' },
  { ma: '040', ten: 'Nghệ An' },
];

/** Số CCCD đúng cấu trúc: mã tỉnh (3) + giới tính/thế kỷ (1) + 2 số cuối năm sinh + 6 số ngẫu nhiên. */
function taoCccd(maTinh: string, gioiTinh: GioiTinh, namSinh: number, daDung: Set<string>) {
  const theKy = namSinh >= 2000 ? 2 : 0;
  const so4 = theKy + (gioiTinh === 'NU' ? 1 : 0);
  let cccd: string;
  do {
    cccd = `${maTinh}${so4}${String(namSinh % 100).padStart(2, '0')}${String(soNgauNhien(0, 999999)).padStart(6, '0')}`;
  } while (daDung.has(cccd));
  daDung.add(cccd);
  return cccd;
}

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ngayStr = (y: number, m: number, day: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

async function duLieuMau() {
  const cs1 = await prisma.coSo.create({ data: { ma: 'CS1', ten: 'Cơ sở 1 (Trụ sở chính)', diaChi: 'Số 1 Đường Mẫu, TP. Mẫu', thuTu: 1 } });
  const cs2 = await prisma.coSo.create({ data: { ma: 'CS2', ten: 'Cơ sở 2', diaChi: 'Khu công nghiệp Mẫu', thuTu: 2 } });

  const dv = async (ma: string, ten: string, loai: LoaiDonVi, coSoId: string, parentId?: string, thuTu = 0) =>
    prisma.donVi.create({ data: { ma, ten, loai, coSoId, parentId, thuTu } });

  const bgh = await dv('BGH', 'Ban Giám hiệu', 'KHAC', cs1.id, undefined, 0);
  const tchc = await dv('P.TCHC', 'Phòng Tổ chức – Hành chính', 'PHONG', cs1.id, undefined, 1);
  const dt = await dv('P.DT', 'Phòng Đào tạo', 'PHONG', cs1.id, undefined, 2);
  const kt = await dv('P.KHTC', 'Phòng Kế hoạch – Tài chính', 'PHONG', cs1.id, undefined, 3);
  const kDien = await dv('K.DIEN', 'Khoa Điện – Điện tử', 'KHOA', cs1.id, undefined, 10);
  const kCk = await dv('K.CK', 'Khoa Cơ khí', 'KHOA', cs2.id, undefined, 11);
  const kOto = await dv('K.OTO', 'Khoa Công nghệ Ô tô', 'KHOA', cs2.id, undefined, 12);
  const kCntt = await dv('K.CNTT', 'Khoa Công nghệ thông tin', 'KHOA', cs1.id, undefined, 13);
  const kCb = await dv('K.CB', 'Khoa Khoa học cơ bản', 'KHOA', cs1.id, undefined, 14);
  const tDcn = await dv('K.DIEN.DCN', 'Tổ Điện công nghiệp', 'TO_BO_MON', cs1.id, kDien.id, 1);
  const tDt = await dv('K.DIEN.DT', 'Tổ Điện tử', 'TO_BO_MON', cs1.id, kDien.id, 2);
  const tHan = await dv('K.CK.HAN', 'Tổ Hàn', 'TO_BO_MON', cs2.id, kCk.id, 1);

  const cv = Object.fromEntries((await prisma.chucVu.findMany()).map((c) => [c.ten, c.id]));
  const daDung = new Set<string>();

  type Mau = { donViId: string; chucVu?: string; gv: boolean; cdnn?: string; nganh: string };
  const mau: Mau[] = [
    { donViId: bgh.id, chucVu: 'Hiệu trưởng', gv: true, cdnn: 'Giảng viên chính GDNN (hạng II)', nganh: 'Kỹ thuật điện' },
    { donViId: bgh.id, chucVu: 'Phó Hiệu trưởng', gv: true, cdnn: 'Giảng viên chính GDNN (hạng II)', nganh: 'Cơ khí chế tạo' },
    { donViId: bgh.id, chucVu: 'Phó Hiệu trưởng', gv: true, cdnn: 'Giảng viên GDNN lý thuyết (hạng III)', nganh: 'Quản lý giáo dục' },
    { donViId: tchc.id, chucVu: 'Trưởng phòng', gv: false, cdnn: 'Chuyên viên', nganh: 'Quản trị nhân lực' },
    ...Array.from({ length: 3 }, () => ({ donViId: tchc.id, chucVu: 'Chuyên viên', gv: false, cdnn: 'Chuyên viên', nganh: 'Luật' })),
    { donViId: dt.id, chucVu: 'Trưởng phòng', gv: true, cdnn: 'Giảng viên GDNN lý thuyết (hạng III)', nganh: 'Sư phạm kỹ thuật' },
    ...Array.from({ length: 3 }, () => ({ donViId: dt.id, chucVu: 'Chuyên viên', gv: false, cdnn: 'Chuyên viên', nganh: 'Quản lý giáo dục' })),
    { donViId: kt.id, chucVu: 'Trưởng phòng', gv: false, cdnn: 'Kế toán viên', nganh: 'Kế toán' },
    ...Array.from({ length: 2 }, () => ({ donViId: kt.id, chucVu: 'Kế toán viên', gv: false, cdnn: 'Kế toán viên', nganh: 'Kế toán' })),
  ];
  const khoa: [string, string, string[]][] = [
    [kDien.id, 'Kỹ thuật điện', [tDcn.id, tDt.id]],
    [kCk.id, 'Cơ khí chế tạo', [tHan.id]],
    [kOto.id, 'Công nghệ kỹ thuật ô tô', []],
    [kCntt.id, 'Công nghệ thông tin', []],
    [kCb.id, 'Toán học', []],
  ];
  for (const [id, nganh, tos] of khoa) {
    mau.push({ donViId: id, chucVu: 'Trưởng khoa', gv: true, cdnn: 'Giảng viên chính GDNN (hạng II)', nganh });
    mau.push({ donViId: id, chucVu: 'Phó Trưởng khoa', gv: true, cdnn: 'Giảng viên GDNN lý thuyết (hạng III)', nganh });
    for (let i = 0; i < 7; i++) {
      mau.push({
        donViId: tos.length ? chon(tos) : id,
        chucVu: 'Giảng viên',
        gv: true,
        cdnn: chon(['Giảng viên GDNN lý thuyết (hạng III)', 'Giảng viên GDNN thực hành (hạng III)']),
        nganh,
      });
    }
  }

  for (const m of mau) {
    const gioiTinh: GioiTinh = ngauNhien() < 0.55 ? 'NAM' : 'NU';
    const nam = gioiTinh === 'NAM';
    const hoTen = `${chon(HO)} ${chon(nam ? DEM_NAM : DEM_NU)} ${chon(nam ? TEN_NAM : TEN_NU)}`;
    const namSinh = soNgauNhien(1965, 1998);
    const tinh = chon(TINH);
    const namTD = Math.min(2024, namSinh + soNgauNhien(23, 30));
    const loaiNhanSu: LoaiNhanSu = ngauNhien() < 0.8 ? 'VIEN_CHUC' : 'HOP_DONG';
    const trinhDo: TrinhDo = m.gv ? chon(['THAC_SI', 'THAC_SI', 'DAI_HOC', 'TIEN_SI'] as const) : chon(['DAI_HOC', 'DAI_HOC', 'THAC_SI'] as const);
    const ns = await prisma.nhanSu.create({
      data: {
        maCanBo: taoCccd(tinh.ma, gioiTinh, namSinh, daDung),
        hoTen,
        ten: layTen(hoTen),
        gioiTinh,
        ngaySinh: d(ngayStr(namSinh, soNgauNhien(1, 12), soNgauNhien(1, 28))),
        queQuan: tinh.ten,
        noiSinh: tinh.ten,
        danToc: 'Kinh',
        dienThoai: `09${soNgauNhien(10000000, 99999999)}`,
        email: null,
        donViId: m.donViId,
        chucVuId: m.chucVu ? cv[m.chucVu] : null,
        loaiNhanSu,
        laGiangVien: m.gv,
        chucDanhNgheNghiep: m.cdnn,
        trinhDoChuyenMon: trinhDo,
        chuyenNganh: m.nganh,
        ngayTuyenDung: d(ngayStr(namTD, 9, 1)),
        ngayVaoTruong: d(ngayStr(namTD, 9, 1)),
        nghiepVuSuPham: m.gv ? 'Sư phạm dạy nghề trình độ cao đẳng' : null,
        kyNangNghe: m.gv && ngauNhien() < 0.6 ? 'Chứng chỉ kỹ năng nghề bậc 3' : null,
        ngoaiNgu: chon(['Tiếng Anh B1', 'Tiếng Anh B2', 'Tiếng Anh A2']),
        tinHoc: 'Ứng dụng CNTT cơ bản',
        lyLuanChinhTri: chon(['Sơ cấp', 'Trung cấp', 'Cao cấp', null]),
        quaTrinhCongTacs: {
          create: [{ tuNgay: d(ngayStr(namTD, 9, 1)), noiCongTac: 'Trường Cao đẳng (dữ liệu mẫu)', chucVu: m.chucVu ?? 'Nhân viên' }],
        },
        vanBangs: {
          create: [
            {
              loai: 'VAN_BANG',
              ten: trinhDo === 'TIEN_SI' ? 'Tiến sĩ' : trinhDo === 'THAC_SI' ? 'Thạc sĩ' : 'Kỹ sư / Cử nhân',
              chuyenNganh: m.nganh,
              noiCap: 'Trường Đại học (dữ liệu mẫu)',
              ngayCap: d(ngayStr(namSinh + 23, 7, 15)),
            },
            ...(m.gv && ngauNhien() < 0.3
              ? [
                  {
                    loai: 'CHUNG_CHI' as const,
                    ten: 'Chứng chỉ kỹ năng nghề',
                    ngayCap: d(ngayStr(new Date().getFullYear() - 5, 1, 1)),
                    ngayHetHan: new Date(Date.now() + soNgauNhien(5, 55) * 86400000),
                  },
                ]
              : []),
          ],
        },
      },
    });
    void ns;
  }
}

const MA_NGACH_THEO_CDNN: Record<string, string> = {
  'Giảng viên chính GDNN (hạng II)': 'V.09.02.02',
  'Giảng viên GDNN lý thuyết (hạng III)': 'V.09.02.03',
  'Giảng viên GDNN thực hành (hạng III)': 'V.09.02.04',
  'Chuyên viên': '01.003',
  'Kế toán viên': '06.031',
};

/** Hệ số phụ cấp chức vụ MẪU — trường tự nhập theo quy định áp dụng. */
const PC_CHUC_VU_MAU: Record<string, number> = {
  'Hiệu trưởng': 0.9,
  'Phó Hiệu trưởng': 0.7,
  'Trưởng phòng': 0.45,
  'Trưởng khoa': 0.45,
  'Phó Trưởng khoa': 0.35,
};

const congThangMau = (x: Date, m: number) => {
  const k = new Date(x);
  k.setUTCMonth(k.getUTCMonth() + m);
  return k;
};

async function luongMau() {
  const ngach = Object.fromEntries((await prisma.ngachLuong.findMany()).map((n) => [n.ma, n]));
  const ds = await prisma.nhanSu.findMany({ include: { chucVu: true } });
  const homNay = new Date();
  for (const ns of ds) {
    const n = ngach[MA_NGACH_THEO_CDNN[ns.chucDanhNgheNghiep ?? ''] ?? '01.003'];
    if (!n) continue;
    // Mốc xếp lương lệch ngẫu nhiên 0–11 tháng so với ngày tuyển dụng để hạn nâng lương trải đều
    const goc = congThangMau(ns.ngayTuyenDung ?? d('2015-09-01'), soNgauNhien(0, 11));
    const thang = Math.max(0, (homNay.getUTCFullYear() - goc.getUTCFullYear()) * 12 + homNay.getUTCMonth() - goc.getUTCMonth());
    const soBac = n.heSo.length;
    const buoc = Math.floor(thang / n.thangNangBac);
    let bac: number;
    let vk = 0;
    let moc: Date;
    if (buoc < soBac) {
      bac = buoc + 1;
      moc = congThangMau(goc, buoc * n.thangNangBac);
    } else {
      bac = soBac;
      const duBacCuoi = thang - (soBac - 1) * n.thangNangBac;
      const mocBacCuoi = congThangMau(goc, (soBac - 1) * n.thangNangBac);
      if (duBacCuoi >= n.thangNangBac) {
        vk = 5 + Math.floor((duBacCuoi - n.thangNangBac) / 12);
        moc = congThangMau(mocBacCuoi, n.thangNangBac + (vk - 5) * 12);
      } else moc = mocBacCuoi;
    }
    await prisma.quaTrinhLuong.create({
      data: {
        nhanSuId: ns.id,
        tuNgay: moc,
        mocNangBac: moc,
        ngachId: n.id,
        bac,
        heSo: n.heSo[bac - 1],
        phanTramVuotKhung: vk,
        soQuyetDinh: `${soNgauNhien(10, 300)}/QĐ-CĐN`,
        ngayQuyetDinh: moc,
        ghiChu: 'Dữ liệu mẫu',
      },
    });

    const pc: { loai: 'CHUC_VU' | 'UU_DAI_NGHE' | 'THAM_NIEN_NHA_GIAO'; heSo?: number; phanTram?: number; tuNgay: Date }[] = [];
    const hsCv = ns.chucVu ? PC_CHUC_VU_MAU[ns.chucVu.ten] : undefined;
    if (hsCv) pc.push({ loai: 'CHUC_VU', heSo: hsCv, tuNgay: d('2020-01-01') });
    if (ns.laGiangVien && ns.ngayTuyenDung) {
      pc.push({ loai: 'UU_DAI_NGHE', phanTram: 35, tuNgay: ns.ngayTuyenDung });
      pc.push({ loai: 'THAM_NIEN_NHA_GIAO', tuNgay: ns.ngayTuyenDung });
    }
    if (pc.length) {
      await prisma.phuCap.createMany({ data: pc.map((p) => ({ ...p, nhanSuId: ns.id, ghiChu: 'Dữ liệu mẫu' })) });
    }

    const td = ns.ngayTuyenDung ?? d('2015-09-01');
    if (ns.loaiNhanSu === 'HOP_DONG') {
      // HĐLĐ xác định thời hạn, một số sắp hết hạn trong 60 ngày
      const den = new Date(homNay.getTime() + soNgauNhien(-10, 200) * 86_400_000);
      const tu = congThangMau(den, -24);
      await prisma.hopDong.create({
        data: {
          nhanSuId: ns.id,
          soHopDong: `${soNgauNhien(1, 200)}/HĐLĐ`,
          loai: 'HDLD_XAC_DINH',
          ngayKy: tu,
          tuNgay: tu,
          denNgay: d(den.toISOString().slice(0, 10)),
          chucDanh: ns.chucDanhNgheNghiep,
          ghiChu: 'Dữ liệu mẫu',
        },
      });
    } else {
      await prisma.hopDong.create({
        data: {
          nhanSuId: ns.id,
          soHopDong: `${soNgauNhien(1, 200)}/HDLV`,
          loai: 'HDLV_KHONG_XAC_DINH',
          ngayKy: td,
          tuNgay: td,
          chucDanh: ns.chucDanhNgheNghiep,
          ghiChu: 'Dữ liệu mẫu',
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
