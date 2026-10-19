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
  kiemTraNangTruocThoiHanLanTruoc,
  NHAN_LOAI_HOP_DONG,
  tinhTongThangKeoDai,
  UngVienNangLuongTruocThoiHan,
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

// ---------------------------------------------------------------- Nâng lương & Cảnh báo

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
  phanLoaiVuotKhung?: 'LAN_DAU' | 'HANG_NAM';
  tienVuotKhungDuKien?: number;
  ngayDenHan: string;
  bacMoi: number;
  heSoMoi: number;
  vuotKhungMoi: number;
  quaHan: boolean;
}

// -------------------- Nâng lương trước thời hạn Schemas
const truocThoiHanQuery = z.object({
  nam: z.coerce.number().int().min(2000).max(2100).optional(),
  donViId: z.string().uuid().optional(),
});

const itemQdTruocThoiHan = z.object({
  nhanSuId: z.string().uuid(),
  soThangRutNgan: z.coerce.number().refine((n) => [6, 9, 12].includes(n), 'Số tháng rút ngắn phải là 6, 9 hoặc 12 tháng'),
  lyDoKhenThuong: z.string().trim().max(300).optional(),
});

const lapQdTruocThoiHanSchema = z.object({
  soQuyetDinh: z.string().trim().min(1, 'Nhập số quyết định').max(50),
  ngayQuyetDinh: ngay,
  ghiChu: txt(500),
  danhSach: z.array(itemQdTruocThoiHan).min(1, 'Chọn ít nhất 1 cán bộ').max(100),
});

