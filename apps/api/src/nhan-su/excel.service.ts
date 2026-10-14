import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { NguoiDung } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import {
  boDau,
  layTen,
  NHAN_GIOI_TINH,
  NHAN_LOAI_NS,
  NHAN_TRANG_THAI,
  NHAN_TRINH_DO,
  traNguoc,
} from '../common/nghiep-vu';
import { DanhSachQuery, nhanSuSchema } from './nhan-su.schema';
import { NhanSuService } from './nhan-su.service';

type Kieu = 'text' | 'date' | 'enum' | 'bool';
interface Cot {
  key: string;
  header: string;
  width: number;
  kieu: Kieu;
  batBuoc?: boolean;
  luaChon?: string[];
}

/** Cột dùng chung cho mẫu nhập và file xuất (file xuất có thể nhập lại). */
const COT: Cot[] = [
  { key: 'maCanBo', header: 'Mã cán bộ (Số CCCD)', width: 18, kieu: 'text', batBuoc: true },
  { key: 'hoTen', header: 'Họ và tên', width: 26, kieu: 'text', batBuoc: true },
  { key: 'gioiTinh', header: 'Giới tính', width: 10, kieu: 'enum', batBuoc: true, luaChon: Object.values(NHAN_GIOI_TINH) },
  { key: 'ngaySinh', header: 'Ngày sinh', width: 12, kieu: 'date', batBuoc: true },
  { key: 'maDonVi', header: 'Mã đơn vị', width: 12, kieu: 'text', batBuoc: true },
  { key: 'chucVu', header: 'Chức vụ', width: 20, kieu: 'text' },
  { key: 'loaiNhanSu', header: 'Loại nhân sự', width: 18, kieu: 'enum', luaChon: Object.values(NHAN_LOAI_NS) },
  { key: 'trangThai', header: 'Trạng thái', width: 16, kieu: 'enum', luaChon: Object.values(NHAN_TRANG_THAI) },
  { key: 'laGiangVien', header: 'Là giảng viên', width: 12, kieu: 'bool', luaChon: ['Có', 'Không'] },
  { key: 'chucDanhNgheNghiep', header: 'Chức danh nghề nghiệp', width: 24, kieu: 'text' },
  { key: 'trinhDoChuyenMon', header: 'Trình độ chuyên môn', width: 14, kieu: 'enum', luaChon: Object.values(NHAN_TRINH_DO) },
  { key: 'chuyenNganh', header: 'Chuyên ngành', width: 22, kieu: 'text' },
  { key: 'ngayTuyenDung', header: 'Ngày tuyển dụng', width: 14, kieu: 'date' },
  { key: 'ngayVaoTruong', header: 'Ngày vào trường', width: 14, kieu: 'date' },
  { key: 'dienThoai', header: 'Điện thoại', width: 14, kieu: 'text' },
  { key: 'email', header: 'Email', width: 24, kieu: 'text' },
  { key: 'ngayCapCccd', header: 'Ngày cấp CCCD', width: 14, kieu: 'date' },
  { key: 'noiCapCccd', header: 'Nơi cấp CCCD', width: 22, kieu: 'text' },
  { key: 'danToc', header: 'Dân tộc', width: 10, kieu: 'text' },
  { key: 'tonGiao', header: 'Tôn giáo', width: 10, kieu: 'text' },
  { key: 'quocTich', header: 'Quốc tịch', width: 12, kieu: 'text' },
  { key: 'noiSinh', header: 'Nơi sinh', width: 20, kieu: 'text' },
  { key: 'queQuan', header: 'Quê quán', width: 20, kieu: 'text' },
  { key: 'diaChiThuongTru', header: 'Địa chỉ thường trú', width: 30, kieu: 'text' },
  { key: 'choOHienNay', header: 'Chỗ ở hiện nay', width: 30, kieu: 'text' },
  { key: 'maSoThue', header: 'Mã số thuế', width: 14, kieu: 'text' },
  { key: 'soBhxh', header: 'Số sổ BHXH', width: 14, kieu: 'text' },
  { key: 'soTaiKhoan', header: 'Số tài khoản', width: 18, kieu: 'text' },
  { key: 'nganHang', header: 'Ngân hàng', width: 18, kieu: 'text' },
  { key: 'lyLuanChinhTri', header: 'Lý luận chính trị', width: 14, kieu: 'text' },
  { key: 'ngoaiNgu', header: 'Ngoại ngữ', width: 16, kieu: 'text' },
  { key: 'tinHoc', header: 'Tin học', width: 16, kieu: 'text' },
  { key: 'nghiepVuSuPham', header: 'Nghiệp vụ sư phạm', width: 22, kieu: 'text' },
  { key: 'kyNangNghe', header: 'Kỹ năng nghề', width: 22, kieu: 'text' },
  { key: 'maCu', header: 'Mã cũ (khi đổi CCCD / mã tạm)', width: 22, kieu: 'text' },
];

