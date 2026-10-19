import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Ip,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { CurrentUser, NguoiDung, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ZodPipe } from '../common/zod';
import { iso } from '../luong/nghiep-vu-luong';
import { leCoDinh } from '../nghi-phep/nghiep-vu-phep';
import {
  chucVuVietTat,
  congChuanThang,
  hopLe,
  KY_HIEU,
  KY_HIEU_THEO_LOAI_NGHI,
  laCuoiTuan,
  soNgayTrongThang,
  TEN_THU,
  tongHopCong,
} from './nghiep-vu-cong';

const DANG_LAM = { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] as ('DANG_LAM_VIEC' | 'TAM_NGHI')[] };
const XEM = ['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'KE_TOAN', 'TRUONG_DON_VI'] as const;

const thangQuery = z.object({
  donViId: z.string().uuid(),
  nam: z.coerce.number().int().min(2000).max(2100),
  thang: z.coerce.number().int().min(1).max(12),
});
const tongHopQuery = z.object({
  nam: z.coerce.number().int().min(2000).max(2100),
  thang: z.coerce.number().int().min(1).max(12),
});
const luuSchema = thangQuery.extend({
  cells: z
    .array(z.object({ nhanSuId: z.string().uuid(), ngay: z.number().int().min(1).max(31), kyHieu: z.string().trim().max(10).nullable() }))
    .min(1)
    .max(2000),
});
const mdSchema = thangQuery.extend({ ghiDe: z.boolean().optional().default(false) });
const chotSchema = thangQuery.extend({ chot: z.boolean() });
const thangSchema = z.object({
  nhanSuId: z.string().uuid(),
  nam: z.coerce.number().int().min(2000).max(2100),
  thang: z.coerce.number().int().min(1).max(12),
  luongKhoan: z.number().min(0).nullable(),
  theoQuyetDinh: z.number().min(0).nullable(),
});

const utc = (nam: number, thang: number, ngay: number) => new Date(Date.UTC(nam, thang - 1, ngay));

function guiFile(res: Response, buf: Buffer, ten: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ten)}`);
  res.send(buf);
}

/**
 * Chấm công: Trưởng đơn vị chấm công cho cán bộ, giảng viên thuộc đơn vị mình;
 * Quản trị / TCHC chấm được mọi đơn vị trong phạm vi; Ban giám hiệu, Kế toán chỉ xem.
 */
@Roles(...XEM)
@Controller('cham-cong')
export class ChamCongController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  // ------------------------------------------------------------ Phạm vi
  /** Các đơn vị người dùng được xem bảng chấm công. */
  private async donViXem(u: NguoiDung): Promise<string[] | null> {
    if (u.vaiTro === 'TRUONG_DON_VI') {
      const goc = u.phamViDonViId ?? u.donViId;
      return goc ? this.scope.donViVaCon(goc) : [];
    }
    return null; // null = mọi đơn vị (theo cơ sở nếu có)
  }

  private async kiemTraXem(u: NguoiDung, donViId: string) {
    const ds = await this.donViXem(u);
    if (ds && !ds.includes(donViId)) throw new ForbiddenException('Bạn không có quyền xem bảng chấm công của đơn vị này');
    await this.scope.kiemTraDonVi(u, donViId);
  }

  private coQuyenCham(u: NguoiDung) {
    return u.vaiTro === 'QUAN_TRI' || u.vaiTro === 'TCHC' || u.vaiTro === 'TRUONG_DON_VI';
  }

  private async kiemTraCham(u: NguoiDung, donViId: string) {
    if (!this.coQuyenCham(u)) throw new ForbiddenException('Bạn không có quyền chấm công');
    await this.kiemTraXem(u, donViId);
  }

  @Get('don-vi')
  async dsDonVi(@CurrentUser() u: NguoiDung) {
    const ids = await this.donViXem(u);
    const ds = await this.prisma.donVi.findMany({
      where: { ...(ids ? { id: { in: ids } } : {}), ...(u.vaiTro !== 'QUAN_TRI' && u.phamViCoSoId ? { coSoId: u.phamViCoSoId } : {}) },
      select: { id: true, ten: true, ma: true, _count: { select: { nhanSus: { where: { trangThai: DANG_LAM } } } } },
      orderBy: [{ thuTu: 'asc' }, { ten: 'asc' }],
    });
    const macDinh = u.phamViDonViId ?? u.donViId ?? null;
    return {
      macDinh: macDinh && ds.some((d) => d.id === macDinh) ? macDinh : (ds[0]?.id ?? null),
      coQuyenCham: this.coQuyenCham(u),
      items: ds.map((d) => ({ id: d.id, ten: d.ten, ma: d.ma, soNguoi: d._count.nhanSus })),
    };
  }

  // ------------------------------------------------------------ Dữ liệu tháng
  private async tapLe(nam: number, thang: number): Promise<Set<number>> {
    const dau = utc(nam, thang, 1);
    const cuoi = utc(nam, thang, soNgayTrongThang(nam, thang));
    const co = await this.prisma.ngayNghiLe.count({ where: { ngay: { gte: utc(nam, 1, 1), lte: utc(nam, 12, 31) } } });
    if (!co) {
      await this.prisma.ngayNghiLe.createMany({
        data: leCoDinh(nam).map((l) => ({ ngay: new Date(`${l.ngay}T00:00:00.000Z`), ten: l.ten })),
        skipDuplicates: true,
      });
    }
    const ds = await this.prisma.ngayNghiLe.findMany({ where: { ngay: { gte: dau, lte: cuoi } } });
    return new Set(ds.map((d) => d.ngay.getUTCDate()));
  }

  private async nhanSuDonVi(donViId: string) {
    return this.prisma.nhanSu.findMany({
      where: { donViId, trangThai: DANG_LAM },
      select: {
        id: true,
        hoTen: true,
        ten: true,
        maCanBo: true,
        laGiangVien: true,
        kiemNhiem: true,
        ngayTuyenDung: true,
        chucVu: { select: { ten: true, thuTu: true } },
      },
      orderBy: [{ chucVu: { thuTu: 'asc' } }, { ten: 'asc' }, { hoTen: 'asc' }],
    });
  }

  /** Ký hiệu gợi ý từ đơn nghỉ đã duyệt: nhanSuId → ngày → ký hiệu. */
  private async goiYTuDonNghi(nhanSuIds: string[], nam: number, thang: number, le: Set<number>) {
    const dau = utc(nam, thang, 1);
    const cuoi = utc(nam, thang, soNgayTrongThang(nam, thang));
    const dons = await this.prisma.donNghi.findMany({
      where: { nhanSuId: { in: nhanSuIds }, trangThai: 'DA_DUYET', tuNgay: { lte: cuoi }, denNgay: { gte: dau } },
      select: { nhanSuId: true, loai: true, tuNgay: true, denNgay: true, nuaNgay: true },
    });
    const kq = new Map<string, Record<number, string>>();
    for (const d of dons) {
      const m = kq.get(d.nhanSuId) ?? {};
      for (let ngay = 1; ngay <= soNgayTrongThang(nam, thang); ngay++) {
        const t = utc(nam, thang, ngay);
        if (t < d.tuNgay || t > d.denNgay) continue;
        if (laCuoiTuan(nam, thang, ngay) || le.has(ngay)) continue;
        const k = KY_HIEU_THEO_LOAI_NGHI[d.loai] ?? 'K';
        m[ngay] = d.nuaNgay ? `${k}/2` : k;
      }
      kq.set(d.nhanSuId, m);
    }
    return kq;
  }

  private async layBang(donViId: string, nam: number, thang: number) {
    const [donVi, nhanSus, bang, le] = await Promise.all([
      this.prisma.donVi.findUniqueOrThrow({ where: { id: donViId }, select: { id: true, ten: true, ma: true } }),
      this.nhanSuDonVi(donViId),
      this.prisma.bangChamCong.findUnique({ where: { donViId_nam_thang: { donViId, nam, thang } } }),
      this.tapLe(nam, thang),
    ]);
    const ids = nhanSus.map((n) => n.id);
    const [cong, thangs, goiY] = await Promise.all([
      this.prisma.chamCong.findMany({ where: { nhanSuId: { in: ids }, ngay: { gte: utc(nam, thang, 1), lte: utc(nam, thang, soNgayTrongThang(nam, thang)) } } }),
      this.prisma.chamCongThang.findMany({ where: { nhanSuId: { in: ids }, nam, thang } }),
      this.goiYTuDonNghi(ids, nam, thang, le),
    ]);
    const theoNguoi = new Map<string, Record<number, string>>();
    for (const c of cong) {
      const m = theoNguoi.get(c.nhanSuId) ?? {};
      m[c.ngay.getUTCDate()] = c.kyHieu;
      theoNguoi.set(c.nhanSuId, m);
    }
    const thangTheo = new Map(thangs.map((t) => [t.nhanSuId, t]));
    const rows = nhanSus.map((n) => {
      const o = theoNguoi.get(n.id) ?? {};
      const ph = thangTheo.get(n.id);
      return {
        nhanSuId: n.id,
        hoTen: n.hoTen,
        maCanBo: n.maCanBo,
        chucVu: chucVuVietTat(n.chucVu?.ten, n.laGiangVien, n.kiemNhiem),
        chucVuDayDu: n.chucVu?.ten ?? null,
        ngayTuyenDung: n.ngayTuyenDung ? iso(n.ngayTuyenDung) : null,
        cong: o,
        goiY: goiY.get(n.id) ?? {},
        luongKhoan: ph?.luongKhoan ?? null,
        theoQuyetDinh: ph?.theoQuyetDinh ?? null,
        tong: tongHopCong(o, nam, thang, le),
      };
    });
    return {
      donVi,
      nam,
      thang,
      soNgay: soNgayTrongThang(nam, thang),
      congChuan: congChuanThang(nam, thang),
      ngayLe: [...le].sort((a, b) => a - b),
      daChot: bang?.daChot ?? false,
      nguoiChot: bang?.nguoiChot ?? null,
      ngayChot: bang?.ngayChot?.toISOString() ?? null,
      rows,
    };
  }

  @Get('bang')
  async bang(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(thangQuery)) q: z.infer<typeof thangQuery>) {
    await this.kiemTraXem(u, q.donViId);
    const b = await this.layBang(q.donViId, q.nam, q.thang);
    return { ...b, coQuyenCham: this.coQuyenCham(u), coQuyenMoChot: u.vaiTro === 'QUAN_TRI' || u.vaiTro === 'TCHC', kyHieu: Object.entries(KY_HIEU).map(([k, v]) => ({ ma: k, ten: v.ten })) };
  }

  private async kiemTraKhoa(u: NguoiDung, donViId: string, nam: number, thang: number) {
    const b = await this.prisma.bangChamCong.findUnique({ where: { donViId_nam_thang: { donViId, nam, thang } } });
    if (b?.daChot && u.vaiTro !== 'QUAN_TRI' && u.vaiTro !== 'TCHC') {
      throw new BadRequestException('Bảng chấm công tháng này đã chốt. Liên hệ Phòng TCHC để mở lại');
    }
  }

  // ------------------------------------------------------------ Ghi dữ liệu
  @Put('bang')
  async luu(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(luuSchema)) body: z.infer<typeof luuSchema>, @Ip() ip: string) {
    await this.kiemTraCham(u, body.donViId);
    await this.kiemTraKhoa(u, body.donViId, body.nam, body.thang);
    const soNgay = soNgayTrongThang(body.nam, body.thang);
    const ids = [...new Set(body.cells.map((c) => c.nhanSuId))];
    const hopLeNs = await this.prisma.nhanSu.count({ where: { id: { in: ids }, donViId: body.donViId } });
    if (hopLeNs !== ids.length) throw new BadRequestException('Có cán bộ không thuộc đơn vị đang chấm công');
    const ops = body.cells.map((c) => {
      if (c.ngay > soNgay) throw new BadRequestException(`Tháng ${body.thang}/${body.nam} không có ngày ${c.ngay}`);
      const ngay = utc(body.nam, body.thang, c.ngay);
      if (!c.kyHieu) return this.prisma.chamCong.deleteMany({ where: { nhanSuId: c.nhanSuId, ngay } });
      if (!hopLe(c.kyHieu)) throw new BadRequestException(`Ký hiệu chấm công không hợp lệ: ${c.kyHieu}`);
      return this.prisma.chamCong.upsert({
        where: { nhanSuId_ngay: { nhanSuId: c.nhanSuId, ngay } },
        create: { nhanSuId: c.nhanSuId, ngay, kyHieu: c.kyHieu, nguoiCham: u.tenDangNhap },
        update: { kyHieu: c.kyHieu, nguoiCham: u.tenDangNhap },
      });
    });
    await this.prisma.$transaction(ops);
    if (body.cells.length > 1) {
      await this.audit.ghi(u, 'SUA', 'ChamCong', null, `Cập nhật ${body.cells.length} ô chấm công tháng ${body.thang}/${body.nam}`, undefined, ip);
    }
    return { ok: true, soO: body.cells.length };
  }

  /** Điền sẵn: "+" cho ngày làm việc đã qua, "L" cho ngày lễ, ký hiệu nghỉ từ đơn đã duyệt. Không ghi đè ô đã chấm. */
  @Post('dien-mac-dinh')
  async dienMacDinh(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(mdSchema)) body: z.infer<typeof mdSchema>, @Ip() ip: string) {
    await this.kiemTraCham(u, body.donViId);
    await this.kiemTraKhoa(u, body.donViId, body.nam, body.thang);
    const nhanSus = await this.nhanSuDonVi(body.donViId);
    const le = await this.tapLe(body.nam, body.thang);
    const goiY = await this.goiYTuDonNghi(
      nhanSus.map((n) => n.id),
      body.nam,
      body.thang,
      le,
    );
    const soNgay = soNgayTrongThang(body.nam, body.thang);
    const homNay = new Date();
    const homNayUtc = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), homNay.getDate()));
    const ids = nhanSus.map((n) => n.id);
    const daCo = await this.prisma.chamCong.findMany({
      where: { nhanSuId: { in: ids }, ngay: { gte: utc(body.nam, body.thang, 1), lte: utc(body.nam, body.thang, soNgay) } },
      select: { nhanSuId: true, ngay: true },
    });
    const tapDaCo = new Set(daCo.map((c) => `${c.nhanSuId}|${c.ngay.getUTCDate()}`));
    const data: { nhanSuId: string; ngay: Date; kyHieu: string; nguoiCham: string }[] = [];
    for (const ns of nhanSus) {
      const tuyen = ns.ngayTuyenDung ? new Date(ns.ngayTuyenDung) : null;
      for (let d = 1; d <= soNgay; d++) {
        if (!body.ghiDe && tapDaCo.has(`${ns.id}|${d}`)) continue;
        const t = utc(body.nam, body.thang, d);
        if (tuyen && t < tuyen) continue;
        if (t > homNayUtc) continue;
        const cuoiTuan = laCuoiTuan(body.nam, body.thang, d);
        const gy = goiY.get(ns.id)?.[d];
        let k: string | null = null;
        if (gy) k = gy;
        else if (le.has(d)) k = 'L';
        else if (!cuoiTuan) k = '+';
        if (k) data.push({ nhanSuId: ns.id, ngay: t, kyHieu: k, nguoiCham: u.tenDangNhap });
      }
    }
    if (data.length) {
      await this.prisma.$transaction(
        data.map((d) =>
          this.prisma.chamCong.upsert({
            where: { nhanSuId_ngay: { nhanSuId: d.nhanSuId, ngay: d.ngay } },
            create: d,
            update: { kyHieu: d.kyHieu, nguoiCham: d.nguoiCham },
          }),
        ),
      );
    }
    await this.audit.ghi(u, 'TAO', 'ChamCong', null, `Điền mặc định ${data.length} ô chấm công tháng ${body.thang}/${body.nam}`, undefined, ip);
    return { soO: data.length };
  }

  // ------------------------------------------------------------ Chốt sổ
  @Post('chot')
  async chot(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(chotSchema)) body: z.infer<typeof chotSchema>, @Ip() ip: string) {
    await this.kiemTraCham(u, body.donViId);
    if (!body.chot && u.vaiTro !== 'QUAN_TRI' && u.vaiTro !== 'TCHC') {
      throw new ForbiddenException('Chỉ Quản trị và Phòng TCHC mới có quyền mở lại bảng chấm công');
    }
    const b = await this.prisma.bangChamCong.upsert({
      where: { donViId_nam_thang: { donViId: body.donViId, nam: body.nam, thang: body.thang } },
      create: { donViId: body.donViId, nam: body.nam, thang: body.thang, daChot: body.chot, nguoiChot: body.chot ? u.tenDangNhap : null, ngayChot: body.chot ? new Date() : null },
      update: { daChot: body.chot, nguoiChot: body.chot ? u.tenDangNhap : null, ngayChot: body.chot ? new Date() : null },
    });
    await this.audit.ghi(u, 'SUA', 'BangChamCong', b.id, `${body.chot ? 'Chốt' : 'Mở lại'} bảng chấm công tháng ${body.thang}/${body.nam}`, undefined, ip);
    return b;
  }

  // ------------------------------------------------------------ Số liệu tháng
  @Patch('thang')
  async suaThang(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(thangSchema)) body: z.infer<typeof thangSchema>, @Ip() ip: string) {
    const ns = await this.prisma.nhanSu.findUniqueOrThrow({ where: { id: body.nhanSuId }, select: { donViId: true, hoTen: true } });
    await this.kiemTraCham(u, ns.donViId);
    await this.kiemTraKhoa(u, ns.donViId, body.nam, body.thang);
    const t = await this.prisma.chamCongThang.upsert({
      where: { nhanSuId_nam_thang: { nhanSuId: body.nhanSuId, nam: body.nam, thang: body.thang } },
      create: { nhanSuId: body.nhanSuId, nam: body.nam, thang: body.thang, luongKhoan: body.luongKhoan, theoQuyetDinh: body.theoQuyetDinh },
      update: { luongKhoan: body.luongKhoan, theoQuyetDinh: body.theoQuyetDinh },
    });
    await this.audit.ghi(u, 'SUA', 'ChamCongThang', t.id, `Cập nhật số liệu tháng ${body.thang}/${body.nam} cho ${ns.hoTen}`, undefined, ip);
    return t;
  }

  // ------------------------------------------------------------ Xuất Excel
  private static readonly VIEN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } as const;

  @Get('xuat-excel')
  async xuat(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(thangQuery)) q: z.infer<typeof thangQuery>, @Res() res: Response) {
    await this.kiemTraXem(u, q.donViId);
    const b = await this.layBang(q.donViId, q.nam, q.thang);
    const tdv = await this.prisma.nhanSu.findFirst({
      where: { donViId: q.donViId, chucVu: { ten: { in: ['Trưởng phòng', 'Trưởng khoa', 'Giám đốc trung tâm', 'Giám đốc'] } } },
      select: { hoTen: true },
    });
    const wb = new ExcelJS.Workbook();
    
    // ==========================================================
    // SHEET 1: BẢNG CHẤM CÔNG CHÍNH CỦA ĐƠN VỊ
    // ==========================================================
    const ws = wb.addWorksheet(`T${String(q.thang).padStart(2, '0')}.${q.nam}`, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    const SN = b.soNgay;
    const COT_NGAY = 4; // cột D
    const cuoiNgay = COT_NGAY + 30; // luôn chừa đủ 31 cột ngày
    const cs = cuoiNgay + 1; // cột đầu tiên của phần tổng hợp
    const tongCot = cs + 6;
    const bao = (r: number, c1: number, c2: number, v: string, o: Partial<ExcelJS.Style> = {}) => {
      ws.mergeCells(r, c1, r, c2);
      const c = ws.getCell(r, c1);
      c.value = v;
      Object.assign(c, { style: { ...c.style, ...o } });
    };
    bao(1, 1, 12, 'TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I', { font: { bold: true, size: 12 } });
    bao(2, 1, 12, b.donVi.ten.toUpperCase(), { font: { bold: true, size: 12 } });
    bao(4, 1, tongCot, 'BẢNG CHẤM CÔNG', { font: { bold: true, size: 16 }, alignment: { horizontal: 'center' } });
    bao(5, 1, tongCot, `Tháng ${q.thang} năm ${q.nam}`, { font: { italic: true, size: 12 }, alignment: { horizontal: 'center' } });

    // Tiêu đề bảng (3 hàng)
    const H1 = 7, H2 = 8, H3 = 9, H4 = 10;
    const tieuDe = (r1: number, r2: number, c1: number, c2: number, v: string) => {
      ws.mergeCells(r1, c1, r2, c2);
      const c = ws.getCell(r1, c1);
      c.value = v;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.font = { bold: true };
    };
    tieuDe(H1, H4, 1, 1, 'TT');
    tieuDe(H1, H4, 2, 2, 'Họ và tên');
    tieuDe(H1, H4, 3, 3, 'Chức vụ');
    tieuDe(H1, H1, COT_NGAY, cuoiNgay, 'Ngày trong tháng');
    for (let d = 1; d <= 31; d++) {
      const col = COT_NGAY + d - 1;
      const hop = d <= SN;
      const dh = ws.getCell(H2, col);
      dh.value = hop ? d : '';
      dh.alignment = { horizontal: 'center' };
      dh.font = { bold: true };
      const th = ws.getCell(H3, col);
      th.value = hop ? TEN_THU[new Date(Date.UTC(q.nam, q.thang - 1, d)).getUTCDay()] : '';
      th.alignment = { horizontal: 'center' };
      th.font = { bold: true, color: { argb: hop && laCuoiTuan(q.nam, q.thang, d) ? 'FFC00000' : 'FF000000' } };
      ws.getColumn(col).width = 3.8;
    }
    tieuDe(H1, H1, cs, cs + 6, 'Quy ra công');
    tieuDe(H2, H2, cs, cs + 2, 'Số công hưởng lương thời gian');
    tieuDe(H3, H4, cs, cs, 'Lương thời gian');
    tieuDe(H3, H4, cs + 1, cs + 1, 'C.tác, H.tập');
    tieuDe(H3, H4, cs + 2, cs + 2, 'Nghỉ khác');
    tieuDe(H2, H4, cs + 3, cs + 3, 'Số công nghỉ No');
    tieuDe(H2, H4, cs + 4, cs + 4, 'Số công hưởng lương BHXH');
    tieuDe(H2, H4, cs + 5, cs + 5, 'Hưởng lương khoán');
    tieuDe(H2, H4, cs + 6, cs + 6, 'Theo QĐ');
    ws.getRow(H1).height = 20;
    ws.getRow(H4).height = 18;
    [6, 28, 9].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    for (let i = 0; i < 7; i++) ws.getColumn(cs + i).width = i < 3 ? 11 : 12;

    // Dữ liệu Sheet 1
    let r = H4 + 1;
    const dau = r;
    const nghiBangMau = (c: ExcelJS.Cell, k: string) => {
      if (k === '+') return;
      c.font = { bold: true, color: { argb: k === 'L' ? 'FFC00000' : 'FF1F4E79' } };
    };
    b.rows.forEach((row, i) => {
      ws.getCell(r, 1).value = i + 1;
      ws.getCell(r, 2).value = row.hoTen;
      ws.getCell(r, 3).value = row.chucVu;
      for (let d = 1; d <= 31; d++) {
        const c = ws.getCell(r, COT_NGAY + d - 1);
        const k = d <= SN ? row.cong[d] : undefined;
        c.value = k ?? null;
        c.alignment = { horizontal: 'center' };
        if (k) nghiBangMau(c, k);
        if (d <= SN && laCuoiTuan(q.nam, q.thang, d)) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }
      const t = row.tong;
      const so = (v: number) => (v === 0 ? null : v);
      ws.getCell(r, cs).value = t.luongThoiGian;
      ws.getCell(r, cs + 1).value = so(t.congTacHocTap);
      ws.getCell(r, cs + 2).value = so(t.nghiKhac);
      ws.getCell(r, cs + 3).value = so(t.nghiKhongLuong);
      ws.getCell(r, cs + 4).value = so(t.nghiBhxh);
      ws.getCell(r, cs + 5).value = row.luongKhoan;
      ws.getCell(r, cs + 6).value = row.theoQuyetDinh;
      ws.getCell(r, 1).alignment = { horizontal: 'center' };
      ws.getCell(r, 3).alignment = { horizontal: 'center' };
      for (let c = cs; c <= cs + 6; c++) ws.getCell(r, c).alignment = { horizontal: 'center' };
      r++;
    });
    const cuoi = r - 1;
    ws.getCell(r, 2).value = 'Tổng';
    ws.getCell(r, 2).font = { bold: true };
    if (b.rows.length) {
      for (let c = cs; c <= cs + 6; c++) {
        const L = ws.getColumn(c).letter;
        ws.getCell(r, c).value = { formula: `SUM(${L}${dau}:${L}${cuoi})` };
        ws.getCell(r, c).font = { bold: true };
        ws.getCell(r, c).alignment = { horizontal: 'center' };
      }
    }
    for (let rr = H1; rr <= r; rr++) for (let c = 1; c <= tongCot; c++) ws.getCell(rr, c).border = { ...ChamCongController.VIEN };

    // Chữ ký Sheet 1
    const k = r + 2;
    bao(k, cs - 6, tongCot, `Hải Phòng, ngày ${' '.repeat(6)} tháng ${' '.repeat(6)} năm ${q.nam}`, { font: { italic: true }, alignment: { horizontal: 'center' } });
    bao(k + 1, 1, 6, 'Người chấm công', { font: { bold: true }, alignment: { horizontal: 'center' } });
    bao(k + 1, 12, 22, tdv ? (b.donVi.ten.toLowerCase().includes('khoa') ? 'Trưởng khoa' : 'Trưởng đơn vị') : 'Trưởng đơn vị', { font: { bold: true }, alignment: { horizontal: 'center' } });
    bao(k + 1, cs - 6, tongCot, 'Ban giám hiệu', { font: { bold: true }, alignment: { horizontal: 'center' } });
    if (tdv) bao(k + 5, 12, 22, tdv.hoTen, { font: { bold: true }, alignment: { horizontal: 'center' } });

    // Chú thích Sheet 1
    const ct = k + 8;
    ws.getCell(ct, 2).value = 'Ký hiệu chấm công:';
    ws.getCell(ct, 2).font = { bold: true };
    const ds = Object.entries(KY_HIEU);
    ds.forEach(([ma, v], i) => {
      const hang = ct + 1 + Math.floor(i / 3);
      const cot = 2 + (i % 3) * 12;
      ws.getCell(hang, cot).value = `${v.ten}:`;
      ws.getCell(hang, cot + 7).value = ma;
      ws.getCell(hang, cot + 7).font = { bold: true };
    });
    ws.getCell(ct + 7, 2).value = 'Nửa ngày ghi thêm "/2" (ví dụ P/2: nghỉ phép nửa ngày, nửa ngày còn lại làm việc).';
    ws.getCell(ct + 8, 2).value = 'Làm thêm giờ: Ngày thường ghi "+2h", "+3h"... hoặc "2h", "4h"; Thứ 7 & CN chấm "+" (8h), "+/2" (4h) hoặc ghi số giờ "4h", "8h". Hệ thống tự động tách sang sheet "Làm thêm giờ".';
    ws.getCell(ct + 9, 2).value = `Số công chuẩn của tháng: ${b.congChuan} ngày (T2–T6, kể cả ngày lễ). Công hưởng lương = lương thời gian + công tác, học tập + nghỉ khác.`;
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: H4 }];

    // ==========================================================
    // SHEET 2: LÀM THÊM GIỜ (CHỈ XUẤT NHỮNG CÁN BỘ CÓ PHÁT SINH LÀM THÊM GIỜ)
    // ==========================================================
    const wsOt = wb.addWorksheet('Làm thêm giờ', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });

    const rowsLamThem = b.rows.filter((row) => (row.tong.tongGioLamThem ?? 0) > 0);
    const COT_NGAY_OT = 5; // Cột E (sau TT, Mã CB, Họ tên, Chức vụ)
    const cuoiNgayOt = COT_NGAY_OT + 30; // 31 ngày (E đến AI)
    const csOt = cuoiNgayOt + 1; // Cột AJ
    const tongCotOt = csOt + 3; // Cột AM (Tổng 39 cột)

    const baoOt = (rOtIdx: number, c1: number, c2: number, v: string, o: Partial<ExcelJS.Style> = {}) => {
      wsOt.mergeCells(rOtIdx, c1, rOtIdx, c2);
      const cell = wsOt.getCell(rOtIdx, c1);
      cell.value = v;
      Object.assign(cell, { style: { ...cell.style, ...o } });
    };

    baoOt(1, 1, 12, 'TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I', { font: { bold: true, size: 12 } });
    baoOt(2, 1, 12, `BỘ PHẬN: ${b.donVi.ten.toUpperCase()}`, { font: { bold: true, size: 12 } });
    baoOt(4, 1, tongCotOt, 'BẢNG CHẤM CÔNG LÀM THÊM GIỜ', { font: { bold: true, size: 16 }, alignment: { horizontal: 'center' } });
    baoOt(5, 1, tongCotOt, `Tháng ${q.thang} năm ${q.nam}`, { font: { italic: true, size: 12 }, alignment: { horizontal: 'center' } });

    const tieuDeOt = (r1: number, r2: number, c1: number, c2: number, v: string) => {
      wsOt.mergeCells(r1, c1, r2, c2);
      const cell = wsOt.getCell(r1, c1);
      cell.value = v;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true };
    };

    tieuDeOt(H1, H4, 1, 1, 'TT');
    tieuDeOt(H1, H4, 2, 2, 'Mã cán bộ (CCCD)');
    tieuDeOt(H1, H4, 3, 3, 'Họ và tên');
    tieuDeOt(H1, H4, 4, 4, 'Chức vụ');
    tieuDeOt(H1, H1, COT_NGAY_OT, cuoiNgayOt, 'Ngày trong tháng (giờ làm thêm)');

    for (let d = 1; d <= 31; d++) {
      const col = COT_NGAY_OT + d - 1;
      const hop = d <= SN;
      const dh = wsOt.getCell(H2, col);
      dh.value = hop ? d : '';
      dh.alignment = { horizontal: 'center' };
      dh.font = { bold: true };
      const th = wsOt.getCell(H3, col);
      th.value = hop ? TEN_THU[new Date(Date.UTC(q.nam, q.thang - 1, d)).getUTCDay()] : '';
      th.alignment = { horizontal: 'center' };
      th.font = { bold: true, color: { argb: hop && laCuoiTuan(q.nam, q.thang, d) ? 'FFC00000' : 'FF000000' } };
      wsOt.getColumn(col).width = 4.2;
    }

    tieuDeOt(H1, H1, csOt, csOt + 3, 'Tổng số giờ làm thêm (h)');
    tieuDeOt(H2, H4, csOt, csOt, 'Ngày thường (150%)');
    tieuDeOt(H2, H4, csOt + 1, csOt + 1, 'Thứ 7, CN (200%)');
    tieuDeOt(H2, H4, csOt + 2, csOt + 2, 'Ngày lễ (300%)');
    tieuDeOt(H2, H4, csOt + 3, csOt + 3, 'Tổng cộng giờ');

    wsOt.getRow(H1).height = 20;
    wsOt.getRow(H4).height = 24;
    [6, 16, 26, 12].forEach((w, i) => (wsOt.getColumn(i + 1).width = w));
    for (let i = 0; i < 4; i++) wsOt.getColumn(csOt + i).width = 13;

    let rOt = H4 + 1;
    const dauOt = rOt;

    if (rowsLamThem.length === 0) {
      wsOt.mergeCells(rOt, 1, rOt, tongCotOt);
      const cEmpty = wsOt.getCell(rOt, 1);
      cEmpty.value = 'Trong tháng không có cán bộ, nhân viên phát sinh giờ làm thêm.';
      cEmpty.font = { italic: true };
      cEmpty.alignment = { horizontal: 'center', vertical: 'middle' };
      wsOt.getRow(rOt).height = 30;
      rOt++;
    } else {
      rowsLamThem.forEach((row, i) => {
        wsOt.getCell(rOt, 1).value = i + 1;
        wsOt.getCell(rOt, 2).value = row.maCanBo;
        wsOt.getCell(rOt, 3).value = row.hoTen;
        wsOt.getCell(rOt, 4).value = row.chucVu;

        for (let d = 1; d <= 31; d++) {
          const c = wsOt.getCell(rOt, COT_NGAY_OT + d - 1);
          const ct = d <= SN ? row.tong.chiTietLamThem?.[d] : undefined;
          if (ct) {
            c.value = ct.nhan || `${ct.gio}h`;
            c.font = { bold: true, color: { argb: ct.loai === 'CUOI_TUAN' ? 'FFC00000' : (ct.loai === 'NGAY_LE' ? 'FF7030A0' : 'FF1F4E79') } };
          } else {
            c.value = null;
          }
          c.alignment = { horizontal: 'center' };
          if (d <= SN && laCuoiTuan(q.nam, q.thang, d)) {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          }
        }

        const t = row.tong;
        wsOt.getCell(rOt, csOt).value = t.gioLamThemNgayThuong || null;
        wsOt.getCell(rOt, csOt + 1).value = t.gioLamThemCuoiTuan || null;
        wsOt.getCell(rOt, csOt + 2).value = t.gioLamThemNgayLe || null;
        wsOt.getCell(rOt, csOt + 3).value = t.tongGioLamThem || null;

        wsOt.getCell(rOt, 1).alignment = { horizontal: 'center' };
        wsOt.getCell(rOt, 2).alignment = { horizontal: 'center' };
        wsOt.getCell(rOt, 4).alignment = { horizontal: 'center' };
        for (let c = csOt; c <= csOt + 3; c++) {
          wsOt.getCell(rOt, c).alignment = { horizontal: 'center' };
          wsOt.getCell(rOt, c).font = { bold: c === csOt + 3 };
        }
        rOt++;
      });

      const cuoiOt = rOt - 1;
      wsOt.getCell(rOt, 3).value = 'Tổng cộng';
      wsOt.getCell(rOt, 3).font = { bold: true };
      for (let c = csOt; c <= csOt + 3; c++) {
        const L = wsOt.getColumn(c).letter;
        wsOt.getCell(rOt, c).value = { formula: `SUM(${L}${dauOt}:${L}${cuoiOt})` };
        wsOt.getCell(rOt, c).font = { bold: true };
        wsOt.getCell(rOt, c).alignment = { horizontal: 'center' };
      }
    }

    for (let rr = H1; rr <= rOt; rr++) {
      for (let c = 1; c <= tongCotOt; c++) {
        wsOt.getCell(rr, c).border = { ...ChamCongController.VIEN };
      }
    }

    // Chữ ký Sheet 2
    const kOt = rOt + 2;
    baoOt(kOt, csOt - 6, tongCotOt, `Hải Phòng, ngày ${' '.repeat(6)} tháng ${' '.repeat(6)} năm ${q.nam}`, { font: { italic: true }, alignment: { horizontal: 'center' } });
    baoOt(kOt + 1, 1, 6, 'Người lập bảng', { font: { bold: true }, alignment: { horizontal: 'center' } });
    baoOt(kOt + 1, 12, 22, tdv ? (b.donVi.ten.toLowerCase().includes('khoa') ? 'Trưởng khoa' : 'Trưởng đơn vị') : 'Trưởng đơn vị', { font: { bold: true }, alignment: { horizontal: 'center' } });
    baoOt(kOt + 1, csOt - 6, tongCotOt, 'Ban giám hiệu duyệt', { font: { bold: true }, alignment: { horizontal: 'center' } });
    if (tdv) baoOt(kOt + 5, 12, 22, tdv.hoTen, { font: { bold: true }, alignment: { horizontal: 'center' } });

    // Ghi chú pháp lý Sheet 2
    const ctOt = kOt + 8;
    wsOt.getCell(ctOt, 2).value = 'Ghi chú chế độ làm thêm giờ:';
    wsOt.getCell(ctOt, 2).font = { bold: true };
    wsOt.getCell(ctOt + 1, 2).value = '• Làm thêm ngày thường (T2–T6): Tính ít nhất bằng 150% đơn giá tiền lương (Điều 98 BLLĐ 2019 & TTLT 08/2005/TTLT-BNV-BTC).';
    wsOt.getCell(ctOt + 2, 2).value = '• Làm thêm ngày Thứ 7, Chủ nhật: Tính ít nhất bằng 200% đơn giá tiền lương ngày nghỉ hằng tuần.';
    wsOt.getCell(ctOt + 3, 2).value = '• Làm thêm ngày Lễ, Tết: Tính ít nhất bằng 300% đơn giá tiền lương (chưa kể lương ngày lễ hưởng nguyên lương).';
    wsOt.views = [{ state: 'frozen', xSplit: 3, ySplit: H4 }];

    guiFile(res, Buffer.from(await wb.xlsx.writeBuffer()), `ChamCong_${b.donVi.ma ?? 'DV'}_${q.thang}_${q.nam}.xlsx`);
  }

  /** Bảng tổng hợp công toàn trường (hoặc trong phạm vi) để tính lương. */
  @Get('xuat-tong-hop')
  async xuatTongHop(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(tongHopQuery)) q: z.infer<typeof tongHopQuery>, @Res() res: Response) {
    const ids = await this.donViXem(u);
    const donVis = await this.prisma.donVi.findMany({
      where: { ...(ids ? { id: { in: ids } } : {}), ...(u.vaiTro !== 'QUAN_TRI' && u.phamViCoSoId ? { coSoId: u.phamViCoSoId } : {}) },
      orderBy: [{ thuTu: 'asc' }, { ten: 'asc' }],
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Tổng hợp T${q.thang}.${q.nam}`);
    ws.mergeCells('A1:S1');
    ws.getCell('A1').value = `TỔNG HỢP CÔNG VÀ LÀM THÊM GIỜ THÁNG ${q.thang}/${q.nam} (DÙNG TÍNH LƯƠNG)`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    const tieu = [
      'STT', 'Mã cán bộ (CCCD)', 'Họ và tên', 'Đơn vị', 'Chức vụ', 'Công chuẩn', 'Lương thời gian', 'Công tác, học tập',
      'Nghỉ phép', 'Nghỉ khác (lễ, bù…)', 'Nghỉ BHXH', 'Nghỉ không lương', 'Công hưởng lương', 'Lương khoán', 'Theo QĐ',
      'Giờ thêm ngày thường (150%)', 'Giờ thêm T7-CN (200%)', 'Giờ thêm Lễ (300%)', 'Tổng giờ thêm',
    ];
    ws.getRow(3).values = tieu;
    ws.getRow(3).font = { bold: true };
    ws.getRow(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = 34;
    [6, 18, 26, 30, 10, 10, 12, 12, 10, 14, 10, 12, 12, 12, 10, 14, 14, 14, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    let stt = 0;
    const chuan = congChuanThang(q.nam, q.thang);
    for (const dv of donVis) {
      const b = await this.layBang(dv.id, q.nam, q.thang);
      for (const row of b.rows) {
        const t = row.tong;
        const nghiPhep = t.theoKyHieu.P ?? 0;
        ws.addRow([
          ++stt, row.maCanBo, row.hoTen, dv.ten, row.chucVu, chuan, t.luongThoiGian, t.congTacHocTap, nghiPhep,
          t.nghiKhac - nghiPhep, t.nghiBhxh, t.nghiKhongLuong, t.huongLuong, row.luongKhoan, row.theoQuyetDinh,
          t.gioLamThemNgayThuong || '', t.gioLamThemCuoiTuan || '', t.gioLamThemNgayLe || '', t.tongGioLamThem || '',
        ]);
      }
    }
    ws.getColumn(2).numFmt = '@';
    ws.eachRow((row, n) => {
      if (n < 3) return;
      row.eachCell({ includeEmpty: true }, (c) => (c.border = { ...ChamCongController.VIEN }));
    });
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 3 }];
    guiFile(res, Buffer.from(await wb.xlsx.writeBuffer()), `TongHopCong_${q.thang}_${q.nam}.xlsx`);
  }
}
