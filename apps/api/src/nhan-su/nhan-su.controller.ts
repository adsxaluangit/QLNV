import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ZodTypeAny } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService, khacBiet } from '../common/audit.service';
import { CurrentUser, NguoiDung, QUYEN_SUA, QUYEN_XEM_DS, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ZodPipe } from '../common/zod';
import { ExcelService } from './excel.service';
import {
  danhSachQuerySchema,
  DanhSachQuery,
  giaDinhSchema,
  hopDongSchema,
  nhanSuSchema,
  NhanSuInput,
  phuCapSchema,
  quaTrinhLuongSchema,
  quaTrinhSchema,
  vanBangSchema,
} from './nhan-su.schema';
import { NhanSuService } from './nhan-su.service';

function guiFile(res: Response, buf: Buffer, ten: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(ten)}`);
  res.send(buf);
}

const ngayHomNay = () => new Date().toISOString().slice(0, 10);

@Controller('nhan-su')
export class NhanSuController {
  constructor(private readonly svc: NhanSuService, private readonly excel: ExcelService) {}

  @Roles(...QUYEN_XEM_DS)
  @Get()
  danhSach(@CurrentUser() u: NguoiDung, @Query(new ZodPipe(danhSachQuerySchema)) q: DanhSachQuery) {
    return this.svc.danhSach(u, q);
  }

  @Roles(...QUYEN_XEM_DS)
  @Get('xuat-excel')
  async xuat(
    @CurrentUser() u: NguoiDung,
    @Query(new ZodPipe(danhSachQuerySchema)) q: DanhSachQuery,
    @Res() res: Response,
  ) {
    guiFile(res, await this.excel.xuat(u, q), `DanhSachNhanSu_${ngayHomNay()}.xlsx`);
  }

  @Roles(...QUYEN_SUA)
  @Get('mau-nhap')
  async mau(@Res() res: Response) {
    guiFile(res, await this.excel.mauNhap(), 'MauNhapNhanSu.xlsx');
  }

  @Roles(...QUYEN_SUA)
  @Post('nhap-excel')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  nhap(
    @CurrentUser() u: NguoiDung,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('kiemTra') kiemTra: string | undefined,
    @Ip() ip: string,
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file');
    return this.excel.nhap(u, file.buffer, kiemTra === '1' || kiemTra === 'true', ip);
  }

  @Get(':id')
  chiTiet(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.chiTiet(u, id);
  }

  @Roles(...QUYEN_SUA)
  @Post()
  tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(nhanSuSchema)) body: NhanSuInput, @Ip() ip: string) {
    return this.svc.tao(u, body, ip);
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(nhanSuSchema)) body: NhanSuInput,
    @Ip() ip: string,
  ) {
    return this.svc.sua(u, id, body, ip);
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.svc.xoa(u, id, ip);
  }
}

// ---------------------------------------------------------------- Hồ sơ con

interface CauHinhCon {
  model: 'quaTrinhCongTac' | 'vanBang' | 'quanHeGiaDinh' | 'quaTrinhLuong' | 'phuCap' | 'hopDong';
  schema: ZodTypeAny;
  orderBy: object | object[];
  ten: string;
  include?: object;
}

const CON: Record<string, CauHinhCon> = {
  'qua-trinh-cong-tac': { model: 'quaTrinhCongTac', schema: quaTrinhSchema, orderBy: { tuNgay: 'desc' }, ten: 'quá trình công tác' },
  'van-bang': {
    model: 'vanBang',
    schema: vanBangSchema,
    orderBy: [{ loai: 'asc' }, { ngayCap: 'desc' }],
    ten: 'văn bằng/chứng chỉ',
  },
  'gia-dinh': { model: 'quanHeGiaDinh', schema: giaDinhSchema, orderBy: { createdAt: 'asc' }, ten: 'quan hệ gia đình' },
  'qua-trinh-luong': {
    model: 'quaTrinhLuong',
    schema: quaTrinhLuongSchema,
    orderBy: [{ tuNgay: 'desc' }, { createdAt: 'desc' }],
    ten: 'quá trình lương',
    include: { ngach: { select: { id: true, ma: true, ten: true, nhom: true } } },
  },
  'phu-cap': { model: 'phuCap', schema: phuCapSchema, orderBy: [{ loai: 'asc' }, { tuNgay: 'desc' }], ten: 'phụ cấp' },
  'hop-dong': { model: 'hopDong', schema: hopDongSchema, orderBy: { tuNgay: 'desc' }, ten: 'hợp đồng' },
};

/**
 * CRUD chung cho các bảng con của hồ sơ:
 * /nhan-su/:id/qua-trinh-cong-tac | van-bang | gia-dinh | qua-trinh-luong | phu-cap | hop-dong
 */
@Controller('nhan-su/:id/:loai')
export class HoSoConController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  private cauHinh(loai: string) {
    const c = CON[loai];
    if (!c) throw new NotFoundException();
    // Các model có cùng dạng API (findMany/create/update/delete) — dùng delegate động
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (this.prisma as any)[c.model];
    return { ...c, delegate };
  }

  private async parse(c: CauHinhCon, body: unknown) {
    const data = new ZodPipe(c.schema).transform(body) as Record<string, unknown>;
    if (c.model === 'quaTrinhLuong' && data.ngachId) {
      const ngach = await this.prisma.ngachLuong.findUnique({ where: { id: data.ngachId as string } });
      if (!ngach) throw new BadRequestException('Ngạch không tồn tại');
      const bac = data.bac as number;
      if (bac > ngach.heSo.length) {
        throw new BadRequestException({
          message: `Ngạch ${ngach.ma} chỉ có ${ngach.heSo.length} bậc`,
          loi: [{ truong: 'bac', loi: `Tối đa bậc ${ngach.heSo.length}` }],
        });
      }
      // Hệ số lấy theo bảng nếu không nhập tay (bảo lưu hệ số cũ thì nhập tay)
      if (data.heSo === null) data.heSo = ngach.heSo[bac - 1];
    }
    return data;
  }

  @Get()
  async danhSach(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Param('loai') loai: string) {
    const c = this.cauHinh(loai);
    await this.scope.kiemTraXem(u, id);
    return c.delegate.findMany({ where: { nhanSuId: id }, orderBy: c.orderBy, include: c.include });
  }

  @Post()
  async tao(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loai') loai: string,
    @Body() body: unknown,
  ) {
    const c = this.cauHinh(loai);
    await this.scope.kiemTraSua(u, id);
    const ban = await c.delegate.create({ data: { ...(await this.parse(c, body)), nhanSuId: id } });
    await this.audit.ghi(u, 'TAO', c.model, ban.id, `Thêm ${c.ten}`, { nhanSuId: id });
    return ban;
  }

  @Patch(':subId')
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loai') loai: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Body() body: unknown,
  ) {
    const c = this.cauHinh(loai);
    await this.scope.kiemTraSua(u, id);
    const cu = await c.delegate.findFirst({ where: { id: subId, nhanSuId: id } });
    if (!cu) throw new NotFoundException();
    const moi = await c.delegate.update({ where: { id: subId }, data: await this.parse(c, body) });
    await this.audit.ghi(u, 'SUA', c.model, subId, `Sửa ${c.ten}`, { nhanSuId: id, ...khacBiet(cu, moi) });
    return moi;
  }

  @Delete(':subId')
  async xoa(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loai') loai: string,
    @Param('subId', ParseUUIDPipe) subId: string,
  ) {
    const c = this.cauHinh(loai);
    await this.scope.kiemTraSua(u, id);
    const cu = await c.delegate.findFirst({ where: { id: subId, nhanSuId: id } });
    if (!cu) throw new NotFoundException();
    await c.delegate.delete({ where: { id: subId } });
    await this.audit.ghi(u, 'XOA', c.model, subId, `Xóa ${c.ten}`, cu);
    return { ok: true };
  }
}
