import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { ReactNode } from 'react';
import { useAuth } from './auth';
import { VaiTro, xemDanhSach } from './constants';
import AppLayout from './layout/AppLayout';
import DangNhap from './pages/DangNhap';
import DoiMatKhau from './pages/DoiMatKhau';
import TongQuan from './pages/TongQuan';
import NhanSuList from './pages/NhanSuList';
import NhanSuChiTiet from './pages/NhanSuChiTiet';
import ToChuc from './pages/ToChuc';
import BoNhiem from './pages/BoNhiem';
import TaiKhoan from './pages/TaiKhoan';
import NhatKy from './pages/NhatKy';
import NangLuong from './pages/NangLuong';
import BangLuong from './pages/BangLuong';
import DanhMucLuong from './pages/DanhMucLuong';
import NghiPhepCuaToi from './pages/NghiPhepCuaToi';
import DuyetNghiPhep from './pages/DuyetNghiPhep';
import QuanLyPhepNam from './pages/QuanLyPhepNam';
import ChamCong from './pages/ChamCong';

function ChiCho({ vaiTro, children }: { vaiTro: VaiTro[]; children: ReactNode }) {
  const { nguoiDung } = useAuth();
  return nguoiDung && vaiTro.includes(nguoiDung.vaiTro) ? <>{children}</> : <Navigate to="/" replace />;
}

const QUAN_LY: VaiTro[] = ['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'KE_TOAN', 'DAO_TAO', 'TRUONG_DON_VI'];

export default function App() {
  const { nguoiDung, dangTai } = useAuth();

  if (dangTai) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!nguoiDung) {
    return (
      <Routes>
        <Route path="*" element={<DangNhap />} />
      </Routes>
    );
  }
  if (nguoiDung.phaiDoiMatKhau) return <DoiMatKhau batBuoc />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={xemDanhSach(nguoiDung.vaiTro) ? <TongQuan /> : <Navigate to="/ho-so-cua-toi" replace />}
        />
        <Route path="ho-so-cua-toi" element={<NhanSuChiTiet cuaToi />} />
        <Route path="nghi-phep" element={<NghiPhepCuaToi />} />
        <Route path="duyet-nghi-phep" element={<ChiCho vaiTro={['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'TRUONG_DON_VI']}><DuyetNghiPhep /></ChiCho>} />
        <Route path="quan-ly-phep" element={<ChiCho vaiTro={['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'TRUONG_DON_VI']}><QuanLyPhepNam /></ChiCho>} />
        <Route path="cham-cong" element={<ChiCho vaiTro={['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'KE_TOAN', 'TRUONG_DON_VI']}><ChamCong /></ChiCho>} />
        <Route path="nhan-su" element={<ChiCho vaiTro={QUAN_LY}><NhanSuList /></ChiCho>} />
        <Route path="nhan-su/moi" element={<ChiCho vaiTro={['QUAN_TRI', 'TCHC']}><NhanSuChiTiet taoMoi /></ChiCho>} />
        <Route path="nhan-su/:id" element={<NhanSuChiTiet />} />
        <Route path="to-chuc" element={<ChiCho vaiTro={QUAN_LY}><ToChuc /></ChiCho>} />
        <Route path="bo-nhiem" element={<ChiCho vaiTro={QUAN_LY}><BoNhiem /></ChiCho>} />
        <Route path="nang-luong" element={<ChiCho vaiTro={QUAN_LY}><NangLuong /></ChiCho>} />
        <Route path="bang-luong" element={<ChiCho vaiTro={QUAN_LY}><BangLuong /></ChiCho>} />
        <Route path="danh-muc-luong" element={<ChiCho vaiTro={QUAN_LY}><DanhMucLuong /></ChiCho>} />
        <Route path="tai-khoan" element={<ChiCho vaiTro={['QUAN_TRI']}><TaiKhoan /></ChiCho>} />
        <Route path="nhat-ky" element={<ChiCho vaiTro={['QUAN_TRI']}><NhatKy /></ChiCho>} />
        <Route path="doi-mat-khau" element={<DoiMatKhau />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
