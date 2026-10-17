import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  FileExcelOutlined,
  DownloadOutlined,
  CalendarOutlined,
  BarChartOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { taiFile } from '../api';

const { Title, Text, Paragraph } = Typography;

interface DeptSummaryRow {
  key: string;
  stt: string | number;
  ten: string;
  soLd: number;
  thang: number;
  quy: number;
  nam: number;
  truNam: number;
  thucLinhNam: number;
  isBold?: boolean;
  isHeader?: boolean;
}

const duLieuDonVi: DeptSummaryRow[] = [
  { key: 'sec1', stt: 'I', ten: 'KHỐI CÁN BỘ, GIẢNG VIÊN, VIÊN CHỨC (CBVC)', soLd: 238, thang: 3188025170, quy: 9564075510, nam: 38256302040, truNam: 3181180236, thucLinhNam: 35075121804, isHeader: true },
  { key: '1', stt: 1, ten: 'Ban Giám hiệu', soLd: 3, thang: 64899560, quy: 194698680, nam: 778794720, truNam: 60695712, thucLinhNam: 718099008 },
  { key: '2', stt: 2, ten: 'Phòng Tổ chức – Hành chính', soLd: 21, thang: 234055360, quy: 702166080, nam: 2808664320, truNam: 258211812, thucLinhNam: 2550452508 },
  { key: '3', stt: 3, ten: 'Phòng Kế hoạch – Tài chính', soLd: 9, thang: 102363800, quy: 307091400, nam: 1228365600, truNam: 117406692, thucLinhNam: 1110958908 },
  { key: '4', stt: 4, ten: 'Phòng Đào tạo', soLd: 32, thang: 440976470, quy: 1322929410, nam: 5291717640, truNam: 438800676, thucLinhNam: 4852916964 },
  { key: '5', stt: 5, ten: 'Phòng BĐCL và HTQT', soLd: 12, thang: 153219330, quy: 459657990, nam: 1838631960, truNam: 157317936, thucLinhNam: 1681314024 },
  { key: '6', stt: 6, ten: 'Phòng Công tác HSSV', soLd: 17, thang: 218804520, quy: 656413560, nam: 2625654240, truNam: 232932552, thucLinhNam: 2392721688 },
  { key: '7', stt: 7, ten: 'Khoa Khoa học Hàng hải', soLd: 30, thang: 426474510, quy: 1279423530, nam: 5117694120, truNam: 413585172, thucLinhNam: 4704108948 },
  { key: '8', stt: 8, ten: 'Khoa Kinh tế – Công nghệ', soLd: 20, thang: 259603300, quy: 778809900, nam: 3115239600, truNam: 251740548, thucLinhNam: 2863499052 },
  { key: '9', stt: 9, ten: 'Khoa Cơ – Điện', soLd: 30, thang: 403924620, quy: 1211773860, nam: 4847095440, truNam: 389166612, thucLinhNam: 4457928828 },
  { key: '10', stt: 10, ten: 'Trung tâm Đào tạo PTNL', soLd: 7, thang: 110447150, quy: 331341450, nam: 1325365800, truNam: 106313148, thucLinhNam: 1219052652 },
  { key: '11', stt: 11, ten: 'Khoa Điều khiển – Máy tàu thủy', soLd: 10, thang: 154663960, quy: 463991880, nam: 1855967520, truNam: 148679004, thucLinhNam: 1707288516 },
  { key: '12', stt: 12, ten: 'Khoa Khoa học CB & Quản trị số', soLd: 18, thang: 253091080, quy: 759273240, nam: 3037092960, truNam: 243261012, thucLinhNam: 2793831948 },
  { key: '13', stt: 13, ten: 'Khoa CN Ô tô – Điện – Công trình', soLd: 16, thang: 200507560, quy: 601522680, nam: 2406090720, truNam: 191395476, thucLinhNam: 2214695244 },
  { key: '14', stt: 14, ten: 'Trung tâm Đào tạo KTNV GTVT', soLd: 13, thang: 164993950, quy: 494981850, nam: 1979927400, truNam: 175169604, thucLinhNam: 1804757796 },
  
  { key: 'sec2', stt: 'II', ten: 'KHỐI LAO ĐỘNG HỢP ĐỒNG (NGHỊ ĐỊNH 111)', soLd: 27, thang: 185647112, quy: 556941336, nam: 2227765344, truNam: 156626964, thucLinhNam: 2071138380, isHeader: true },
  { key: '15', stt: 1, ten: 'HĐ 111 đóng BHXH (Kho bạc)', soLd: 17, thang: 124307112, quy: 372921336, nam: 1491685344, truNam: 156626964, thucLinhNam: 1335058380 },
  { key: '16', stt: 2, ten: 'HĐ 111 không đóng BHXH (Ngân hàng)', soLd: 10, thang: 61340000, quy: 184020000, nam: 736080000, truNam: 0, thucLinhNam: 736080000 },

  { key: 'tot', stt: '', ten: 'TỔNG CỘNG TOÀN TRƯỜNG', soLd: 265, thang: 3373672282, quy: 10121016846, nam: 40484067384, truNam: 3337807200, thucLinhNam: 37146260184, isBold: true },
];

