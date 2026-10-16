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
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, FileExcelOutlined, RiseOutlined, WarningOutlined } from '@ant-design/icons';
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
  const [kyHan, setKyHan] = useState(3);
  const [donViId, setDonViId] = useState<string>();
  const [chon, setChon] = useState<string[]>([]);
  const [moQd, setMoQd] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [form] = Form.useForm<{ soQuyetDinh: string; ngayQuyetDinh: Dayjs; ghiChu?: string }>();
  const { data: coSos } = useCoSo();
  const { data: donVis } = useDonVi();
  const cay = useMemo(() => cayDonVi(coSos, donVis), [coSos, donVis]);

  const denNgay = useMemo(() => dayjs().add(kyHan, 'month').format('YYYY-MM-DD'), [kyHan]);
  const query = { denNgay, donViId };
  const { data = [], isLoading } = useQuery({
    queryKey: ['nang-luong', 'den-han', query],
    queryFn: () => api<DongDenHan[]>('/nang-luong/den-han', { query }),
  });

  const soNangBac = data.filter((d) => d.loai === 'NANG_BAC').length;
  const soQuaHan = data.filter((d) => d.quaHan).length;

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

  const cot: ColumnsType<DongDenHan> = [
    {
      title: 'Cán bộ',
      key: 'canBo',
      render: (_, r) => (
        <div>
          <Link to={`/nhan-su/${r.nhanSuId}?tab=luong`} style={{ fontWeight: 600 }}>
            {r.hoTen}
          </Link>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            <span className="ma-cccd">{r.maCanBo}</span> · {r.donVi}
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
          Bậc {r.bacHienTai} · {fmtHeSo(r.heSoHienTai)}
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
              <Tooltip title={`Mốc gốc: ${fmtNgay(r.mocNangBac)} • Lùi ${r.soThangKeoDai} tháng do ${r.lyDoKeoDai?.toLowerCase() ?? 'nghỉ không lương'}`}>
                <Tag color="orange" style={{ fontSize: 11, padding: '0 4px', margin: '2px 0 0 0', cursor: 'help' }}>
                  +${r.soThangKeoDai} thg nghỉ KL
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
            Bậc {r.bacMoi} · hệ số {fmtHeSo(r.heSoMoi)}
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
          {r.quaHan ? ' · đã đến hạn' : ''}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        message="Chế độ nâng bậc lương thường xuyên theo hệ số Nhà nước (Nghị định 204/2004/NĐ-CP)"
        description="Chỉ áp dụng đối với ngạch bậc Viên chức. Cán bộ thuộc diện Hợp đồng Lao động (lái xe, bảo vệ, phục vụ...) hưởng lương cố định theo thỏa thuận, không áp dụng nâng lương theo hệ số."
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
          columns={cot}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          rowSelection={sua ? { selectedRowKeys: chon, onChange: (k) => setChon(k as string[]) } : undefined}
          locale={{ emptyText: 'Không có cán bộ đến hạn trong kỳ' }}
          scroll={{ x: 900 }}
        />
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            Căn cứ NĐ 204/2004/NĐ-CP, TT 08/2013/TT-BNV, TT 03/2021/TT-BNV: nâng bậc sau 36 tháng (loại A0 trở lên) hoặc 24 tháng (loại B, C); ở bậc cuối hưởng vượt khung 5% rồi mỗi năm thêm 1%. Hệ thống tự động lùi mốc và kéo dài thời hạn nâng lương tương ứng nếu có thời gian nghỉ không hưởng lương (từ 01 tháng trở lên) đã được duyệt.
          </Typography.Paragraph>
      </Card>

      <Modal
        open={moQd}
        title="Lập quyết định nâng lương"
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
    </>
  );
}
