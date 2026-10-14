-- CreateTable
CREATE TABLE "ChamCong" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "ngay" DATE NOT NULL,
    "kyHieu" TEXT NOT NULL,
    "nguoiCham" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChamCong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BangChamCong" (
    "id" TEXT NOT NULL,
    "donViId" TEXT NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "daChot" BOOLEAN NOT NULL DEFAULT false,
    "nguoiChot" TEXT,
    "ngayChot" TIMESTAMP(3),

    CONSTRAINT "BangChamCong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamCongThang" (
    "id" TEXT NOT NULL,
    "nhanSuId" TEXT NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "luongKhoan" DOUBLE PRECISION,
    "theoQuyetDinh" DOUBLE PRECISION,
    "ghiChu" TEXT,

    CONSTRAINT "ChamCongThang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChamCong_ngay_idx" ON "ChamCong"("ngay");

-- CreateIndex
CREATE UNIQUE INDEX "ChamCong_nhanSuId_ngay_key" ON "ChamCong"("nhanSuId", "ngay");

-- CreateIndex
CREATE UNIQUE INDEX "BangChamCong_donViId_nam_thang_key" ON "BangChamCong"("donViId", "nam", "thang");

-- CreateIndex
CREATE UNIQUE INDEX "ChamCongThang_nhanSuId_nam_thang_key" ON "ChamCongThang"("nhanSuId", "nam", "thang");

-- AddForeignKey
ALTER TABLE "ChamCong" ADD CONSTRAINT "ChamCong_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BangChamCong" ADD CONSTRAINT "BangChamCong_donViId_fkey" FOREIGN KEY ("donViId") REFERENCES "DonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamCongThang" ADD CONSTRAINT "ChamCongThang_nhanSuId_fkey" FOREIGN KEY ("nhanSuId") REFERENCES "NhanSu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
