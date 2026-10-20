import {
  BadRequestException,
  Body,
  Controller,
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
import { AuditService } from '../common/audit.service';
import { CurrentUser, NguoiDung, QUYEN_SUA, QUYEN_XEM_DS, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ngay, ngayOpt, txt, ZodPipe } from '../common/zod';
import { iso } from '../luong/nghiep-vu-luong';

// Va loi OpenXML schema cua ExcelJS (outlinePr bat buoc dung truoc pageSetUpPr trong sheetPr)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SheetPropertiesXform = require('exceljs/lib/xlsx/xform/sheet/sheet-properties-xform');
  if (SheetPropertiesXform?.prototype) {
    SheetPropertiesXform.prototype.render = function (xmlStream: any, model: any) {
      if (model) {
        xmlStream.addRollback();
        xmlStream.openNode('sheetPr');

        let inner = false;
        inner = this.map.tabColor.render(xmlStream, model.tabColor) || inner;
        inner = this.map.outlinePr.render(xmlStream, model.outlineProperties) || inner;
        inner = this.map.pageSetUpPr.render(xmlStream, model.pageSetup) || inner;

        if (inner) {
          xmlStream.closeNode();
          xmlStream.commit();
        } else {
          xmlStream.rollback();
        }
      }
    };
  }
} catch {}

