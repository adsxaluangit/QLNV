import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Put,
  Res,
} from '@nestjs/common';
import { LoaiNghi, Prisma, TrangThaiDon } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { CurrentUser, NguoiDung, QUYEN_SUA, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ngay, ngayOpt, txt, ZodPipe } from '../common/zod';
import { iso } from '../luong/nghiep-vu-luong';
import {
  demNgayLamViec,
  leCoDinh,
  NHAN_LOAI_NGHI,
  NHAN_TRANG_THAI_DON,
  tinhQuyPhep,
} from './nghiep-vu-phep';
import { dongBoQuyPhepNamNay } from './dong-bo-quy';

const DANG_LAM = { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] as ('DANG_LAM_VIEC' | 'TAM_NGHI')[] };
const CHO: TrangThaiDon[] = ['CHO_TRUONG_DON_VI', 'CHO_BGH', 'CHO_TCHC'];
const TINH_VAO_QUY: TrangThaiDon[] = ['DA_DUYET', ...CHO];
const QUAN_LY: ('QUAN_TRI' | 'BAN_GIAM_HIEU' | 'TCHC' | 'TRUONG_DON_VI')[] = ['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'TRUONG_DON_VI'];
const NGUOI_DUYET: typeof QUAN_LY = QUAN_LY;

const homNay = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};
const namHienTai = () => new Date().getFullYear();
const dauNam = (nam: number) => new Date(Date.UTC(nam, 0, 1));
const cuoiNam = (nam: number) => new Date(Date.UTC(nam, 11, 31));

