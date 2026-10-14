import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Prisma, VaiTro } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { CurrentUser, NguoiDung, Roles } from '../common/auth.decorators';
import { NHAN_VAI_TRO } from '../common/nghiep-vu';
import { txt, uuidOpt, ZodPipe } from '../common/zod';
import { xuLyTrung } from '../to-chuc/to-chuc.controller';

/** Mật khẩu ban đầu mặc định của tài khoản mới (bắt buộc đổi ở lần đăng nhập đầu tiên). */
export const MAT_KHAU_MAC_DINH = '123456@';

/** Mật khẩu tạm 10 ký tự, luôn có chữ hoa, chữ thường và số; bỏ ký tự dễ nhầm. */
export function matKhauTam(): string {
  const nhom = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789'];
  const all = nhom.join('');
  const kt = nhom.map((n) => n[randomInt(n.length)]);
  while (kt.length < 10) kt.push(all[randomInt(all.length)]);
  for (let i = kt.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [kt[i], kt[j]] = [kt[j], kt[i]];
  }
  return kt.join('');
}

const taoSchema = z
  .object({
    nhanSuId: uuidOpt,
    tenDangNhap: txt(50),
    tenHienThi: txt(100),
    vaiTro: z.nativeEnum(VaiTro),
    phamViCoSoId: uuidOpt,
    phamViDonViId: uuidOpt,
  })
  .refine((d) => d.nhanSuId || d.tenDangNhap, { path: ['tenDangNhap'], message: 'Chọn cán bộ hoặc nhập tên đăng nhập' });

const suaSchema = z.object({
  vaiTro: z.nativeEnum(VaiTro),
  phamViCoSoId: uuidOpt,
  phamViDonViId: uuidOpt,
  hoatDong: z.boolean(),
  tenHienThi: txt(100),
});

const CHON = {
  id: true,
  tenDangNhap: true,
  tenHienThi: true,
  vaiTro: true,
  hoatDong: true,
  phaiDoiMatKhau: true,
  dangNhapCuoi: true,
  khoaDen: true,
  phamViCoSo: { select: { id: true, ten: true } },
  phamViDonVi: { select: { id: true, ten: true } },
  nhanSu: { select: { id: true, hoTen: true, donVi: { select: { ten: true } } } },
} satisfies Prisma.TaiKhoanSelect;

@Roles('QUAN_TRI')
@Controller('tai-khoan')
export class TaiKhoanController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  async danhSach(@Query('q') q?: string, @Query('vaiTro') vaiTro?: VaiTro) {
    const where: Prisma.TaiKhoanWhereInput = {};
    if (q) {
      where.OR = [
        { tenDangNhap: { contains: q, mode: 'insensitive' } },
        { tenHienThi: { contains: q, mode: 'insensitive' } },
        { nhanSu: { hoTen: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (vaiTro && vaiTro in NHAN_VAI_TRO) where.vaiTro = vaiTro;
    const [items, chuaCoTaiKhoan] = await Promise.all([
      this.prisma.taiKhoan.findMany({ where, select: CHON, orderBy: [{ vaiTro: 'asc' }, { tenDangNhap: 'asc' }] }),
      this.prisma.nhanSu.count({ where: { taiKhoan: null, trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } } }),
    ]);
    return { items, chuaCoTaiKhoan };
  }

  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(taoSchema)) body: z.infer<typeof taoSchema>, @Ip() ip: string) {
    let tenDangNhap = body.tenDangNhap ?? '';
    if (body.nhanSuId) {
      const ns = await this.prisma.nhanSu.findUniqueOrThrow({ where: { id: body.nhanSuId }, include: { taiKhoan: true } });
      if (ns.taiKhoan) throw new BadRequestException(`${ns.hoTen} đã có tài khoản`);
      tenDangNhap = ns.maCanBo;
    }
    const matKhau = MAT_KHAU_MAC_DINH;
    const tk = await this.prisma.taiKhoan
      .create({
        data: {
          tenDangNhap,
          tenHienThi: body.tenHienThi,
          nhanSuId: body.nhanSuId,
          vaiTro: body.vaiTro,
          phamViCoSoId: body.phamViCoSoId,
          phamViDonViId: body.phamViDonViId,
          matKhauHash: await bcrypt.hash(matKhau, 10),
        },
      })
      .catch((e) => xuLyTrung(e, `Tên đăng nhập ${tenDangNhap} đã tồn tại`));
    await this.audit.ghi(u, 'TAO', 'TaiKhoan', tk.id, `Tạo tài khoản ${tk.tenDangNhap} (${NHAN_VAI_TRO[tk.vaiTro]})`, undefined, ip);
    return { id: tk.id, tenDangNhap, matKhau };
  }