function guiFile(res: Response, buf: Buffer, ten: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ten)}`);
  res.send(buf);
}

export type TinhTrangBoNhiem = 'QUA_HAN' | 'DEN_HAN_90_NGAY' | 'SAP_DEN_HAN_180_NGAY' | 'BINH_THUONG' | 'CHUA_CO_NGAY';

export function tinhNhiemKyBoNhiem(
  ngayBoNhiem: Date | string | null | undefined,
  ngayHetHan: Date | string | null | undefined,
  now = new Date(),
) {
  if (!ngayBoNhiem) {
    return {
      tinhTrang: 'CHUA_CO_NGAY' as TinhTrangBoNhiem,
      ngayHetHan: null,
      ngayBatDauQuyTrinh: null,
      soNgayConLaiNhiemKy: null,
      soNgayConLaiDenMoc90: null,
      moTa: 'Chưa cập nhật ngày bổ nhiệm',
    };
  }

  const dBoNhiem = new Date(ngayBoNhiem);
  let dHetHan: Date;
  if (ngayHetHan) {
    dHetHan = new Date(ngayHetHan);
  } else {
    dHetHan = new Date(dBoNhiem);
    dHetHan.setFullYear(dHetHan.getFullYear() + 5);
  }

  // Mốc bắt đầu làm quy trình: 90 ngày trước ngày hết hạn
  const dMoc90 = new Date(dHetHan);
  dMoc90.setDate(dMoc90.getDate() - 90);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const dNow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dHetHanUtc = new Date(Date.UTC(dHetHan.getFullYear(), dHetHan.getMonth(), dHetHan.getDate()));
  const dMoc90Utc = new Date(Date.UTC(dMoc90.getFullYear(), dMoc90.getMonth(), dMoc90.getDate()));

  const soNgayConLaiNhiemKy = Math.round((dHetHanUtc.getTime() - dNow.getTime()) / MS_PER_DAY);
  const soNgayConLaiDenMoc90 = Math.round((dMoc90Utc.getTime() - dNow.getTime()) / MS_PER_DAY);

  let tinhTrang: TinhTrangBoNhiem = 'BINH_THUONG';
  let moTa = '';

  if (soNgayConLaiNhiemKy < 0) {
    tinhTrang = 'QUA_HAN';
    moTa = `Đã quá hạn ${Math.abs(soNgayConLaiNhiemKy)} ngày`;
  } else if (soNgayConLaiNhiemKy <= 90) {
    tinhTrang = 'DEN_HAN_90_NGAY';
    moTa = `Đến hạn làm quy trình (còn ${soNgayConLaiNhiemKy} ngày hết nhiệm kỳ)`;
  } else if (soNgayConLaiNhiemKy <= 180) {
    tinhTrang = 'SAP_DEN_HAN_180_NGAY';
    moTa = `Còn ${soNgayConLaiDenMoc90} ngày đến mốc 90 ngày (còn ${soNgayConLaiNhiemKy} ngày hết nhiệm kỳ)`;
  } else {
    tinhTrang = 'BINH_THUONG';
    const nam = Math.floor(soNgayConLaiNhiemKy / 365);
    const thang = Math.floor((soNgayConLaiNhiemKy % 365) / 30);
    moTa = `Còn ${nam > 0 ? `${nam} năm ` : ''}${thang} tháng`;
  }

  return {
    tinhTrang,
    ngayHetHan: dHetHan,
    ngayBatDauQuyTrinh: dMoc90,
    soNgayConLaiNhiemKy,
    soNgayConLaiDenMoc90,
    moTa,
  };
}

const lapQdBoNhiemSchema = z.object({
  nhanSuId: z.string().uuid(),
  soQuyetDinh: z.string().trim().min(1, 'Nhập số quyết định').max(100),
  ngayQuyetDinh: ngay,
  ngayHieuLuc: ngay,
  thoiHanNam: z.coerce.number().int().min(1).max(10).default(5),
  loaiQuyetDinh: z.enum(['BO_NHIEM_LAN_DAU', 'BO_NHIEM_LAI', 'KEO_DAI', 'THOI_GIU_CHUC_VU']).default('BO_NHIEM_LAI'),
  chucVuId: z.string().uuid().optional(),
  chucVu: z.string().trim().max(100).optional(),
  donVi: z.string().trim().max(200).optional(),
  nguoiKy: txt(100),
  ghiChu: txt(500),
});
type LapQdBoNhiemInput = z.infer<typeof lapQdBoNhiemSchema>;

const capNhatNhanhSchema = z.object({
  ngayBoNhiem: ngayOpt,
  soQdBoNhiem: z.string().trim().max(100).nullable().optional(),
  thoiHanNam: z.coerce.number().int().min(1).max(10).default(5),
});

@Controller('bo-nhiem')
export class BoNhiemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Lấy danh sách cán bộ quản lý kèm trạng thái bổ nhiệm lại */
  @Roles(...QUYEN_XEM_DS)
  @Get('can-bo-quan-ly')
  async danhSach(
    @CurrentUser() u: NguoiDung,
    @Query('q') q?: string,
    @Query('donViId') donViId?: string,
    @Query('chucVuId') chucVuId?: string,
    @Query('capQuanLy') capQuanLyStr?: string,
    @Query('tinhTrang') tinhTrang?: string,
  ) {
    const scopeWhere = await this.scope.nhanSuWhere(u);
    const capQuanLy = capQuanLyStr ? parseInt(capQuanLyStr, 10) : undefined;

    const where: any = {
      AND: [
        scopeWhere,
        {
          trangThai: 'DANG_LAM_VIEC',
          chucVu: {
            laQuanLy: true,
            ...(capQuanLy !== undefined && !isNaN(capQuanLy) ? { capQuanLy } : {}),
          },
          ...(donViId ? { donViId } : {}),
          ...(chucVuId ? { chucVuId } : {}),
        },
      ],
    };

    if (q && q.trim()) {
      const qTrim = q.trim();
      where.AND.push({
        OR: [
          { hoTen: { contains: qTrim, mode: 'insensitive' } },
          { maCanBo: { contains: qTrim, mode: 'insensitive' } },
        ],
      });
    }

    const dsNhanSu = await this.prisma.nhanSu.findMany({
      where,
      include: {
        donVi: { select: { id: true, ten: true, ma: true, coSo: { select: { id: true, ten: true } } } },
        chucVu: { select: { id: true, ten: true, thuTu: true, laQuanLy: true, capQuanLy: true } },
        _count: { select: { quaTrinhBoNhiems: true } },
      },
      orderBy: [
        { chucVu: { capQuanLy: 'asc' } },
        { chucVu: { thuTu: 'asc' } },
        { donVi: { ten: 'asc' } },
        { ten: 'asc' },
      ],
    });

    const now = new Date();
    const ketQua = dsNhanSu.map((ns) => {
      const tinhToan = tinhNhiemKyBoNhiem(ns.ngayBoNhiem, ns.ngayHetHanBoNhiem, now);
      return {
        id: ns.id,
        maCanBo: ns.maCanBo,
        hoTen: ns.hoTen,
        ten: ns.ten,
        gioiTinh: ns.gioiTinh,
        ngaySinh: ns.ngaySinh,
        dienThoai: ns.dienThoai,
        email: ns.email,
        anhDaiDien: ns.anhDaiDien,
        donVi: ns.donVi,
        chucVu: ns.chucVu,
        ngayBoNhiem: ns.ngayBoNhiem,
        ngayHetHanBoNhiem: ns.ngayHetHanBoNhiem,
        soQdBoNhiem: ns.soQdBoNhiem,
        lanBoNhiem: ns.lanBoNhiem,
        soLanBoNhiemLuu: ns._count.quaTrinhBoNhiems,
        ...tinhToan,
      };
    });

    if (tinhTrang && tinhTrang !== 'TAT_CA') {
      return ketQua.filter((item) => item.tinhTrang === tinhTrang);
    }

    return ketQua;
  }

  /** Lấy danh sách cán bộ đến hạn làm quy trình (≤ 90 ngày) hoặc đã quá hạn */
  @Roles(...QUYEN_XEM_DS)
  @Get('den-han')
  async danhSachDenHan(@CurrentUser() u: NguoiDung) {
    const ds = await this.danhSach(u);
    const denHan = ds.filter((x) => x.tinhTrang === 'QUA_HAN' || x.tinhTrang === 'DEN_HAN_90_NGAY');
    denHan.sort((a, b) => (a.soNgayConLaiNhiemKy ?? 9999) - (b.soNgayConLaiNhiemKy ?? 9999));
    return denHan;
  }

  /** Thống kê cán bộ quản lý và tình trạng bổ nhiệm */
  @Roles(...QUYEN_XEM_DS)
  @Get('thong-ke')
  async thongKe(@CurrentUser() u: NguoiDung) {
    const ds = await this.danhSach(u);
    const tongSo = ds.length;
    const quaHan = ds.filter((x) => x.tinhTrang === 'QUA_HAN').length;
    const denHan90Ngay = ds.filter((x) => x.tinhTrang === 'DEN_HAN_90_NGAY').length;
    const sapDenHan180Ngay = ds.filter((x) => x.tinhTrang === 'SAP_DEN_HAN_180_NGAY').length;
    const binhThuong = ds.filter((x) => x.tinhTrang === 'BINH_THUONG').length;
    const chuaCoNgay = ds.filter((x) => x.tinhTrang === 'CHUA_CO_NGAY').length;

    const theoCap = {
      banGiamHieu: ds.filter((x) => x.chucVu?.capQuanLy === 1).length,
      truongPhoKhoaPhong: ds.filter((x) => x.chucVu?.capQuanLy === 2).length,
      toTruongPho: ds.filter((x) => x.chucVu?.capQuanLy === 3).length,
    };

    return {
      tongSo,
      quaHan,
      denHan90Ngay,
      sapDenHan180Ngay,
      binhThuong,
      chuaCoNgay,
      theoCap,
    };
  }

  /** Lập quyết định bổ nhiệm lại / bổ nhiệm mới / kéo dài nhiệm kỳ */
  @Roles(...QUYEN_SUA)
  @Post('lap-quyet-dinh')
  async lapQuyetDinh(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(lapQdBoNhiemSchema)) body: LapQdBoNhiemInput) {
    await this.scope.kiemTraSua(u, body.nhanSuId);
    const ns = await this.prisma.nhanSu.findUniqueOrThrow({
      where: { id: body.nhanSuId },
      include: { chucVu: true, donVi: true },
    });

    const ngayHieuLuc = new Date(body.ngayHieuLuc);
    const ngayHetHan = new Date(ngayHieuLuc);
    ngayHetHan.setFullYear(ngayHetHan.getFullYear() + body.thoiHanNam);

    const tenChucVu = body.chucVu || (body.chucVuId ? (await this.prisma.chucVu.findUnique({ where: { id: body.chucVuId } }))?.ten : ns.chucVu?.ten) || 'Cán bộ quản lý';
    const tenDonVi = body.donVi || ns.donVi?.ten || '';

    // Tạo bản ghi trong QuaTrinhBoNhiem
    const qd = await this.prisma.quaTrinhBoNhiem.create({
      data: {
        nhanSuId: body.nhanSuId,
        soQuyetDinh: body.soQuyetDinh,
        ngayQuyetDinh: new Date(body.ngayQuyetDinh),
        ngayHieuLuc,
        ngayHetHan,
        thoiHanNam: body.thoiHanNam,
        loaiQuyetDinh: body.loaiQuyetDinh,
        chucVu: tenChucVu,
        donVi: tenDonVi,
        nguoiKy: body.nguoiKy,
        ghiChu: body.ghiChu,
      },
    });

    // Cập nhật trên hồ sơ Nhân sự
    const dataCapNhat: any = {
      ngayBoNhiem: ngayHieuLuc,
      ngayHetHanBoNhiem: ngayHetHan,
      soQdBoNhiem: body.soQuyetDinh,
      lanBoNhiem: (ns.lanBoNhiem || 1) + 1,
    };
    if (body.chucVuId) {
      dataCapNhat.chucVuId = body.chucVuId;
    }

    await this.prisma.nhanSu.update({
      where: { id: body.nhanSuId },
      data: dataCapNhat,
    });

    // Thêm vào Quá trình công tác để đồng bộ hồ sơ
    await this.prisma.quaTrinhCongTac.create({
      data: {
        nhanSuId: body.nhanSuId,
        tuNgay: ngayHieuLuc,
        denNgay: ngayHetHan,
        chucVu: tenChucVu,
        noiCongTac: tenDonVi,
        soQuyetDinh: body.soQuyetDinh,
        ghiChu: `Quyết định ${body.loaiQuyetDinh === 'BO_NHIEM_LAI' ? 'bổ nhiệm lại' : 'bổ nhiệm'} thời hạn ${body.thoiHanNam} năm`,
      },
    });

    await this.audit.ghi(
      u,
      'TAO',
      'QuaTrinhBoNhiem',
      qd.id,
      `Lập quyết định bổ nhiệm cho ${ns.hoTen} (${tenChucVu}) - Số QĐ: ${body.soQuyetDinh}`,
    );

    return { ok: true, id: qd.id };
  }

  /** Cập nhật nhanh ngày bổ nhiệm / số QĐ trực tiếp trên hồ sơ nhân sự */
  @Roles(...QUYEN_SUA)
  @Patch(':nhanSuId/cap-nhat-nhanh')
  async capNhatNhanh(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Body(new ZodPipe(capNhatNhanhSchema)) body: z.infer<typeof capNhatNhanhSchema>,
  ) {
    await this.scope.kiemTraSua(u, nhanSuId);
    const ns = await this.prisma.nhanSu.findUniqueOrThrow({ where: { id: nhanSuId } });

    let ngayHetHan: Date | null = null;
    if (body.ngayBoNhiem) {
      const d = new Date(body.ngayBoNhiem);
      ngayHetHan = new Date(d);
      ngayHetHan.setFullYear(ngayHetHan.getFullYear() + (body.thoiHanNam || 5));
    }

    const updated = await this.prisma.nhanSu.update({
      where: { id: nhanSuId },
      data: {
        ngayBoNhiem: body.ngayBoNhiem ? new Date(body.ngayBoNhiem) : null,
        ngayHetHanBoNhiem: ngayHetHan,
        soQdBoNhiem: body.soQdBoNhiem,
      },
    });

    await this.audit.ghi(
      u,
      'SUA',
      'NhanSu',
      nhanSuId,
      `Cập nhật thông tin bổ nhiệm của ${ns.hoTen}: Ngày ${body.ngayBoNhiem ? iso(new Date(body.ngayBoNhiem)) : 'trống'}, Số QĐ: ${body.soQdBoNhiem || 'trống'}`,
    );

    return { ok: true, nhanSu: updated };
  }

  /** Lịch sử các lần bổ nhiệm của một cán bộ */
  @Roles(...QUYEN_XEM_DS)
  @Get(':nhanSuId/lich-su')
  async lichSu(@CurrentUser() u: NguoiDung, @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string) {
    await this.scope.kiemTraXem(u, nhanSuId);
    return this.prisma.quaTrinhBoNhiem.findMany({
      where: { nhanSuId },
      orderBy: { ngayHieuLuc: 'desc' },
    });
  }

  /** Xuất Excel danh sách cán bộ quản lý và cảnh báo bổ nhiệm lại */
  @Roles(...QUYEN_XEM_DS)
  @Get('xuat-excel')
  async xuatExcel(
    @CurrentUser() u: NguoiDung,
    @Res() res: Response,
    @Query('donViId') donViId?: string,
    @Query('chucVuId') chucVuId?: string,
    @Query('tinhTrang') tinhTrang?: string,
  ) {
    const ds = await this.danhSach(u, undefined, donViId, chucVuId, undefined, tinhTrang);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hệ thống QLNS - Trường CĐ Hàng hải và Đường thủy I';

    const ws = wb.addWorksheet('Cán bộ quản lý', {
      views: [{ state: 'frozen', ySplit: 7 }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // Tiêu đề
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VIỆT NAM';
    ws.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = 'TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I';
    ws.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true, underline: true };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.mergeCells('A4:J4');
    ws.getCell('A4').value = 'DANH SÁCH CÁN BỘ QUẢN LÝ VÀ THEO DÕI THỜI HẠN BỔ NHIỆM LẠI';
    ws.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    ws.getCell('A4').alignment = { horizontal: 'center' };

    ws.mergeCells('A5:J5');
    ws.getCell('A5').value = `(Căn cứ Điều 41 & Điều 50 Nghị định 115/2020/NĐ-CP - Thời hạn bổ nhiệm 05 năm, cảnh báo trước 90 ngày) - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    ws.getCell('A5').font = { name: 'Times New Roman', size: 10, italic: true };
    ws.getCell('A5').alignment = { horizontal: 'center' };

    // Header bảng
    const headers = [
      'STT',
      'Mã CB (CCCD)',
      'Họ và tên',
      'Chức vụ',
      'Đơn vị / Bộ phận',
      'Số quyết định',
      'Ngày bổ nhiệm',
      'Ngày hết hạn (5 năm)',
      'Mốc quy trình (-90 ngày)',
      'Tình trạng nhiệm kỳ',
    ];

    ws.getRow(7).values = headers;
    ws.getRow(7).height = 28;
    ws.getRow(7).font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(7).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    for (let c = 1; c <= headers.length; c++) {
      const cell = ws.getCell(7, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    // Set widths
    const widths = [6, 16, 24, 20, 26, 18, 14, 16, 18, 28];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    let rIdx = 8;
    let stt = 0;
    for (const item of ds) {
      stt++;
      const row = ws.getRow(rIdx);
      row.values = [
        stt,
        item.maCanBo,
        item.hoTen,
        item.chucVu?.ten || '',
        item.donVi?.ten || '',
        item.soQdBoNhiem || '-',
        item.ngayBoNhiem ? new Date(item.ngayBoNhiem).toLocaleDateString('vi-VN') : '-',
        item.ngayHetHan ? new Date(item.ngayHetHan).toLocaleDateString('vi-VN') : '-',
        item.ngayBatDauQuyTrinh ? new Date(item.ngayBatDauQuyTrinh).toLocaleDateString('vi-VN') : '-',
        item.moTa,
      ];

      row.height = 22;
      row.font = { name: 'Times New Roman', size: 10 };
      row.alignment = { vertical: 'middle' };

      // Căn lề
      ws.getCell(rIdx, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rIdx, 2).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rIdx, 6).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rIdx, 7).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rIdx, 8).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rIdx, 9).alignment = { horizontal: 'center', vertical: 'middle' };

      // Màu sắc theo tình trạng
      const cellStatus = ws.getCell(rIdx, 10);
      if (item.tinhTrang === 'QUA_HAN') {
        cellStatus.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        cellStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else if (item.tinhTrang === 'DEN_HAN_90_NGAY') {
        cellStatus.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFD97706' } };
        cellStatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else if (item.tinhTrang === 'BINH_THUONG') {
        cellStatus.font = { name: 'Times New Roman', size: 10, color: { argb: 'FF059669' } };
      }

      // Border
      for (let c = 1; c <= headers.length; c++) {
        ws.getCell(rIdx, c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
      rIdx++;
    }

    // Khung chữ ký
    const rSig = rIdx + 2;
    ws.mergeCells(`H${rSig}:J${rSig}`);
    ws.getCell(`H${rSig}`).value = `Hải Phòng, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;
    ws.getCell(`H${rSig}`).font = { name: 'Times New Roman', size: 10, italic: true };
    ws.getCell(`H${rSig}`).alignment = { horizontal: 'center' };

    const rTitle = rSig + 1;
    ws.mergeCells(`A${rTitle}:C${rTitle}`);
    ws.getCell(`A${rTitle}`).value = 'NGƯỜI LẬP BẢNG';
    ws.getCell(`A${rTitle}`).font = { name: 'Times New Roman', size: 10, bold: true };
    ws.getCell(`A${rTitle}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`D${rTitle}:G${rTitle}`);
    ws.getCell(`D${rTitle}`).value = 'TRƯỞNG PHÒNG TCHC';
    ws.getCell(`D${rTitle}`).font = { name: 'Times New Roman', size: 10, bold: true };
    ws.getCell(`D${rTitle}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`H${rTitle}:J${rTitle}`);
    ws.getCell(`H${rTitle}`).value = 'HIỆU TRƯỞNG';
    ws.getCell(`H${rTitle}`).font = { name: 'Times New Roman', size: 10, bold: true };
    ws.getCell(`H${rTitle}`).alignment = { horizontal: 'center' };

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    guiFile(res, buf, 'Danh_Sach_Can_Bo_Quan_Ly_Bo_Nhiem_Lai.xlsx');
  }
}
