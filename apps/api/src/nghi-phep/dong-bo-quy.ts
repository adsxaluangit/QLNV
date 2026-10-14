import { PrismaClient } from '@prisma/client';
import { tinhQuyPhep } from './nghiep-vu-phep';

/**
 * Tính lại quỹ phép của năm hiện tại cho một cán bộ khi hồ sơ thay đổi
 * (giảng viên / kiêm nhiệm / ngày tuyển dụng / loại cán bộ). Chỉ cập nhật khi quỹ đã tồn tại;
 * giữ nguyên phần TCHC đã điều chỉnh thủ công. Quỹ chưa có sẽ được tạo khi mở màn hình.
 */
export async function dongBoQuyPhepNamNay(prisma: Pick<PrismaClient, 'nhanSu' | 'quyPhep'>, nhanSuId: string, nam = new Date().getFullYear()) {
  const ns = await prisma.nhanSu.findUnique({
    where: { id: nhanSuId },
    select: { id: true, ngayTuyenDung: true, laGiangVien: true, kiemNhiem: true, loaiNhanSu: true },
  });
  if (!ns) return;
  const kq = tinhQuyPhep(ns, nam);
  await prisma.quyPhep.updateMany({
    where: { nhanSuId, nam },
    data: { soThang: kq.soThang, phepCoBan: kq.phepCoBan, phepThamNien: kq.phepThamNien, tongPhep: kq.tongPhep, ghiChu: kq.ghiChu },
  });
}
