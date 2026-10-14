import { Controller, Get, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CurrentUser, NguoiDung, QUYEN_XEM_DS, Roles } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';
import { ngayNghiHuu } from '../common/nghiep-vu';

function demTheo<T>(ds: T[], key: (x: T) => string | null | undefined) {
  const m: Record<string, number> = {};
  for (const x of ds) {
    const k = key(x) ?? 'CHUA_RO';
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

function tuoi(ngaySinh: Date, homNay: Date) {
  let t = homNay.getUTCFullYear() - ngaySinh.getUTCFullYear();
  const m = homNay.getUTCMonth() - ngaySinh.getUTCMonth();
  if (m < 0 || (m === 0 && homNay.getUTCDate() < ngaySinh.getUTCDate())) t--;
  return t;
}

@Controller()
export class ThongKeController {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  @Roles(...QUYEN_XEM_DS)
  @Get('thong-ke/tong-quan')
  async tongQuan(@CurrentUser() u: NguoiDung) {
    const pham = await this.scope.nhanSuWhere(u);
    const ds = await this.prisma.nhanSu.findMany({
      where: { AND: [pham, { trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } }] },
      select: {
        id: true,
        hoTen: true,
        maCanBo: true,
        gioiTinh: true,
        ngaySinh: true,
        loaiNhanSu: true,
        trinhDoChuyenMon: true,
        laGiangVien: true,
        donVi: { select: { ten: true, coSo: { select: { ten: true } } } },
      },
    });

    const homNay = new Date();
    const sau12Thang = new Date(homNay);
    sau12Thang.setUTCFullYear(sau12Thang.getUTCFullYear() + 1);

    const nhomTuoi = { 'Dưới 30': 0, '30–39': 0, '40–49': 0, '50–59': 0, 'Từ 60': 0, 'Chưa rõ': 0 };
    const sapNghiHuu: { id: string; hoTen: string; donVi: string; ngayNghiHuu: string }[] = [];
    const sinhNhat: { id: string; hoTen: string; donVi: string; ngay: number }[] = [];

    for (const n of ds) {
      const ngaySinh = n.ngaySinh;
      if (!ngaySinh) {
        nhomTuoi['Chưa rõ']++;
        continue;
      }
      const t = tuoi(ngaySinh, homNay);
      if (t < 30) nhomTuoi['Dưới 30']++;
      else if (t < 40) nhomTuoi['30–39']++;
      else if (t < 50) nhomTuoi['40–49']++;
      else if (t < 60) nhomTuoi['50–59']++;
      else nhomTuoi['Từ 60']++;

      if (n.loaiNhanSu !== 'THINH_GIANG' && n.gioiTinh) {
        const nh = ngayNghiHuu(ngaySinh, n.gioiTinh);
        if (nh <= sau12Thang) {
          sapNghiHuu.push({ id: n.id, hoTen: n.hoTen, donVi: n.donVi.ten, ngayNghiHuu: nh.toISOString().slice(0, 10) });
        }
      }
      if (ngaySinh.getUTCMonth() === homNay.getUTCMonth()) {
        sinhNhat.push({ id: n.id, hoTen: n.hoTen, donVi: n.donVi.ten, ngay: ngaySinh.getUTCDate() });
      }
    }
    if (!nhomTuoi['Chưa rõ']) delete (nhomTuoi as Partial<typeof nhomTuoi>)['Chưa rõ'];

    const sau60Ngay = new Date(homNay.getTime() + 60 * 86400000);
    const chungChiSapHetHan = await this.prisma.vanBang.findMany({
      where: {
        ngayHetHan: { gte: new Date(homNay.toISOString().slice(0, 10)), lte: sau60Ngay },
        nhanSu: { AND: [pham, { trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } }] } as Prisma.NhanSuWhereInput,
      },
      select: { id: true, ten: true, ngayHetHan: true, nhanSu: { select: { id: true, hoTen: true } } },
      orderBy: { ngayHetHan: 'asc' },
      take: 50,
    });

    return {
      tongSo: ds.length,
      soGiangVien: ds.filter((n) => n.laGiangVien).length,
      theoGioiTinh: demTheo(ds, (n) => n.gioiTinh),
      theoLoai: demTheo(ds, (n) => n.loaiNhanSu),
      theoTrinhDo: demTheo(ds, (n) => n.trinhDoChuyenMon),
      theoCoSo: demTheo(ds, (n) => n.donVi.coSo.ten),
      theoDonVi: demTheo(ds, (n) => n.donVi.ten),
      theoDoTuoi: nhomTuoi,
      sapNghiHuu: sapNghiHuu.sort((a, b) => a.ngayNghiHuu.localeCompare(b.ngayNghiHuu)),
      sinhNhatThangNay: sinhNhat.sort((a, b) => a.ngay - b.ngay),
      chungChiSapHetHan,
    };
  }

  @Roles('QUAN_TRI')
  @Get('nhat-ky')
  async nhatKy(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '30',
    @Query('q') q?: string,
    @Query('doiTuong') doiTuong?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const s = Math.min(200, Math.max(1, Number(pageSize) || 30));
    const where: Prisma.NhatKyWhereInput = {};
    if (doiTuong) where.doiTuong = doiTuong;
    if (q) {
      where.OR = [
        { moTa: { contains: q, mode: 'insensitive' } },
        { tenDangNhap: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.nhatKy.findMany({ where, orderBy: { thoiGian: 'desc' }, skip: (p - 1) * s, take: s }),
      this.prisma.nhatKy.count({ where }),
    ]);
    return { items, total };
  }
}