export default function BangLuong() {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<'thang' | 'tonghop'>('thang');
  const [thang, setThang] = useState(10);
  const [nam, setNam] = useState(2026);
  const [quy, setQuy] = useState(4);
  const [luongCoSo, setLuongCoSo] = useState(2530000);
  const [dangTaiThang, setDangTaiThang] = useState(false);
  const [dangTaiTongHop, setDangTaiTongHop] = useState(false);

  const xuatExcelThang = async () => {
    setDangTaiThang(true);
    try {
      await taiFile('/bang-luong/xuat-excel');
      message.success('Đã tải xuống Bảng thanh toán tiền lương Tháng 10/2026 thành công!');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDangTaiThang(false);
    }
  };

  const xuatExcelTongHop = async () => {
    setDangTaiTongHop(true);
    try {
      await taiFile('/bang-luong/xuat-excel-tong-hop');
      message.success('Đã tải xuống Bảng tổng hợp lương Quý & Năm 2026 thành công!');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDangTaiTongHop(false);
    }
  };

  const columns = [
    {
      title: 'STT',
      dataIndex: 'stt',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (v: string | number, record: DeptSummaryRow) => {
        if (record.isHeader) return <Tag color="blue">{v}</Tag>;
        if (record.isBold) return <b>{v}</b>;
        return v;
      },
    },
    {
      title: 'Đơn Vị (Phòng / Khoa / TT)',
      dataIndex: 'ten',
      key: 'ten',
      render: (v: string, record: DeptSummaryRow) => {
        if (record.isHeader) return <Text strong style={{ color: '#0958d9', fontSize: 14 }}>{v}</Text>;
        if (record.isBold) return <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{v}</Text>;
        return v;
      },
    },
    {
      title: 'Số LĐ',
      dataIndex: 'soLd',
      key: 'soLd',
      width: 80,
      align: 'center' as const,
      render: (v: number, record: DeptSummaryRow) => (record.isBold || record.isHeader ? <b>{v}</b> : v),
    },
    {
      title: 'Quỹ Lương 1 Tháng',
      dataIndex: 'thang',
      key: 'thang',
      align: 'right' as const,
      render: (v: number, record: DeptSummaryRow) => {
        const text = `${v.toLocaleString('vi-VN')} đ`;
        return record.isBold || record.isHeader ? <b>{text}</b> : text;
      },
    },
    {
      title: 'Quỹ Lương 1 Quý (x3)',
      dataIndex: 'quy',
      key: 'quy',
      align: 'right' as const,
      render: (v: number, record: DeptSummaryRow) => {
        const text = `${v.toLocaleString('vi-VN')} đ`;
        return record.isBold || record.isHeader ? <Text strong style={{ color: '#d46b08' }}>{text}</Text> : text;
      },
    },
    {
      title: 'Quỹ Lương Cả Năm (x12)',
      dataIndex: 'nam',
      key: 'nam',
      align: 'right' as const,
      render: (v: number, record: DeptSummaryRow) => {
        const text = `${v.toLocaleString('vi-VN')} đ`;
        return record.isBold || record.isHeader ? <Text strong style={{ color: '#0958d9' }}>{text}</Text> : text;
      },
    },
    {
      title: 'Thực Lĩnh Cả Năm',
      dataIndex: 'thucLinhNam',
      key: 'thucLinhNam',
      align: 'right' as const,
      render: (v: number, record: DeptSummaryRow) => {
        const text = `${v.toLocaleString('vi-VN')} đ`;
        return record.isBold || record.isHeader ? <Text strong style={{ color: '#389e0d' }}>{text}</Text> : text;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 32 }}>
      {/* Banner giới thiệu */}
      <Card
        className="card-mem"
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          color: '#ffffff',
          borderRadius: 12,
        }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={15}>
            <Tag color="#10b981" style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, marginBottom: 8 }}>
              MẪU CHUẨN TRƯỜNG CAO ĐẲNG HÀNG HẢI VÀ ĐƯỜNG THỦY I – CỤC HÀNG HẢI VÀ ĐƯỜNG THỦY VN
            </Tag>
            <Title level={2} style={{ color: '#ffffff', margin: '4px 0 8px 0' }}>
              Quản Lý Tiền Lương, Hợp Đồng 111 & Tổng Hợp Quý / Năm
            </Title>
            <Paragraph style={{ color: '#d1fae5', margin: 0, fontSize: 14 }}>
              Hệ thống tự động đồng bộ bảng thanh toán tiền lương ngạch bậc, chức vụ, phụ cấp theo lương cơ sở mới 2.530.000 đ, lao động hợp đồng 111 và báo cáo tổng hợp quỹ lương Quý/Năm phục vụ quyết toán ngân sách.
            </Paragraph>
          </Col>
          <Col xs={24} md={9} style={{ textAlign: 'right' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined style={{ fontSize: 18 }} />}
                loading={dangTaiThang}
                onClick={xuatExcelThang}
                style={{
                  backgroundColor: '#10b981',
                  borderColor: '#10b981',
                  height: 46,
                  width: '100%',
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}
                id="nut-xuat-bang-luong-chinh"
              >
                📗 Xuất Bảng lương Tháng (Kèm HĐ111)
              </Button>
              <Button
                size="large"
                icon={<BarChartOutlined style={{ fontSize: 18 }} />}
                loading={dangTaiTongHop}
                onClick={xuatExcelTongHop}
                style={{
                  backgroundColor: '#f59e0b',
                  borderColor: '#f59e0b',
                  color: '#ffffff',
                  height: 46,
                  width: '100%',
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}
                id="nut-xuat-tong-hop-quy-nam"
              >
                📊 Xuất Bảng Tổng Hợp Quý, Năm
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs điều hướng */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'thang' | 'tonghop')}
        type="card"
        size="large"
        items={[
          {
            key: 'thang',
            label: (
              <span>
                <CalendarOutlined /> Bảng Lương Chi Trả Hàng Tháng
              </span>
            ),
          },
          {
            key: 'tonghop',
            label: (
              <span>
                <BarChartOutlined /> Bảng Tổng Hợp Theo Quý & Năm 2026
              </span>
            ),
          },
        ]}
      />

      {activeTab === 'thang' && (
        <Row gutter={[20, 20]}>
          <Col xs={24} md={8}>
            <Card title="⚙️ Thiết lập kỳ tính lương" className="card-mem" style={{ height: '100%' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Tháng tính lương:
                </Text>
                <Select
                  value={thang}
                  onChange={setThang}
                  style={{ width: '100%' }}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: i + 1,
                    label: `Tháng ${i + 1}`,
                  }))}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Năm:
                </Text>
                <Select
                  value={nam}
                  onChange={setNam}
                  style={{ width: '100%' }}
                  options={[2025, 2026, 2027, 2028].map((y) => ({ value: y, label: `Năm ${y}` }))}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Mức lương cơ sở áp dụng:
                </Text>
                <InputNumber
                  style={{ width: '100%' }}
                  value={luongCoSo}
                  onChange={(v) => setLuongCoSo(v ?? 2530000)}
                  step={10000}
                  formatter={(v) => (v ? `${Number(v).toLocaleString('vi-VN')} đ/tháng` : '')}
                  parser={(v) => (v && /\d/.test(v) ? Number(v.replace(/\D/g, '')) : 2530000) as unknown as 0}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  Đang áp dụng: <b>2.530.000 đ/tháng</b>
                </Text>
              </div>

              <Button
                type="primary"
                block
                size="large"
                icon={<FileExcelOutlined />}
                loading={dangTaiThang}
                onClick={xuatExcelThang}
                style={{ background: '#059669', borderColor: '#059669', fontWeight: 600, height: 44 }}
              >
                Tải Bảng Lương Tháng {thang}/{nam} (Excel)
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={16}>
            <Card title="📊 Thông tin tổng hợp bảng lương tháng" className="card-mem" style={{ height: '100%' }}>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Đơn vị thanh toán">
                  <b>Trường Cao đẳng Hàng hải và Đường thủy I</b>
                </Descriptions.Item>
                <Descriptions.Item label="Cơ quan chủ quản">
                  Cục Hàng hải và Đường thủy Việt Nam
                </Descriptions.Item>
                <Descriptions.Item label="Kỳ lương">
                  <Tag color="blue" style={{ fontSize: 13 }}>
                    Tháng {thang} năm {nam}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Mức lương cơ sở">
                  <Tag color="green" style={{ fontSize: 13, fontWeight: 600 }}>
                    {luongCoSo.toLocaleString('vi-VN')} đ/tháng
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Cán bộ viên chức (CBVC)">
                  <Text strong style={{ color: '#0958d9' }}>238 người</Text> (14 đơn vị)
                </Descriptions.Item>
                <Descriptions.Item label="Lao động hợp đồng (HĐ111)">
                  <Text strong style={{ color: '#d46b08' }}>27 người</Text> (Kho bạc + Ngân hàng)
                </Descriptions.Item>
                <Descriptions.Item label="Tổng số lao động toàn trường">
                  <Tag color="purple" style={{ fontSize: 13, fontWeight: 600 }}>
                    265 cán bộ, giảng viên & người lao động
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Các sheet trong file tải về">
                  <b>1. Bảng Lương T10-2026 | 2. HĐ111 | 3. TH_Theo_Don_Vi | 4. TH_Dien_Bien_4_Quy</b>
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 20 }}>
                <Alert
                  type="success"
                  showIcon
                  message="Đầy đủ công thức và mẫu biểu hành chính chuẩn"
                  description={
                    <ul style={{ paddingLeft: 20, margin: '8px 0 0 0', fontSize: 13 }}>
                      <li>
                        <strong>Bảng Lương Viên chức</strong>: Tự động tính các mức phụ cấp (chức vụ, vượt khung, thâm niên nhà giáo, ưu đãi nghề 30%-40%).
                      </li>
                      <li>
                        <strong>Sheet HĐ111</strong>: Lao động hợp đồng cố định chi trả qua Kho bạc (đóng 10.5% BHXH) và qua Ngân hàng (không đóng BHXH).
                      </li>
                      <li>
                        <strong>Sheet Tổng hợp Quý - Năm</strong>: Tổng hợp quỹ lương các phòng khoa theo Quý và cả Năm 2026.
                      </li>
                    </ul>
                  }
                />
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === 'tonghop' && (
        <div>
          {/* 4 Thẻ thống kê nổi bật */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="card-mem" bordered={false} style={{ background: '#f0fdf4', borderLeft: '4px solid #10b981' }}>
                <Statistic
                  title={<span style={{ fontWeight: 600, color: '#065f46' }}>Tổng Lao Động Toàn Trường</span>}
                  value={265}
                  suffix="người"
                  prefix={<TeamOutlined style={{ color: '#10b981' }} />}
                  valueStyle={{ color: '#047857', fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>238 CBVC + 27 Hợp đồng 111</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="card-mem" bordered={false} style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
                <Statistic
                  title={<span style={{ fontWeight: 600, color: '#1e40af' }}>Quỹ Tiền Lương 1 Tháng</span>}
                  value={3.37}
                  precision={2}
                  suffix="tỷ VNĐ"
                  prefix={<DollarCircleOutlined style={{ color: '#3b82f6' }} />}
                  valueStyle={{ color: '#1d4ed8', fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>3.373.672.282 đ / tháng</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="card-mem" bordered={false} style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
                <Statistic
                  title={<span style={{ fontWeight: 600, color: '#92400e' }}>Quỹ Tiền Lương 1 Quý</span>}
                  value={10.12}
                  precision={2}
                  suffix="tỷ VNĐ"
                  prefix={<BarChartOutlined style={{ color: '#f59e0b' }} />}
                  valueStyle={{ color: '#b45309', fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>10.121.016.846 đ / quý (x3)</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="card-mem" bordered={false} style={{ background: '#faf5ff', borderLeft: '4px solid #a855f7' }}>
                <Statistic
                  title={<span style={{ fontWeight: 600, color: '#6b21a8' }}>Tổng Quỹ Lương Năm 2026</span>}
                  value={40.48}
                  precision={2}
                  suffix="tỷ VNĐ"
                  prefix={<BankOutlined style={{ color: '#a855f7' }} />}
                  valueStyle={{ color: '#7e22ce', fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>40.484.067.384 đ / năm (x12)</Text>
              </Card>
            </Col>
          </Row>

          {/* Bảng chi tiết tổng hợp */}
          <Card
            className="card-mem"
            title="📋 Bảng Tổng Hợp Quỹ Lương Chi Tiết Theo Đơn Vị (14 Phòng/Khoa + HĐ 111)"
            extra={
              <Space>
                <Select
                  value={quy}
                  onChange={setQuy}
                  style={{ width: 140 }}
                  options={[
                    { value: 1, label: 'Quý I (T1-T3)' },
                    { value: 2, label: 'Quý II (T4-T6)' },
                    { value: 3, label: 'Quý III (T7-T9)' },
                    { value: 4, label: 'Quý IV (T10-T12)' },
                  ]}
                />
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  loading={dangTaiTongHop}
                  onClick={xuatExcelTongHop}
                  style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 600 }}
                >
                  Tải File Excel Báo Cáo Tổng Hợp
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={duLieuDonVi}
              columns={columns}
              pagination={false}
              size="middle"
              bordered
              rowClassName={(record) => {
                if (record.isBold) return 'ant-table-row-selected';
                if (record.isHeader) return 'bg-gray-100 font-semibold';
                return '';
              }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
