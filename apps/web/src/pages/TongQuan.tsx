interface CanBoDenHanBoNhiem {
  id: string;
  maCanBo: string;
  hoTen: string;
  tinhTrang: string;
  soNgayConLaiNhiemKy: number | null;
  moTa: string;
  chucVu: { ten: string; capQuanLy: number } | null;
  donVi: { ten: string } | null;
  ngayHetHan: string | null;
}
import { Button, Card, Col, Empty, List, Row, Skeleton, Tag, Typography } from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  GiftOutlined,
  IdcardOutlined,
  ReadOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { api } from '../api';
import { fmtNgay, NHAN_GIOI_TINH, NHAN_LOAI_NS, NHAN_TRINH_DO } from '../constants';
import type { DongDenHan, HopDongSapHet } from './NangLuong';

interface TongQuanData {
  tongSo: number;
  soGiangVien: number;
  soChuyenVien: number;
  theoGioiTinh: Record<string, number>;
  theoLoai: Record<string, number>;
  theoTrinhDo: Record<string, number>;
  theoCoSo: Record<string, number>;
  theoDonVi: Record<string, number>;
  theoDoTuoi: Record<string, number>;
  sapNghiHuu: { id: string; hoTen: string; donVi: string; ngayNghiHuu: string }[];
  sinhNhatThangNay: { id: string; hoTen: string; donVi: string; ngay: number }[];
  chungChiSapHetHan: { id: string; ten: string; ngayHetHan: string; nhanSu: { id: string; hoTen: string } }[];
}

