import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoaiTaiLieu } from '@prisma/client';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../common/audit.service';
import { CurrentUser, NguoiDung } from '../common/auth.decorators';
import { ScopeService } from '../common/scope.service';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const TAI_LIEU_DIR = path.join(UPLOAD_ROOT, 'tailieu');
if (!fs.existsSync(TAI_LIEU_DIR)) {
  fs.mkdirSync(TAI_LIEU_DIR, { recursive: true });
}

export const NHAN_LOAI_TAI_LIEU: Record<LoaiTaiLieu, string> = {
  QUYET_DINH_LUONG: 'Quyết định lương / Phụ cấp',
  QUYET_DINH_THOI_VIEC: 'Quyết định thôi việc / Nghỉ hưu',
  QUYET_DINH_BO_NHIEM: 'Quyết định bổ nhiệm / Khen thưởng / Kỷ luật',
  HOP_DONG: 'Hợp đồng làm việc / Lao động',
  VAN_BANG_CHUNG_CHI: 'Văn bằng / Chứng chỉ scan',
  GIAY_TO_KHAC: 'Giấy tờ khác (CCCD, Sơ yếu lý lịch, ...)',
};

const LOAI_FILE_CHO_PHEP = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
];

interface TaoTaiLieuBody {
  ten: string;
  loai?: LoaiTaiLieu;
  soHieu?: string;
  ngayBanHanh?: string;
  coQuanBanHanh?: string;
  ghiChu?: string;
}

interface SuaTaiLieuBody {
  ten?: string;
  loai?: LoaiTaiLieu;
  soHieu?: string;
  ngayBanHanh?: string;
  coQuanBanHanh?: string;
  ghiChu?: string;
}