const NHAN_ENUM: Record<string, Record<string, string>> = {
  gioiTinh: NHAN_GIOI_TINH,
  loaiNhanSu: NHAN_LOAI_NS,
  trangThai: NHAN_TRANG_THAI,
  trinhDoChuyenMon: NHAN_TRINH_DO,
};

const SO_DONG_MAU = 500;

export interface KetQuaNhap {
  tong: number;
  taoMoi: number;
  capNhat: number;
  loi: { dong: number; maCanBo: string; loi: string }[];
  kiemTra: boolean;
}

function giaTriO(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return (v as ExcelJS.CellFormulaValue).result ?? null;
    if ('text' in v) return (v as ExcelJS.CellHyperlinkValue).text;
    return null;
  }
  return v;
}

function iso(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Chấp nhận ô ngày của Excel, "dd/mm/yyyy", "d-m-yyyy" hoặc "yyyy-mm-dd". */
function docNgay(v: unknown): string | null | 'LOI' {
  if (v === null || v === '') return null;
  if (v instanceof Date) return iso(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return 'LOI';
}

/** Excel hay làm mất số 0 đầu của CCCD (vd 001...) → bù lại cho đủ 12 số. */
function docMaCanBo(v: unknown): string {
  if (typeof v === 'number') return String(Math.round(v)).padStart(12, '0');
  const s = String(v ?? '').replace(/\s+/g, '').toUpperCase();
  return /^\d{10,11}$/.test(s) ? s.padStart(12, '0') : s;
}

@Injectable()
export class ExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly nhanSu: NhanSuService,
  ) {}

  private kieuTieuDe(ws: ExcelJS.Worksheet) {
    const row = ws.getRow(1);
    row.height = 32;
    row.eachCell((c, col) => {
      const batBuoc = COT[col - 1]?.batBuoc;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: batBuoc ? 'FFB4232A' : 'FF0F4C5C' } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  }

  private themCot(ws: ExcelJS.Worksheet, them: { header: string; key: string; width: number }[] = []) {
    ws.columns = [...COT.map((c) => ({ header: c.header, key: c.key, width: c.width })), ...them];
    COT.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.kieu === 'date') col.numFmt = 'dd/mm/yyyy';
      if (c.key === 'maCanBo' || c.key === 'dienThoai' || c.key === 'soTaiKhoan') col.numFmt = '@';
    });
  }

  async mauNhap(): Promise<Buffer> {
    const [donVis, chucVus] = await Promise.all([
      this.prisma.donVi.findMany({ include: { coSo: true }, orderBy: [{ coSo: { thuTu: 'asc' } }, { thuTu: 'asc' }] }),
      this.prisma.chucVu.findMany({ orderBy: { thuTu: 'asc' } }),
    ]);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanSu');
    this.themCot(ws);
    this.kieuTieuDe(ws);

    for (let r = 2; r <= SO_DONG_MAU + 1; r++) {
      COT.forEach((c, i) => {
        if (c.luaChon) {
          ws.getCell(r, i + 1).dataValidation = {
            type: 'list',
            allowBlank: !c.batBuoc,
            formulae: [`"${c.luaChon.join(',')}"`],
          };
        }
      });
    }

    const hd = wb.addWorksheet('HuongDan');
    hd.columns = [
      { header: 'Mã đơn vị', key: 'ma', width: 14 },
      { header: 'Tên đơn vị', key: 'ten', width: 40 },
      { header: 'Cơ sở', key: 'coSo', width: 30 },
      { header: '', key: 'trong', width: 4 },
      { header: 'Chức vụ', key: 'chucVu', width: 30 },
    ];
    donVis.forEach((d, i) => {
      hd.getCell(i + 2, 1).value = d.ma;
      hd.getCell(i + 2, 2).value = d.ten;
      hd.getCell(i + 2, 3).value = d.coSo.ten;
    });
    chucVus.forEach((c, i) => (hd.getCell(i + 2, 5).value = c.ten));
    hd.getRow(1).font = { bold: true };
    const ghiChu = [
      'HƯỚNG DẪN',
      '• Cột tô đỏ là bắt buộc.',
      '• Mã cán bộ = số CCCD 12 chữ số. Nên định dạng cột là Text để không mất số 0 đầu.',
      '• Ngày nhập dạng dd/mm/yyyy.',
      '• Nếu Mã cán bộ đã có trong hệ thống: các ô có dữ liệu sẽ cập nhật, ô trống giữ nguyên.',
      '• Đổi mã (vd bổ sung CCCD cho hồ sơ mã tạm TAM-xxxx): ghi mã hiện tại vào cột "Mã cũ", số CCCD mới vào cột "Mã cán bộ".',
      '  Mẹo: Xuất Excel danh sách → cột "Mã cũ" đã điền sẵn cho hồ sơ mã tạm; chỉ cần gõ CCCD, ngày sinh, giới tính rồi nhập lại.',
      '• Người nước ngoài: điền số hộ chiếu và cột Quốc tịch.',
    ];
    ghiChu.forEach((t, i) => {
      const c = hd.getCell(i + 1, 7);
      c.value = t;
      if (i === 0) c.font = { bold: true };
    });
    hd.getColumn(7).width = 90;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async xuat(u: NguoiDung, q: Partial<DanhSachQuery>): Promise<Buffer> {
    const ds = await this.prisma.nhanSu.findMany({
      where: await this.nhanSu.where(u, q),
      orderBy: this.nhanSu.thuTu,
      include: { donVi: { include: { coSo: true } }, chucVu: true },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanSu');
    this.themCot(ws, [
      { header: 'Tên đơn vị', key: 'tenDonVi', width: 30 },
      { header: 'Cơ sở', key: 'coSo', width: 24 },
    ]);
    for (const n of ds) {
      ws.addRow({
        ...n,
        gioiTinh: n.gioiTinh ? NHAN_GIOI_TINH[n.gioiTinh] : null,
        maCu: n.maCanBo.startsWith('TAM-') ? n.maCanBo : null,
        loaiNhanSu: NHAN_LOAI_NS[n.loaiNhanSu],
        trangThai: NHAN_TRANG_THAI[n.trangThai],
        trinhDoChuyenMon: n.trinhDoChuyenMon ? NHAN_TRINH_DO[n.trinhDoChuyenMon] : null,
        laGiangVien: n.laGiangVien ? 'Có' : 'Không',
        maDonVi: n.donVi.ma,
        chucVu: n.chucVu?.ten ?? null,
        tenDonVi: n.donVi.ten,
        coSo: n.donVi.coSo.ten,
      });
    }
    this.kieuTieuDe(ws);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COT.length + 2 } };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async nhap(u: NguoiDung, file: Buffer, kiemTra: boolean, ip?: string): Promise<KetQuaNhap> {
    if (!this.scope.coQuyenSua(u)) throw new ForbiddenException('Bạn không có quyền nhập dữ liệu');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Không đọc được file. Hãy dùng file .xlsx theo mẫu');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('File không có dữ liệu');

    // Ánh xạ cột theo tiêu đề (không phụ thuộc thứ tự cột)
    const viTri = new Map<string, number>();
    ws.getRow(1).eachCell((c, col) => {
      const h = boDau(String(giaTriO(c) ?? ''));
      const cot = COT.find((x) => boDau(x.header) === h);
      if (cot) viTri.set(cot.key, col);
    });
    const thieu = COT.filter((c) => c.batBuoc && !viTri.has(c.key)).map((c) => c.header);
    if (thieu.length) throw new BadRequestException(`File thiếu cột bắt buộc: ${thieu.join(', ')}`);

    const [donVis, chucVus] = await Promise.all([this.prisma.donVi.findMany(), this.prisma.chucVu.findMany()]);
    const kq: KetQuaNhap = { tong: 0, taoMoi: 0, capNhat: 0, loi: [], kiemTra };
    const daGap = new Set<string>();

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const tho: Record<string, unknown> = {};
      for (const [key, col] of viTri) {
        const v = giaTriO(row.getCell(col));
        tho[key] = typeof v === 'string' ? v.trim() : v;
      }
      if (Object.values(tho).every((v) => v === null || v === '')) continue;
      kq.tong++;

      const maCanBo = docMaCanBo(tho.maCanBo);
      const loi: string[] = [];
      const du: Record<string, unknown> = {};

      for (const c of COT) {
        if (!viTri.has(c.key) || c.key === 'maDonVi' || c.key === 'chucVu' || c.key === 'maCu') continue;
        const v = tho[c.key];
        if (v === null || v === '') continue;
        if (c.kieu === 'date') {
          const d = docNgay(v);
          if (d === 'LOI') loi.push(`${c.header} không hợp lệ`);
          else du[c.key] = d;
        } else if (c.kieu === 'enum') {
          const e = traNguoc(NHAN_ENUM[c.key], String(v));
          if (!e) loi.push(`${c.header} "${v}" không hợp lệ`);
          else du[c.key] = e;
        } else if (c.kieu === 'bool') {
          du[c.key] = ['co', 'x', '1', 'true', 'yes'].includes(boDau(String(v)));
        } else {
          du[c.key] = String(v);
        }
      }
      du.maCanBo = maCanBo;

      if (tho.maDonVi) {
        const s = boDau(String(tho.maDonVi));
        const dv = donVis.find((d) => boDau(d.ma) === s) ?? donVis.find((d) => boDau(d.ten) === s);
        if (!dv) loi.push(`Không tìm thấy đơn vị "${tho.maDonVi}"`);
        else du.donViId = dv.id;
      }
      if (tho.chucVu) {
        const cv = chucVus.find((c) => boDau(c.ten) === boDau(String(tho.chucVu)));
        if (!cv) loi.push(`Không tìm thấy chức vụ "${tho.chucVu}"`);
        else du.chucVuId = cv.id;
      }
      if (daGap.has(maCanBo)) loi.push('Mã cán bộ bị lặp trong file');
      daGap.add(maCanBo);

      const maCu = tho.maCu ? docMaCanBo(tho.maCu) : null;
      let ton = await this.prisma.nhanSu.findUnique({ where: { maCanBo: maCu ?? maCanBo } });
      if (maCu && !ton) loi.push(`Không tìm thấy hồ sơ có mã cũ "${maCu}"`);
      if (maCu && ton && maCu !== maCanBo) {
        const trung = await this.prisma.nhanSu.findUnique({ where: { maCanBo } });
        if (trung) {
          loi.push(`Mã ${maCanBo} đã thuộc hồ sơ ${trung.hoTen}`);
          ton = null;
        }
      }
      if (maCanBo.startsWith('TAM-')) loi.push('Chưa nhập số CCCD (đang là mã tạm)');
      if (ton) {
        try {
          await this.scope.kiemTraSua(u, ton.id);
        } catch {
          loi.push('Cán bộ đã tồn tại và nằm ngoài phạm vi bạn quản lý');
        }
      }

      // Bản ghi đã có: gộp dữ liệu cũ với ô có dữ liệu trong file
      const gop = ton ? { ...this.thanhChuoi(ton), ...du } : du;
      const parsed = nhanSuSchema.safeParse(gop);
      if (!parsed.success) {
        for (const i of parsed.error.issues) {
          const cot = COT.find((c) => c.key === i.path[0] || (c.key === 'maDonVi' && i.path[0] === 'donViId'));
          loi.push(`${cot?.header ?? i.path.join('.')}: ${i.message}`);
        }
      } else {
        try {
          await this.scope.kiemTraDonVi(u, parsed.data.donViId);
        } catch (e) {
          loi.push((e as Error).message);
        }
      }

      if (loi.length || !parsed.success) {
        kq.loi.push({ dong: r, maCanBo, loi: loi.join('; ') });
        continue;
      }
      const data = { ...parsed.data, ten: layTen(parsed.data.hoTen) };
      if (ton) {
        if (!kiemTra) {
          await this.prisma.nhanSu.update({ where: { id: ton.id }, data });
          // Đổi mã → đổi luôn tên đăng nhập nếu đang trùng mã cũ
          if (ton.maCanBo !== data.maCanBo) {
            await this.prisma.taiKhoan.updateMany({
              where: { nhanSuId: ton.id, tenDangNhap: ton.maCanBo },
              data: { tenDangNhap: data.maCanBo },
            });
          }
        }
        kq.capNhat++;
      } else {
        if (!kiemTra) await this.prisma.nhanSu.create({ data });
        kq.taoMoi++;
      }
    }

    if (!kiemTra && (kq.taoMoi || kq.capNhat)) {
      await this.audit.ghi(
        u,
        'NHAP_EXCEL',
        'NhanSu',
        null,
        `Nhập Excel: thêm ${kq.taoMoi}, cập nhật ${kq.capNhat}, lỗi ${kq.loi.length}`,
        undefined,
        ip,
      );
    }
    return kq;
  }

  /** Đưa bản ghi DB về dạng đầu vào của schema (ngày → chuỗi). */
  private thanhChuoi(o: Record<string, unknown>): Record<string, unknown> {
    const kq: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) kq[k] = v instanceof Date ? iso(v) : v;
    return kq;
  }
}
