-- CreateEnum
CREATE TYPE "LoaiNghi" AS ENUM ('PHEP_NAM', 'OM_DAU', 'THAI_SAN', 'KHONG_LUONG', 'VIEC_RIENG', 'KHAC');

-- CreateEnum
CREATE TYPE "TrangThaiDon" AS ENUM ('CHO_TRUONG_DON_VI', 'CHO_BGH', 'CHO_TCHC', 'DA_DUYET', 'TU_CHOI', 'DA_HUY');

-- CreateTable
CREATE TABLE "QuyPhep" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "nam" INTEGER NOT NULL,
    "soThang" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "phepCoBan" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "phepThamNien" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tongPhep" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dieuChinh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lyDoDieuChinh" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuyPhep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonNghi" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "loai" "LoaiNghi" NOT NULL,
    "tuNgay" DATE NOT NULL,
    "denNgay" DATE NOT NULL,
    "nuaNgay" BOOLEAN NOT NULL DEFAULT false,
    "soNgay" DOUBLE PRECISION NOT NULL,
    "lyDo" TEXT NOT NULL,
    "trangThai" "TrangThaiDon" NOT NULL,
    "lyDoTuChoi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonNghi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuyetDonNghi" (
    "id" TEXT NOT NULL,
    "donId" TEXT NOT NULL,
    "taiKhoanId" TEXT,
    "nguoiDuyet" TEXT NOT NULL,
    "buoc" TEXT NOT NULL,
    "ketQua" TEXT NOT NULL,
    "ghiChu" TEXT,
    "thoiGian" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuyetDonNghi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NgayNghiLe" (
    "id" TEXT NOT NULL,
    "ngay" DATE NOT NULL,
    "ten" TEXT NOT NULL,

    CONSTRAINT "NgayNghiLe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuyPhep_nam_idx" ON "QuyPhep"("nam");

-- CreateIndex
CREATE UNIQUE INDEX "QuyPhep_nhanSuId_nam_key" ON "QuyPhep"("nhanSuId", "nam");

-- CreateIndex
CREATE INDEX "DonNghi_nhanSuId_tuNgay_idx" ON "DonNghi"("nhanSuId", "tuNgay");

-- CreateIndex
CREATE INDEX "DonNghi_trangThai_idx" ON "DonNghi"("trangThai");

-- CreateIndex
CREATE INDEX "DuyetDonNghi_donId_idx" ON "DuyetDonNghi"("donId");

-- CreateIndex
CREATE UNIQUE INDEX "NgayNghiLe_ngay_key" ON "NgayNghiLe"("ngay");

-- AddForeignKey
ALTER TABLE "QuyPhep" ADD CONSTRAINT "QuyPhep_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonNghi" ADD CONSTRAINT "DonNghi_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuyetDonNghi" ADD CONSTRAINT "DuyetDonNghi_donId_fkey" FOREIGN KEY ("donId") REFERENCES "DonNghi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