@Controller('tai-lieu')
export class TaiLieuNhanSuController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}

  @Get(':nhanSuId')
  async danhSach(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Query('loai') loai?: LoaiTaiLieu,
    @Query('q') q?: string,
  ) {
    await this.scope.kiemTraXem(u, nhanSuId);

    const ds = await this.prisma.taiLieuNhanSu.findMany({
      where: {
        nhanSuId,
        ...(loai ? { loai } : {}),
        ...(q
          ? {
              OR: [
                { ten: { contains: q, mode: 'insensitive' } },
                { soHieu: { contains: q, mode: 'insensitive' } },
                { tenFile: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ ngayBanHanh: 'desc' }, { createdAt: 'desc' }],
    });

    return ds.map((d) => ({
      ...d,
      tenLoai: NHAN_LOAI_TAI_LIEU[d.loai],
      ngayBanHanh: d.ngayBanHanh ? d.ngayBanHanh.toISOString().slice(0, 10) : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  @Post(':nhanSuId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async tao(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: TaoTaiLieuBody,
  ) {
    await this.scope.kiemTraSua(u, nhanSuId);

    if (!file) throw new BadRequestException('Vui lòng chọn file đính kèm');
    if (!body.ten?.trim()) throw new BadRequestException('Vui lòng nhập tên tài liệu / quyết định');

    const ext = path.extname(file.originalname).toLowerCase();
    const hopLe = LOAI_FILE_CHO_PHEP.includes(file.mimetype) || ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    if (!hopLe) {
      throw new BadRequestException('Chỉ chấp nhận file PDF, Word (.doc, .docx), Excel (.xls, .xlsx) hoặc ảnh (.jpg, .png, .webp)');
    }

    const ns = await this.prisma.nhanSu.findUniqueOrThrow({ where: { id: nhanSuId }, select: { hoTen: true } });

    // Tạo tên file an toàn trên đĩa
    const tenGocSach = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tenLuu = `${Date.now()}_${randomUUID().slice(0, 8)}_${tenGocSach}`;
    const duongDanTuyetDoi = path.join(TAI_LIEU_DIR, tenLuu);

    fs.writeFileSync(duongDanTuyetDoi, file.buffer);

    const doc = await this.prisma.taiLieuNhanSu.create({
      data: {
        nhanSuId,
        loai: body.loai && Object.values(LoaiTaiLieu).includes(body.loai) ? body.loai : LoaiTaiLieu.GIAY_TO_KHAC,
        ten: body.ten.trim(),
        soHieu: body.soHieu?.trim() || null,
        ngayBanHanh: body.ngayBanHanh ? new Date(body.ngayBanHanh) : null,
        coQuanBanHanh: body.coQuanBanHanh?.trim() || null,
        tenFile: file.originalname,
        duongDan: path.relative(UPLOAD_ROOT, duongDanTuyetDoi).replace(/\\/g, '/'),
        dinhDang: file.mimetype || 'application/octet-stream',
        kichThuoc: file.size,
        ghiChu: body.ghiChu?.trim() || null,
        nguoiTaiLen: u.tenDangNhap,
      },
    });

    await this.audit.ghi(
      u,
      'TAO',
      'TaiLieuNhanSu',
      doc.id,
      `Tải lên tài liệu "${doc.ten}" (${file.originalname}) cho cán bộ ${ns.hoTen}`,
    );

    return {
      ...doc,
      tenLoai: NHAN_LOAI_TAI_LIEU[doc.loai],
      ngayBanHanh: doc.ngayBanHanh ? doc.ngayBanHanh.toISOString().slice(0, 10) : null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  @Patch(':nhanSuId/:id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async sua(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SuaTaiLieuBody,
  ) {
    await this.scope.kiemTraSua(u, nhanSuId);

    const doc = await this.prisma.taiLieuNhanSu.findFirst({
      where: { id, nhanSuId },
      include: { nhanSu: { select: { hoTen: true } } },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');

    let tenFile = doc.tenFile;
    let duongDan = doc.duongDan;
    let dinhDang = doc.dinhDang;
    let kichThuoc = doc.kichThuoc;

    // Nếu người dùng tải file mới để thay thế
    if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const hopLe =
        LOAI_FILE_CHO_PHEP.includes(file.mimetype) ||
        ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      if (!hopLe) {
        throw new BadRequestException('Chỉ chấp nhận file PDF, Word, Excel hoặc ảnh');
      }

      // Xóa file cũ
      const duongDanCu = path.join(UPLOAD_ROOT, doc.duongDan);
      if (fs.existsSync(duongDanCu)) {
        try {
          fs.unlinkSync(duongDanCu);
        } catch (e) {
          console.error('Lỗi khi xóa file cũ:', e);
        }
      }

      // Lưu file mới
      const tenGocSach = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const tenLuu = `${Date.now()}_${randomUUID().slice(0, 8)}_${tenGocSach}`;
      const duongDanMoiTuyetDoi = path.join(TAI_LIEU_DIR, tenLuu);
      fs.writeFileSync(duongDanMoiTuyetDoi, file.buffer);

      tenFile = file.originalname;
      duongDan = path.relative(UPLOAD_ROOT, duongDanMoiTuyetDoi).replace(/\\/g, '/');
      dinhDang = file.mimetype || 'application/octet-stream';
      kichThuoc = file.size;
    }

    const updated = await this.prisma.taiLieuNhanSu.update({
      where: { id },
      data: {
        ten: body.ten?.trim() ? body.ten.trim() : doc.ten,
        loai: body.loai && Object.values(LoaiTaiLieu).includes(body.loai) ? body.loai : doc.loai,
        soHieu: body.soHieu !== undefined ? (body.soHieu ? body.soHieu.trim() : null) : doc.soHieu,
        ngayBanHanh:
          body.ngayBanHanh !== undefined ? (body.ngayBanHanh ? new Date(body.ngayBanHanh) : null) : doc.ngayBanHanh,
        coQuanBanHanh:
          body.coQuanBanHanh !== undefined ? (body.coQuanBanHanh ? body.coQuanBanHanh.trim() : null) : doc.coQuanBanHanh,
        ghiChu: body.ghiChu !== undefined ? (body.ghiChu ? body.ghiChu.trim() : null) : doc.ghiChu,
        tenFile,
        duongDan,
        dinhDang,
        kichThuoc,
      },
    });

    await this.audit.ghi(
      u,
      'SUA',
      'TaiLieuNhanSu',
      id,
      `Cập nhật tài liệu "${updated.ten}" của cán bộ ${doc.nhanSu.hoTen}`,
    );

    return {
      ...updated,
      tenLoai: NHAN_LOAI_TAI_LIEU[updated.loai],
      ngayBanHanh: updated.ngayBanHanh ? updated.ngayBanHanh.toISOString().slice(0, 10) : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  @Get(':nhanSuId/:id/xem')
  async xem(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    await this.scope.kiemTraXem(u, nhanSuId);

    const doc = await this.prisma.taiLieuNhanSu.findFirst({ where: { id, nhanSuId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');

    const duongDanDayDu = path.join(UPLOAD_ROOT, doc.duongDan);
    if (!fs.existsSync(duongDanDayDu)) {
      throw new NotFoundException('File đính kèm không còn tồn tại trên máy chủ');
    }

    res.setHeader('Content-Type', doc.dinhDang);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.tenFile)}`);
    fs.createReadStream(duongDanDayDu).pipe(res);
  }

  @Get(':nhanSuId/:id/tai-ve')
  async taiVe(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    await this.scope.kiemTraXem(u, nhanSuId);

    const doc = await this.prisma.taiLieuNhanSu.findFirst({ where: { id, nhanSuId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');

    const duongDanDayDu = path.join(UPLOAD_ROOT, doc.duongDan);
    if (!fs.existsSync(duongDanDayDu)) {
      throw new NotFoundException('File đính kèm không còn tồn tại trên máy chủ');
    }

    res.setHeader('Content-Type', doc.dinhDang);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.tenFile)}`);
    fs.createReadStream(duongDanDayDu).pipe(res);
  }

  @Delete(':nhanSuId/:id')
  async xoa(
    @CurrentUser() u: NguoiDung,
    @Param('nhanSuId', ParseUUIDPipe) nhanSuId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.scope.kiemTraSua(u, nhanSuId);

    const doc = await this.prisma.taiLieuNhanSu.findFirst({
      where: { id, nhanSuId },
      include: { nhanSu: { select: { hoTen: true } } },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');

    const duongDanDayDu = path.join(UPLOAD_ROOT, doc.duongDan);
    if (fs.existsSync(duongDanDayDu)) {
      try {
        fs.unlinkSync(duongDanDayDu);
      } catch (err) {
        console.error('Không thể xóa file vật lý:', err);
      }
    }

    await this.prisma.taiLieuNhanSu.delete({ where: { id } });

    await this.audit.ghi(
      u,
      'XOA',
      'TaiLieuNhanSu',
      id,
      `Xóa tài liệu "${doc.ten}" (${doc.tenFile}) của cán bộ ${doc.nhanSu.hoTen}`,
    );

    return { ok: true };
  }
}
