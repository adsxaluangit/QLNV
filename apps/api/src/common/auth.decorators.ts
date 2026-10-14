import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { VaiTro } from '@prisma/client';

export interface NguoiDung {
  id: string;
  tenDangNhap: string;
  vaiTro: VaiTro;
  nhanSuId: string | null;
  /** Đơn vị của chính cán bộ gắn với tài khoản */
  donViId: string | null;
  phamViCoSoId: string | null;
  phamViDonViId: string | null;
}

export const ROLES_KEY = 'roles';
/** Giới hạn endpoint cho các vai trò được liệt kê. */
export const Roles = (...roles: VaiTro[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'public';
/** Endpoint không cần đăng nhập. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CHO_PHEP_CHUA_DOI_MK = 'allowPendingPassword';
/** Endpoint vẫn dùng được khi tài khoản chưa đổi mật khẩu lần đầu. */
export const ChoPhepChuaDoiMatKhau = () => SetMetadata(CHO_PHEP_CHUA_DOI_MK, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): NguoiDung => ctx.switchToHttp().getRequest().user,
);

/** Vai trò được thêm/sửa/xóa hồ sơ nhân sự và cơ cấu tổ chức. */
export const QUYEN_SUA: VaiTro[] = ['QUAN_TRI', 'TCHC'];
/** Vai trò được xem danh sách (trong phạm vi của mình). */
export const QUYEN_XEM_DS: VaiTro[] = [
  'QUAN_TRI',
  'BAN_GIAM_HIEU',
  'TCHC',
  'KE_TOAN',
  'DAO_TAO',
  'TRUONG_DON_VI',
];