  /** Tạo tài khoản Cán bộ cho mọi người đang làm việc chưa có tài khoản; trả file Excel mật khẩu tạm. */
  @Post('tao-hang-loat')
  async taoHangLoat(@CurrentUser() u: NguoiDung, @Res() res: Response, @Ip() ip: string) {
    const ds = await this.prisma.nhanSu.findMany({
      where: { taiKhoan: null, trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } },
      include: { donVi: true },
      orderBy: [{ donVi: { ten: 'asc' } }, { ten: 'asc' }],
    });
    if (!ds.length) throw new BadRequestException('Tất cả cán bộ đang làm việc đều đã có tài khoản');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('TaiKhoan');
    ws.columns = [
      { header: 'Đơn vị', key: 'donVi', width: 30 },
      { header: 'Họ và tên', key: 'hoTen', width: 26 },
      { header: 'Tên đăng nhập (CCCD)', key: 'tenDangNhap', width: 20 },
      { header: 'Mật khẩu tạm', key: 'matKhau', width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getColumn(3).numFmt = '@';

    const hash = await bcrypt.hash(MAT_KHAU_MAC_DINH, 10);
    for (const ns of ds) {
      const matKhau = MAT_KHAU_MAC_DINH;
      await this.prisma.taiKhoan.create({
        data: { tenDangNhap: ns.maCanBo, nhanSuId: ns.id, vaiTro: 'CAN_BO', matKhauHash: hash },
      });
      ws.addRow({ donVi: ns.donVi.ten, hoTen: ns.hoTen, tenDangNhap: ns.maCanBo, matKhau });
    }
    await this.audit.ghi(u, 'TAO', 'TaiKhoan', null, `Tạo hàng loạt ${ds.length} tài khoản cán bộ`, undefined, ip);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TaiKhoanMoi.xlsx"`);
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }

  @Patch(':id')
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(suaSchema)) body: z.infer<typeof suaSchema>,
    @Ip() ip: string,
  ) {
    if (id === u.id && (body.vaiTro !== 'QUAN_TRI' || !body.hoatDong)) {
      throw new BadRequestException('Không thể tự hạ quyền hoặc khóa tài khoản của chính mình');
    }
    const cu = await this.prisma.taiKhoan.findUniqueOrThrow({ where: { id } });
    const tk = await this.prisma.taiKhoan.update({
      where: { id },
      data: {
        ...body,
        // Khóa tài khoản → vô hiệu ngay các phiên đang đăng nhập
        phienBan: cu.hoatDong && !body.hoatDong ? { increment: 1 } : undefined,
        khoaDen: body.hoatDong ? null : undefined,
        soLanSai: body.hoatDong ? 0 : undefined,
      },
    });
    await this.audit.ghi(u, 'SUA', 'TaiKhoan', id, `Sửa tài khoản ${tk.tenDangNhap}`, {
      vaiTro: [cu.vaiTro, tk.vaiTro],
      hoatDong: [cu.hoatDong, tk.hoatDong],
    }, ip);
    return { ok: true };
  }

  @Post(':id/dat-lai-mat-khau')
  async datLai(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    const matKhau = matKhauTam();
    const tk = await this.prisma.taiKhoan.update({
      where: { id },
      data: {
        matKhauHash: await bcrypt.hash(matKhau, 10),
        phaiDoiMatKhau: true,
        phienBan: { increment: 1 },
        soLanSai: 0,
        khoaDen: null,
      },
    });
    await this.audit.ghi(u, 'DAT_LAI_MAT_KHAU', 'TaiKhoan', id, `Đặt lại mật khẩu ${tk.tenDangNhap}`, undefined, ip);
    return { tenDangNhap: tk.tenDangNhap, matKhau };
  }

  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    if (id === u.id) throw new BadRequestException('Không thể xóa tài khoản của chính mình');
    const tk = await this.prisma.taiKhoan.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'TaiKhoan', id, `Xóa tài khoản ${tk.tenDangNhap}`, undefined, ip);
    return { ok: true };
  }
}