@Controller()
export class NangLuongController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Danh sách cán bộ đến hạn nâng lương thường xuyên tính đến `denNgay` (mặc định +3 tháng). */
  async denHan(u: NguoiDung, denNgay: Date, donViId?: string, nhanSuIds?: string[]): Promise<DongDenHan[]> {
    const homNay = new Date();
    const [ds, lcs] = await Promise.all([
      this.prisma.nhanSu.findMany({
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
      }),
      this.prisma.luongCoSo.findFirst({
        where: { tuNgay: { lte: homNay } },
        orderBy: { tuNgay: 'desc' },
      }),
    ]);

    const mucLuongCoSo = lcs?.mucLuong ?? 2340000;
    const kq: DongDenHan[] = [];

    for (const ns of ds) {
      const qtl = ns.quaTrinhLuongs[0];
      if (!qtl?.ngach || !qtl.bac || qtl.luongThoaThuan) continue;
      const { soThang, lyDo } = tinhTongThangKeoDai(qtl.mocNangBac, ns.donNghis ?? []);
      const dx = deXuatNangLuong(qtl, qtl.ngach, soThang);
      if (!dx || dx.ngayDenHan > denNgay) continue;

      const lanDau = qtl.phanTramVuotKhung === 0;
      const phanLoaiVuotKhung = dx.loai === 'VUOT_KHUNG' ? (lanDau ? 'LAN_DAU' : 'HANG_NAM') : undefined;
      const tienVuotKhungDuKien =
        dx.loai === 'VUOT_KHUNG' ? Math.round(mucLuongCoSo * dx.heSoMoi * (dx.vuotKhungMoi / 100)) : undefined;

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
        phanLoaiVuotKhung,
        tienVuotKhungDuKien,
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
        d.loai === 'NANG_BAC' ? 'Nâng bậc' : d.phanLoaiVuotKhung === 'LAN_DAU' ? 'Vượt khung 5% (Lần đầu)' : `VK +1% (${d.vuotKhungMoi}%)`,
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

  /** Xuất Excel danh sách riêng cho các cán bộ đến hạn hưởng phụ cấp thâm niên vượt khung. */
  @Roles(...QUYEN_XEM_DS)
  @Get('nang-luong/vuot-khung/xuat-excel')
  async xuatExcelVuotKhung(
    @CurrentUser() u: NguoiDung,
    @Query(new ZodPipe(denHanQuery)) q: z.infer<typeof denHanQuery>,
    @Res() res: Response,
  ) {
    const denNgay = q.denNgay ?? congThang(new Date(), 3);
    const dsToanBo = await this.denHan(u, denNgay, q.donViId);
    const ds = dsToanBo.filter((d) => d.loai === 'VUOT_KHUNG');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Vuot khung');
    ws.mergeCells('A1:L1');
    ws.getCell('A1').value = `DANH SÁCH CÁN BỘ ĐẾN HẠN HƯỞNG PHỤ CẤP THÂM NIÊN VƯỢT KHUNG (đến ngày ${denNgay
      .toISOString()
      .slice(0, 10)
      .split('-')
      .reverse()
      .join('/')})`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.mergeCells('A2:L2');
    ws.getCell('A2').value = `(Căn cứ Điều 6 Nghị định 204/2004/NĐ-CP, Thông tư 04/2005/TT-BNV và Thông tư 08/2013/TT-BNV của Bộ Nội vụ)`;
    ws.getCell('A2').font = { italic: true, size: 10 };
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getRow(2).height = 20;

    const tieuDe = [
      'STT',
      'Mã cán bộ (CCCD)',
      'Họ và tên',
      'Đơn vị',
      'Mã ngạch',
      'Bậc cuối cùng',
      'Hệ số bậc cuối',
      '% VK hiện hưởng',
      'Mốc tính',
      'Phân loại vượt khung',
      'Ngày hưởng mới',
      '% VK mới',
    ];
    ws.getRow(4).values = tieuDe;
    ws.getRow(4).font = { bold: true, color: { argb: 'FFFFFF' } };
    ws.getRow(4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(4).height = 32;
    for (let c = 1; c <= tieuDe.length; c++) {
      ws.getCell(4, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '7C3AED' },
      };
    }

    const rong = [6, 16, 26, 24, 12, 12, 14, 14, 14, 28, 14, 12];
    rong.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const dmy = (s: string) => s.split('-').reverse().join('/');

    ds.forEach((d, i) => {
      const phanLoai =
        d.phanLoaiVuotKhung === 'LAN_DAU'
          ? 'Hưởng 5% lần đầu (sau 36 tháng kịch khung)'
          : `Tăng thêm +1% hàng năm (${d.vuotKhungHienTai}% → ${d.vuotKhungMoi}%)`;
      const mocHienThi =
        d.soThangKeoDai && d.soThangKeoDai > 0
          ? `${dmy(d.mocNangBacDieuChinh ?? d.mocNangBac)} (+${d.soThangKeoDai} thg)`
          : dmy(d.mocNangBac);

      ws.addRow([
        i + 1,
        d.maCanBo,
        d.hoTen,
        d.donVi,
        d.ngach.ma,
        `Bậc ${d.bacHienTai}`,
        d.heSoHienTai.toFixed(2),
        d.vuotKhungHienTai ? `${d.vuotKhungHienTai}%` : '0%',
        mocHienThi,
        phanLoai,
        dmy(d.ngayDenHan),
        `${d.vuotKhungMoi}%`,
      ]);
    });

    ws.eachRow((row, n) => {
      if (n < 4) return;
      row.eachCell({ includeEmpty: true }, (c) => {
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
    ws.getColumn(2).numFmt = '@';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    guiFile(res, buf, `DenHanVuotKhung_${iso(denNgay)}.xlsx`);
  }

  /** Xuất Bảng thanh toán tiền lương chuẩn theo mẫu của Trường. */
  @Get('bang-luong/xuat-excel')
  async xuatBangLuong(@CurrentUser() u: NguoiDung, @Res() res: Response) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', 'Bang_Luong_Thang_10_2026.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Chưa có file bảng lương tháng 10/2026');
    }

    try {
      const nam = 2026;
      const thang = 10;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      // Đồng bộ động Sheet 'Làm thêm giờ' theo CSDL chấm công hiện tại
      const { tongHopCong, soNgayTrongThang } = await import('../cham-cong/nghiep-vu-cong');
      const dauThang = new Date(Date.UTC(nam, thang - 1, 1));
      const cuoiThang = new Date(Date.UTC(nam, thang - 1, soNgayTrongThang(nam, thang)));

      const [leList, congList] = await Promise.all([
        this.prisma.ngayNghiLe.findMany({ where: { ngay: { gte: dauThang, lte: cuoiThang } } }),
        this.prisma.chamCong.findMany({
          where: { ngay: { gte: dauThang, lte: cuoiThang } },
          include: { nhanSu: { select: { id: true, hoTen: true, maCanBo: true, donVi: { select: { ten: true } }, chucVu: { select: { ten: true } } } } },
        }),
      ]);

      const leSet = new Set(leList.map((l) => l.ngay.getUTCDate()));
      const mapCong = new Map<string, Record<number, string>>();
      const mapMeta = new Map<string, any>();

      for (const c of congList) {
        const m = mapCong.get(c.nhanSuId) ?? {};
        m[c.ngay.getUTCDate()] = c.kyHieu;
        mapCong.set(c.nhanSuId, m);
        mapMeta.set(c.nhanSuId, c.nhanSu);
      }

      const dsLamThem: { meta: any; tong: any }[] = [];
      for (const [id, cong] of mapCong.entries()) {
        const t = tongHopCong(cong, nam, thang, leSet);
        if ((t.tongGioLamThem ?? 0) > 0) {
          dsLamThem.push({ meta: mapMeta.get(id), tong: t });
        }
      }

      const wsOt = wb.worksheets.find((w) => /th[êe]m/i.test(w.name)) || wb.getWorksheet('Làm thêm giờ');
      if (wsOt) {
        // Lấy thông tin lương từ Bảng Lương T10-2026
        const wsMain = wb.worksheets.find((w) => /b[ảa]ng\s+l[ươu]ng/i.test(w.name)) || wb.worksheets[0];
        const mapLuong = new Map<string, { hsLuong: number; hspc: number; chucVu: string }>();
        if (wsMain) {
          for (let r = 11; r <= wsMain.rowCount; r++) {
            const ten = wsMain.getCell(`D${r}`).value;
            if (ten && typeof ten === 'string' && ten.trim()) {
              const hsL = Number(wsMain.getCell(`F${r}`).value) || 0;
              const hspcCv = Number(wsMain.getCell(`G${r}`).value) || 0;
              const hspcVk = Number(wsMain.getCell(`H${r}`).value) || 0;
              const hspcTn = Number(wsMain.getCell(`K${r}`).value) || 0;
              mapLuong.set(ten.trim(), {
                hsLuong: hsL,
                hspc: hspcCv + hspcVk + hspcTn,
                chucVu: (wsMain.getCell(`E${r}`).value as string) || '',
              });
            }
          }
        }

        // Gỡ tất cả các merged cells từ dòng 11 trở đi để tránh xung đột ExcelJS
        const toUnmerge: string[] = [];
        for (const [key, val] of Object.entries((wsOt as any)._merges || {})) {
          const m = val as any;
          const top = m.model ? m.model.top : parseInt(key.match(/\d+/)?.[0] || '0', 10);
          if (top >= 11) {
            toUnmerge.push(`${m.tl}:${m.br}`);
          }
        }
        for (const rng of toUnmerge) {
          try { wsOt.unMergeCells(rng); } catch {}
        }

        // Xóa nội dung các dòng từ 11 đến cuối bảng cũ
        const maxR = Math.max(wsOt.rowCount, 35);
        for (let r = 11; r <= maxR; r++) {
          wsOt.getRow(r).values = [];
        }

        let rIdx = 11;
        if (dsLamThem.length === 0) {
          wsOt.mergeCells(`A${rIdx}:R${rIdx}`);
          const c = wsOt.getCell(`A${rIdx}`);
          c.value = 'Trong tháng không có cán bộ, nhân viên phát sinh làm thêm giờ.';
          c.font = { name: 'Times New Roman', size: 11, italic: true };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          wsOt.getRow(rIdx).height = 30;
          rIdx++;
        } else {
          dsLamThem.sort((a, b) => (a.meta.donVi?.ten || '').localeCompare(b.meta.donVi?.ten || ''));
          let stt = 0;
          for (const item of dsLamThem) {
            stt++;
            const m = item.meta;
            const t = item.tong;
            const sal = mapLuong.get(m.hoTen) || { hsLuong: 0, hspc: 0, chucVu: m.chucVu?.ten || '' };

            wsOt.getCell(rIdx, 1).value = stt;
            wsOt.getCell(rIdx, 2).value = m.maCanBo || '';
            wsOt.getCell(rIdx, 3).value = m.hoTen;
            wsOt.getCell(rIdx, 4).value = sal.chucVu || m.chucVu?.ten || '';
            wsOt.getCell(rIdx, 5).value = m.donVi?.ten || '';
            wsOt.getCell(rIdx, 6).value = sal.hsLuong;
            wsOt.getCell(rIdx, 7).value = sal.hspc;
            wsOt.getCell(rIdx, 8).value = { formula: `(F${rIdx}+G${rIdx})*2530000` };
            wsOt.getCell(rIdx, 9).value = { formula: `ROUND(H${rIdx}/176, 0)` };
            wsOt.getCell(rIdx, 10).value = t.gioLamThemNgayThuong || 0;
            wsOt.getCell(rIdx, 11).value = { formula: `ROUND(J${rIdx}*I${rIdx}*1.5, 0)` };
            wsOt.getCell(rIdx, 12).value = t.gioLamThemCuoiTuan || 0;
            wsOt.getCell(rIdx, 13).value = { formula: `ROUND(L${rIdx}*I${rIdx}*2, 0)` };
            wsOt.getCell(rIdx, 14).value = t.gioLamThemNgayLe || 0;
            wsOt.getCell(rIdx, 15).value = { formula: `ROUND(N${rIdx}*I${rIdx}*3, 0)` };
            wsOt.getCell(rIdx, 16).value = { formula: `J${rIdx}+L${rIdx}+N${rIdx}` };
            wsOt.getCell(rIdx, 17).value = { formula: `K${rIdx}+M${rIdx}+O${rIdx}` };
            wsOt.getCell(rIdx, 18).value = 'Chuyển khoản';

            wsOt.getRow(rIdx).height = 24;
            rIdx++;
          }
        }

        // Hàng tổng cộng
        const cuoi = rIdx - 1;
        wsOt.mergeCells(`A${rIdx}:E${rIdx}`);
        wsOt.getCell(`A${rIdx}`).value = 'Tổng cộng';
        wsOt.getCell(`A${rIdx}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`A${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

        ['H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach((col) => {
          const c = wsOt.getCell(`${col}${rIdx}`);
          c.value = dsLamThem.length ? { formula: `SUM(${col}11:${col}${cuoi})` } : 0;
          c.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: col === 'Q' ? 'FFB91C1C' : 'FF000000' } };
          c.alignment = { horizontal: 'right', vertical: 'middle' };
          c.numFmt = ['J', 'L', 'N', 'P'].includes(col) ? '#,##0.0' : '#,##0';
        });

        // Khung chữ ký
        const rSig = rIdx + 2;
        wsOt.mergeCells(`M${rSig}:R${rSig}`);
        wsOt.getCell(`M${rSig}`).value = `Hải Phòng, ngày 31 tháng ${thang} năm ${nam}`;
        wsOt.getCell(`M${rSig}`).font = { name: 'Times New Roman', size: 11, italic: true };
        wsOt.getCell(`M${rSig}`).alignment = { horizontal: 'center', vertical: 'middle' };

        const rTitle = rSig + 1;
        wsOt.mergeCells(`A${rTitle}:C${rTitle}`);
        wsOt.getCell(`A${rTitle}`).value = 'NGƯỜI LẬP BẢNG';
        wsOt.getCell(`A${rTitle}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`A${rTitle}`).alignment = { horizontal: 'center', vertical: 'middle' };

        wsOt.mergeCells(`D${rTitle}:G${rTitle}`);
        wsOt.getCell(`D${rTitle}`).value = 'KẾ TOÁN TRƯỞNG';
        wsOt.getCell(`D${rTitle}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`D${rTitle}`).alignment = { horizontal: 'center', vertical: 'middle' };

        wsOt.mergeCells(`H${rTitle}:L${rTitle}`);
        wsOt.getCell(`H${rTitle}`).value = 'TRƯỞNG PHÒNG TCHC';
        wsOt.getCell(`H${rTitle}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`H${rTitle}`).alignment = { horizontal: 'center', vertical: 'middle' };

        wsOt.mergeCells(`M${rTitle}:R${rTitle}`);
        wsOt.getCell(`M${rTitle}`).value = 'HIỆU TRƯỞNG';
        wsOt.getCell(`M${rTitle}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`M${rTitle}`).alignment = { horizontal: 'center', vertical: 'middle' };

        const rSub = rTitle + 1;
        wsOt.mergeCells(`A${rSub}:C${rSub}`); wsOt.getCell(`A${rSub}`).value = '(Ký, họ tên)'; wsOt.getCell(`A${rSub}`).font = { name: 'Times New Roman', size: 9.5, italic: true }; wsOt.getCell(`A${rSub}`).alignment = { horizontal: 'center' };
        wsOt.mergeCells(`D${rSub}:G${rSub}`); wsOt.getCell(`D${rSub}`).value = '(Ký, họ tên)'; wsOt.getCell(`D${rSub}`).font = { name: 'Times New Roman', size: 9.5, italic: true }; wsOt.getCell(`D${rSub}`).alignment = { horizontal: 'center' };
        wsOt.mergeCells(`H${rSub}:L${rSub}`); wsOt.getCell(`H${rSub}`).value = '(Ký, họ tên)'; wsOt.getCell(`H${rSub}`).font = { name: 'Times New Roman', size: 9.5, italic: true }; wsOt.getCell(`H${rSub}`).alignment = { horizontal: 'center' };
        wsOt.mergeCells(`M${rSub}:R${rSub}`); wsOt.getCell(`M${rSub}`).value = '(Ký, đóng dấu, họ tên)'; wsOt.getCell(`M${rSub}`).font = { name: 'Times New Roman', size: 9.5, italic: true }; wsOt.getCell(`M${rSub}`).alignment = { horizontal: 'center' };

        const rName = rSub + 4;
        wsOt.mergeCells(`M${rName}:R${rName}`);
        wsOt.getCell(`M${rName}`).value = 'Đỗ Văn Tuấn';
        wsOt.getCell(`M${rName}`).font = { name: 'Times New Roman', size: 11, bold: true };
        wsOt.getCell(`M${rName}`).alignment = { horizontal: 'center', vertical: 'middle' };

        const rNote = rName + 3;
        wsOt.getCell(`A${rNote}`).value = 'Ghi chú chế độ thanh toán làm thêm giờ:';
        wsOt.getCell(`A${rNote}`).font = { name: 'Times New Roman', size: 10, bold: true };
        wsOt.getCell(`A${rNote + 1}`).value = '1. Căn cứ Điều 98 Bộ luật Lao động 2019 và Thông tư liên tịch số 08/2005/TTLT-BNV-BTC ngày 05/01/2005.';
        wsOt.getCell(`A${rNote + 1}`).font = { name: 'Times New Roman', size: 9.5, italic: true };
        wsOt.getCell(`A${rNote + 2}`).value = '2. Tiền lương 1 giờ làm việc bình thường = (Tiền lương theo hệ số + PC chức vụ + PC vượt khung + PC thâm niên GV) / (22 ngày chuẩn × 8 giờ = 176 giờ).';
        wsOt.getCell(`A${rNote + 2}`).font = { name: 'Times New Roman', size: 9.5, italic: true };
        wsOt.getCell(`A${rNote + 3}`).value = '3. Mức thanh toán: Ngày thường = 150%; Ngày nghỉ hằng tuần (T7, CN) = 200%; Ngày nghỉ lễ, tết = 300% đơn giá tiền lương 1 giờ bình thường.';
        wsOt.getCell(`A${rNote + 3}`).font = { name: 'Times New Roman', size: 9.5, italic: true };
      }

      const bufOut = Buffer.from(await wb.xlsx.writeBuffer());
      guiFile(res, bufOut, 'Bang_Luong_Thang_10_2026.xlsx');
    } catch (err) {
      console.error('Lỗi khi đồng bộ Sheet Làm thêm giờ:', err);
      const buf = fs.readFileSync(filePath);
      guiFile(res, buf, 'Bang_Luong_Thang_10_2026.xlsx');
    }
  }

  @Get('luong/bang-luong/xuat-excel')
  async xuatBangLuongAlias(@CurrentUser() u: NguoiDung, @Res() res: Response) {
    return this.xuatBangLuong(u, res);
  }

  /** Xuất Bảng tổng hợp quỹ lương theo Quý và Năm. */
  @Get('bang-luong/xuat-excel-tong-hop')
  async xuatBangTongHop(@CurrentUser() u: NguoiDung, @Res() res: Response) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', 'Bang_Tong_Hop_Luong_Quy_Nam_2026.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Chưa có file bảng tổng hợp lương năm 2026');
    }
    const buf = fs.readFileSync(filePath);
    guiFile(res, buf, 'Bang_Tong_Hop_Luong_Quy_Nam_2026.xlsx');
  }

  @Get('luong/bang-luong/xuat-excel-tong-hop')
  async xuatBangTongHopAlias(@CurrentUser() u: NguoiDung, @Res() res: Response) {
    return this.xuatBangTongHop(u, res);
  }

  /** Lập quyết định nâng lương thường xuyên / vượt khung cho các cán bộ đã chọn. */
  @Roles(...QUYEN_SUA)
  @Post('nang-luong/lap-quyet-dinh')
  async lapQuyetDinh(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(lapQdSchema)) body: z.infer<typeof lapQdSchema>) {
    const ds = await this.denHan(u, congThang(new Date(), 12), undefined, body.nhanSuIds);
    const thieu = body.nhanSuIds.filter((id) => !ds.some((d) => d.nhanSuId === id));
    if (thieu.length) throw new BadRequestException(`${thieu.length} cán bộ không còn đủ điều kiện nâng lương hoặc ngoài phạm vi`);
    await this.prisma.$transaction(
      ds.map((d) => {
        let ghiChuMacDinh = 'Nâng bậc lương thường xuyên';
        if (d.loai === 'VUOT_KHUNG') {
          ghiChuMacDinh =
            d.phanLoaiVuotKhung === 'LAN_DAU'
              ? 'Hưởng phụ cấp thâm niên vượt khung 5% (sau 36 tháng giữ bậc cuối)'
              : `Nâng phụ cấp thâm niên vượt khung từ ${d.vuotKhungHienTai}% lên ${d.vuotKhungMoi}% (+1%)`;
        }
        return this.prisma.quaTrinhLuong.create({
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
            ghiChu: body.ghiChu ?? ghiChuMacDinh,
          },
        });
      }),
    );
    await this.audit.ghi(u, 'TAO', 'QuaTrinhLuong', null, `Lập QĐ nâng lương/vượt khung ${body.soQuyetDinh} cho ${ds.length} cán bộ`, {
      nhanSuIds: body.nhanSuIds,
    });
    return { soLuong: ds.length };
  }

  // ================================================================
  // NÂNG BẬC LƯƠNG TRƯỚC THỜI HẠN DO LẬP THÀNH TÍCH XUẤT SẮC
  // (Thông tư 08/2013/TT-BNV, Thông tư 03/2021/TT-BNV)
  // ================================================================

  /** Lấy danh sách viên chức xem xét nâng lương trước thời hạn do lập thành tích xuất sắc. */
  async danhSachTruocThoiHan(u: NguoiDung, nam: number, donViId?: string) {
    const mocXet = new Date(Date.UTC(nam, 11, 31, 23, 59, 59, 999));
    const tongVienChuc = await this.prisma.nhanSu.count({
      where: {
        AND: [
          await this.scope.nhanSuWhere(u),
          { trangThai: DANG_LAM },
          { loaiNhanSu: 'VIEN_CHUC' },
          donViId ? { donViId: { in: await this.scope.donViVaCon(donViId) } } : {},
        ],
      },
    });
    const chiTieu10PhanTram = Math.floor(tongVienChuc * 0.1);

    const ds = await this.prisma.nhanSu.findMany({
      where: {
        AND: [
          await this.scope.nhanSuWhere(u),
          { trangThai: DANG_LAM },
          { loaiNhanSu: 'VIEN_CHUC' },
          donViId ? { donViId: { in: await this.scope.donViVaCon(donViId) } } : {},
        ],
      },
      select: {
        id: true,
        maCanBo: true,
        hoTen: true,
        ten: true,
        donVi: { select: { ten: true } },
        chucVu: { select: { ten: true } },
        quaTrinhLuongs: {
          orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }],
          take: 2,
          include: { ngach: true },
        },
        donNghis: {
          where: { loai: 'KHONG_LUONG', trangThai: 'DA_DUYET' },
          select: { tuNgay: true, denNgay: true, loai: true, trangThai: true },
        },
      },
      orderBy: [{ ten: 'asc' }, { hoTen: 'asc' }],
    });

    const ungViens: UngVienNangLuongTruocThoiHan[] = [];
    for (const ns of ds) {
      const qtl = ns.quaTrinhLuongs[0];
      if (!qtl?.ngach || !qtl.bac || qtl.luongThoaThuan) continue;
      // Chưa xếp bậc lương cuối cùng trong ngạch/chức danh (Khoản 1 Điều 3 TT 08/2013)
      if (qtl.bac >= qtl.ngach.heSo.length) continue;

      const { soThang, lyDo } = tinhTongThangKeoDai(qtl.mocNangBac, ns.donNghis ?? []);
      const mocDieuChinh = soThang > 0 ? congThang(qtl.mocNangBac, soThang) : qtl.mocNangBac;
      const ngayDenHanThuongXuyen = congThang(qtl.mocNangBac, qtl.ngach.thangNangBac + soThang);

      const thangThieu =
        (ngayDenHanThuongXuyen.getUTCFullYear() - mocXet.getUTCFullYear()) * 12 +
        ngayDenHanThuongXuyen.getUTCMonth() -
        mocXet.getUTCMonth();

      if (thangThieu < 1 || thangThieu > 12) continue;

      const kiemTra2Lan = kiemTraNangTruocThoiHanLanTruoc(qtl, ns.quaTrinhLuongs[1], qtl.ngach);
      const bacMoi = qtl.bac + 1;
      const heSoMoi = qtl.ngach.heSo[qtl.bac];

      ungViens.push({
        nhanSuId: ns.id,
        maCanBo: ns.maCanBo,
        hoTen: ns.hoTen,
        donVi: ns.donVi.ten,
        chucVu: ns.chucVu?.ten,
        ngach: { id: qtl.ngach.id, ma: qtl.ngach.ma, ten: qtl.ngach.ten },
        bacHienTai: qtl.bac,
        heSoHienTai: qtl.heSo ?? 0,
        vuotKhungHienTai: qtl.phanTramVuotKhung,
        mocNangBac: iso(qtl.mocNangBac),
        mocNangBacDieuChinh: iso(mocDieuChinh),
        soThangKeoDai: soThang,
        lyDoKeoDai: lyDo,
        ngayDenHanThuongXuyen: iso(ngayDenHanThuongXuyen),
        soThangConThieu: thangThieu,
        bacMoi,
        heSoMoi,
        daNangTruocThoiHanLanTruoc: kiemTra2Lan.daNang,
        lyDoKhongDuDieuKien: kiemTra2Lan.lyDo,
        ngayHuong12Thang: iso(congThang(ngayDenHanThuongXuyen, -12)),
        ngayHuong9Thang: iso(congThang(ngayDenHanThuongXuyen, -9)),
        ngayHuong6Thang: iso(congThang(ngayDenHanThuongXuyen, -6)),
      });
    }

    return {
      nam,
      mocXet: iso(mocXet),
      tongVienChuc,
      chiTieu10PhanTram,
      danhSach: ungViens.sort((a, b) => a.soThangConThieu - b.soThangConThieu),
    };
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('nang-luong/truoc-thoi-han')
  async getTruocThoiHan(
    @CurrentUser() u: NguoiDung,
    @Query(new ZodPipe(truocThoiHanQuery)) q: z.infer<typeof truocThoiHanQuery>,
  ) {
    const nam = q.nam ?? new Date().getFullYear();
    return this.danhSachTruocThoiHan(u, nam, q.donViId);
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('nang-luong/truoc-thoi-han/xuat-excel')
  async xuatExcelTruocThoiHan(
    @CurrentUser() u: NguoiDung,
    @Query(new ZodPipe(truocThoiHanQuery)) q: z.infer<typeof truocThoiHanQuery>,
    @Res() res: Response,
  ) {
    const nam = q.nam ?? new Date().getFullYear();
    const kq = await this.danhSachTruocThoiHan(u, nam, q.donViId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Nang luong truoc thoi han');

    ws.mergeCells('A1:O1');
    ws.getCell('A1').value = `DANH SÁCH ĐỀ XUẤT XÉT NÂNG BẬC LƯƠNG TRƯỚC THỜI HẠN DO LẬP THÀNH TÍCH XUẤT SẮC NĂM ${nam}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:O2');
    ws.getCell('A2').value = `(Căn cứ Thông tư số 08/2013/TT-BNV và Thông tư số 03/2021/TT-BNV của Bộ Nội vụ - Tính đến ngày 31/12/${nam})`;
    ws.getCell('A2').font = { italic: true, size: 11 };
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getRow(2).height = 22;

    ws.mergeCells('A3:O3');
    ws.getCell('A3').value = `Tổng số viên chức hưởng lương theo ngạch bậc: ${kq.tongVienChuc} người  |  Chỉ tiêu tối đa 10%: ${kq.chiTieu10PhanTram} người`;
    ws.getCell('A3').font = { bold: true, size: 11, color: { argb: '0E7C86' } };
    ws.getCell('A3').alignment = { horizontal: 'center' };
    ws.getRow(3).height = 24;

    const tieuDe = [
      'STT',
      'Mã CB (CCCD)',
      'Họ và tên',
      'Đơn vị công tác',
      'Chức vụ',
      'Mã ngạch',
      'Bậc hiện tại',
      'Hệ số hiện tại',
      'Hạn thường xuyên',
      'Tháng thiếu (đến 31/12)',
      'Điều kiện 2 lần liên tiếp',
      'Ngày hưởng (rút 12 tháng)',
      'Ngày hưởng (rút 9 tháng)',
      'Ngày hưởng (rút 6 tháng)',
      'Bậc / Hệ số mới',
    ];
    ws.getRow(5).values = tieuDe;
    ws.getRow(5).font = { bold: true, color: { argb: 'FFFFFF' } };
    ws.getRow(5).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(5).height = 36;
    for (let c = 1; c <= tieuDe.length; c++) {
      ws.getCell(5, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0E7C86' },
      };
    }

    const rong = [6, 16, 26, 22, 18, 12, 11, 12, 14, 14, 20, 16, 16, 16, 16];
    rong.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const dmy = (s: string) => s.split('-').reverse().join('/');

    kq.danhSach.forEach((d, i) => {
      const dk2Lan = d.daNangTruocThoiHanLanTruoc
        ? 'Không đạt (lần trước đã nâng)'
        : 'Đạt điều kiện';
      const row = ws.addRow([
        i + 1,
        d.maCanBo,
        d.hoTen,
        d.donVi,
        d.chucVu || '',
        d.ngach.ma,
        d.bacHienTai,
        d.heSoHienTai.toFixed(2),
        dmy(d.ngayDenHanThuongXuyen),
        `${d.soThangConThieu} tháng`,
        dk2Lan,
        dmy(d.ngayHuong12Thang),
        dmy(d.ngayHuong9Thang),
        dmy(d.ngayHuong6Thang),
        `Bậc ${d.bacMoi} (${d.heSoMoi.toFixed(2)})`,
      ]);
      if (d.daNangTruocThoiHanLanTruoc) {
        row.getCell(11).font = { color: { argb: 'EF4444' }, bold: true };
      } else {
        row.getCell(11).font = { color: { argb: '16A34A' } };
      }
    });

    ws.eachRow((row, n) => {
      if (n < 5) return;
      row.eachCell({ includeEmpty: true }, (c) => {
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });
    ws.getColumn(2).numFmt = '@';
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    guiFile(res, buf, `XetNangLuongTruocThoiHan_${nam}.xlsx`);
  }

  /** Lập quyết định nâng bậc lương trước thời hạn do lập thành tích xuất sắc. */
  @Roles(...QUYEN_SUA)
  @Post('nang-luong/truoc-thoi-han/lap-quyet-dinh')
  async lapQdTruocThoiHan(
    @CurrentUser() u: NguoiDung,
    @Body(new ZodPipe(lapQdTruocThoiHanSchema)) body: z.infer<typeof lapQdTruocThoiHanSchema>,
  ) {
    const ids = body.danhSach.map((d) => d.nhanSuId);
    const nam = new Date(body.ngayQuyetDinh).getFullYear();
    const kq = await this.danhSachTruocThoiHan(u, nam);

    const mapUngVien = new Map(kq.danhSach.map((uv) => [uv.nhanSuId, uv]));
    const khongHopLe = body.danhSach.filter((item) => {
      const uv = mapUngVien.get(item.nhanSuId);
      return !uv || uv.daNangTruocThoiHanLanTruoc;
    });

    if (khongHopLe.length) {
      throw new BadRequestException(
        `${khongHopLe.length} cán bộ không đủ điều kiện xét nâng trước thời hạn (hoặc đã nâng trước hạn lần trước).`,
      );
    }

    await this.prisma.$transaction(
      body.danhSach.map((item) => {
        const uv = mapUngVien.get(item.nhanSuId)!;
        const ngayHuongMoiStr =
          item.soThangRutNgan === 12
            ? uv.ngayHuong12Thang
            : item.soThangRutNgan === 9
            ? uv.ngayHuong9Thang
            : uv.ngayHuong6Thang;
        const ngayHuongMoi = new Date(`${ngayHuongMoiStr}T00:00:00.000Z`);

        const lyDo = item.lyDoKhenThuong ? ` (${item.lyDoKhenThuong})` : '';
        const ghiChu = `Nâng bậc lương trước thời hạn ${item.soThangRutNgan} tháng do lập thành tích xuất sắc${lyDo}. ${body.ghiChu ?? ''}`.trim();

        return this.prisma.quaTrinhLuong.create({
          data: {
            nhanSuId: uv.nhanSuId,
            tuNgay: ngayHuongMoi,
            mocNangBac: ngayHuongMoi,
            ngachId: uv.ngach.id,
            bac: uv.bacMoi,
            heSo: uv.heSoMoi,
            phanTramVuotKhung: 0,
            soQuyetDinh: body.soQuyetDinh,
            ngayQuyetDinh: body.ngayQuyetDinh,
            ghiChu,
          },
        });
      }),
    );

    await this.audit.ghi(
      u,
      'TAO',
      'QuaTrinhLuong',
      null,
      `Lập QĐ nâng lương trước thời hạn ${body.soQuyetDinh} cho ${body.danhSach.length} cán bộ`,
      { nhanSuIds: ids },
    );

    return { soLuong: body.danhSach.length };
  }

  // ---------------------------------------------------------------- Hợp đồng sắp hết hạn
  @Roles(...QUYEN_XEM_DS)
  @Get('hop-dong/sap-het-han')
  async hopDongSapHetHan(@CurrentUser() u: NguoiDung, @Query('soNgay') soNgay?: string) {
    const n = Math.min(Math.max(Number(soNgay) || 60, 1), 365);
    const den = new Date(Date.now() + n * 86_400_000);
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
