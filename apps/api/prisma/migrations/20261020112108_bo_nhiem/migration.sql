-- AlterTable ChucVu
ALTER TABLE "ChucVu" ADD COLUMN IF NOT EXISTS "laQuanLy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChucVu" ADD COLUMN IF NOT EXISTS "capQuanLy" INTEGER NOT NULL DEFAULT 0;

-- AlterTable NhanSu
ALTER TABLE "NhanSu" ADD COLUMN IF NOT EXISTS "ngayBoNhiem" DATE;
ALTER TABLE "NhanSu" ADD COLUMN IF NOT EXISTS "ngayHetHanBoNhiem" DATE;
ALTER TABLE "NhanSu" ADD COLUMN IF NOT EXISTS "soQdBoNhiem" TEXT;
ALTER TABLE "NhanSu" ADD COLUMN IF NOT EXISTS "lanBoNhiem" INTEGER NOT NULL DEFAULT 1;

-- CreateTable QuaTrinhBoNhiem
CREATE TABLE IF NOT EXISTS "QuaTrinhBoNhiem" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "chucVu" TEXT NOT NULL,
    "donVi" TEXT,
    "soQuyetDinh" TEXT NOT NULL,
    "ngayQuyetDinh" DATE NOT NULL,
    "ngayHieuLuc" DATE NOT NULL,
    "ngayHetHan" DATE,
    "thoiHanNam" INTEGER NOT NULL DEFAULT 5,
    "loaiQuyetDinh" TEXT NOT NULL DEFAULT 'BO_NHIEM_LAN_DAU',
    "nguoiKy" TEXT,
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuaTrinhBoNhiem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuaTrinhBoNhiem_nhanSuId_idx" ON "QuaTrinhBoNhiem"("nhanSuId");
CREATE INDEX IF NOT EXISTS "QuaTrinhBoNhiem_ngayHetHan_idx" ON "QuaTrinhBoNhiem"("ngayHetHan");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "QuaTrinhBoNhiem" ADD CONSTRAINT "QuaTrinhBoNhiem_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

