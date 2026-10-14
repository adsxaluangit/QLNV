import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NguoiDung } from './auth.decorators';

export type HanhDong = 'TAO' | 'SUA' | 'XOA' | 'NHAP_EXCEL' | 'DANG_NHAP' | 'DOI_MAT_KHAU' | 'DAT_LAI_MAT_KHAU';

const BO_QUA = new Set(['matKhauHash', 'createdAt', 'updatedAt']);

function chuanHoa(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v ?? null;
}

/** Chỉ giữ các trường thay đổi: { truong: [truoc, sau] } */
export function khacBiet(truoc: Record<string, unknown>, sau: Record<string, unknown>) {
  const kq: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(sau)) {
    if (BO_QUA.has(k)) continue;
    const a = chuanHoa(truoc[k]);
    const b = chuanHoa(sau[k]);
    if (typeof b === 'object' && b !== null) continue;
    if (a !== b) kq[k] = [a, b];
  }
  return kq;
}

/** Nhật ký thao tác: ai, làm gì, lúc nào, dữ liệu trước/sau. */
@Injectable()
export class AuditService {
  private readonly log = new Logger('NhatKy');

  constructor(private readonly prisma: PrismaService) {}

  async ghi(
    u: Pick<NguoiDung, 'id' | 'tenDangNhap'> | null,
    hanhDong: HanhDong,
    doiTuong: string,
    doiTuongId: string | null,
    moTa: string,
    duLieu?: unknown,
    ip?: string,
  ): Promise<void> {
    try {
      await this.prisma.nhatKy.create({
        data: {
          taiKhoanId: u?.id ?? null,
          tenDangNhap: u?.tenDangNhap ?? null,
          hanhDong,
          doiTuong,
          doiTuongId,
          moTa,
          duLieu: duLieu === undefined ? undefined : (JSON.parse(JSON.stringify(duLieu)) as Prisma.InputJsonValue),
          ip: ip ?? null,
        },
      });
    } catch (e) {
      // Không để lỗi ghi nhật ký làm hỏng thao tác chính
      this.log.error(`Không ghi được nhật ký: ${(e as Error).message}`);
    }
  }
}
