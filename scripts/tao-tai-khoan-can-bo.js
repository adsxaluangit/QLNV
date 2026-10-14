// Tạo tài khoản cho mọi cán bộ chưa có (MK mặc định 123456@, bắt buộc đổi lần đầu).
// Chạy: $env:NODE_PATH="d:\Code\QLNV\apps\api\node_modules"; node scripts/tao-tai-khoan-can-bo.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

const MK = '123456@';
const BGH = ['Hiệu trưởng', 'Phó Hiệu trưởng'];
const TDV = ['Trưởng phòng', 'Trưởng khoa', 'Giám đốc trung tâm'];

async function main() {
  const ds = await prisma.nhanSu.findMany({
    where: { taiKhoan: null, trangThai: { in: ['DANG_LAM_VIEC', 'TAM_NGHI'] } },
    include: { donVi: true, chucVu: true },
    orderBy: [{ donVi: { ten: 'asc' } }, { ten: 'asc' }],
  });
  const hash = await bcrypt.hash(MK, 10);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tài khoản');
  ws.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Họ tên', key: 'hoTen', width: 28 },
    { header: 'Đơn vị', key: 'donVi', width: 28 },
    { header: 'Chức vụ', key: 'chucVu', width: 22 },
    { header: 'Tên đăng nhập', key: 'tdn', width: 18 },
    { header: 'Mật khẩu ban đầu', key: 'mk', width: 18 },
    { header: 'Vai trò', key: 'vaiTro', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  let i = 0;
  for (const n of ds) {
    const cv = n.chucVu?.ten ?? '';
    const vaiTro = BGH.includes(cv) ? 'BAN_GIAM_HIEU' : TDV.includes(cv) ? 'TRUONG_DON_VI' : 'CAN_BO';
    await prisma.taiKhoan.create({
      data: { tenDangNhap: n.maCanBo, tenHienThi: n.hoTen, nhanSuId: n.id, vaiTro, matKhauHash: hash },
    });
    ws.addRow({ stt: ++i, hoTen: n.hoTen, donVi: n.donVi?.ten, chucVu: cv, tdn: n.maCanBo, mk: MK, vaiTro });
  }
  await wb.xlsx.writeFile('D:/Code/QLNV/TaiKhoan_CanBo.xlsx');
  console.log('Đã tạo', i, 'tài khoản');
}
main().catch(console.error).finally(() => prisma.$disconnect());