const BANG_MAU = ['#0e7c86', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#84cc16', '#f97316', '#64748b'];

function TheSo({ icon, so, nhan, mau }: { icon: React.ReactNode; so: number | string; nhan: string; mau: string }) {
  return (
    <Card className="the-so" style={{ color: mau }}>
      <div className="icon" style={{ background: `linear-gradient(135deg, ${mau}, ${mau}cc)` }}>
        {icon}
      </div>
      <div className="so">{so}</div>
      <div className="nhan">{nhan}</div>
    </Card>
  );
}

const thanhMang = (m: Record<string, number>, nhan?: Record<string, string>) =>
  Object.entries(m).map(([k, v]) => ({ ten: nhan?.[k] ?? (k === 'CHUA_RO' ? 'Chưa rõ' : k), so: v }));

const KHONG_CO = { emptyText: <Empty description="Không có" image={Empty.PRESENTED_IMAGE_SIMPLE} /> };
const THAN_CUON = { body: { maxHeight: 380, overflow: 'auto' as const } };

export default function TongQuan() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['tong-quan'], queryFn: () => api<TongQuanData>('/thong-ke/tong-quan') });
  const { data: denHan } = useQuery({ queryKey: ['nang-luong', 'den-han', 'mac-dinh'], queryFn: () => api<DongDenHan[]>('/nang-luong/den-han') });
  const { data: hopDong } = useQuery({ queryKey: ['hop-dong', 'sap-het-han'], queryFn: () => api<HopDongSapHet[]>('/hop-dong/sap-het-han') });
  const { data: boNhiemDenHan } = useQuery({
    queryKey: ['bo-nhiem', 'den-han'],
    queryFn: () => api<CanBoDenHanBoNhiem[]>('/bo-nhiem/den-han'),
  });

  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 12 }} />;

  const trinhDo = Object.keys(NHAN_TRINH_DO)
    .concat('CHUA_RO')
    .filter((k) => data.theoTrinhDo[k])
    .map((k) => ({ ten: NHAN_TRINH_DO[k as keyof typeof NHAN_TRINH_DO] ?? 'Chưa rõ', so: data.theoTrinhDo[k] }));
  const gioiTinh = thanhMang(data.theoGioiTinh, NHAN_GIOI_TINH);
  const loai = thanhMang(data.theoLoai, NHAN_LOAI_NS);
  const doTuoi = thanhMang(data.theoDoTuoi);
  const donVi = thanhMang(data.theoDonVi).sort((a, b) => b.so - a.so).slice(0, 10);
  const vienChuc = data.theoLoai.VIEN_CHUC ?? 0;
  const saudh = (data.theoTrinhDo.TIEN_SI ?? 0) + (data.theoTrinhDo.THAC_SI ?? 0);

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(120deg, #0b4f5c 0%, #0e7c86 60%, #14a3a0 100%)',
          borderRadius: 16,
          padding: '18px 24px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(14, 124, 134, 0.16)',
        }}
      >
        <img
          src="/logo.png"
          alt="MIC1"
          style={{
            width: 58,
            height: 58,
            objectFit: 'contain',
            background: '#ffffff',
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            flex: 'none',
          }}
        />
        <div>
          <div style={{ textTransform: 'uppercase', fontSize: 12.5, letterSpacing: 0.5, opacity: 0.9, fontWeight: 600 }}>
            Trường Cao đẳng Hàng hải và Đường thủy I
          </div>
          <h2 style={{ margin: '2px 0 0', color: '#ffffff', fontSize: 21, fontWeight: 700 }}>
            Hệ thống Quản lý Nhân sự &amp; Hồ sơ Cán bộ
          </h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
        <TheSo icon={<TeamOutlined />} so={data.tongSo} nhan="Cán bộ đang làm việc" mau="#0e7c86" />
        <TheSo icon={<ReadOutlined />} so={data.soGiangVien} nhan="Giảng viên" mau="#6366f1" />
        <TheSo icon={<IdcardOutlined />} so={data.soChuyenVien ?? 0} nhan="Chuyên viên" mau="#10b981" />
        <TheSo
          icon={<SafetyCertificateOutlined />}
          so={data.tongSo ? `${Math.round((saudh / data.tongSo) * 100)}%` : '0%'}
          nhan={`Trình độ sau đại học (${saudh} người)`}
          mau="#f59e0b"
        />
        <TheSo icon={<UserSwitchOutlined />} so={vienChuc} nhan="Viên chức" mau="#ec4899" />
      </div>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={8}>
          <Card
            className="card-mem"
            styles={THAN_CUON}
            title={
              <>
                <RiseOutlined /> Nâng lương trong 3 tháng{' '}
                {denHan?.length ? <Tag color="green">{denHan.length}</Tag> : null}
              </>
            }
            extra={
              <Button type="link" onClick={() => nav('/nang-luong')} id="xem-nang-luong">
                Xem
              </Button>
            }
          >
            <List
              locale={KHONG_CO}
              dataSource={denHan ?? []}
              renderItem={(x) => (
                <List.Item extra={<Tag color={x.quaHan ? 'red' : 'green'}>{fmtNgay(x.ngayDenHan)}</Tag>}>
                  <List.Item.Meta
                    title={<Link to={`/nhan-su/${x.nhanSuId}`}>{x.hoTen}</Link>}
                    description={
                      x.loai === 'NANG_BAC'
                        ? `${x.ngach.ma}: bậc ${x.bacHienTai} → ${x.bacMoi} (hệ số ${x.heSoMoi.toFixed(2)})`
                        : `${x.ngach.ma}: vượt khung ${x.vuotKhungHienTai}% → ${x.vuotKhungMoi}%`
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="card-mem"
            styles={THAN_CUON}
            title={
              <>
                <FileProtectOutlined /> Hợp đồng hết hạn trong 60 ngày{' '}
                {hopDong?.length ? <Tag color="orange">{hopDong.length}</Tag> : null}
              </>
            }
          >
            <List
              locale={KHONG_CO}
              dataSource={hopDong ?? []}
              renderItem={(x) => (
                <List.Item
                  extra={
                    <Tag color={x.soNgayConLai < 0 ? 'red' : x.soNgayConLai <= 15 ? 'orange' : 'gold'}>
                      {fmtNgay(x.denNgay)} · {x.soNgayConLai < 0 ? `quá ${-x.soNgayConLai} ngày` : `còn ${x.soNgayConLai} ngày`}
                    </Tag>
                  }
                >
                  <List.Item.Meta
                    title={<Link to={`/nhan-su/${x.nhanSuId}?tab=hop-dong`}>{x.hoTen}</Link>}
                    description={`${x.tenLoai}${x.soHopDong ? ` · số ${x.soHopDong}` : ''} · ${x.donVi}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="card-mem"
            styles={THAN_CUON}
            title={
              <>
                <AuditOutlined style={{ color: '#d97706' }} /> Bổ nhiệm lại CBQL (Mốc 90 ngày){' '}
                {boNhiemDenHan?.length ? (
                  <Tag color={boNhiemDenHan.some((b) => b.tinhTrang === 'QUA_HAN') ? 'red' : 'orange'}>
                    {boNhiemDenHan.length}
                  </Tag>
                ) : null}
              </>
            }
            extra={
              <Button type="link" onClick={() => nav('/bo-nhiem')} id="xem-bo-nhiem">
                Chi tiết & QĐ
              </Button>
            }
          >
            <List
              locale={KHONG_CO}
              dataSource={boNhiemDenHan ?? []}
              renderItem={(x) => (
                <List.Item
                  extra={
                    <Tag color={x.tinhTrang === 'QUA_HAN' ? 'error' : 'warning'}>
                      {x.tinhTrang === 'QUA_HAN'
                        ? `Quá ${Math.abs(x.soNgayConLaiNhiemKy ?? 0)} ngày`
                        : `Còn ${x.soNgayConLaiNhiemKy} ngày`}
                    </Tag>
                  }
                >
                  <List.Item.Meta
                    title={<Link to={`/nhan-su/${x.id}`}>{x.hoTen}</Link>}
                    description={`${x.chucVu?.ten || ''} · ${x.donVi?.ten || ''}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={14}>
          <Card className="card-mem" title="Cơ cấu theo trình độ chuyên môn">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trinhDo} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ten" tickLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, 'Số người']} />
                <Bar dataKey="so" radius={[8, 8, 0, 0]} maxBarSize={56}>
                  {trinhDo.map((_, i) => (
                    <Cell key={i} fill={BANG_MAU[i % BANG_MAU.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="card-mem" title="Giới tính">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={gioiTinh} dataKey="so" nameKey="ten" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {gioiTinh.map((_, i) => (
                    <Cell key={i} fill={['#0e7c86', '#ec4899'][i % 2]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card className="card-mem" title="Loại nhân sự">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={loai} dataKey="so" nameKey="ten" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {loai.map((_, i) => (
                    <Cell key={i} fill={BANG_MAU[(i + 1) % BANG_MAU.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="card-mem" title="Độ tuổi">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={doTuoi} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ten" tickLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, 'Số người']} />
                <Bar dataKey="so" fill="#14b8a6" radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card className="card-mem" title="Số cán bộ theo đơn vị (10 đơn vị đông nhất)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={donVi} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} />
                <YAxis type="category" dataKey="ten" width={170} tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [v, 'Số người']} />
                <Bar dataKey="so" fill="#6366f1" radius={[0, 8, 8, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={8}>
          <Card className="card-mem" styles={THAN_CUON} title={<><CalendarOutlined /> Dự kiến nghỉ hưu trong 12 tháng</>}>
            <List
              locale={KHONG_CO}
              dataSource={data.sapNghiHuu}
              renderItem={(x) => (
                <List.Item extra={<Tag color="orange">{fmtNgay(x.ngayNghiHuu)}</Tag>}>
                  <List.Item.Meta title={<Link to={`/nhan-su/${x.id}`}>{x.hoTen}</Link>} description={x.donVi} />
                </List.Item>
              )}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tính theo lộ trình tuổi nghỉ hưu của BLLĐ 2019 (điều kiện lao động bình thường).
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="card-mem" styles={THAN_CUON} title={<><SafetyCertificateOutlined /> Chứng chỉ hết hạn trong 60 ngày</>}>
            <List
              locale={KHONG_CO}
              dataSource={data.chungChiSapHetHan}
              renderItem={(x) => (
                <List.Item extra={<Tag color="red">{fmtNgay(x.ngayHetHan)}</Tag>}>
                  <List.Item.Meta title={<Link to={`/nhan-su/${x.nhanSu.id}`}>{x.nhanSu.hoTen}</Link>} description={x.ten} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="card-mem" styles={THAN_CUON} title={<><GiftOutlined /> Sinh nhật trong tháng</>}>
            <List
              locale={KHONG_CO}
              dataSource={data.sinhNhatThangNay}
              renderItem={(x) => (
                <List.Item extra={<Tag color="magenta">Ngày {x.ngay}</Tag>}>
                  <List.Item.Meta title={<Link to={`/nhan-su/${x.id}`}>{x.hoTen}</Link>} description={x.donVi} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
