import { Avatar, Badge, Dropdown, Layout, Menu } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  FormOutlined,
  ScheduleOutlined,
  DashboardOutlined,
  IdcardOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  RiseOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { chuCaiDau, VaiTro, xemDanhSach } from '../constants';

const { Sider, Header, Content } = Layout;

interface Muc {
  key: string;
  icon: React.ReactNode;
  label: string;
  vaiTro?: VaiTro[];
  canNhanSu?: boolean;
}

const QUAN_LY: VaiTro[] = ['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'KE_TOAN', 'DAO_TAO', 'TRUONG_DON_VI'];
const NGUOI_DUYET: VaiTro[] = ['QUAN_TRI', 'BAN_GIAM_HIEU', 'TCHC', 'TRUONG_DON_VI'];

const MENU: Muc[] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan', vaiTro: QUAN_LY },
  { key: '/nhan-su', icon: <TeamOutlined />, label: 'Hồ sơ nhân sự', vaiTro: QUAN_LY },
  { key: '/to-chuc', icon: <ApartmentOutlined />, label: 'Cơ cấu tổ chức', vaiTro: QUAN_LY },
  { key: '/nang-luong', icon: <RiseOutlined />, label: 'Nâng lương', vaiTro: QUAN_LY },
  { key: '/danh-muc-luong', icon: <TableOutlined />, label: 'Danh mục lương', vaiTro: QUAN_LY },
  { key: '/ho-so-cua-toi', icon: <IdcardOutlined />, label: 'Hồ sơ của tôi', canNhanSu: true },
  { key: '/nghi-phep', icon: <CalendarOutlined />, label: 'Nghỉ phép của tôi', canNhanSu: true },
  { key: '/duyet-nghi-phep', icon: <FormOutlined />, label: 'Duyệt đơn nghỉ', vaiTro: NGUOI_DUYET },
  { key: '/quan-ly-phep', icon: <ScheduleOutlined />, label: 'Quản lý phép năm', vaiTro: NGUOI_DUYET },
  { key: '/cham-cong', icon: <FieldTimeOutlined />, label: 'Chấm công', vaiTro: [...NGUOI_DUYET, 'KE_TOAN'] },
  { key: '/tai-khoan', icon: <SafetyCertificateOutlined />, label: 'Tài khoản & phân quyền', vaiTro: ['QUAN_TRI'] },
  { key: '/nhat-ky', icon: <AuditOutlined />, label: 'Nhật ký hệ thống', vaiTro: ['QUAN_TRI'] },
];

const TIEU_DE: [RegExp, string][] = [
  [/^\/$/, 'Tổng quan'],
  [/^\/nhan-su\/moi/, 'Thêm hồ sơ cán bộ'],
  [/^\/nhan-su\/.+/, 'Hồ sơ cán bộ'],
  [/^\/nhan-su/, 'Hồ sơ nhân sự'],
  [/^\/to-chuc/, 'Cơ cấu tổ chức'],
  [/^\/nang-luong/, 'Nâng bậc lương thường xuyên & vượt khung'],
  [/^\/danh-muc-luong/, 'Danh mục lương'],
  [/^\/ho-so-cua-toi/, 'Hồ sơ của tôi'],
  [/^\/nghi-phep/, 'Nghỉ phép của tôi'],
  [/^\/duyet-nghi-phep/, 'Duyệt đơn xin nghỉ'],
  [/^\/quan-ly-phep/, 'Quản lý phép năm'],
  [/^\/cham-cong/, 'Bảng chấm công'],
  [/^\/tai-khoan/, 'Tài khoản & phân quyền'],
  [/^\/nhat-ky/, 'Nhật ký hệ thống'],
  [/^\/doi-mat-khau/, 'Đổi mật khẩu'],
];

export default function AppLayout() {
  const { nguoiDung, dangXuat } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const duyet = !!nguoiDung && NGUOI_DUYET.includes(nguoiDung.vaiTro);
  const soCho = useQuery({
    queryKey: ['so-cho-duyet'],
    enabled: duyet,
    refetchInterval: 60_000,
    queryFn: () => api<{ soLuong: number }>('/nghi-phep/don/cho-duyet/so-luong'),
  });
  if (!nguoiDung) return null;

  const items = MENU.filter(
    (m) => (!m.vaiTro || m.vaiTro.includes(nguoiDung.vaiTro)) && (!m.canNhanSu || nguoiDung.nhanSuId),
  ).map(({ key, icon, label }) => ({
    key,
    icon,
    label:
      key === '/duyet-nghi-phep' ? (
        <span>
          {label} <Badge count={soCho.data?.soLuong ?? 0} size="small" offset={[6, -2]} />
        </span>
      ) : (
        label
      ),
  }));

  const chon =
    items
      .map((i) => i.key)
      .filter((k) => (k === '/' ? loc.pathname === '/' : loc.pathname.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0] ?? '';
  const tieuDe = TIEU_DE.find(([re]) => re.test(loc.pathname))?.[1] ?? '';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={256} breakpoint="lg" collapsedWidth={72} className="sider">
        <div className="logo" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
          <img
            src="/logo.png"
            alt="MIC1"
            style={{
              width: 42,
              height: 42,
              objectFit: 'contain',
              background: '#ffffff',
              borderRadius: 8,
              padding: 2,
              flex: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          />
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <b style={{ fontSize: 14.5, display: 'block', lineHeight: 1.25, color: '#ffffff' }}>Quản lý Nhân sự</b>
            <small
              style={{
                fontSize: 10.5,
                color: '#94a3b8',
                lineHeight: 1.2,
                display: 'block',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title="Trường Cao đẳng Hàng hải và Đường thủy I"
            >
              CĐ Hàng hải &amp; Đường thủy I
            </small>
          </div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[chon]} items={items} onClick={(e) => nav(e.key)} />
      </Sider>
      <Layout>
        <Header className="header">
          <h1>{tieuDe}</h1>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                ...(xemDanhSach(nguoiDung.vaiTro) && nguoiDung.nhanSuId
                  ? [{ key: 'hs', icon: <IdcardOutlined />, label: 'Hồ sơ của tôi', onClick: () => nav('/ho-so-cua-toi') }]
                  : []),
                { key: 'mk', icon: <KeyOutlined />, label: 'Đổi mật khẩu', onClick: () => nav('/doi-mat-khau') },
                { type: 'divider' as const },
                { key: 'out', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: dangXuat },
              ],
            }}
          >
            <div className="user-chip" id="menu-nguoi-dung">
              <div className="ten">
                <b>{nguoiDung.hoTen}</b>
                <small>
                  {nguoiDung.tenVaiTro}
                  {nguoiDung.phamVi ? ` · ${nguoiDung.phamVi}` : ''}
                </small>
              </div>
              <Avatar style={{ background: 'linear-gradient(135deg,#14b8a6,#0b4f5c)' }}>{chuCaiDau(nguoiDung.hoTen)}</Avatar>
            </div>
          </Dropdown>
        </Header>
        <Content className="content" key={loc.pathname}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
