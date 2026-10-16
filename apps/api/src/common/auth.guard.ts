import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { VaiTro } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CHO_PHEP_CHUA_DOI_MK, NguoiDung, PUBLIC_KEY, ROLES_KEY } from './auth.decorators';

/**
 * Guard toàn cục: xác thực JWT, nạp tài khoản từ DB (để khóa/đổi mật khẩu
 * có hiệu lực ngay), kiểm tra vai trò và bắt buộc đổi mật khẩu lần đầu.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : (typeof req.query?.token === 'string' ? req.query.token : undefined);
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');

    let payload: { sub: string; v: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    }

    const tk = await this.prisma.taiKhoan.findUnique({
      where: { id: payload.sub },
      include: { nhanSu: { select: { donViId: true } } },
    });
    if (!tk || !tk.hoatDong || tk.phienBan !== payload.v) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại');
    }

    const user: NguoiDung = {
      id: tk.id,
      tenDangNhap: tk.tenDangNhap,
      vaiTro: tk.vaiTro,
      nhanSuId: tk.nhanSuId,
      donViId: tk.nhanSu?.donViId ?? null,
      phamViCoSoId: tk.phamViCoSoId,
      phamViDonViId: tk.phamViDonViId,
    };
    req.user = user;

    if (tk.phaiDoiMatKhau && !this.reflector.getAllAndOverride<boolean>(CHO_PHEP_CHUA_DOI_MK, targets)) {
      throw new ForbiddenException('Bạn cần đổi mật khẩu trước khi sử dụng hệ thống');
    }

    const roles = this.reflector.getAllAndOverride<VaiTro[] | undefined>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(tk.vaiTro)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
