import { useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  RiseOutlined,
  StarFilled,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { Link } from 'react-router-dom';
import { api, ApiError, taiFile } from '../api';
import { useAuth } from '../auth';
import { coQuyenSua, fmtHeSo, fmtNgay, toIso } from '../constants';
import { cayDonVi, useCoSo, useDonVi } from '../danh-muc';

export interface DongDenHan {
  nhanSuId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  ngach: { id: string; ma: string; ten: string };
  bacHienTai: number;
  heSoHienTai: number;
  vuotKhungHienTai: number;
  mocNangBac: string;
  mocNangBacDieuChinh?: string;
  soThangKeoDai?: number;
  lyDoKeoDai?: string;
  loai: 'NANG_BAC' | 'VUOT_KHUNG';
  ngayDenHan: string;
  bacMoi: number;
  heSoMoi: number;
  vuotKhungMoi: number;
  quaHan: boolean;
}

export interface HopDongSapHet {
  nhanSuId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  hopDongId: string;
  soHopDong: string | null;
  loai: string;
  tenLoai: string;
  denNgay: string;
  soNgayConLai: number;
}

export interface UngVienTruocThoiHan {
  nhanSuId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  chucVu?: string;
  ngach: { id: string; ma: string; ten: string };
  bacHienTai: number;
  heSoHienTai: number;
  vuotKhungHienTai?: number;
  mocNangBac: string;
  mocNangBacDieuChinh?: string;
  soThangKeoDai?: number;
  lyDoKeoDai?: string;
  ngayDenHanThuongXuyen: string;
  soThangConThieu: number;
  bacMoi: number;
  heSoMoi: number;
  daNangTruocThoiHanLanTruoc: boolean;
  lyDoKhongDuDieuKien?: string;
  ngayHuong12Thang: string;
  ngayHuong9Thang: string;
  ngayHuong6Thang: string;
}

export interface KetQuaTruocThoiHan {
  nam: number;
  mocXet: string;
  tongVienChuc: number;
  chiTieu10PhanTram: number;
  danhSach: UngVienTruocThoiHan[];
}

const KY_HAN: { label: string; value: number }[] = [
  { label: '1 tháng', value: 1 },
  { label: '3 tháng', value: 3 },
  { label: '6 tháng', value: 6 },
  { label: '12 tháng', value: 12 },
];

export default function NangLuong() {
  const { nguoiDung } = useAuth();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const sua = coQuyenSua(nguoiDung?.vaiTro);

  const [tabHienTai, setTabHienTai] = useState<'thuong-xuyen' | 'truoc-thoi-han'>('thuong-xuyen');

  // ------------------------------------------------------------- State Nâng thường xuyên
  const [kyHan, setKyHan] = useState(3);
  const [donViId, setDonViId] = useState<string>();
  const [chon, setChon] = useState<string[]>([]);
  const [moQd, setMoQd] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [form] = Form.useForm<{ soQuyetDinh: string; ngayQuyetDinh: Dayjs; ghiChu?: string }>();

  // ------------------------------------------------------------- State Nâng trước thời hạn
  const [namXet, setNamXet] = useState<number>(dayjs().year());
  const [donViIdTruocHan, setDonViIdTruocHan] = useState<string>();
  const [chonTruocHan, setChonTruocHan] = useState<string[]>([]);
  const [cauHinhRutNgan, setCauHinhRutNgan] = useState<
    Record<string, { soThangRutNgan: 6 | 9 | 12; lyDoKhenThuong?: string }>
  >({});
  const [moQdTruocHan, setMoQdTruocHan] = useState(false);
  const [dangLuuTruocHan, setDangLuuTruocHan] = useState(false);
  const [formTruocHan] = Form.useForm<{ soQuyetDinh: string; ngayQuyetDinh: Dayjs; ghiChu?: string }>();

  const { data: coSos } = useCoSo();
  const { data: donVis } = useDonVi();
  const cay = useMemo(() => cayDonVi(coSos, donVis), [coSos, donVis]);

  // Query Nâng lương thường xuyên
  const denNgay = useMemo(() => dayjs().add(kyHan, 'month').format('YYYY-MM-DD'), [kyHan]);
  const query = { denNgay, donViId };
  const { data = [], isLoading } = useQuery({
    queryKey: ['nang-luong', 'den-han', query],
    queryFn: () => api<DongDenHan[]>('/nang-luong/den-han', { query }),
    enabled: tabHienTai === 'thuong-xuyen',
  });

  const soNangBac = data.filter((d) => d.loai === 'NANG_BAC').length;
  const soQuaHan = data.filter((d) => d.quaHan).length;

  // Query Nâng lương trước thời hạn
  const queryTruocHan = { nam: namXet, donViId: donViIdTruocHan };
  const { data: dataTruocHan, isLoading: dangTaiTruocHan } = useQuery({
    queryKey: ['nang-luong', 'truoc-thoi-han', queryTruocHan],
    queryFn: () => api<KetQuaTruocThoiHan>('/nang-luong/truoc-thoi-han', { query: queryTruocHan }),
    enabled: tabHienTai === 'truoc-thoi-han',
  });

  const danhSachTruocHan = dataTruocHan?.danhSach ?? [];
  const tongVienChuc = dataTruocHan?.tongVienChuc ?? 0;
  const chiTieu10 = dataTruocHan?.chiTieu10PhanTram ?? 0;
  const soDuDieuKien = danhSachTruocHan.filter((d) => !d.daNangTruocThoiHanLanTruoc).length;
  const vuotChiTieu = chonTruocHan.length > chiTieu10;

  // Xử lý lập quyết định thường xuyên
  const lap = async () => {
    const v = await form.validateFields();
    setDangLuu(true);
    try {
      const r = await api<{ soLuong: number }>('/nang-luong/lap-quyet-dinh', {
        method: 'POST',
        body: { nhanSuIds: chon, soQuyetDinh: v.soQuyetDinh, ngayQuyetDinh: toIso(v.ngayQuyetDinh), ghiChu: v.ghiChu ?? null },
      });
      message.success(`Đã cập nhật quá trình lương cho ${r.soLuong} cán bộ`);
      setMoQd(false);
      setChon([]);
      qc.invalidateQueries({ queryKey: ['nang-luong'] });
      qc.invalidateQueries({ queryKey: ['ho-so-con'] });
      qc.invalidateQueries({ queryKey: ['uoc-tinh'] });
    } catch (e) {
      const err = e as ApiError;
      if (err.loi?.length) form.setFields(err.loi.map((l) => ({ name: l.truong as 'soQuyetDinh', errors: [l.loi] })));
      message.error(err.message);
    } finally {
      setDangLuu(false);
    }
  };

  // Xử lý lập quyết định trước thời hạn
  const lapTruocThoiHan = async () => {
    const v = await formTruocHan.validateFields();
    setDangLuuTruocHan(true);
    try {
      const danhSachGui = chonTruocHan.map((id) => ({
        nhanSuId: id,
        soThangRutNgan: cauHinhRutNgan[id]?.soThangRutNgan ?? (12 as 6 | 9 | 12),
        lyDoKhenThuong: cauHinhRutNgan[id]?.lyDoKhenThuong ?? '',
      }));

      const r = await api<{ soLuong: number }>('/nang-luong/truoc-thoi-han/lap-quyet-dinh', {
        method: 'POST',
        body: {
          soQuyetDinh: v.soQuyetDinh,
          ngayQuyetDinh: toIso(v.ngayQuyetDinh),
          ghiChu: v.ghiChu ?? null,
          danhSach: danhSachGui,
        },
      });

      message.success(`Đã lập Quyết định nâng lương trước thời hạn cho ${r.soLuong} cán bộ thành công!`);
      setMoQdTruocHan(false);
      setChonTruocHan([]);
      qc.invalidateQueries({ queryKey: ['nang-luong'] });
      qc.invalidateQueries({ queryKey: ['ho-so-con'] });
      qc.invalidateQueries({ queryKey: ['uoc-tinh'] });
    } catch (e) {
      const err = e as ApiError;
      if (err.loi?.length) formTruocHan.setFields(err.loi.map((l) => ({ name: l.truong as 'soQuyetDinh', errors: [l.loi] })));
      message.error(err.message);
    } finally {
      setDangLuuTruocHan(false);
    }
  };

  // Cột bảng Nâng thường xuyên
  const cotThuongXuyen: ColumnsType<DongDenHan> = [
    {
      title: 'Cán bộ',
      key: 'canBo',
      render: (_, r) => (
        <div>
          <Link to={`/nhan-su/${r.nhanSuId}?tab=luong`} style={{ fontWeight: 600 }}>
            {r.hoTen}
          </Link>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            <span className="ma-cccd">{r.maCanBo}</span> • {r.donVi}
          </div>
        </div>
      ),
    },
    { title: 'Ngạch', key: 'ngach', width: 110, render: (_, r) => <span title={r.ngach.ten}>{r.ngach.ma}</span> },
    {
      title: 'Hiện hưởng',
      key: 'hienTai',
      width: 150,
      render: (_, r) => (
        <>
          Bậc {r.bacHienTai} • {fmtHeSo(r.heSoHienTai)}
          {r.vuotKhungHienTai ? <Tag style={{ marginLeft: 6 }}>VK {r.vuotKhungHienTai}%</Tag> : null}
        </>
      ),
    },
    {
      title: 'Mốc tính',
      key: 'mocNangBac',
      width: 145,
      render: (_, r) => (
        <div>
          <span style={{ whiteSpace: 'nowrap' }}>
            {fmtNgay(r.mocNangBacDieuChinh ?? r.mocNangBac)}
          </span>
          {r.soThangKeoDai && r.soThangKeoDai > 0 ? (
            <div>
              <Tooltip title={`Mốc gốc: ${fmtNgay(r.mocNangBac)} → Lùi ${r.soThangKeoDai} tháng do ${r.lyDoKeoDai?.toLowerCase() ?? 'nghỉ không lương'}`}>
                <Tag color="orange" style={{ fontSize: 11, padding: '0 4px', margin: '2px 0 0 0', cursor: 'help' }}>
                  +{r.soThangKeoDai} thg nghỉ KL
                </Tag>
              </Tooltip>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Đề xuất',
      key: 'deXuat',
      width: 210,
      render: (_, r) =>
        r.loai === 'NANG_BAC' ? (
          <Tag color="green" icon={<RiseOutlined />}>
            Bậc {r.bacMoi} • hệ số {fmtHeSo(r.heSoMoi)}
          </Tag>
        ) : (
          <Tag color="purple" icon={<RiseOutlined />}>
            Vượt khung {r.vuotKhungMoi}%
          </Tag>
        ),
    },
    {
      title: 'Ngày hưởng mới',
      dataIndex: 'ngayDenHan',
      width: 140,
      sorter: (a, b) => a.ngayDenHan.localeCompare(b.ngayDenHan),
      defaultSortOrder: 'ascend',
      render: (v, r) => (
        <Tag color={r.quaHan ? 'red' : dayjs(v).diff(dayjs(), 'day') <= 30 ? 'orange' : 'default'}>
          {fmtNgay(v)}
          {r.quaHan ? ' • đã đến hạn' : ''}
        </Tag>
      ),
    },
  ];

  // Cột bảng Nâng trước thời hạn
  const cotTruocThoiHan: ColumnsType<UngVienTruocThoiHan> = [
    {
      title: 'Cán bộ',
      key: 'canBo',
      width: 220,
      render: (_, r) => (
        <div>
          <Link to={`/nhan-su/${r.nhanSuId}?tab=luong`} style={{ fontWeight: 600 }}>
            {r.hoTen}
          </Link>
          {r.chucVu && <Tag color="blue" style={{ fontSize: 11, marginLeft: 6 }}>{r.chucVu}</Tag>}
          <div style={{ fontSize: 12, color: '#64748b' }}>
            <span className="ma-cccd">{r.maCanBo}</span> • {r.donVi}
          </div>
        </div>
      ),
    },
    {
      title: 'Ngạch & Hiện hưởng',
      key: 'ngach',
      width: 170,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.ngach.ma}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Bậc {r.bacHienTai} • Hệ số {fmtHeSo(r.heSoHienTai)}
          </div>
        </div>
      ),
    },
    {
      title: 'Hạn thường xuyên',
      key: 'hanThuongXuyen',
      width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{fmtNgay(r.ngayDenHanThuongXuyen)}</div>
          <div style={{ fontSize: 12 }}>
            <Tooltip title={`Tính đến ngày mốc xét 31/12/${namXet}, viên chức còn thiếu ${r.soThangConThieu} tháng để đủ thời hạn nâng bậc thường xuyên (Quy định: thiếu từ 1 - 12 tháng).`}>
              <Tag color="cyan" style={{ cursor: 'help' }}>
                Thiếu {r.soThangConThieu} tháng (đến 31/12)
              </Tag>
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: 'ĐK 2 lần liên tiếp',
      key: 'dieuKien2Lan',
      width: 170,
      render: (_, r) =>
        r.daNangTruocThoiHanLanTruoc ? (
          <Tooltip title={r.lyDoKhongDuDieuKien || 'Đã nâng trước thời hạn ở lần nâng liền kề trước. Theo TT 08/2013 không được nâng 2 lần liên tiếp.'}>
            <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ cursor: 'help' }}>
              Không đủ ĐK (đã nâng)
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Hợp lệ (chưa nâng)
          </Tag>
        ),
    },
    {
      title: 'Mức rút ngắn',
      key: 'mucRutNgan',
      width: 135,
      render: (_, r) => {
        const hienTai = cauHinhRutNgan[r.nhanSuId]?.soThangRutNgan ?? 12;
        return (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={hienTai}
            disabled={r.daNangTruocThoiHanLanTruoc || !sua}
            onChange={(val) => {
              setCauHinhRutNgan((prev) => ({
                ...prev,
                [r.nhanSuId]: { ...prev[r.nhanSuId], soThangRutNgan: val as 6 | 9 | 12 },
              }));
            }}
            options={[
              { label: 'Rút 12 tháng', value: 12 },
              { label: 'Rút 9 tháng', value: 9 },
              { label: 'Rút 6 tháng', value: 6 },
            ]}
          />
        );
      },
    },
    {
      title: 'Ngày hưởng mới',
      key: 'ngayHuongMoi',
      width: 150,
      render: (_, r) => {
        const muc = cauHinhRutNgan[r.nhanSuId]?.soThangRutNgan ?? 12;
        const ngay =
          muc === 12
            ? r.ngayHuong12Thang
            : muc === 9
            ? r.ngayHuong9Thang
            : r.ngayHuong6Thang;
        return (
          <div>
            <Tag color="geekblue" icon={<RiseOutlined />}>
              {fmtNgay(ngay)}
            </Tag>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Lên Bậc {r.bacMoi} ({fmtHeSo(r.heSoMoi)})
            </div>
          </div>
        );
      },
    },
    {
      title: 'Thành tích / Căn cứ khen thưởng',
      key: 'lyDo',
      render: (_, r) => {
        const hienTai = cauHinhRutNgan[r.nhanSuId]?.lyDoKhenThuong ?? '';
        return (
          <Input
            size="small"
            placeholder="vd: CSTĐ cơ sở 2025, Bằng khen Bộ..."
            value={hienTai}
            disabled={r.daNangTruocThoiHanLanTruoc || !sua}
            onChange={(e) => {
              const val = e.target.value;
              setCauHinhRutNgan((prev) => ({
                ...prev,
                [r.nhanSuId]: {
                  soThangRutNgan: prev[r.nhanSuId]?.soThangRutNgan ?? 12,
                  lyDoKhenThuong: val,
                },
              }));
            }}
          />
        );
      },
    },
  ];

  return (
    <>
      <Tabs
        type="card"
        activeKey={tabHienTai}
        onChange={(k) => {
          setTabHienTai(k as 'thuong-xuyen' | 'truoc-thoi-han');
          setChon([]);
          setChonTruocHan([]);
        }}
        items={[
          {
            key: 'thuong-xuyen',
            label: (
              <span style={{ fontWeight: 600 }}>
                <RiseOutlined /> Nâng bậc thường xuyên
              </span>
            ),
          },
          {
            key: 'truoc-thoi-han',
            label: (
              <span style={{ fontWeight: 600 }}>
                <TrophyOutlined style={{ color: '#f59e0b' }} /> Xét nâng lương trước thời hạn (Thành tích xuất sắc)
              </span>
            ),
          },
        ]}
        style={{ marginBottom: 8 }}
      />

      {/* ========================================================= TAB 1: THƯỜNG XUYÊN */}
      {tabHienTai === 'thuong-xuyen' && (
        <>
          <Alert
            type="info"
            showIcon
            message="Chế độ nâng bậc lương thường xuyên theo hệ số Nhà nước (Nghị định 204/2004/NĐ-CP)"
            description="Chỉ áp dụng đối với ngạch bậc Viên chức. Cán bộ thuộc diện Hợp đồng Lao động hưởng lương thỏa thuận, không áp dụng nâng lương ngạch bậc."
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[20, 20]}>
            <Col xs={24} md={8}>
              <Card className="the-so" style={{ color: '#0e7c86' }}>
                <Statistic title="Đến hạn trong kỳ" value={data.length} suffix="cán bộ" />
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card className="the-so" style={{ color: '#16a34a' }}>
                <Statistic title="Nâng bậc thường xuyên" value={soNangBac} valueStyle={{ color: '#16a34a' }} />
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card className="the-so" style={{ color: '#7c3aed' }}>
                <Statistic title="Phụ cấp thâm niên vượt khung" value={data.length - soNangBac} valueStyle={{ color: '#7c3aed' }} />
              </Card>
            </Col>
          </Row>

          <Card className="card-mem" style={{ marginTop: 20 }}>
            <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <span>Đến hạn trong:</span>
                <Segmented
                  options={KY_HAN}
                  value={kyHan}
                  onChange={(v) => {
                    setKyHan(v as number);
                    setChon([]);
                  }}
                  id="ky-han"
                />
                <TreeSelect
                  allowClear
                  placeholder="Tất cả đơn vị"
                  treeData={cay}
                  value={donViId}
                  onChange={(v) => {
                    setDonViId(v);
                    setChon([]);
                  }}
                  style={{ width: 260 }}
                  treeDefaultExpandAll
                  showSearch
                  treeNodeFilterProp="title"
                />
              </Space>
              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => taiFile('/nang-luong/xuat-excel', { query }).catch((e) => message.error(e.message))}
                  id="xuat-den-han"
                >
                  Xuất danh sách
                </Button>
                {sua && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={!chon.length}
                    onClick={() => {
                      form.resetFields();
                      form.setFieldsValue({ ngayQuyetDinh: dayjs() });
                      setMoQd(true);
                    }}
                    id="lap-quyet-dinh"
                  >
                    Lập quyết định ({chon.length})
                  </Button>
                )}
              </Space>
            </Space>

            {soQuaHan > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
                message={`${soQuaHan} cán bộ đã đến hạn nhưng chưa có quyết định nâng lương.`}
              />
            )}

            <Table
              rowKey="nhanSuId"
              size="middle"
              loading={isLoading}
              dataSource={data}
              columns={cotThuongXuyen}
              pagination={{ pageSize: 50, hideOnSinglePage: true }}
              rowSelection={sua ? { selectedRowKeys: chon, onChange: (k) => setChon(k as string[]) } : undefined}
              locale={{ emptyText: 'Không có cán bộ đến hạn trong kỳ' }}
              scroll={{ x: 900 }}
            />
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Căn cứ NĐ 204/2004/NĐ-CP, TT 08/2013/TT-BNV, TT 03/2021/TT-BNV: nâng bậc sau 36 tháng (loại A0 trở lên) hoặc 24 tháng (loại B, C); ở bậc cuối hưởng vượt khung 5% rồi mỗi năm thêm 1%. Hệ thống tự động lùi mốc và kéo dài thời hạn nếu có thời gian nghỉ không hưởng lương.
            </Typography.Paragraph>
          </Card>
        </>
      )}

      {/* ========================================================= TAB 2: TRƯỚC THỜI HẠN */}
      {tabHienTai === 'truoc-thoi-han' && (
        <>
          <Alert
            type="warning"
            showIcon
            icon={<StarFilled style={{ color: '#d97706' }} />}
            message="Chế độ nâng bậc lương trước thời hạn do lập thành tích xuất sắc (Thông tư 08/2013/TT-BNV & TT 03/2021/TT-BNV)"
            description={
              <div>
                <div>• <b>Điều kiện thời gian:</b> Tính đến ngày 31/12 của năm xét, còn <b>thiếu từ 01 đến 12 tháng</b> để nâng bậc lương thường xuyên và chưa xếp bậc lương cuối cùng trong ngạch.</div>
                <div>• <b>Chỉ tiêu tối đa 10%:</b> Tỷ lệ viên chức được nâng trước thời hạn trong 1 năm không quá <b>10%</b> tổng số viên chức hưởng lương ngạch bậc của đơn vị.</div>
                <div>• <b>Quy tắc không nâng 2 lần liên tiếp:</b> Không thực hiện 2 lần liên tiếp nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong cùng ngạch/chức danh.</div>
                <div>• <b>Mốc tính lần sau:</b> Được tính kể từ ngày bắt đầu hưởng bậc lương mới theo Quyết định nâng bậc trước thời hạn.</div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[20, 20]}>
            <Col xs={24} sm={12} md={6}>
              <Card className="the-so" style={{ color: '#0e7c86' }}>
                <Statistic title={`Tổng viên chức ngạch bậc (${namXet})`} value={tongVienChuc} suffix="người" />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="the-so" style={{ color: '#d97706', borderColor: '#fde68a' }}>
                <Statistic
                  title="Chỉ tiêu tối đa 10%"
                  value={chiTieu10}
                  suffix="chỉ tiêu"
                  valueStyle={{ color: '#b45309', fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="the-so" style={{ color: '#16a34a' }}>
                <Statistic title="Ứng viên đủ điều kiện xét" value={soDuDieuKien} suffix="người" valueStyle={{ color: '#16a34a' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                className="the-so"
                style={{
                  color: vuotChiTieu ? '#dc2626' : '#7c3aed',
                  borderColor: vuotChiTieu ? '#fca5a5' : undefined,
                  backgroundColor: vuotChiTieu ? '#fef2f2' : undefined,
                }}
              >
                <Statistic
                  title="Đã chọn duyệt"
                  value={chonTruocHan.length}
                  suffix={`/ ${chiTieu10} chỉ tiêu`}
                  valueStyle={{ color: vuotChiTieu ? '#dc2626' : '#7c3aed', fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>

          <Card className="card-mem" style={{ marginTop: 20 }}>
            <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space wrap align="center">
                <span><b>Năm xét:</b></span>
                <Select
                  value={namXet}
                  onChange={(v) => {
                    setNamXet(v);
                    setChonTruocHan([]);
                  }}
                  style={{ width: 120 }}
                  options={[
                    { label: `Năm ${dayjs().year() - 1}`, value: dayjs().year() - 1 },
                    { label: `Năm ${dayjs().year()}`, value: dayjs().year() },
                    { label: `Năm ${dayjs().year() + 1}`, value: dayjs().year() + 1 },
                  ]}
                />
                <TreeSelect
                  allowClear
                  placeholder="Tất cả đơn vị"
                  treeData={cay}
                  value={donViIdTruocHan}
                  onChange={(v) => {
                    setDonViIdTruocHan(v);
                    setChonTruocHan([]);
                  }}
                  style={{ width: 260 }}
                  treeDefaultExpandAll
                  showSearch
                  treeNodeFilterProp="title"
                />
              </Space>

              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() =>
                    taiFile('/nang-luong/truoc-thoi-han/xuat-excel', { query: queryTruocHan }).catch((e) =>
                      message.error(e.message),
                    )
                  }
                >
                  Xuất danh sách xét duyệt
                </Button>
                {sua && (
                  <Button
                    type="primary"
                    icon={<TrophyOutlined />}
                    disabled={!chonTruocHan.length}
                    danger={vuotChiTieu}
                    onClick={() => {
                      formTruocHan.resetFields();
                      formTruocHan.setFieldsValue({ ngayQuyetDinh: dayjs() });
                      setMoQdTruocHan(true);
                    }}
                  >
                    Lập Quyết định nâng trước hạn ({chonTruocHan.length})
                  </Button>
                )}
              </Space>
            </Space>

            {vuotChiTieu && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Cảnh báo: Bạn đang chọn ${chonTruocHan.length} người, vượt quá chỉ tiêu 10% (${chiTieu10} người).`}
                description="Theo quy định tại Thông tư 08/2013/TT-BNV, tỷ lệ nâng trước thời hạn không được vượt quá 10% tổng số viên chức. Vui lòng rà soát lại kết quả họp Hội đồng lương để chọn đúng chỉ tiêu."
              />
            )}

            <Table
              rowKey="nhanSuId"
              size="middle"
              loading={dangTaiTruocHan}
              dataSource={danhSachTruocHan}
              columns={cotTruocThoiHan}
              pagination={{ pageSize: 50, hideOnSinglePage: true }}
              rowSelection={
                sua
                  ? {
                      selectedRowKeys: chonTruocHan,
                      onChange: (k) => setChonTruocHan(k as string[]),
                      getCheckboxProps: (r) => ({
                        disabled: r.daNangTruocThoiHanLanTruoc,
                        title: r.daNangTruocThoiHanLanTruoc ? r.lyDoKhongDuDieuKien : undefined,
                      }),
                    }
                  : undefined
              }
              locale={{ emptyText: 'Không có cán bộ trong diện xét nâng lương trước thời hạn cho năm đã chọn' }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </>
      )}

      {/* MODAL LẬP QUYẾT ĐỊNH THƯỜNG XUYÊN */}
      <Modal
        open={moQd}
        title="Lập quyết định nâng lương thường xuyên"
        okText="Cập nhật quá trình lương"
        cancelText="Hủy"
        confirmLoading={dangLuu}
        onCancel={() => setMoQd(false)}
        onOk={() =>
          modal.confirm({
            title: `Xác nhận nâng lương cho ${chon.length} cán bộ?`,
            content: 'Mỗi cán bộ sẽ được thêm một dòng quá trình lương mới với ngày hưởng = ngày đến hạn.',
            okText: 'Xác nhận',
            cancelText: 'Xem lại',
            onOk: lap,
          })
        }
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="soQuyetDinh" label="Số quyết định" rules={[{ required: true, message: 'Nhập số quyết định' }]}>
                <Input placeholder="vd 125/QĐ-CĐN" id="so-quyet-dinh" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngayQuyetDinh" label="Ngày quyết định" rules={[{ required: true, message: 'Chọn ngày' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="ghiChu" label="Ghi chú" extra="Để trống: tự ghi “Nâng bậc lương thường xuyên” / “Hưởng phụ cấp thâm niên vượt khung”">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* MODAL LẬP QUYẾT ĐỊNH TRƯỚC THỜI HẠN */}
      <Modal
        open={moQdTruocHan}
        title={
          <span>
            <TrophyOutlined style={{ color: '#d97706', marginRight: 8 }} />
            Lập Quyết định nâng bậc lương trước thời hạn do lập thành tích xuất sắc
          </span>
        }
        width={720}
        okText="Ký QĐ & Cập nhật quá trình lương"
        cancelText="Hủy"
        confirmLoading={dangLuuTruocHan}
        onCancel={() => setMoQdTruocHan(false)}
        onOk={() => {
          modal.confirm({
            title: `Xác nhận nâng bậc lương trước thời hạn cho ${chonTruocHan.length} cán bộ?`,
            content: (
              <div>
                <div>• Quá trình lương mới sẽ được tạo với mốc nâng bậc và ngày hưởng được rút ngắn tương ứng.</div>
                <div>• Mốc tính nâng bậc lần sau sẽ được tính từ ngày hưởng bậc lương mới này.</div>
                {vuotChiTieu && (
                  <div style={{ color: '#dc2626', marginTop: 8, fontWeight: 600 }}>
                    ⚠️ Cảnh báo: Số lượng đang vượt chỉ tiêu 10% ({chonTruocHan.length}/{chiTieu10}).
                  </div>
                )}
              </div>
            ),
            okText: 'Xác nhận ban hành',
            cancelText: 'Xem lại',
            onOk: lapTruocThoiHan,
          });
        }}
        destroyOnClose
      >
        <Form form={formTruocHan} layout="vertical" style={{ marginTop: 12 }}>
          {vuotChiTieu && (
            <Alert
              type="error"
              showIcon
              message={`Cảnh báo vượt chỉ tiêu 10%: Bạn đang duyệt ${chonTruocHan.length} người, trong khi chỉ tiêu tối đa của trường là ${chiTieu10} người.`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="soQuyetDinh"
                label="Số Quyết định nâng lương trước thời hạn"
                rules={[{ required: true, message: 'Nhập số quyết định' }]}
              >
                <Input placeholder="vd 88/QĐ-CĐN" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="ngayQuyetDinh"
                label="Ngày ký Quyết định"
                rules={[{ required: true, message: 'Chọn ngày quyết định' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="ghiChu" label="Căn cứ / Ghi chú chung của Hội đồng">
                <Input.TextArea
                  rows={2}
                  placeholder="Căn cứ biên bản họp Hội đồng xét nâng bậc lương trước thời hạn..."
                />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
            Danh sách cán bộ được duyệt nâng trước thời hạn ({chonTruocHan.length} người):
          </Typography.Title>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px' }}>
            {chonTruocHan.map((id, idx) => {
              const cb = danhSachTruocHan.find((d) => d.nhanSuId === id);
              if (!cb) return null;
              const cfg = cauHinhRutNgan[id] || { soThangRutNgan: 12 };
              const ngayMoi =
                cfg.soThangRutNgan === 12
                  ? cb.ngayHuong12Thang
                  : cfg.soThangRutNgan === 9
                  ? cb.ngayHuong9Thang
                  : cb.ngayHuong6Thang;
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: idx < chonTruocHan.length - 1 ? '1px dashed #f1f5f9' : 'none',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{cb.hoTen}</span> ({cb.donVi})
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                      Lên Bậc {cb.bacMoi} ({fmtHeSo(cb.heSoMoi)})
                    </span>
                    {cfg.lyDoKhenThuong && (
                      <div style={{ fontSize: 12, color: '#0369a1' }}>• Căn cứ: {cfg.lyDoKhenThuong}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Tag color="orange">Rút ngắn {cfg.soThangRutNgan} tháng</Tag>
                    <Tag color="green">Hưởng từ {fmtNgay(ngayMoi)}</Tag>
                  </div>
                </div>
              );
            })}
          </div>
        </Form>
      </Modal>
    </>
  );
}