const namQuery = z.object({ nam: z.coerce.number().int().min(2000).max(2100).optional() });
const quyQuery = z.object({
  nam: z.coerce.number().int().min(2000).max(2100).optional(),
  donViId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  q: z.string().trim().optional(),
});
const donQuery = z.object({
  nam: z.coerce.number().int().min(2000).max(2100).optional(),
  trangThai: z.nativeEnum(TrangThaiDon).optional().or(z.literal('').transform(() => undefined)),
  donViId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  q: z.string().trim().optional(),
});
const uocTinhQuery = z.object({
  tuNgay: ngay,
  denNgay: ngay,
  nuaNgay: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const taoDonSchema = z.object({
  loai: z.nativeEnum(LoaiNghi),
  tuNgay: ngay,
  denNgay: ngay,
  nuaNgay: z.boolean().optional().default(false),
  lyDo: z.string().trim().min(3, 'Nhập lý do xin nghỉ').max(500),
});
const duyetSchema = z.object({ ghiChu: txt(300) });
const tuChoiSchema = z.object({ lyDo: z.string().trim().min(3, 'Nhập lý do từ chối').max(300) });
const dieuChinhSchema = z.object({
  dieuChinh: z.coerce.number().min(-30).max(30),
  lyDo: txt(300),
});
const tinhLaiSchema = z.object({ nam: z.coerce.number().int().min(2000).max(2100) });
const leSchema = z.object({ tuNgay: ngay, denNgay: ngayOpt, ten: z.string().trim().min(2, 'Nhập tên ngày nghỉ').max(100) });
const kiemNhiemSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), kiemNhiem: z.boolean() });
const diLamLaiSchema = z.object({ ngayDiLam: ngay });
/** Ngưỡng ngày nghỉ không lương để coi là dài hạn (tự động TAM_NGHI). */
const NGHI_DAI_HAN = 30;
const gvQuery = z.object({
  donViId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  q: z.string().trim().optional(),
  loaiDonVi: z.enum(['KHOA', 'PHONG', 'TRUNG_TAM', 'TO_BO_MON', 'KHAC']).optional().or(z.literal('').transform(() => undefined)),
  chiKhongKhoa: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

interface NhanSuPhep {
  id: string;
  ngayTuyenDung: Date | null;
  laGiangVien: boolean;
  kiemNhiem?: boolean;
  loaiNhanSu: 'VIEN_CHUC' | 'HOP_DONG' | 'THINH_GIANG';
}

type DonDayDu = Prisma.DonNghiGetPayload<{
  include: { nhanSu: { select: { id: true; hoTen: true; maCanBo: true; donViId: true; donVi: { select: { ten: true; coSoId: true } } } }; duyets: true };
}>;

function guiFile(res: Response, buf: Buffer, ten: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ten)}`);
  res.send(buf);
}

@Controller('nghi-phep')
export class NghiPhepController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  // ------------------------------------------------------------ Ngày lễ
  /** Bảo đảm ngày lễ dương lịch cố định của các năm trong khoảng đã có trong CSDL. */
  private async bamBaoLe(tuNam: number, denNam: number) {
    for (let nam = tuNam; nam <= denNam; nam++) {
      const co = await this.prisma.ngayNghiLe.count({ where: { ngay: { gte: dauNam(nam), lte: cuoiNam(nam) } } });
      if (co) continue;
      await this.prisma.ngayNghiLe.createMany({
        data: leCoDinh(nam).map((l) => ({ ngay: new Date(`${l.ngay}T00:00:00.000Z`), ten: l.ten })),
        skipDuplicates: true,
      });
    }
  }

  private async tapLe(tu: Date, den: Date): Promise<Set<string>> {
    await this.bamBaoLe(tu.getUTCFullYear(), den.getUTCFullYear());
    const ds = await this.prisma.ngayNghiLe.findMany({ where: { ngay: { gte: tu, lte: den } }, select: { ngay: true } });
    return new Set(ds.map((d) => iso(d.ngay)));
  }

  @Get('ngay-le')
  async dsNgayLe(@Query(new ZodPipe(namQuery)) q: z.infer<typeof namQuery>) {
    const nam = q.nam ?? namHienTai();
    await this.bamBaoLe(nam, nam);
    const ds = await this.prisma.ngayNghiLe.findMany({ where: { ngay: { gte: dauNam(nam), lte: cuoiNam(nam) } }, orderBy: { ngay: 'asc' } });
    return ds.map((d) => ({ id: d.id, ngay: iso(d.ngay), ten: d.ten }));
  }

  @Roles(...QUYEN_SUA)
  @Post('ngay-le')
  async themNgayLe(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(leSchema)) body: z.infer<typeof leSchema>, @Ip() ip: string) {
    const den = body.denNgay ?? body.tuNgay;
    if (den < body.tuNgay) throw new BadRequestException('Đến ngày phải sau hoặc bằng từ ngày');
    if ((den.getTime() - body.tuNgay.getTime()) / 86_400_000 > 30) throw new BadRequestException('Tối đa 31 ngày một lần thêm');
    const data: { ngay: Date; ten: string }[] = [];
    for (let t = body.tuNgay.getTime(); t <= den.getTime(); t += 86_400_000) data.push({ ngay: new Date(t), ten: body.ten });
    const r = await this.prisma.ngayNghiLe.createMany({ data, skipDuplicates: true });
    await this.audit.ghi(u, 'TAO', 'NgayNghiLe', null, `Thêm ngày nghỉ lễ "${body.ten}" (${iso(body.tuNgay)} → ${iso(den)})`, undefined, ip);
    return { soNgay: r.count };
  }

  @Roles(...QUYEN_SUA)
  @Delete('ngay-le/:id')
  async xoaNgayLe(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    const l = await this.prisma.ngayNghiLe.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Không tìm thấy ngày nghỉ lễ');
    });
    await this.audit.ghi(u, 'XOA', 'NgayNghiLe', id, `Xóa ngày nghỉ lễ ${iso(l.ngay)} (${l.ten})`, undefined, ip);
    return { ok: true };
  }

  // ------------------------------------------------------------ Quỹ phép
  private async layQuy(ns: NhanSuPhep, nam: number) {
    const where = { nhanSuId_nam: { nhanSuId: ns.id, nam } };
    const co = await this.prisma.quyPhep.findUnique({ where });
    if (co) return co;
    const kq = tinhQuyPhep(ns, nam);
    return this.prisma.quyPhep.upsert({
      where,
      create: { nhanSuId: ns.id, nam, soThang: kq.soThang, phepCoBan: kq.phepCoBan, phepThamNien: kq.phepThamNien, tongPhep: kq.tongPhep, ghiChu: kq.ghiChu },
      update: {},
    });
  }

  /** Số ngày đã nghỉ / đang chờ duyệt / nghỉ loại khác của một cán bộ trong năm. */
  private async thongKe(nhanSuId: string, nam: number, boQuaDonId?: string) {
    const ds = await this.prisma.donNghi.findMany({
      where: {
        nhanSuId,
        tuNgay: { gte: dauNam(nam), lte: cuoiNam(nam) },
        trangThai: { in: TINH_VAO_QUY },
        ...(boQuaDonId ? { id: { not: boQuaDonId } } : {}),
      },
      select: { loai: true, soNgay: true, trangThai: true },
    });
    let daNghi = 0;
    let choDuyet = 0;
    const khac: Record<string, number> = {};
    for (const d of ds) {
      if (d.loai === 'PHEP_NAM') {
        if (d.trangThai === 'DA_DUYET') daNghi += d.soNgay;
        else choDuyet += d.soNgay;
      } else if (d.trangThai === 'DA_DUYET') {
        khac[d.loai] = (khac[d.loai] ?? 0) + d.soNgay;
      }
    }
    return { daNghi, choDuyet, khac };
  }

  private async nhanSuCuaToi(u: NguoiDung) {
    if (!u.nhanSuId) throw new BadRequestException('Tài khoản này chưa gắn với cán bộ nên không thể xin nghỉ phép');
    return this.prisma.nhanSu.findUniqueOrThrow({
      where: { id: u.nhanSuId },
      select: { id: true, hoTen: true, donViId: true, ngayTuyenDung: true, laGiangVien: true, kiemNhiem: true, loaiNhanSu: true },
    });
  }

  @Get('quy-phep/cua-toi')
  async quyCuaToi(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(namQuery)) q: z.infer<typeof namQuery>) {
    const nam = q.nam ?? namHienTai();
    const ns = await this.nhanSuCuaToi(u);
    const quy = await this.layQuy(ns, nam);
    const tk = await this.thongKe(ns.id, nam);
    const tong = quy.tongPhep + quy.dieuChinh;
    return {
      nam,
      laGiangVien: ns.laGiangVien && !ns.kiemNhiem,
      kiemNhiem: ns.kiemNhiem,
      soThang: quy.soThang,
      phepCoBan: quy.phepCoBan,
      phepThamNien: quy.phepThamNien,
      dieuChinh: quy.dieuChinh,
      lyDoDieuChinh: quy.lyDoDieuChinh,
      ghiChu: quy.ghiChu,
      tongPhep: tong,
      daNghi: tk.daNghi,
      choDuyet: tk.choDuyet,
      conLai: tong - tk.daNghi,
      khaDung: tong - tk.daNghi - tk.choDuyet,
      nghiKhac: tk.khac,
    };
  }

  /** Bảng tổng hợp quỹ phép của cán bộ trong phạm vi người xem. */
  private async tongHopQuy(u: NguoiDung, nam: number, donViId?: string, q?: string) {
    const where: Prisma.NhanSuWhereInput = {
      AND: [
        await this.scope.nhanSuWhere(u),
        { trangThai: DANG_LAM },
        donViId ? { donViId: { in: await this.scope.donViVaCon(donViId) } } : {},
        q ? { OR: [{ hoTen: { contains: q, mode: 'insensitive' } }, { maCanBo: { contains: q } }] } : {},
      ],
    };
    const ds = await this.prisma.nhanSu.findMany({
      where,
      select: {
        id: true,
        maCanBo: true,
        hoTen: true,
        ten: true,
        ngayTuyenDung: true,
        laGiangVien: true, kiemNhiem: true,
        loaiNhanSu: true,
        donVi: { select: { ten: true } },
        quyPheps: { where: { nam } },
      },
      orderBy: [{ donVi: { ten: 'asc' } }, { ten: 'asc' }, { hoTen: 'asc' }],
    });
    // Tạo quỹ phép còn thiếu cho năm được xem
    const thieu = ds.filter((n) => !n.quyPheps[0]);
    if (thieu.length) {
      await this.prisma.quyPhep.createMany({
        data: thieu.map((n) => {
          const kq = tinhQuyPhep(n, nam);
          return { nhanSuId: n.id, nam, soThang: kq.soThang, phepCoBan: kq.phepCoBan, phepThamNien: kq.phepThamNien, tongPhep: kq.tongPhep, ghiChu: kq.ghiChu };
        }),
        skipDuplicates: true,
      });
    }
    const quys = await this.prisma.quyPhep.findMany({ where: { nam, nhanSuId: { in: ds.map((n) => n.id) } } });
    const quyTheo = new Map(quys.map((x) => [x.nhanSuId, x]));
    const dons = await this.prisma.donNghi.findMany({
      where: { nhanSuId: { in: ds.map((n) => n.id) }, tuNgay: { gte: dauNam(nam), lte: cuoiNam(nam) }, trangThai: { in: TINH_VAO_QUY } },
      select: { nhanSuId: true, loai: true, soNgay: true, trangThai: true },
    });
    const gop = new Map<string, { daNghi: number; choDuyet: number; khac: Record<string, number> }>();
    for (const d of dons) {
      const g = gop.get(d.nhanSuId) ?? { daNghi: 0, choDuyet: 0, khac: {} };
      if (d.loai === 'PHEP_NAM') {
        if (d.trangThai === 'DA_DUYET') g.daNghi += d.soNgay;
        else g.choDuyet += d.soNgay;
      } else if (d.trangThai === 'DA_DUYET') g.khac[d.loai] = (g.khac[d.loai] ?? 0) + d.soNgay;
      gop.set(d.nhanSuId, g);
    }
    return ds.map((n) => {
      const quy = quyTheo.get(n.id)!;
      const g = gop.get(n.id) ?? { daNghi: 0, choDuyet: 0, khac: {} };
      const tong = quy.tongPhep + quy.dieuChinh;
      return {
        quyId: quy.id,
        nhanSuId: n.id,
        maCanBo: n.maCanBo,
        hoTen: n.hoTen,
        donVi: n.donVi.ten,
        laGiangVien: n.laGiangVien && !n.kiemNhiem,
        kiemNhiem: n.kiemNhiem,
        loaiNhanSu: n.loaiNhanSu,
        ngayTuyenDung: n.ngayTuyenDung ? iso(n.ngayTuyenDung) : null,
        soThang: quy.soThang,
        phepCoBan: quy.phepCoBan,
        phepThamNien: quy.phepThamNien,
        phepTinh: quy.tongPhep,
        dieuChinh: quy.dieuChinh,
        lyDoDieuChinh: quy.lyDoDieuChinh,
        ghiChu: quy.ghiChu,
        tongPhep: tong,
        daNghi: g.daNghi,
        choDuyet: g.choDuyet,
        conLai: tong - g.daNghi,
        om: g.khac.OM_DAU ?? 0,
        thaiSan: g.khac.THAI_SAN ?? 0,
        khongLuong: g.khac.KHONG_LUONG ?? 0,
        viecRieng: g.khac.VIEC_RIENG ?? 0,
        khac: g.khac.KHAC ?? 0,
      };
    });
  }

  @Roles(...QUAN_LY)
  @Get('quy-phep')
  danhSachQuy(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(quyQuery)) q: z.infer<typeof quyQuery>) {
    return this.tongHopQuy(u, q.nam ?? namHienTai(), q.donViId, q.q);
  }

  @Roles(...QUAN_LY)
  @Get('quy-phep/xuat-excel')
  async xuatQuy(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(quyQuery)) q: z.infer<typeof quyQuery>, @Res() res: Response) {
    const nam = q.nam ?? namHienTai();
    const ds = await this.tongHopQuy(u, nam, q.donViId, q.q);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Phép năm ${nam}`);
    ws.mergeCells('A1:N1');
    ws.getCell('A1').value = `BẢNG THEO DÕI NGÀY PHÉP NĂM ${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getRow(3).values = [
      'STT', 'Mã cán bộ (CCCD)', 'Họ và tên', 'Đơn vị', 'Ngày tuyển dụng', 'Phép cơ bản', 'Thâm niên', 'Điều chỉnh',
      'Tổng phép năm', 'Đã nghỉ', 'Chờ duyệt', 'Còn lại', 'Nghỉ ốm / thai sản / khác (ngày)', 'Ghi chú',
    ];
    ws.getRow(3).font = { bold: true };
    ws.getRow(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = 34;
    [6, 18, 26, 30, 14, 10, 10, 10, 12, 10, 10, 10, 18, 34].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const dmy = (s: string | null) => (s ? s.split('-').reverse().join('/') : '');
    ds.forEach((d, i) =>
      ws.addRow([
        i + 1, d.maCanBo, d.hoTen, d.donVi, dmy(d.ngayTuyenDung), d.phepCoBan, d.phepThamNien, d.dieuChinh || '',
        d.tongPhep, d.daNghi, d.choDuyet, d.conLai, d.om + d.thaiSan + d.khongLuong + d.viecRieng + d.khac,
        [d.ghiChu, d.lyDoDieuChinh].filter(Boolean).join('; '),
      ]),
    );
    ws.eachRow((row, n) => {
      if (n < 3) return;
      row.eachCell({ includeEmpty: true }, (c) => {
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    ws.getColumn(2).numFmt = '@';
    guiFile(res, Buffer.from(await wb.xlsx.writeBuffer()), `PhepNam_${nam}.xlsx`);
  }

  @Roles(...QUYEN_SUA)
  @Post('quy-phep/tinh-lai')
  async tinhLai(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(tinhLaiSchema)) body: z.infer<typeof tinhLaiSchema>, @Ip() ip: string) {
    const ds = await this.prisma.nhanSu.findMany({
      where: { AND: [await this.scope.nhanSuWhere(u), { trangThai: DANG_LAM }] },
      select: { id: true, ngayTuyenDung: true, laGiangVien: true, kiemNhiem: true, loaiNhanSu: true },
    });
    for (const n of ds) {
      const kq = tinhQuyPhep(n, body.nam);
      const du = { soThang: kq.soThang, phepCoBan: kq.phepCoBan, phepThamNien: kq.phepThamNien, tongPhep: kq.tongPhep, ghiChu: kq.ghiChu };
      await this.prisma.quyPhep.upsert({
        where: { nhanSuId_nam: { nhanSuId: n.id, nam: body.nam } },
        create: { nhanSuId: n.id, nam: body.nam, ...du },
        update: du, // giữ nguyên phần TCHC đã điều chỉnh
      });
    }
    await this.audit.ghi(u, 'SUA', 'QuyPhep', null, `Tính lại quỹ phép năm ${body.nam} cho ${ds.length} cán bộ`, undefined, ip);
    return { soLuong: ds.length };
  }

  @Roles(...QUYEN_SUA)
  @Patch('quy-phep/:id/dieu-chinh')
  async dieuChinh(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(dieuChinhSchema)) body: z.infer<typeof dieuChinhSchema>,
    @Ip() ip: string,
  ) {
    const quy = await this.prisma.quyPhep.findUnique({ where: { id }, include: { nhanSu: { select: { hoTen: true } } } });
    if (!quy) throw new NotFoundException('Không tìm thấy quỹ phép');
    await this.scope.kiemTraSua(u, quy.nhanSuId);
    if (body.dieuChinh !== 0 && !body.lyDo) throw new BadRequestException('Phải nhập lý do khi điều chỉnh số ngày phép');
    await this.prisma.quyPhep.update({
      where: { id },
      data: { dieuChinh: body.dieuChinh, lyDoDieuChinh: body.dieuChinh === 0 ? null : body.lyDo },
    });
    await this.audit.ghi(
      u, 'SUA', 'QuyPhep', id,
      `Điều chỉnh phép năm ${quy.nam} của ${quy.nhanSu.hoTen}: ${quy.dieuChinh} → ${body.dieuChinh}${body.lyDo ? ` (${body.lyDo})` : ''}`,
      { dieuChinh: [quy.dieuChinh, body.dieuChinh] }, ip,
    );
    return { ok: true };
  }

  // ------------------------------------------------------------ Giảng viên kiêm nhiệm
  /** Danh sách giảng viên để TCHC tích chọn "kiêm nhiệm" (phép năm tính như nhân viên). */
  @Roles(...QUYEN_SUA)
  @Get('giang-vien')
  async dsGiangVien(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(gvQuery)) q: z.infer<typeof gvQuery>) {
    const ds = await this.prisma.nhanSu.findMany({
      where: {
        AND: [
          await this.scope.nhanSuWhere(u),
          { laGiangVien: true, trangThai: DANG_LAM },
          q.donViId ? { donViId: { in: await this.scope.donViVaCon(q.donViId) } } : {},
          q.loaiDonVi ? { donVi: { loai: q.loaiDonVi } } : {},
          q.chiKhongKhoa ? { donVi: { loai: { notIn: ['KHOA', 'TO_BO_MON'] } } } : {},
          q.q ? { OR: [{ hoTen: { contains: q.q, mode: 'insensitive' } }, { maCanBo: { contains: q.q } }] } : {},
        ],
      },
      select: { id: true, maCanBo: true, hoTen: true, kiemNhiem: true, donVi: { select: { ten: true, loai: true } }, chucVu: { select: { ten: true } } },
      orderBy: [{ donVi: { ten: 'asc' } }, { ten: 'asc' }, { hoTen: 'asc' }],
    });
    return ds.map((n) => ({ id: n.id, maCanBo: n.maCanBo, hoTen: n.hoTen, kiemNhiem: n.kiemNhiem, donVi: n.donVi.ten, loaiDonVi: n.donVi.loai, chucVu: n.chucVu?.ten ?? null }));
  }

  @Roles(...QUYEN_SUA)
  @Put('giang-vien/kiem-nhiem')
  async datKiemNhiem(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(kiemNhiemSchema)) body: z.infer<typeof kiemNhiemSchema>, @Ip() ip: string) {
    const trongPhamVi = await this.prisma.nhanSu.findMany({
      where: { AND: [await this.scope.nhanSuWhere(u), { id: { in: body.ids }, laGiangVien: true }] },
      select: { id: true, hoTen: true, kiemNhiem: true },
    });
    if (trongPhamVi.length !== body.ids.length) throw new BadRequestException('Có cán bộ không phải giảng viên hoặc nằm ngoài phạm vi quản lý');
    const can = trongPhamVi.filter((n) => n.kiemNhiem !== body.kiemNhiem);
    if (can.length) {
      await this.prisma.nhanSu.updateMany({ where: { id: { in: can.map((n) => n.id) } }, data: { kiemNhiem: body.kiemNhiem } });
      for (const n of can) await dongBoQuyPhepNamNay(this.prisma, n.id);
      await this.audit.ghi(
        u, 'SUA', 'NhanSu', null,
        `${body.kiemNhiem ? 'Đánh dấu' : 'Bỏ đánh dấu'} giảng viên kiêm nhiệm cho ${can.length} cán bộ: ${can.map((n) => n.hoTen).slice(0, 15).join(', ')}${can.length > 15 ? '…' : ''}`,
        undefined, ip,
      );
    }
    return { soLuong: can.length };
  }

  // ------------------------------------------------------------ Đơn nghỉ
  private mapDon(d: DonDayDu) {
    return {
      id: d.id,
      nhanSuId: d.nhanSuId,
      maCanBo: d.nhanSu.maCanBo,
      hoTen: d.nhanSu.hoTen,
      donVi: d.nhanSu.donVi.ten,
      loai: d.loai,
      tenLoai: NHAN_LOAI_NGHI[d.loai],
      tuNgay: iso(d.tuNgay),
      denNgay: iso(d.denNgay),
      nuaNgay: d.nuaNgay,
      soNgay: d.soNgay,
      lyDo: d.lyDo,
      trangThai: d.trangThai,
      tenTrangThai: NHAN_TRANG_THAI_DON[d.trangThai],
      lyDoTuChoi: d.lyDoTuChoi,
      ngayGui: d.createdAt.toISOString(),
      duyets: d.duyets
        .slice()
        .sort((a, b) => a.thoiGian.getTime() - b.thoiGian.getTime())
        .map((x) => ({ nguoiDuyet: x.nguoiDuyet, buoc: x.buoc, ketQua: x.ketQua, ghiChu: x.ghiChu, thoiGian: x.thoiGian.toISOString() })),
    };
  }

  private readonly bao = {
    nhanSu: { select: { id: true, hoTen: true, maCanBo: true, donViId: true, donVi: { select: { ten: true, coSoId: true } } } },
    duyets: true,
  } as const;

  /** Tập đơn vị mà Trưởng đơn vị này được duyệt (đơn vị của mình và các đơn vị con). */
  private async phamViDuyet(u: NguoiDung): Promise<Set<string>> {
    const goc = u.phamViDonViId ?? u.donViId;
    return new Set(goc ? await this.scope.donViVaCon(goc) : []);
  }

  private coQuyenDuyet(u: NguoiDung, don: DonDayDu, phamVi: Set<string>): boolean {
    if (u.vaiTro === 'QUAN_TRI') return true;
    if (u.nhanSuId && u.nhanSuId === don.nhanSuId) return false; // không tự duyệt đơn của mình
    switch (don.trangThai) {
      case 'CHO_TRUONG_DON_VI':
        return u.vaiTro === 'TRUONG_DON_VI' && phamVi.has(don.nhanSu.donViId);
      case 'CHO_BGH':
        return u.vaiTro === 'BAN_GIAM_HIEU';
      case 'CHO_TCHC':
        return u.vaiTro === 'TCHC' && (!u.phamViCoSoId || don.nhanSu.donVi.coSoId === u.phamViCoSoId);
      default:
        return false;
    }
  }

  /** Đơn của Trưởng đơn vị → BGH; của cán bộ thường → Trưởng đơn vị (nếu có) → TCHC. */
  private async trangThaiBanDau(u: NguoiDung, ns: { id: string; donViId: string }): Promise<TrangThaiDon> {
    if (u.vaiTro === 'TRUONG_DON_VI') return 'CHO_BGH';
    if (u.vaiTro === 'BAN_GIAM_HIEU' || u.vaiTro === 'QUAN_TRI') return 'CHO_TCHC';
    const tdvs = await this.prisma.taiKhoan.findMany({
      where: { vaiTro: 'TRUONG_DON_VI', hoatDong: true, nhanSuId: { not: ns.id } },
      select: { phamViDonViId: true, nhanSu: { select: { donViId: true } } },
    });
    for (const t of tdvs) {
      const goc = t.phamViDonViId ?? t.nhanSu?.donViId;
      if (goc && (await this.scope.donViVaCon(goc)).includes(ns.donViId)) return 'CHO_TRUONG_DON_VI';
    }
    return 'CHO_TCHC';
  }

  @Get('don/uoc-tinh')
  async uocTinh(@Query(new ZodPipe(uocTinhQuery)) q: z.infer<typeof uocTinhQuery>) {
    if (q.denNgay < q.tuNgay) throw new BadRequestException('Đến ngày phải sau hoặc bằng từ ngày');
    if ((q.denNgay.getTime() - q.tuNgay.getTime()) / 86_400_000 > 731) throw new BadRequestException('Khoảng nghỉ quá dài (tối đa 2 năm)');
    const le = await this.tapLe(q.tuNgay, q.denNgay);
    return { soNgay: demNgayLamViec(q.tuNgay, q.denNgay, le, q.nuaNgay && iso(q.tuNgay) === iso(q.denNgay)) };
  }

  @Get('don/cua-toi')
  async donCuaToi(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(namQuery)) q: z.infer<typeof namQuery>) {
    if (!u.nhanSuId) return [];
    const nam = q.nam ?? namHienTai();
    const ds = await this.prisma.donNghi.findMany({
      where: { nhanSuId: u.nhanSuId, tuNgay: { gte: dauNam(nam), lte: cuoiNam(nam) } },
      include: this.bao,
      orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }],
    });
    return ds.map((d) => this.mapDon(d));
  }

  @Post('don')
  async taoDon(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(taoDonSchema)) body: z.infer<typeof taoDonSchema>, @Ip() ip: string) {
    const ns = await this.nhanSuCuaToi(u);
    if (body.denNgay < body.tuNgay) throw new BadRequestException('Đến ngày phải sau hoặc bằng từ ngày');
    if (body.nuaNgay && iso(body.tuNgay) !== iso(body.denNgay)) throw new BadRequestException('Chỉ chọn nửa ngày khi nghỉ trong một ngày');
    const gioiHanNgay = body.loai === 'KHONG_LUONG' ? 731 : 366; // Nghỉ không lương được tối đa 2 năm
    if ((body.denNgay.getTime() - body.tuNgay.getTime()) / 86_400_000 > gioiHanNgay) {
      throw new BadRequestException(
        body.loai === 'KHONG_LUONG'
          ? 'Khoảng nghỉ quá dài (tối đa 2 năm đối với nghỉ không lương)'
          : 'Khoảng nghỉ quá dài (tối đa 1 năm)',
      );
    }
    const sau7NgayTruoc = new Date(homNay().getTime() - 7 * 86_400_000);
    if (body.tuNgay < sau7NgayTruoc) throw new BadRequestException('Không thể xin nghỉ cho ngày đã qua quá 7 ngày. Hãy liên hệ Phòng TCHC');

    const le = await this.tapLe(body.tuNgay, body.denNgay);
    const soNgay = demNgayLamViec(body.tuNgay, body.denNgay, le, body.nuaNgay);
    if (soNgay <= 0) throw new BadRequestException('Khoảng ngày đã chọn không có ngày làm việc nào (thứ Bảy, Chủ nhật hoặc ngày lễ)');

    const trung = await this.prisma.donNghi.findFirst({
      where: { nhanSuId: ns.id, trangThai: { in: TINH_VAO_QUY }, tuNgay: { lte: body.denNgay }, denNgay: { gte: body.tuNgay } },
    });
    if (trung) throw new BadRequestException(`Trùng với đơn nghỉ từ ${iso(trung.tuNgay)} đến ${iso(trung.denNgay)}`);

    if (body.loai === 'PHEP_NAM') {
      const nam = body.tuNgay.getUTCFullYear();
      if (body.denNgay.getUTCFullYear() !== nam) throw new BadRequestException('Nghỉ phép năm phải nằm trong cùng một năm. Hãy tách thành hai đơn');
      const quy = await this.layQuy(ns, nam);
      const tk = await this.thongKe(ns.id, nam);
      const khaDung = quy.tongPhep + quy.dieuChinh - tk.daNghi - tk.choDuyet;
      if (soNgay > khaDung) {
        throw new BadRequestException(
          khaDung <= 0
            ? `Bạn không còn ngày phép năm ${nam} để xin nghỉ`
            : `Xin nghỉ ${soNgay} ngày nhưng phép năm ${nam} chỉ còn ${khaDung} ngày (đã tính các đơn đang chờ duyệt)`,
        );
      }
    }

    const trangThai = await this.trangThaiBanDau(u, ns);
    const don = await this.prisma.donNghi.create({
      data: {
        nhanSuId: ns.id,
        loai: body.loai,
        tuNgay: body.tuNgay,
        denNgay: body.denNgay,
        nuaNgay: body.nuaNgay,
        soNgay,
        lyDo: body.lyDo,
        trangThai,
        duyets: { create: { taiKhoanId: u.id, nguoiDuyet: u.tenDangNhap, buoc: 'GUI_DON', ketQua: 'GUI' } },
      },
    });
    await this.audit.ghi(
      u, 'TAO', 'DonNghi', don.id,
      `${ns.hoTen} xin ${NHAN_LOAI_NGHI[body.loai].toLowerCase()} ${soNgay} ngày (${iso(body.tuNgay)} → ${iso(body.denNgay)})`,
      undefined, ip,
    );
    return { id: don.id, soNgay, trangThai, tenTrangThai: NHAN_TRANG_THAI_DON[trangThai] };
  }

  @Patch('don/:id/huy')
  async huy(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    const don = await this.prisma.donNghi.findUnique({ where: { id }, include: this.bao });
    if (!don) throw new NotFoundException('Không tìm thấy đơn nghỉ');
    const laChuDon = !!u.nhanSuId && u.nhanSuId === don.nhanSuId;
    const laQuanLy = this.scope.coQuyenSua(u);
    if (laChuDon) {
      if (!CHO.includes(don.trangThai)) throw new BadRequestException('Chỉ hủy được đơn đang chờ duyệt. Đơn đã duyệt hãy liên hệ Phòng TCHC');
    } else if (laQuanLy) {
      await this.scope.kiemTraXem(u, don.nhanSuId);
      if (!CHO.includes(don.trangThai) && don.trangThai !== 'DA_DUYET') throw new BadRequestException('Đơn này không thể hủy');
    } else {
      throw new ForbiddenException('Bạn không có quyền hủy đơn này');
    }
    await this.prisma.donNghi.update({
      where: { id },
      data: { trangThai: 'DA_HUY', duyets: { create: { taiKhoanId: u.id, nguoiDuyet: u.tenDangNhap, buoc: 'HUY', ketQua: 'HUY' } } },
    });
    await this.audit.ghi(u, 'SUA', 'DonNghi', id, `Hủy đơn nghỉ của ${don.nhanSu.hoTen} (${iso(don.tuNgay)} → ${iso(don.denNgay)})`, undefined, ip);
    return { ok: true };
  }

  @Roles(...NGUOI_DUYET)
  @Get('don/cho-duyet')
  async choDuyet(@CurrentUser() u: NguoiDung) {
    const phamVi = await this.phamViDuyet(u);
    const ds = await this.prisma.donNghi.findMany({
      where: { trangThai: { in: CHO } },
      include: this.bao,
      orderBy: { createdAt: 'asc' },
    });
    const duoc = ds.filter((d) => this.coQuyenDuyet(u, d, phamVi));
    return Promise.all(
      duoc.map(async (d) => {
        let conLai: number | null = null;
        if (d.loai === 'PHEP_NAM') {
          const ns = await this.prisma.nhanSu.findUniqueOrThrow({
            where: { id: d.nhanSuId },
            select: { id: true, ngayTuyenDung: true, laGiangVien: true, kiemNhiem: true, loaiNhanSu: true },
          });
          const nam = d.tuNgay.getUTCFullYear();
          const quy = await this.layQuy(ns, nam);
          const tk = await this.thongKe(ns.id, nam);
          conLai = quy.tongPhep + quy.dieuChinh - tk.daNghi;
        }
        return { ...this.mapDon(d), phepConLai: conLai };
      }),
    );
  }

  @Roles(...NGUOI_DUYET)
  @Get('don/cho-duyet/so-luong')
  async soChoDuyet(@CurrentUser() u: NguoiDung) {
    const phamVi = await this.phamViDuyet(u);
    const ds = await this.prisma.donNghi.findMany({ where: { trangThai: { in: CHO } }, include: this.bao });
    return { soLuong: ds.filter((d) => this.coQuyenDuyet(u, d, phamVi)).length };
  }

  private async layDonDeDuyet(u: NguoiDung, id: string): Promise<DonDayDu> {
    const don = await this.prisma.donNghi.findUnique({ where: { id }, include: this.bao });
    if (!don) throw new NotFoundException('Không tìm thấy đơn nghỉ');
    if (!CHO.includes(don.trangThai)) throw new BadRequestException('Đơn này không còn ở trạng thái chờ duyệt');
    if (!this.coQuyenDuyet(u, don, await this.phamViDuyet(u))) throw new ForbiddenException('Bạn không có quyền xử lý đơn này ở bước hiện tại');
    return don;
  }

  @Roles(...NGUOI_DUYET)
  @Post('don/:id/duyet')
  async duyet(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(duyetSchema)) body: z.infer<typeof duyetSchema>,
    @Ip() ip: string,
  ) {
    const don = await this.layDonDeDuyet(u, id);
    const tiep: Record<string, TrangThaiDon> = { CHO_TRUONG_DON_VI: 'CHO_TCHC', CHO_BGH: 'CHO_TCHC', CHO_TCHC: 'DA_DUYET' };
    const moi = tiep[don.trangThai];

    if (moi === 'DA_DUYET' && don.loai === 'PHEP_NAM') {
      // Kiểm tra lại quỹ phép khi xác nhận cuối cùng
      const ns = await this.prisma.nhanSu.findUniqueOrThrow({
        where: { id: don.nhanSuId },
        select: { id: true, ngayTuyenDung: true, laGiangVien: true, kiemNhiem: true, loaiNhanSu: true },
      });
      const nam = don.tuNgay.getUTCFullYear();
      const quy = await this.layQuy(ns, nam);
      const tk = await this.thongKe(ns.id, nam, don.id);
      const conLai = quy.tongPhep + quy.dieuChinh - tk.daNghi;
      if (don.soNgay > conLai) throw new BadRequestException(`Không đủ phép: đơn xin ${don.soNgay} ngày nhưng phép năm ${nam} chỉ còn ${conLai} ngày`);
    }

    await this.prisma.donNghi.update({
      where: { id },
      data: {
        trangThai: moi,
        duyets: { create: { taiKhoanId: u.id, nguoiDuyet: u.tenDangNhap, buoc: don.trangThai, ketQua: 'DUYET', ghiChu: body.ghiChu } },
      },
    });
    await this.audit.ghi(
      u, 'SUA', 'DonNghi', id,
      `${moi === 'DA_DUYET' ? 'Xác nhận' : 'Duyệt'} đơn nghỉ của ${don.nhanSu.hoTen} (${iso(don.tuNgay)} → ${iso(don.denNgay)}, ${don.soNgay} ngày)`,
      undefined, ip,
    );
    // Tự động chuyển trạng thái nhân sự sang TAM_NGHI khi duyệt nghỉ không lương dài hạn
    if (moi === 'DA_DUYET' && don.loai === 'KHONG_LUONG' && don.soNgay > NGHI_DAI_HAN) {
      await this.prisma.nhanSu.update({ where: { id: don.nhanSuId }, data: { trangThai: 'TAM_NGHI' } });
      await this.audit.ghi(
        u, 'SUA', 'NhanSu', don.nhanSuId,
        `Tự động chuyển ${don.nhanSu.hoTen} sang Tạm nghỉ (nghỉ không lương ${don.soNgay} ngày, ${iso(don.tuNgay)} → ${iso(don.denNgay)})`,
        undefined, ip,
      );
    }

    return { trangThai: moi, tenTrangThai: NHAN_TRANG_THAI_DON[moi] };
  }

  @Roles(...NGUOI_DUYET)
  @Post('don/:id/tu-choi')
  async tuChoi(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(tuChoiSchema)) body: z.infer<typeof tuChoiSchema>,
    @Ip() ip: string,
  ) {
    const don = await this.layDonDeDuyet(u, id);
    await this.prisma.donNghi.update({
      where: { id },
      data: {
        trangThai: 'TU_CHOI',
        lyDoTuChoi: body.lyDo,
        duyets: { create: { taiKhoanId: u.id, nguoiDuyet: u.tenDangNhap, buoc: don.trangThai, ketQua: 'TU_CHOI', ghiChu: body.lyDo } },
      },
    });
    await this.audit.ghi(u, 'SUA', 'DonNghi', id, `Từ chối đơn nghỉ của ${don.nhanSu.hoTen}: ${body.lyDo}`, undefined, ip);
    return { ok: true };
  }

  // ------------------------------------------------------------ Đi làm lại (kết thúc nghỉ KL dài hạn sớm)
  @Roles(...QUYEN_SUA)
  @Post('don/:id/di-lam-lai')
  async diLamLai(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(diLamLaiSchema)) body: z.infer<typeof diLamLaiSchema>,
    @Ip() ip: string,
  ) {
    const don = await this.prisma.donNghi.findUnique({ where: { id }, include: this.bao });
    if (!don) throw new NotFoundException('Không tìm thấy đơn nghỉ');
    if (don.trangThai !== 'DA_DUYET') throw new BadRequestException('Chỉ xử lý được đơn đã duyệt');
    if (don.loai !== 'KHONG_LUONG') throw new BadRequestException('Chỉ áp dụng cho đơn nghỉ không lương');
    if (don.soNgay <= NGHI_DAI_HAN) throw new BadRequestException('Chỉ áp dụng cho đơn nghỉ dài hạn (trên 30 ngày)');
    await this.scope.kiemTraSua(u, don.nhanSuId);

    const ngayDiLam = body.ngayDiLam;
    if (ngayDiLam <= don.tuNgay) throw new BadRequestException('Ngày đi làm lại phải sau ngày bắt đầu nghỉ');

    // Trả sớm: rút ngắn denNgay; trả đúng/muộn: giữ nguyên denNgay
    const denNgayMoi = ngayDiLam <= don.denNgay
      ? new Date(ngayDiLam.getTime() - 86_400_000)
      : don.denNgay;

    // Tính lại số ngày nghỉ thực tế
    const le = await this.tapLe(don.tuNgay, denNgayMoi);
    const soNgayMoi = demNgayLamViec(don.tuNgay, denNgayMoi, le, false);

    await this.prisma.$transaction([
      this.prisma.donNghi.update({
        where: { id },
        data: {
          denNgay: denNgayMoi,
          soNgay: soNgayMoi,
          duyets: {
            create: {
              taiKhoanId: u.id,
              nguoiDuyet: u.tenDangNhap,
              buoc: 'DI_LAM_LAI',
              ketQua: 'DI_LAM_LAI',
              ghiChu: `Đi làm lại từ ${iso(ngayDiLam)}${ngayDiLam <= don.denNgay ? ` (sớm ${don.soNgay - soNgayMoi} ngày)` : ''}`,
            },
          },
        },
      }),
      this.prisma.nhanSu.update({
        where: { id: don.nhanSuId },
        data: { trangThai: 'DANG_LAM_VIEC' },
      }),
    ]);

    await this.audit.ghi(
      u, 'SUA', 'DonNghi', id,
      `${don.nhanSu.hoTen} đi làm lại từ ${iso(ngayDiLam)} (nghỉ thực tế ${soNgayMoi}/${don.soNgay} ngày)`,
      { denNgay: [iso(don.denNgay), iso(denNgayMoi)], soNgay: [don.soNgay, soNgayMoi] }, ip,
    );
    await this.audit.ghi(
      u, 'SUA', 'NhanSu', don.nhanSuId,
      `Chuyển ${don.nhanSu.hoTen} từ Tạm nghỉ về Đang làm việc (đi làm lại từ ${iso(ngayDiLam)})`,
      undefined, ip,
    );

    return { ok: true, soNgayThucTe: soNgayMoi, ngayDiLam: iso(ngayDiLam) };
  }

  /** Mọi đơn trong phạm vi của người xem (TCHC, BGH, Trưởng đơn vị). */
  @Roles(...QUAN_LY)
  @Get('don')
  async danhSachDon(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(donQuery)) q: z.infer<typeof donQuery>) {
    const nam = q.nam ?? namHienTai();
    const ds = await this.prisma.donNghi.findMany({
      where: {
        tuNgay: { gte: dauNam(nam), lte: cuoiNam(nam) },
        trangThai: q.trangThai || undefined,
        nhanSu: {
          AND: [
            await this.scope.nhanSuWhere(u),
            q.donViId ? { donViId: { in: await this.scope.donViVaCon(q.donViId) } } : {},
            q.q ? { OR: [{ hoTen: { contains: q.q, mode: 'insensitive' } }, { maCanBo: { contains: q.q } }] } : {},
          ],
        },
      },
      include: this.bao,
      orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    return ds.map((d) => this.mapDon(d));
  }
}
