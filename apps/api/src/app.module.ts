import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './common/auth.guard';
import { AuditService } from './common/audit.service';
import { ScopeService } from './common/scope.service';
import { AuthController } from './auth/auth.controller';
import { ChucVuController, CoSoController, DonViController } from './to-chuc/to-chuc.controller';
import { HoSoConController, NhanSuController } from './nhan-su/nhan-su.controller';
import { TaiLieuNhanSuController } from './nhan-su/tai-lieu.controller';
import { NhanSuService } from './nhan-su/nhan-su.service';
import { ExcelService } from './nhan-su/excel.service';
import { TaiKhoanController } from './tai-khoan/tai-khoan.controller';
import { ThongKeController } from './thong-ke/thong-ke.controller';
import { HealthController } from './health.controller';
import { LuongCoSoController, NangLuongController, NgachLuongController } from './luong/luong.controller';
import { NghiPhepController } from './nghi-phep/nghi-phep.controller';
import { ChamCongController } from './cham-cong/cham-cong.controller';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('Thiếu biến môi trường JWT_SECRET');
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret ?? 'dev-secret-chi-dung-khi-phat-trien',
      signOptions: { expiresIn: process.env.JWT_EXPIRES ?? '8h' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    CoSoController,
    DonViController,
    ChucVuController,
    NhanSuController,
    HoSoConController,
    TaiLieuNhanSuController,
    TaiKhoanController,
    ThongKeController,
    NgachLuongController,
    LuongCoSoController,
    NangLuongController,
    NghiPhepController,
    ChamCongController,
  ],
  providers: [
    PrismaService,
    ScopeService,
    AuditService,
    NhanSuService,
    ExcelService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
