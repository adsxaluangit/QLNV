import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService, khacBiet } from '../common/audit.service';
import { NguoiDung } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { layTen } from '../common/nghiep-vu';
import { dongBoQuyPhepNamNay } from '../nghi-phep/dong-bo-quy';
import { DanhSachQuery, NhanSuInput } from './nhan-su.schema';

export const CHON_DANH_SACH = {
  id: true,
  maCanBo: true,
  hoTen: true,
  gioiTinh: true,
  ngaySinh: true,
  dienThoai: true,
  email: true,
  loaiNhanSu: true,
  trangThai: true,
  laGiangVien: true,
  kiemNhiem: true,
  trinhDoChuyenMon: true,
  chuyenNganh: true,
  chucDanhNgheNghiep: true,
  donVi: { select: { id: true, ten: true, coSo: { select: { id: true, ten: true } } } },
  chucVu: { select: { id: true, ten: true } },
} satisfies Prisma.NhanSuSelect;

@Injectable()
export class NhanSuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async where(u: NguoiDung, q: Partial<DanhSachQuery>): Promise<Prisma.NhanSuWhereInput> {
    const dk: Prisma.NhanSuWhereInput[] = [await this.scope.nhanSuWhere(u)];
    if (q.q) {
      const s = q.q;
      dk.push({
        OR: [
          { hoTen: { contains: s, mode: 'insensitive' } },
          { maCanBo: { startsWith: s.toUpperCase() } },
          { email: { contains: s, mode: 'insensitive' } },
          { dienThoai: { contains: s } },
        ],
      });
    }
    if (q.coSoId) dk.push({ donVi: { coSoId: q.coSoId } });
    if (q.donViId) dk.push({ donViId: { in: await this.scope.donViVaCon(q.donViId) } });
    if (q.chucVuId) dk.push({ chucVuId: q.chucVuId });
    if (q.loaiNhanSu) dk.push({ loaiNhanSu: q.loaiNhanSu });
    if (q.trangThai) dk.push({ trangThai: q.trangThai });
    if (q.trinhDo) dk.push({ trinhDoChuyenMon: q.trinhDo });
    if (q.gioiTinh) dk.push({ gioiTinh: q.gioiTinh });
    if (q.laGiangVien !== undefined) dk.push({ laGiangVien: q.laGiangVien });
    if (q.thieuCccd) dk.push({ maCanBo: { startsWith: 'TAM-' } });
    return { AND: dk };
  }

  /** Sắp xếp theo tên rồi họ tên — thói quen lập danh sách ở Việt Nam. */
  readonly thuTu: Prisma.NhanSuOrderByWithRelationInput[] = [{ ten: 'asc' }, { hoTen: 'asc' }];

  async danhSach(u: NguoiDung, q: DanhSachQuery) {
    const where = await this.where(u, q);
    const [rawItems, total] = await Promise.all([
      this.prisma.nhanSu.findMany({
        where,
        select: { ...CHON_DANH_SACH, anhDaiDien: true },
        orderBy: this.thuTu,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.nhanSu.count({ where }),
    ]);
    const items = rawItems.map(({ anhDaiDien, ...rest }) => ({
      ...rest,
      coAnh: Boolean(anhDaiDien),
    }));
    return { items, total };
  }

  async chiTiet(u: NguoiDung, id: string) {
    await this.scope.kiemTraXem(u, id);
    const ns = await this.prisma.nhanSu.findUniqueOrThrow({
      where: { id },
      include: {
        donVi: { select: { id: true, ten: true, coSo: { select: { id: true, ten: true } } } },
        chucVu: { select: { id: true, ten: true } },
        taiKhoan: { select: { id: true, vaiTro: true, hoatDong: true, dangNhapCuoi: true } },
      },
    });
    return { ...ns, coQuyenSua: this.scope.coQuyenSua(u) };
  }

  private async kiemTraTrung(maCanBo: string, boQuaId?: string) {
    const ton = await this.prisma.nhanSu.findUnique({ where: { maCanBo }, select: { id: true, hoTen: true } });
    if (ton && ton.id !== boQuaId) {
      throw new ConflictException(`Số CCCD ${maCanBo} đã được dùng cho cán bộ ${ton.hoTen}`);
    }
  }

  async tao(u: NguoiDung, data: NhanSuInput, ip?: string) {
    if (!this.scope.coQuyenSua(u)) throw new ForbiddenException('Bạn không có quyền thêm hồ sơ');
    await this.scope.kiemTraDonVi(u, data.donViId);
    await this.kiemTraTrung(data.maCanBo);
    const { ghiQuaTrinhCongTac, ngayChuyenDonVi, soQuyetDinhDieuDong, ghiChuDieuDong, ...nhanSuData } = data;
    const ns = await this.prisma.nhanSu.create({
      data: { ...nhanSuData, ten: layTen(nhanSuData.hoTen) },
      include: { donVi: true, chucVu: true },
    });
    // Tự động khởi tạo 1 bản ghi công tác ban đầu cho cán bộ mới
    if (ns.donViId && ns.donVi) {
      const tuNgay = ns.ngayVaoTruong || ns.ngayTuyenDung || new Date();
      await this.prisma.quaTrinhCongTac.create({
        data: {
          nhanSuId: ns.id,
          tuNgay,
          denNgay: null,
          noiCongTac: ns.donVi.ten,
          chucVu: ns.chucVu?.ten || null,
          ghiChu: 'Công tác từ khi tiếp nhận',
        },
      });
    }
    await this.audit.ghi(u, 'TAO', 'NhanSu', ns.id, `Thêm hồ sơ ${ns.hoTen} (${ns.maCanBo})`, undefined, ip);
    return ns;
  }

  async sua(u: NguoiDung, id: string, data: NhanSuInput, ip?: string) {
    await this.scope.kiemTraSua(u, id);
    await this.scope.kiemTraDonVi(u, data.donViId);
    await this.kiemTraTrung(data.maCanBo, id);
    const { ghiQuaTrinhCongTac, ngayChuyenDonVi, soQuyetDinhDieuDong, ghiChuDieuDong, ...nhanSuData } = data;
    const cu = await this.prisma.nhanSu.findUniqueOrThrow({
      where: { id },
      include: { donVi: true, chucVu: true },
    });
    const donViThayDoi = cu.donViId !== nhanSuData.donViId;
    const chucVuThayDoi = cu.chucVuId !== nhanSuData.chucVuId;
    const coThayDoiCongTac = donViThayDoi || chucVuThayDoi;

    const ns = await this.prisma.$transaction(async (tx) => {
      const moi = await tx.nhanSu.update({
        where: { id },
        data: { ...nhanSuData, ten: layTen(nhanSuData.hoTen) },
        include: { donVi: true, chucVu: true },
      });
      // Tên đăng nhập luôn trùng mã cán bộ (CCCD)
      if (cu.maCanBo !== moi.maCanBo) {
        await tx.taiKhoan.updateMany({ where: { nhanSuId: id }, data: { tenDangNhap: moi.maCanBo } });
      }

      // Tự động ghi nhận vào Quá trình công tác nếu có thay đổi đơn vị/chức vụ và được kích hoạt
      if (coThayDoiCongTac && ghiQuaTrinhCongTac !== false) {
        const ngayChuyen = ngayChuyenDonVi ? new Date(ngayChuyenDonVi) : new Date();
        ngayChuyen.setHours(0, 0, 0, 0);

        const cacQuaTrinh = await tx.quaTrinhCongTac.findMany({
          where: { nhanSuId: id },
          orderBy: { tuNgay: 'asc' },
        });

        const banGhiDangMo = cacQuaTrinh.find((qt) => !qt.denNgay);

        if (banGhiDangMo) {
          let denNgayCu = new Date(ngayChuyen);
          if (denNgayCu > banGhiDangMo.tuNgay) {
            denNgayCu = new Date(ngayChuyen.getTime() - 24 * 60 * 60 * 1000);
          }
          await tx.quaTrinhCongTac.update({
            where: { id: banGhiDangMo.id },
            data: { denNgay: denNgayCu },
          });
        } else if (cacQuaTrinh.length === 0 && cu.donVi) {
          const tuNgayCu = cu.ngayVaoTruong || cu.ngayTuyenDung || new Date(2020, 0, 1);
          let denNgayCu = new Date(ngayChuyen);
          if (denNgayCu > tuNgayCu) {
            denNgayCu = new Date(ngayChuyen.getTime() - 24 * 60 * 60 * 1000);
          }
          await tx.quaTrinhCongTac.create({
            data: {
              nhanSuId: id,
              tuNgay: tuNgayCu,
              denNgay: denNgayCu,
              noiCongTac: cu.donVi.ten,
              chucVu: cu.chucVu?.ten || null,
              ghiChu: 'Công tác trước khi điều động',
            },
          });
        }

        await tx.quaTrinhCongTac.create({
          data: {
            nhanSuId: id,
            tuNgay: ngayChuyen,
            denNgay: null,
            noiCongTac: moi.donVi?.ten || '',
            chucVu: moi.chucVu?.ten || null,
            soQuyetDinh: soQuyetDinhDieuDong || null,
            ghiChu: ghiChuDieuDong || (donViThayDoi ? `Điều động từ ${cu.donVi?.ten || 'đơn vị cũ'}` : 'Thay đổi chức vụ'),
          },
        });
      }

      return moi;
    });

    if (cu.laGiangVien !== ns.laGiangVien || cu.kiemNhiem !== ns.kiemNhiem || cu.loaiNhanSu !== ns.loaiNhanSu || String(cu.ngayTuyenDung) !== String(ns.ngayTuyenDung)) {
      await dongBoQuyPhepNamNay(this.prisma, id);
    }
    const thayDoi = khacBiet(cu, ns);
    if (Object.keys(thayDoi).length) {
      await this.audit.ghi(u, 'SUA', 'NhanSu', id, `Sửa hồ sơ ${ns.hoTen} (${ns.maCanBo})${coThayDoiCongTac ? ' - Điều động/chuyển công tác' : ''}`, thayDoi, ip);
    }
    return ns;
  }

  async layAnh(id: string) {
    return this.prisma.nhanSu.findUnique({
      where: { id },
      select: { anhDaiDien: true },
    });
  }

  async capNhatAnh(u: NguoiDung, id: string, anhDataUrl: string | null, ip?: string) {
    if (!this.scope.coQuyenSua(u) && u.nhanSuId !== id) {
      throw new ForbiddenException('Bạn không có quyền cập nhật ảnh của cán bộ này');
    }
    const cu = await this.prisma.nhanSu.findUniqueOrThrow({ where: { id }, select: { id: true, hoTen: true, maCanBo: true } });
    const ns = await this.prisma.nhanSu.update({
      where: { id },
      data: { anhDaiDien: anhDataUrl },
      select: { id: true, hoTen: true, maCanBo: true, anhDaiDien: true },
    });
    const hanhDong = anhDataUrl ? 'Cập nhật ảnh 3x4' : 'Xóa ảnh 3x4';
    await this.audit.ghi(u, 'SUA', 'NhanSu', id, `${hanhDong} cho cán bộ ${cu.hoTen} (${cu.maCanBo})`, undefined, ip);
    return ns;
  }

  async xoa(u: NguoiDung, id: string, ip?: string) {
    await this.scope.kiemTraSua(u, id);
    const ns = await this.prisma.nhanSu.delete({ where: { id } });
    await this.audit.ghi(u, 'XOA', 'NhanSu', id, `Xóa hồ sơ ${ns.hoTen} (${ns.maCanBo})`, ns, ip);
    return { ok: true };
  }
}
