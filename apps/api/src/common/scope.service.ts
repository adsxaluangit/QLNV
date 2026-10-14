import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NguoiDung, QUYEN_SUA } from './auth.decorators';

const KHONG_CO = '00000000-0000-0000-0000-000000000000';

/**
 * Phạm vi dữ liệu: mỗi vai trò chỉ thấy những cán bộ thuộc phạm vi của mình.
 * Mọi truy vấn hồ sơ nhân sự PHẢI đi qua `nhanSuWhere`.
 */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Id của đơn vị gốc và mọi đơn vị con cháu. */
  async donViVaCon(goc: string): Promise<string[]> {
    const all = await this.prisma.donVi.findMany({ select: { id: true, parentId: true } });
    const conCua = new Map<string, string[]>();
    for (const d of all) {
      if (!d.parentId) continue;
      conCua.set(d.parentId, [...(conCua.get(d.parentId) ?? []), d.id]);
    }
    const kq: string[] = [];
    const hang = [goc];
    while (hang.length) {
      const id = hang.shift()!;
      if (kq.includes(id)) continue;
      kq.push(id);
      hang.push(...(conCua.get(id) ?? []));
    }
    return kq;
  }

  async nhanSuWhere(u: NguoiDung): Promise<Prisma.NhanSuWhereInput> {
    switch (u.vaiTro) {
      case 'QUAN_TRI':
      case 'BAN_GIAM_HIEU':
        return {};
      case 'TCHC':
      case 'KE_TOAN':
      case 'DAO_TAO':
        return u.phamViCoSoId ? { donVi: { coSoId: u.phamViCoSoId } } : {};
      case 'TRUONG_DON_VI': {
        const goc = u.phamViDonViId ?? u.donViId;
        const banThan = { id: u.nhanSuId ?? KHONG_CO };
        if (!goc) return banThan;
        return { OR: [{ donViId: { in: await this.donViVaCon(goc) } }, banThan] };
      }
      default:
        return { id: u.nhanSuId ?? KHONG_CO };
    }
  }

  /** Ném 404 nếu cán bộ không tồn tại hoặc nằm ngoài phạm vi. */
  async kiemTraXem(u: NguoiDung, nhanSuId: string): Promise<void> {
    const n = await this.prisma.nhanSu.count({ where: { AND: [await this.nhanSuWhere(u), { id: nhanSuId }] } });
    if (!n) throw new NotFoundException('Không tìm thấy cán bộ hoặc bạn không có quyền xem');
  }

  coQuyenSua(u: NguoiDung): boolean {
    return QUYEN_SUA.includes(u.vaiTro);
  }

  async kiemTraSua(u: NguoiDung, nhanSuId: string): Promise<void> {
    if (!this.coQuyenSua(u)) throw new ForbiddenException('Bạn không có quyền sửa hồ sơ');
    await this.kiemTraXem(u, nhanSuId);
  }

  /** Đơn vị đích phải thuộc cơ sở được giao (với TCHC giới hạn theo cơ sở). */
  async kiemTraDonVi(u: NguoiDung, donViId: string): Promise<void> {
    const dv = await this.prisma.donVi.findUnique({ where: { id: donViId }, select: { coSoId: true } });
    if (!dv) throw new NotFoundException('Đơn vị không tồn tại');
    if (u.vaiTro !== 'QUAN_TRI' && u.phamViCoSoId && dv.coSoId !== u.phamViCoSoId) {
      throw new ForbiddenException('Đơn vị này không thuộc cơ sở bạn được giao quản lý');
    }
  }
}
