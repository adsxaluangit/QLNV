import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService, khacBiet } from '../common/audit.service';
import { CurrentUser, NguoiDung, QUYEN_SUA, QUYEN_XEM_DS, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ngay, ngayOpt, txt, ZodPipe } from '../common/zod';
import { xuLyTrung } from '../to-chuc/to-chuc.controller';
import {
  congThang,
  deXuatNangLuong,
  iso,
  NHAN_LOAI_HOP_DONG,
  tinhTongThangKeoDai,
  uocTinhLuong,
} from './nghiep-vu-luong';

const DANG_LAM = { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] as ('DANG_LAM_VIEC' | 'TAM_NGHI')[] };

function guiFile(res: Response, buf: Buffer, ten: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ten)}`);
  res.send(buf);
}

// ---------------------------------------------------------------- Ngạch lương
const ngachSchema = z.object({
  ma: z.string().trim().min(1, 'Nhập mã').max(30).transform((s) => s.toUpperCase()),
  ten: z.string().trim().min(2).max(200),
  nhom: z.string().trim().min(1, 'Nhập nhóm').max(20),
  heSo: z
    .array(z.coerce.number().positive('Hệ số phải > 0').max(20))
    .min(1, 'Nhập ít nhất 1 bậc')
    .max(20)
    .refine((a) => a.every((v, i) => i === 0 || v > a[i - 1]), 'Hệ số bậc sau phải lớn hơn bậc trước'),
  thangNangBac: z.coerce.number().int().min(12).max(60).default(36),
  thuTu: z.coerce.number().int().default(0),
});
type NgachInput = z.infer<typeof ngachSchema>;

@Controller('ngach-luong')
export class NgachLuongController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  danhSach() {
    return this.prisma.ngachLuong.findMany({
      orderBy: [{ thuTu: 'asc' }, { ma: 'asc' }],
      include: { _count: { select: { quaTrinhLuongs: true } } },
    });
  }

  @Roles(...QUYEN_SUA)
  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(ngachSchema)) body: NgachInput) {
    const n = await this.prisma.ngachLuong.create({ data: body }).catch((e) => xuLyTrung(e, `Mã ngạch ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'TAO', 'NgachLuong', n.id, `Thêm ngạch ${n.ma} - ${n.ten}`);
    return n;
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  async sua(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(ngachSchema)) body: NgachInput) {
    const cu = await this.prisma.ngachLuong.findUniqueOrThrow({ where: { id } });
    const n = await this.prisma.ngachLuong
      .update({ where: { id }, data: body })
      .catch((e) => xuLyTrung(e, `Mã ngạch ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'SUA', 'NgachLuong', id, `Sửa ngạch ${n.ma}`, khacBiet(cu, n));
    return n;
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    const dung = await this.prisma.quaTrinhLuong.count({ where: { ngachId: id } });
    if (dung) throw new BadRequestException(`Ngạch đang được dùng trong ${dung} quá trình lương`);
    const n = await this.prisma.ngachLuong.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'NgachLuong', id, `Xóa ngạch ${n.ma}`);
    return { ok: true };
  }
}

// ---------------------------------------------------------------- Lương cơ sở
const luongCoSoSchema = z.object({
  tuNgay: ngay,
  mucLuong: z.coerce.number().int().min(100_000, 'Mức lương không hợp lệ').max(100_000_000),
  canCu: txt(300),
});
type LuongCoSoInput = z.infer<typeof luongCoSoSchema>;

@Controller('luong-co-so')
export class LuongCoSoController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  danhSach() {
    return this.prisma.luongCoSo.findMany({ orderBy: { tuNgay: 'desc' } });
  }

  @Roles(...QUYEN_SUA)
  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(luongCoSoSchema)) body: LuongCoSoInput) {
    const l = await this.prisma.luongCoSo
      .create({ data: body })
      .catch((e) => xuLyTrung(e, `Đã có mức lương cơ sở từ ngày ${iso(body.tuNgay)}`));
    await this.audit.ghi(u, 'TAO', 'LuongCoSo', l.id, `Thêm lương cơ sở ${l.mucLuong} từ ${iso(l.tuNgay)}`);
    return l;
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  async sua(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(luongCoSoSchema)) body: LuongCoSoInput) {
    const cu = await this.prisma.luongCoSo.findUniqueOrThrow({ where: { id } });
    const l = await this.prisma.luongCoSo
      .update({ where: { id }, data: body })
      .catch((e) => xuLyTrung(e, `Đã có mức lương cơ sở từ ngày ${iso(body.tuNgay)}`));
    await this.audit.ghi(u, 'SUA', 'LuongCoSo', id, `Sửa lương cơ sở từ ${iso(l.tuNgay)}`, khacBiet(cu, l));
    return l;
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    const l = await this.prisma.luongCoSo.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'LuongCoSo', id, `Xóa lương cơ sở từ ${iso(l.tuNgay)}`);
    return { ok: true };
  }
}

// ---------------------------------------------------------------- Nâng lương & cảnh báo

const denHanQuery = z.object({
  denNgay: ngayOpt,
  donViId: z.string().uuid().optional(),
});

const lapQdSchema = z.object({
  nhanSuIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất 1 cán bộ').max(1000),
  soQuyetDinh: z.string().trim().min(1, 'Nhập số quyết định').max(50),
  ngayQuyetDinh: ngay,
  ghiChu: txt(500),
});

export interface DongDenHan {
  nhanSuId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  ngach: { id: string; ma: string; ten: string };
  bacHienTai: number;
  heSoHienTai: number;
  vuotKhungHienTai: number;
  mocNangBac: string;
  mocNangBacDieuChinh?: string;
  soThangKeoDai?: number;
  lyDoKeoDai?: string;
  loai: 'NANG_BAC' | 'VUOT_KHUNG';
  ngayDenHan: string;
  bacMoi: number;
  heSoMoi: number;
  vuotKhungMoi: number;
  quaHan: boolean;
}

@Controller()
export class NangLuongController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách cán bộ đến hạn nâng lương thường xuyên tính đến `denNgay` (mặc định +3 tháng). */
  async denHan(u: NguoiDung, denNgay: Date, donViId?: string, nhanSuIds?: string[]): Promise<DongDenHan[]> {
    const ds = await this.prisma.nhanSu.findMany({
      where: {
        AND: [
          await this.scope.nhanSuWhere(u),
          { trangThai: DANG_LAM },
          { loaiNhanSu: 'VIEN_CHUC' },
          donViId ? { donViId: { in: await this.scope.donViVaCon(donViId) } } : {},
          nhanSuIds ? { id: { in: nhanSuIds } } : {},
        ],
      },
      select: {
        id: true,
        maCanBo: true,
        hoTen: true,
        ten: true,
        donVi: { select: { ten: true } },
        quaTrinhLuongs: { orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }], take: 1, include: { ngach: true } },
        donNghis: {
          where: { loai: 'KHONG_LUONG', trangThai: 'DA_DUYET' },
          select: { tuNgay: true, denNgay: true, loai: true, trangThai: true },
        },
      },
      orderBy: [{ ten: 'asc' }, { hoTen: 'asc' }],
    });
    const homNay = new Date();
    const kq: DongDenHan[] = [];
    for (const ns of ds) {
      const qtl = ns.quaTrinhLuongs[0];
      if (!qtl?.ngach || !qtl.bac || qtl.luongThoaThuan) continue;
      const { soThang, lyDo } = tinhTongThangKeoDai(qtl.mocNangBac, ns.donNghis ?? []);
      const dx = deXuatNangLuong(qtl, qtl.ngach, soThang);
      if (!dx || dx.ngayDenHan > denNgay) continue;
      kq.push({
        nhanSuId: ns.id,
        maCanBo: ns.maCanBo,
        hoTen: ns.hoTen,
        donVi: ns.donVi.ten,
        ngach: { id: qtl.ngach.id, ma: qtl.ngach.ma, ten: qtl.ngach.ten },
        bacHienTai: qtl.bac!,
        heSoHienTai: qtl.heSo ?? 0,
        vuotKhungHienTai: qtl.phanTramVuotKhung,
        mocNangBac: iso(qtl.mocNangBac),
        mocNangBacDieuChinh: iso(dx.mocNangBacDieuChinh ?? qtl.mocNangBac),
        soThangKeoDai: soThang,
        lyDoKeoDai: lyDo,
        loai: dx.loai,
        ngayDenHan: iso(dx.ngayDenHan),
        bacMoi: dx.bacMoi,
        heSoMoi: dx.heSoMoi,
        vuotKhungMoi: dx.vuotKhungMoi,
        quaHan: dx.ngayDenHan < homNay,
      });
    }
    return kq.sort((a, b) => a.ngayDenHan.localeCompare(b.ngayDenHan));
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('nang-luong/den-han')
  danhSachDenHan(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(denHanQuery)) q: z.infer<typeof denHanQuery>) {
    return this.denHan(u, q.denNgay ?? congThang(new Date(), 3), q.donViId);
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('nang-luong/xuat-excel')
  async xuatExcel(
    @CurrentUser() u: NguoiDung,
    @Query(new ZodPipe(denHanQuery)) q: z.infer<typeof denHanQuery>,
    @Res() res: Response,
  ) {
    const denNgay = q.denNgay ?? congThang(new Date(), 3);
    const ds = await this.denHan(u, denNgay, q.donViId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Đến hạn nâng lương');
    ws.mergeCells('A1:M1');
    ws.getCell('A1').value = `DANH SÁCH CÁN BỘ ĐẾN HẠN NÂNG BẬC LƯƠNG THƯỜNG XUYÊN, PHỤ CẤP THÂM NIÊN VƯỢT KHUNG (đến ngày ${denNgay
      .toISOString()
      .slice(0, 10)
      .split('-')
      .reverse()
      .join('/')})`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A1').alignment = { horizontal: 'center', wrapText: true };
    ws.getRow(1).height = 36;
    const tieuDe = [
      'STT', 'Mã cán bộ (CCCD)', 'Họ và tên', 'Đơn vị', 'Mã ngạch', 'Bậc hiện hưởng', 'Hệ số hiện hưởng',
      '% VK hiện hưởng', 'Mốc tính', 'Hình thức', 'Ngày hưởng mới', 'Bậc / hệ số mới', '% VK mới',
    ];
    ws.getRow(3).values = tieuDe;
    ws.getRow(3).font = { bold: true };
    ws.getRow(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = 32;
    const rong = [6, 16, 26, 24, 12, 9, 10, 9, 12, 14, 13, 14, 9];
    rong.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const dmy = (s: string) => s.split('-').reverse().join('/');
    ds.forEach((d, i) => {
      const mocHienThi = d.soThangKeoDai && d.soThangKeoDai > 0
        ? `${dmy(d.mocNangBacDieuChinh ?? d.mocNangBac)} (+${d.soThangKeoDai} thg)`
        : dmy(d.mocNangBac);
      ws.addRow([
        i + 1,
        d.maCanBo,
        d.hoTen,
        d.donVi,
        d.ngach.ma,
        d.bacHienTai,
        d.heSoHienTai,
        d.vuotKhungHienTai || '',
        mocHienThi,
        d.loai === 'NANG_BAC' ? 'Nâng bậc' : 'Vượt khung',
        dmy(d.ngayDenHan),
        `Bậc ${d.bacMoi} / ${d.heSoMoi.toFixed(2)}`,
        d.vuotKhungMoi || '',
      ]);
    });
    ws.eachRow((row, n) => {
      if (n < 3) return;
      row.eachCell({ includeEmpty: true }, (c) => {
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    ws.getColumn(2).numFmt = '@';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    guiFile(res, buf, `DenHanNangLuong_${iso(denNgay)}.xlsx`);
  }

  /** Lập quyết định nâng lương cho các cán bộ đã chọn: thêm dòng quá trình lương mới. */
  @Roles(...QUYEN_SUA)
  @Post('nang-luong/lap-quyet-dinh')
  async lapQuyetDinh(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(lapQdSchema)) body: z.infer<typeof lapQdSchema>) {
    // Tính lại phía máy chủ, không tin dữ liệu gửi lên; cho phép lập trước tối đa 12 tháng
    const ds = await this.denHan(u, congThang(new Date(), 12), undefined, body.nhanSuIds);
    const thieu = body.nhanSuIds.filter((id) => !ds.some((d) => d.nhanSuId === id));
    if (thieu.length) throw new BadRequestException(`${thieu.length} cán bộ không còn đủ điều kiện nâng lương hoặc ngoài phạm vi`);
    await this.prisma.$transaction(
      ds.map((d) =>
        this.prisma.quaTrinhLuong.create({
          data: {
            nhanSuId: d.nhanSuId,
            tuNgay: new Date(`${d.ngayDenHan}T00:00:00.000Z`),
            mocNangBac: new Date(`${d.ngayDenHan}T00:00:00.000Z`),
            ngachId: d.ngach.id,
            bac: d.bacMoi,
            heSo: d.heSoMoi,
            phanTramVuotKhung: d.vuotKhungMoi,
            soQuyetDinh: body.soQuyetDinh,
            ngayQuyetDinh: body.ngayQuyetDinh,
            ghiChu: body.ghiChu ?? (d.loai === 'NANG_BAC' ? 'Nâng bậc lương thường xuyên' : 'Hưởng phụ cấp thâm niên vượt khung'),
          },
        }),
      ),
    );
    await this.audit.ghi(u, 'TAO', 'QuaTrinhLuong', null, `Lập QĐ nâng lương ${body.soQuyetDinh} cho ${ds.length} cán bộ`, {
      nhanSuIds: body.nhanSuIds,
    });
    return { soLuong: ds.length };
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('hop-dong/sap-het-han')
  async hopDongSapHetHan(@CurrentUser() u: NguoiDung, @Query('soNgay') soNgay?: string) {
    const n = Math.min(Math.max(Number(soNgay) || 60, 1), 365);
    const den = new Date(Date.now() + n * 86_400_000);
    // Chỉ xét hợp đồng mới nhất của mỗi cán bộ (hợp đồng cũ đã được thay thế thì bỏ qua)
    const ds = await this.prisma.nhanSu.findMany({
      where: { AND: [await this.scope.nhanSuWhere(u), { trangThai: DANG_LAM }] },
      select: {
        id: true,
        maCanBo: true,
        hoTen: true,
        donVi: { select: { ten: true } },
        hopDongs: { orderBy: { tuNgay: 'desc' }, take: 1 },
      },
    });
    const homNay = new Date();
    return ds
      .filter((ns) => ns.hopDongs[0]?.denNgay && ns.hopDongs[0].denNgay <= den)
      .map((ns) => {
        const hd = ns.hopDongs[0];
        return {
          nhanSuId: ns.id,
          maCanBo: ns.maCanBo,
          hoTen: ns.hoTen,
          donVi: ns.donVi.ten,
          hopDongId: hd.id,
          soHopDong: hd.soHopDong,
          loai: hd.loai,
          tenLoai: NHAN_LOAI_HOP_DONG[hd.loai],
          denNgay: iso(hd.denNgay!),
          soNgayConLai: Math.ceil((hd.denNgay!.getTime() - homNay.getTime()) / 86_400_000),
        };
      })
      .sort((a, b) => a.denNgay.localeCompare(b.denNgay));
  }

  /** Ước tính thu nhập ngạch bậc + phụ cấp tại ngày hôm nay (tham khảo). */
  @Get('luong/uoc-tinh/:nhanSuId')
  async uocTinh(@CurrentUser() u: NguoiDung, @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string) {
    await this.scope.kiemTraXem(u, nhanSuId);
    const homNay = new Date();
    const [qtl, phuCaps, lcs, donNghis] = await Promise.all([
      this.prisma.quaTrinhLuong.findFirst({
        where: { nhanSuId, tuNgay: { lte: homNay } },
        orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }],
        include: { ngach: true },
      }),
      this.prisma.phuCap.findMany({ where: { nhanSuId } }),
      this.prisma.luongCoSo.findFirst({ where: { tuNgay: { lte: homNay } }, orderBy: { tuNgay: 'desc' } }),
      this.prisma.donNghi.findMany({
        where: { nhanSuId, loai: 'KHONG_LUONG', trangThai: 'DA_DUYET' },
        select: { tuNgay: true, denNgay: true, loai: true, trangThai: true },
      }),
    ]);
    const kq = uocTinhLuong(qtl, phuCaps, lcs?.mucLuong ?? 0, homNay);
    const { soThang, lyDo } = qtl ? tinhTongThangKeoDai(qtl.mocNangBac, donNghis) : { soThang: 0 };
    const dx = qtl ? deXuatNangLuong(qtl, qtl.ngach, soThang) : null;
    return {
      uocTinh: kq,
      thieuLuongCoSo: !lcs,
      nangLuongKeTiep: dx
        ? {
            ...dx,
            ngayDenHan: iso(dx.ngayDenHan),
            soThangKeoDai: soThang,
            lyDoKeoDai: lyDo,
            mocNangBac: iso(dx.mocNangBacDieuChinh ?? dx.mocNangBacGoc!),
            mocNangBacGoc: iso(dx.mocNangBacGoc!),
          }
        : null,
    };
  }
}
