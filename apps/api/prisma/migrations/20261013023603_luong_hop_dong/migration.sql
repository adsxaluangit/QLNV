-- CreateEnum
CREATE TYPE "LoaiPhuCap" AS ENUM ('CHUC_VU', 'TRACH_NHIEM', 'UU_DAI_NGHE', 'THAM_NIEN_NHA_GIAO', 'KHAC');

-- CreateEnum
CREATE TYPE "LoaiHopDong" AS ENUM ('HDLV_KHONG_XAC_DINH', 'HDLV_XAC_DINH', 'HDLD_KHONG_XAC_DINH', 'HDLD_XAC_DINH', 'THINH_GIANG', 'KHAC');

-- CreateTable
CREATE TABLE "NgachLuong" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "nhom" TEXT NOT NULL,
    "heSo" DOUBLE PRECISION[],
    "thangNangBac" INTEGER NOT NULL DEFAULT 36,
    "thuTu" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NgachLuong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LuongCoSo" (
    "id" TEXT NOT NULL,
    "tuNgay" DATE NOT NULL,
    "mucLuong" INTEGER NOT NULL,
    "canCu" TEXT,

    CONSTRAINT "LuongCoSo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuaTrinhLuong" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "tuNgay" DATE NOT NULL,
    "ngachId" TEXT,
    "bac" INTEGER,
    "heSo" DOUBLE PRECISION,
    "phanTramVuotKhung" INTEGER NOT NULL DEFAULT 0,
    "mocNangBac" DATE NOT NULL,
    "luongThoaThuan" INTEGER,
    "soQuyetDinh" TEXT,
    "ngayQuyetDinh" DATE,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuaTrinhLuong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhuCap" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "loai" "LoaiPhuCap" NOT NULL,
    "ten" TEXT,
    "heSo" DOUBLE PRECISION,
    "phanTram" DOUBLE PRECISION,
    "tuNgay" DATE NOT NULL,
    "denNgay" DATE,
    "soQuyetDinh" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhuCap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HopDong" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "soHopDong" TEXT,
    "loai" "LoaiHopDong" NOT NULL,
    "ngayKy" DATE,
    "tuNgay" DATE NOT NULL,
    "denNgay" DATE,
    "chucDanh" TEXT,
    "luongThoaThuan" INTEGER,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HopDong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NgachLuong_ma_key" ON "NgachLuong"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "LuongCoSo_tuNgay_key" ON "LuongCoSo"("tuNgay");

-- CreateIndex
CREATE INDEX "QuaTrinhLuong_nhanSuId_tuNgay_idx" ON "QuaTrinhLuong"("nhanSuId", "tuNgay");

-- CreateIndex
CREATE INDEX "PhuCap_nhanSuId_idx" ON "PhuCap"("nhanSuId");

-- CreateIndex
CREATE INDEX "HopDong_nhanSuId_idx" ON "HopDong"("nhanSuId");

-- CreateIndex
CREATE INDEX "HopDong_denNgay_idx" ON "HopDong"("denNgay");

-- AddForeignKey
ALTER TABLE "QuaTrinhLuong" ADD CONSTRAINT "QuaTrinhLuong_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuaTrinhLuong" ADD CONSTRAINT "QuaTrinhLuong_ngachId_fkey" FOREIGN KEY ("ngachId") REFERENCES "NgachLuong"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhuCap" ADD CONSTRAINT "PhuCap_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HopDong" ADD CONSTRAINT "HopDong_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
