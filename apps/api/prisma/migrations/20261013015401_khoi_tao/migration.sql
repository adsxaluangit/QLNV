-- CreateEnum
CREATE TYPE "LoaiDonVi" AS ENUM ('KHOA', 'PHONG', 'TRUNG_TAM', 'TO_BO_MON', 'KHAC');

-- CreateEnum
CREATE TYPE "GioiTinh" AS ENUM ('NAM', 'NU');

-- CreateEnum
CREATE TYPE "LoaiNhanSu" AS ENUM ('VIEN_CHUC', 'HOP_DONG', 'THINH_GIANG');

-- CreateEnum
CREATE TYPE "TrangThaiNhanSu" AS ENUM ('DANG_LAM_VIEC', 'TAM_NGHI', 'NGHI_HUU', 'THOI_VIEC', 'CHUYEN_CONG_TAC');

-- CreateEnum
CREATE TYPE "TrinhDo" AS ENUM ('TIEN_SI', 'THAC_SI', 'DAI_HOC', 'CAO_DANG', 'TRUNG_CAP', 'SO_CAP', 'KHAC');

-- CreateEnum
CREATE TYPE "VaiTro" AS ENUM ('QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'KE_TOAN', 'DAO_TAO', 'TRUONG_DON_VI', 'CAN_BO');

-- CreateEnum
CREATE TYPE "LoaiVanBang" AS ENUM ('VAN_BANG', 'CHUNG_CHI');

-- CreateTable
CREATE TABLE "CoSo" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "diaChi" TEXT,
    "thuTu" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoSo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonVi" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loai" "LoaiDonVi" NOT NULL DEFAULT 'KHAC',
    "thuTu" INTEGER NOT NULL DEFAULT 0,
    "coSoId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonVi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChucVu" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "thuTu" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChucVu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NhanSu" (
    "id" TEXT NOT NULL,
    "maCanBo" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "tenGoiKhac" TEXT,
    "gioiTinh" "GioiTinh" NOT NULL,
    "ngaySinh" DATE NOT NULL,
    "noiSinh" TEXT,
    "queQuan" TEXT,
    "quocTich" TEXT NOT NULL DEFAULT 'Việt Nam',
    "danToc" TEXT,
    "tonGiao" TEXT,
    "ngayCapCccd" DATE,
    "noiCapCccd" TEXT,
    "dienThoai" TEXT,
    "email" TEXT,
    "diaChiThuongTru" TEXT,
    "choOHienNay" TEXT,
    "maSoThue" TEXT,
    "soBhxh" TEXT,
    "soTaiKhoan" TEXT,
    "nganHang" TEXT,
    "donViId" TEXT NOT NULL,
    "chucVuId" TEXT,
    "loaiNhanSu" "LoaiNhanSu" NOT NULL DEFAULT 'VIEN_CHUC',
    "trangThai" "TrangThaiNhanSu" NOT NULL DEFAULT 'DANG_LAM_VIEC',
    "laGiangVien" BOOLEAN NOT NULL DEFAULT false,
    "chucDanhNgheNghiep" TEXT,
    "ngayTuyenDung" DATE,
    "ngayVaoTruong" DATE,
    "trinhDoChuyenMon" "TrinhDo",
    "chuyenNganh" TEXT,
    "hocHam" TEXT,
    "danhHieu" TEXT,
    "lyLuanChinhTri" TEXT,
    "ngoaiNgu" TEXT,
    "tinHoc" TEXT,
    "nghiepVuSuPham" TEXT,
    "kyNangNghe" TEXT,
    "ngayVaoDang" DATE,
    "ngayChinhThucDang" DATE,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NhanSu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuaTrinhCongTac" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "tuNgay" DATE NOT NULL,
    "denNgay" DATE,
    "noiCongTac" TEXT NOT NULL,
    "chucVu" TEXT,
    "soQuyetDinh" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuaTrinhCongTac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanBang" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "loai" "LoaiVanBang" NOT NULL,
    "ten" TEXT NOT NULL,
    "chuyenNganh" TEXT,
    "noiCap" TEXT,
    "soHieu" TEXT,
    "ngayCap" DATE,
    "ngayHetHan" DATE,
    "xepLoai" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VanBang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuanHeGiaDinh" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "quanHe" TEXT NOT NULL,
    "hoTen" TEXT NOT NULL,
    "namSinh" INTEGER,
    "ngheNghiep" TEXT,
    "noiO" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuanHeGiaDinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaiKhoan" (
    "id" TEXT NOT NULL,
    "tenDangNhap" TEXT NOT NULL,
    "tenHienThi" TEXT,
    "matKhauHash" TEXT NOT NULL,
    "vaiTro" "VaiTro" NOT NULL DEFAULT 'CAN_BO',
    "hoatDong" BOOLEAN NOT NULL DEFAULT true,
    "phaiDoiMatKhau" BOOLEAN NOT NULL DEFAULT true,
    "phienBan" INTEGER NOT NULL DEFAULT 0,
    "soLanSai" INTEGER NOT NULL DEFAULT 0,
    "khoaDen" TIMESTAMP(3),
    "dangNhapCuoi" TIMESTAMP(3),
    "nhanSuId" TEXT,
    "phamViCoSoId" TEXT,
    "phamViDonViId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaiKhoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NhatKy" (
    "id" TEXT NOT NULL,
    "taiKhoanId" TEXT,
    "tenDangNhap" TEXT,
    "hanhDong" TEXT NOT NULL,
    "doiTuong" TEXT NOT NULL,
    "doiTuongId" TEXT,
    "moTa" TEXT NOT NULL,
    "duLieu" JSONB,
    "ip" TEXT,
    "thoiGian" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NhatKy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoSo_ma_key" ON "CoSo"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "DonVi_ma_key" ON "DonVi"("ma");

-- CreateIndex
CREATE INDEX "DonVi_coSoId_idx" ON "DonVi"("coSoId");

-- CreateIndex
CREATE INDEX "DonVi_parentId_idx" ON "DonVi"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChucVu_ten_key" ON "ChucVu"("ten");

-- CreateIndex
CREATE UNIQUE INDEX "NhanSu_maCanBo_key" ON "NhanSu"("maCanBo");

-- CreateIndex
CREATE INDEX "NhanSu_donViId_idx" ON "NhanSu"("donViId");

-- CreateIndex
CREATE INDEX "NhanSu_ten_hoTen_idx" ON "NhanSu"("ten", "hoTen");

-- CreateIndex
CREATE INDEX "NhanSu_trangThai_idx" ON "NhanSu"("trangThai");

-- CreateIndex
CREATE INDEX "QuaTrinhCongTac_nhanSuId_idx" ON "QuaTrinhCongTac"("nhanSuId");

-- CreateIndex
CREATE INDEX "VanBang_nhanSuId_idx" ON "VanBang"("nhanSuId");

-- CreateIndex
CREATE INDEX "VanBang_ngayHetHan_idx" ON "VanBang"("ngayHetHan");

-- CreateIndex
CREATE INDEX "QuanHeGiaDinh_nhanSuId_idx" ON "QuanHeGiaDinh"("nhanSuId");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_tenDangNhap_key" ON "TaiKhoan"("tenDangNhap");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_nhanSuId_key" ON "TaiKhoan"("nhanSuId");

-- CreateIndex
CREATE INDEX "NhatKy_thoiGian_idx" ON "NhatKy"("thoiGian");

-- CreateIndex
CREATE INDEX "NhatKy_doiTuong_doiTuongId_idx" ON "NhatKy"("doiTuong", "doiTuongId");

-- AddForeignKey
ALTER TABLE "DonVi" ADD CONSTRAINT "DonVi_coSoId_fkey" FOREIGN KEY ("coSoId") REFERENCES "CoSo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonVi" ADD CONSTRAINT "DonVi_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DonVi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanSu" ADD CONSTRAINT "NhanSu_donViId_fkey" FOREIGN KEY ("donViId") REFERENCES "DonVi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanSu" ADD CONSTRAINT "NhanSu_chucVuId_fkey" FOREIGN KEY ("chucVuId") REFERENCES "ChucVu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuaTrinhCongTac" ADD CONSTRAINT "QuaTrinhCongTac_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VanBang" ADD CONSTRAINT "VanBang_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuanHeGiaDinh" ADD CONSTRAINT "QuanHeGiaDinh_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaiKhoan" ADD CONSTRAINT "TaiKhoan_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaiKhoan" ADD CONSTRAINT "TaiKhoan_phamViCoSoId_fkey" FOREIGN KEY ("phamViCoSoId") REFERENCES "CoSo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaiKhoan" ADD CONSTRAINT "TaiKhoan_phamViDonViId_fkey" FOREIGN KEY ("phamViDonViId") REFERENCES "DonVi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhatKy" ADD CONSTRAINT "NhatKy_taiKhoanId_fkey" FOREIGN KEY ("taiKhoanId") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
