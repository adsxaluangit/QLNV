-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LoaiTaiLieu" AS ENUM ('QUYET_DINH_LUONG', 'QUYET_DINH_THOI_VIEC', 'QUYET_DINH_BO_NHIEM', 'HOP_DONG', 'VAN_BANG_CHUNG_CHI', 'GIAY_TO_KHAC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaiLieuNhanSu" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "loai" "LoaiTaiLieu" NOT NULL DEFAULT 'GIAY_TO_KHAC',
    "ten" TEXT NOT NULL,
    "soHieu" TEXT,
    "ngayBanHanh" DATE,
    "coQuanBanHanh" TEXT,
    "tenFile" TEXT NOT NULL,
    "duongDan" TEXT NOT NULL,
    "dinhDang" TEXT NOT NULL,
    "kichThuoc" INTEGER NOT NULL,
    "ghiChu" TEXT,
    "nguoiTaiLen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaiLieuNhanSu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaiLieuNhanSu_nhanSuId_loai_idx" ON "TaiLieuNhanSu"("nhanSuId", "loai");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaiLieuNhanSu_nhanSuId_createdAt_idx" ON "TaiLieuNhanSu"("nhanSuId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaiLieuNhanSu" ADD CONSTRAINT "TaiLieuNhanSu_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
