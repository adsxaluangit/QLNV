import { BadRequestException, Body, Controller, Get, Ip, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { ChoPhepChuaDoiMatKhau, CurrentUser, NguoiDung, Public } from '../common/auth.decorators';
import { ZodPipe } from '../common/zod';
import { NHAN_VAI_TRO } from '../common/nghiep-vu';

const SO_LAN_SAI_TOI_DA = 5;
const PHUT_KHOA = 15;

export function kiemTraMatKhauManh(mk: string): string | null {
  if (mk.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (!/[A-Za-z]/.test(mk) || !/\d/.test(mk)) return 'Mật khẩu phải có cả chữ và số';
  return null;
}

const dangNhapSchema = z.object({
  tenDangNhap: z.string().trim().min(1, 'Nhập tên đăng nhập'),
  matKhau: z.string().min(1, 'Nhập mật khẩu'),
});

const doiMatKhauSchema = z.object({
  matKhauCu: z.string().min(1),
  matKhauMoi: z.string().max(100),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private taoToken(tk: { id: string; phienBan: number }) {
    return this.jwt.sign({ sub: tk.id, v: tk.phienBan });
  }

  private async thongTin(id: string) {
    const tk = await this.prisma.taiKhoan.findUniqueOrThrow({
      where: { id },
      include: {
        nhanSu: { select: { id: true, hoTen: true, maCanBo: true, donVi: { select: { ten: true } } } },
        phamViCoSo: { select: { ten: true } },
        phamViDonVi: { select: { ten: true } },
      },
    });
    return {
      id: tk.id,
      tenDangNhap: tk.tenDangNhap,
      hoTen: tk.nhanSu?.hoTen ?? tk.tenHienThi ?? tk.tenDangNhap,
      vaiTro: tk.vaiTro,
      tenVaiTro: NHAN_VAI_TRO[tk.vaiTro],
      nhanSuId: tk.nhanSuId,
      donVi: tk.nhanSu?.donVi.ten ?? null,
      phamVi: tk.phamViCoSo?.ten ?? tk.phamViDonVi?.ten ?? null,
      phaiDoiMatKhau: tk.phaiDoiMatKhau,
    };
  }

  @Public()
  @Post('dang-nhap')
  async dangNhap(@Body(new ZodPipe(dangNhapSchema)) body: z.infer<typeof dangNhapSchema>, @Ip() ip: string) {
    const tk = await this.prisma.taiKhoan.findFirst({
      where: { tenDangNhap: { equals: body.tenDangNhap, mode: 'insensitive' } },
    });
    const sai = new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    if (!tk || !tk.hoatDong) throw sai;

    if (tk.khoaDen && tk.khoaDen > new Date()) {
      const phut = Math.ceil((tk.khoaDen.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${phut} phút`);
    }

    if (!(await bcrypt.compare(body.matKhau, tk.matKhauHash))) {
      const soLan = tk.soLanSai + 1;
      const khoa = soLan >= SO_LAN_SAI_TOI_DA;
      await this.prisma.taiKhoan.update({
        where: { id: tk.id },
        data: { soLanSai: khoa ? 0 : soLan, khoaDen: khoa ? new Date(Date.now() + PHUT_KHOA * 60000) : null },
      });
      throw sai;
    }

    await this.prisma.taiKhoan.update({
      where: { id: tk.id },
      data: { soLanSai: 0, khoaDen: null, dangNhapCuoi: new Date() },
    });
    await this.audit.ghi(tk, 'DANG_NHAP', 'TaiKhoan', tk.id, 'Đăng nhập', undefined, ip);
    return { token: this.taoToken(tk), nguoiDung: await this.thongTin(tk.id) };
  }

  @ChoPhepChuaDoiMatKhau()
  @Get('toi')
  toi(@CurrentUser() u: NguoiDung) {
    return this.thongTin(u.id);
  }

  @ChoPhepChuaDoiMatKhau()
  @Post('doi-mat-khau')
  async doiMatKhau(
    @CurrentUser() u: NguoiDung,
    @Body(new ZodPipe(doiMatKhauSchema)) body: z.infer<typeof doiMatKhauSchema>,
    @Ip() ip: string,
  ) {
    const tk = await this.prisma.taiKhoan.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await bcrypt.compare(body.matKhauCu, tk.matKhauHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    const loi = kiemTraMatKhauManh(body.matKhauMoi);
    if (loi) throw new BadRequestException(loi);
    if (body.matKhauMoi === body.matKhauCu) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');

    const moi = await this.prisma.taiKhoan.update({
      where: { id: u.id },
      data: {
        matKhauHash: await bcrypt.hash(body.matKhauMoi, 10),
        phaiDoiMatKhau: false,
        phienBan: { increment: 1 },
      },
    });
    await this.audit.ghi(u, 'DOI_MAT_KHAU', 'TaiKhoan', u.id, 'Đổi mật khẩu', undefined, ip);
    return { token: this.taoToken(moi), nguoiDung: await this.thongTin(u.id) };
  }
}
