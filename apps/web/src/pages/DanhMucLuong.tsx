import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { coQuyenSua, fmtHeSo, fmtNgay, fmtTien, toDayjs, toIso } from '../constants';
import { NgachLuong, useNgachLuong } from '../components/TabLuong';

interface LuongCoSo {
  id: string;
  tuNgay: string;
  mucLuong: number;
  canCu: string | null;
}

/** Hộp thoại thêm/sửa dùng chung cho 2 danh mục. */
function useHopThoai<T extends { id: string }>(duongDan: string, khoaQuery: string[]) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [dang, setDang] = useState<T | 'moi' | null>(null);
  const [luu, setLuu] = useState(false);
  const gui = async (body: unknown) => {
    setLuu(true);
    try {
      if (dang === 'moi') await api(duongDan, { method: 'POST', body });
      else if (dang) await api(`${duongDan}/${dang.id}`, { method: 'PATCH', body });
      message.success('Đã lưu');
      setDang(null);
      qc.invalidateQueries({ queryKey: khoaQuery });
    } catch (e) {
      const err = e as ApiError;
      if (err.loi?.length) form.setFields(err.loi.map((l) => ({ name: l.truong.split('.')[0], errors: [l.loi] })));
      message.error(err.message);
    } finally {
      setLuu(false);
    }
  };
  const xoa = async (id: string) => {
    try {
      await api(`${duongDan}/${id}`, { method: 'DELETE' });
      message.success('Đã xóa');
      qc.invalidateQueries({ queryKey: khoaQuery });
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  return { form, dang, setDang, luu, gui, xoa };
}

function BangNgach({ sua }: { sua: boolean }) {
  const { data = [], isLoading } = useNgachLuong();
  const h = useHopThoai<NgachLuong>('/ngach-luong', ['ngach-luong']);
  const [sinh, setSinh] = useState<{ dau?: number; buoc?: number; soBac?: number }>({});

  const mo = (r: NgachLuong | 'moi') => {
    h.setDang(r);
    h.form.resetFields();
    setSinh({});
    if (r === 'moi') h.form.setFieldsValue({ thangNangBac: 36, heSo: [] });
    else h.form.setFieldsValue({ ...r, heSo: r.heSo.map((x) => x.toFixed(2)) });
  };

  const cot: ColumnsType<NgachLuong> = [
    { title: 'Mã', dataIndex: 'ma', width: 110, render: (v) => <b>{v}</b> },
    { title: 'Ngạch / chức danh nghề nghiệp', dataIndex: 'ten' },
    { title: 'Nhóm', dataIndex: 'nhom', width: 70, render: (v) => <Tag color="cyan">{v}</Tag> },
    {
      title: 'Hệ số theo bậc',
      dataIndex: 'heSo',
      render: (v: number[]) => (
        <div className="day-he-so">
          {v.map((x, i) => (
            <Tooltip key={i} title={`Bậc ${i + 1}`}>
              <span>{fmtHeSo(x)}</span>
            </Tooltip>
          ))}
        </div>
      ),
    },
    { title: 'Nâng bậc', dataIndex: 'thangNangBac', width: 90, render: (v) => `${v} tháng` },
    { title: 'Đang dùng', key: 'dung', width: 90, align: 'right', render: (_, r) => r._count?.quaTrinhLuongs ?? 0 },
  ];
  if (sua) {
    cot.push({
      title: '',
      key: 'hd',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="text" icon={<EditOutlined />} onClick={() => mo(r)} />
          <Popconfirm title="Xóa ngạch này?" okText="Xóa" cancelText="Không" onConfirm={() => h.xoa(r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  const sinhDay = () => {
    const { dau, buoc, soBac } = sinh;
    if (!dau || !buoc || !soBac) return;
    h.form.setFieldValue(
      'heSo',
      Array.from({ length: soBac }, (_, i) => (dau + buoc * i).toFixed(2)),
    );
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Bảng hệ số khởi tạo theo NĐ 204/2004/NĐ-CP. Mã ngạch, hệ số, thời gian nâng bậc cần được TCHC đối chiếu văn bản hiện hành và chỉnh sửa nếu có thay đổi (vd khi cải cách tiền lương)."
      />
      {sua && (
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => mo('moi')} id="them-ngach">
            Thêm ngạch
          </Button>
        </div>
      )}
      <Table rowKey="id" size="middle" loading={isLoading} dataSource={data} columns={cot} pagination={false} scroll={{ x: 900 }} />
      <Modal
        open={!!h.dang}
        title={h.dang === 'moi' ? 'Thêm ngạch' : 'Sửa ngạch'}
        okText="Lưu"
        cancelText="Hủy"
        width={720}
        confirmLoading={h.luu}
        onCancel={() => h.setDang(null)}
        onOk={async () => {
          const v = await h.form.validateFields();
          h.gui({ ...v, heSo: (v.heSo as string[]).map(Number) });
        }}
        destroyOnClose
      >
        <Form form={h.form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ma" label="Mã ngạch / CDNN" rules={[{ required: true, message: 'Nhập mã' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="ten" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nhom" label="Nhóm bảng lương" rules={[{ required: true, message: 'Nhập nhóm' }]}>
                <Input placeholder="vd A1, A2.1, A0, B" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="thangNangBac" label="Số tháng nâng bậc">
                <InputNumber min={12} max={60} style={{ width: '100%' }} addonAfter="tháng" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="thuTu" label="Thứ tự">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Card size="small" style={{ background: '#f0fdfa', marginBottom: 12 }}>
                <Space wrap>
                  <ThunderboltOutlined style={{ color: '#0e7c86' }} />
                  Sinh nhanh:
                  <InputNumber placeholder="Bậc 1" step={0.01} value={sinh.dau} onChange={(v) => setSinh({ ...sinh, dau: v ?? undefined })} />
                  <InputNumber placeholder="Khoảng cách" step={0.01} value={sinh.buoc} onChange={(v) => setSinh({ ...sinh, buoc: v ?? undefined })} />
                  <InputNumber placeholder="Số bậc" min={1} max={20} value={sinh.soBac} onChange={(v) => setSinh({ ...sinh, soBac: v ?? undefined })} />
                  <Button onClick={sinhDay}>Tạo dãy hệ số</Button>
                </Space>
              </Card>
              <Form.Item
                name="heSo"
                label="Hệ số theo bậc (theo thứ tự bậc 1, 2, 3…)"
                rules={[{ required: true, message: 'Nhập hệ số' }]}
                extra="Gõ hệ số rồi Enter; có thể dán danh sách cách nhau bởi dấu chấm phẩy hoặc khoảng trắng."
              >
                <Select mode="tags" tokenSeparators={[';', ' ', '\n']} open={false} suffixIcon={null} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}

function BangLuongCoSo({ sua }: { sua: boolean }) {
  const { data = [], isLoading } = useQuery({ queryKey: ['luong-co-so'], queryFn: () => api<LuongCoSo[]>('/luong-co-so') });
  const h = useHopThoai<LuongCoSo>('/luong-co-so', ['luong-co-so']);
  const homNay = new Date().toISOString().slice(0, 10);
  const dangApDung = data.find((x) => x.tuNgay.slice(0, 10) <= homNay)?.id;

  const mo = (r: LuongCoSo | 'moi') => {
    h.setDang(r);
    h.form.resetFields();
    if (r !== 'moi') h.form.setFieldsValue({ ...r, tuNgay: toDayjs(r.tuNgay) });
  };

  const cot: ColumnsType<LuongCoSo> = [
    {
      title: 'Áp dụng từ ngày',
      dataIndex: 'tuNgay',
      width: 170,
      render: (v, r) => (
        <Space>
          {fmtNgay(v)}
          {r.id === dangApDung && <Tag color="green">Đang áp dụng</Tag>}
        </Space>
      ),
    },
    { title: 'Mức lương cơ sở', dataIndex: 'mucLuong', width: 180, render: (v) => <b>{fmtTien(v)} đ/tháng</b> },
    { title: 'Căn cứ', dataIndex: 'canCu' },
  ];
  if (sua) {
    cot.push({
      title: '',
      key: 'hd',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="text" icon={<EditOutlined />} onClick={() => mo(r)} />
          <Popconfirm title="Xóa mức lương này?" okText="Xóa" cancelText="Không" onConfirm={() => h.xoa(r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Khi Nhà nước điều chỉnh lương cơ sở, chỉ cần thêm mức mới kèm ngày áp dụng — lịch sử được giữ nguyên để tính truy lĩnh."
      />
      {sua && (
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => mo('moi')} id="them-luong-co-so">
            Thêm mức lương cơ sở
          </Button>
        </div>
      )}
      <Table rowKey="id" size="middle" loading={isLoading} dataSource={data} columns={cot} pagination={false} />
      <Modal
        open={!!h.dang}
        title={h.dang === 'moi' ? 'Thêm mức lương cơ sở' : 'Sửa mức lương cơ sở'}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={h.luu}
        onCancel={() => h.setDang(null)}
        onOk={async () => {
          const v = await h.form.validateFields();
          h.gui({ ...v, tuNgay: toIso(v.tuNgay) });
        }}
        destroyOnClose
      >
        <Form form={h.form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tuNgay" label="Áp dụng từ ngày" rules={[{ required: true, message: 'Chọn ngày' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mucLuong" label="Mức lương cơ sở" rules={[{ required: true, message: 'Nhập mức lương' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={10000}
                  addonAfter="đ"
                  formatter={(v) => (v ? Number(v).toLocaleString('vi-VN') : '')}
                  parser={(v) => (v && /\d/.test(v) ? Number(v.replace(/\D/g, '')) : '') as unknown as 0}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="canCu" label="Căn cứ (số hiệu văn bản)">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}

export default function DanhMucLuong() {
  const { nguoiDung } = useAuth();
  const sua = coQuyenSua(nguoiDung?.vaiTro);
  return (
    <Card className="card-mem" styles={{ body: { paddingTop: 8 } }}>
      <Tabs
        items={[
          { key: 'ngach', label: 'Ngạch & hệ số lương', children: <BangNgach sua={sua} /> },
          { key: 'lcs', label: 'Lương cơ sở', children: <BangLuongCoSo sua={sua} /> },
        ]}
      />
    </Card>
  );
}
