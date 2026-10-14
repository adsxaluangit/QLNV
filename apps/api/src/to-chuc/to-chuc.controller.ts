import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { LoaiDonVi, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService, khacBiet } from '../common/audit.service';
import { CurrentUser, NguoiDung, QUYEN_SUA, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { txt, uuidOpt, ZodPipe } from '../common/zod';

/** Chuyển lỗi trùng khóa của Prisma thành thông báo dễ hiểu. */
export function xuLyTrung(e: unknown, thongBao: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(thongBao);
  throw e;
}

const ma = z
  .string()
  .trim()
  .min(1, 'Nhập mã')
  .max(30)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Mã chỉ gồm chữ không dấu, số, dấu gạch')
  .transform((s) => s.toUpperCase());

// ---------------------------------------------------------------- Cơ sở
const coSoSchema = z.object({
  ma,
  ten: z.string().trim().min(2).max(200),
  diaChi: txt(300),
  thuTu: z.coerce.number().int().default(0),
});

@Controller('co-so')
export class CoSoController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  danhSach() {
    return this.prisma.coSo.findMany({ orderBy: [{ thuTu: 'asc' }, { ten: 'asc' }] });
  }

  @Roles(...QUYEN_SUA)
  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(coSoSchema)) body: z.infer<typeof coSoSchema>) {
    const cs = await this.prisma.coSo.create({ data: body }).catch((e) => xuLyTrung(e, `Mã cơ sở ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'TAO', 'CoSo', cs.id, `Thêm cơ sở ${cs.ten}`);
    return cs;
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(coSoSchema)) body: z.infer<typeof coSoSchema>,
  ) {
    const cu = await this.prisma.coSo.findUniqueOrThrow({ where: { id } });
    const cs = await this.prisma.coSo
      .update({ where: { id }, data: body })
      .catch((e) => xuLyTrung(e, `Mã cơ sở ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'SUA', 'CoSo', id, `Sửa cơ sở ${cs.ten}`, khacBiet(cu, cs));
    return cs;
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    const soDonVi = await this.prisma.donVi.count({ where: { coSoId: id } });
    if (soDonVi) throw new BadRequestException(`Cơ sở còn ${soDonVi} đơn vị, hãy chuyển hoặc xóa đơn vị trước`);
    const cs = await this.prisma.coSo.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'CoSo', id, `Xóa cơ sở ${cs.ten}`);
    return { ok: true };
  }
}

// ---------------------------------------------------------------- Đơn vị
const donViSchema = z.object({
  ma,
  ten: z.string().trim().min(2).max(200),
  loai: z.nativeEnum(LoaiDonVi).default('KHAC'),
  coSoId: z.string().uuid('Chọn cơ sở'),
  parentId: uuidOpt,
  thuTu: z.coerce.number().int().default(0),
});

@Controller('don-vi')
export class DonViController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
  ) {}

  @Get()
  danhSach() {
    return this.prisma.donVi.findMany({
      orderBy: [{ thuTu: 'asc' }, { ten: 'asc' }],
      include: {
        coSo: { select: { id: true, ten: true } },
        _count: { select: { nhanSus: { where: { trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } } } } },
      },
    });
  }

  private async kiemTraCha(id: string | null, data: z.infer<typeof donViSchema>) {
    if (!data.parentId) return;
    const cha = await this.prisma.donVi.findUnique({ where: { id: data.parentId } });
    if (!cha) throw new BadRequestException('Đơn vị cấp trên không tồn tại');
    if (cha.coSoId !== data.coSoId) throw new BadRequestException('Đơn vị cấp trên phải cùng cơ sở');
    if (id && (await this.scope.donViVaCon(id)).includes(data.parentId)) {
      throw new BadRequestException('Không thể chọn chính đơn vị này hoặc đơn vị con làm cấp trên');
    }
  }

  @Roles(...QUYEN_SUA)
  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(donViSchema)) body: z.infer<typeof donViSchema>) {
    await this.kiemTraCha(null, body);
    const dv = await this.prisma.donVi.create({ data: body }).catch((e) => xuLyTrung(e, `Mã đơn vị ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'TAO', 'DonVi', dv.id, `Thêm đơn vị ${dv.ten}`);
    return dv;
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(donViSchema)) body: z.infer<typeof donViSchema>,
  ) {
    const cu = await this.prisma.donVi.findUniqueOrThrow({ where: { id } });
    await this.kiemTraCha(id, body);
    if (cu.coSoId !== body.coSoId && (await this.prisma.donVi.count({ where: { parentId: id } }))) {
      throw new BadRequestException('Đơn vị có đơn vị con, không thể đổi cơ sở');
    }
    const dv = await this.prisma.donVi
      .update({ where: { id }, data: body })
      .catch((e) => xuLyTrung(e, `Mã đơn vị ${body.ma} đã tồn tại`));
    await this.audit.ghi(u, 'SUA', 'DonVi', id, `Sửa đơn vị ${dv.ten}`, khacBiet(cu, dv));
    return dv;
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    const [con, ns] = await Promise.all([
      this.prisma.donVi.count({ where: { parentId: id } }),
      this.prisma.nhanSu.count({ where: { donViId: id } }),
    ]);
    if (con) throw new BadRequestException(`Đơn vị còn ${con} đơn vị con`);
    if (ns) throw new BadRequestException(`Đơn vị còn ${ns} hồ sơ cán bộ (kể cả đã nghỉ), hãy chuyển sang đơn vị khác trước`);
    const dv = await this.prisma.donVi.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'DonVi', id, `Xóa đơn vị ${dv.ten}`);
    return { ok: true };
  }
}

// ---------------------------------------------------------------- Chức vụ
const chucVuSchema = z.object({
  ten: z.string().trim().min(2).max(100),
  thuTu: z.coerce.number().int().default(0),
});

@Controller('chuc-vu')
export class ChucVuController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  danhSach() {
    return this.prisma.chucVu.findMany({ orderBy: [{ thuTu: 'asc' }, { ten: 'asc' }] });
  }

  @Roles(...QUYEN_SUA)
  @Post()
  async tao(@CurrentUser() u: NguoiDung, @Body(new ZodPipe(chucVuSchema)) body: z.infer<typeof chucVuSchema>) {
    const cv = await this.prisma.chucVu.create({ data: body }).catch((e) => xuLyTrung(e, `Chức vụ "${body.ten}" đã tồn tại`));
    await this.audit.ghi(u, 'TAO', 'ChucVu', cv.id, `Thêm chức vụ ${cv.ten}`);
    return cv;
  }

  @Roles(...QUYEN_SUA)
  @Patch(':id')
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(chucVuSchema)) body: z.infer<typeof chucVuSchema>,
  ) {
    const cv = await this.prisma.chucVu
      .update({ where: { id }, data: body })
      .catch((e) => xuLyTrung(e, `Chức vụ "${body.ten}" đã tồn tại`));
    await this.audit.ghi(u, 'SUA', 'ChucVu', id, `Sửa chức vụ ${cv.ten}`);
    return cv;
  }

  @Roles(...QUYEN_SUA)
  @Delete(':id')
  async xoa(@CurrentUser() u: NguoiDung, @Param('id', ParseUUIDPipe) id: string) {
    const n = await this.prisma.nhanSu.count({ where: { chucVuId: id } });
    if (n) throw new BadRequestException(`Có ${n} cán bộ đang giữ chức vụ này`);
    const cv = await this.prisma.chucVu.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'ChucVu', id, `Xóa chức vụ ${cv.ten}`);
    return { ok: true };
  }
}
