import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api, ApiError, taiFile, tokenStore } from '../api';
import { fmtNgay } from '../constants';

export type LoaiTaiLieu =
  | 'QUYET_DINH_LUONG'
  | 'QUYET_DINH_THOI_VIEC'
  | 'QUYET_DINH_BO_NHIEM'
  | 'HOP_DONG'
  | 'VAN_BANG_CHUNG_CHI'
  | 'GIAY_TO_KHAC';

export interface TaiLieuItem {
  id: string;
  nhanSuId: string;
  loai: LoaiTaiLieu;
  tenLoai: string;
  ten: string;
  soHieu: string | null;
  ngayBanHanh: string | null;
  coQuanBanHanh: string | null;
  tenFile: string;
  duongDan: string;
  dinhDang: string;
  kichThuoc: number;
  ghiChu: string | null;
  nguoiTaiLen: string | null;
  createdAt: string;
}

export const NHAN_LOAI_TAI_LIEU: Record<LoaiTaiLieu, string> = {
  QUYET_DINH_LUONG: 'Quyết định lương / Phụ cấp',
  QUYET_DINH_THOI_VIEC: 'Quyết định thôi việc / Nghỉ hưu',
  QUYET_DINH_BO_NHIEM: 'Quyết định bổ nhiệm / Khen thưởng / Kỷ luật',
  HOP_DONG: 'Hợp đồng làm việc / Lao động',
  VAN_BANG_CHUNG_CHI: 'Văn bằng / Chứng chỉ scan',
  GIAY_TO_KHAC: 'Giấy tờ khác (CCCD, Sơ yếu lý lịch, ...)',
};

const MAU_LOAI_TAI_LIEU: Record<LoaiTaiLieu, string> = {
  QUYET_DINH_LUONG: 'green',
  QUYET_DINH_THOI_VIEC: 'volcano',
  QUYET_DINH_BO_NHIEM: 'blue',
  HOP_DONG: 'purple',
  VAN_BANG_CHUNG_CHI: 'gold',
  GIAY_TO_KHAC: 'default',
};

function fmtBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function layIconFile(tenFile: string, dinhDang: string) {
  const ext = tenFile.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf' || dinhDang.includes('pdf')) {
    return <FilePdfOutlined style={{ color: '#ef4444', fontSize: 18 }} />;
  }
  if (['doc', 'docx'].includes(ext) || dinhDang.includes('word')) {
    return <FileWordOutlined style={{ color: '#2563eb', fontSize: 18 }} />;
  }
  if (['xls', 'xlsx'].includes(ext) || dinhDang.includes('sheet') || dinhDang.includes('excel')) {
    return <FileExcelOutlined style={{ color: '#16a34a', fontSize: 18 }} />;
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || dinhDang.startsWith('image/')) {
    return <FileImageOutlined style={{ color: '#f59e0b', fontSize: 18 }} />;
  }
  return <FileTextOutlined style={{ color: '#64748b', fontSize: 18 }} />;
}

export default function TabTaiLieu({
  nhanSuId,
  coQuyenSua,
  hoTenCanBo,
}: {
  nhanSuId: string;
  coQuyenSua: boolean;
  hoTenCanBo?: string;
}) {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [locLoai, setLocLoai] = useState<string>('TAT_CA');
  const [tuKhoa, setTuKhoa] = useState<string>('');

  // Modal Thêm mới
  const [moModalThem, setMoModalThem] = useState(false);
  const [dangTaiLen, setDangTaiLen] = useState(false);
  const [fileChon, setFileChon] = useState<File | null>(null);
  const [formThem] = Form.useForm();

  // Modal Chỉnh sửa
  const [moModalSua, setMoModalSua] = useState(false);
  const [itemSua, setItemSua] = useState<TaiLieuItem | null>(null);
  const [dangCapNhat, setDangCapNhat] = useState(false);
  const [fileMoi, setFileMoi] = useState<File | null>(null);
  const [formSua] = Form.useForm();

  // Modal Xem trước tài liệu
  const [itemXem, setItemXem] = useState<TaiLieuItem | null>(null);

  const { data: danhSach = [], isLoading } = useQuery({
    queryKey: ['tai-lieu-nhan-su', nhanSuId, locLoai, tuKhoa],
    queryFn: () =>
      api<TaiLieuItem[]>(`/tai-lieu/${nhanSuId}`, {
        query: {
          loai: locLoai === 'TAT_CA' ? undefined : locLoai,
          q: tuKhoa.trim() || undefined,
        },
      }),
  });

  const lamMoi = () => qc.invalidateQueries({ queryKey: ['tai-lieu-nhan-su', nhanSuId] });

  // Xử lý upload tài liệu mới
  const xuLyTaiLen = async () => {
    try {
      const values = await formThem.validateFields();
      if (!fileChon) {
        message.warning('Vui lòng chọn hoặc kéo thả file đính kèm');
        return;
      }

      setDangTaiLen(true);
      const fd = new FormData();
      fd.append('file', fileChon);
      fd.append('ten', values.ten);
      fd.append('loai', values.loai);
      if (values.soHieu) fd.append('soHieu', values.soHieu);
      if (values.ngayBanHanh) fd.append('ngayBanHanh', values.ngayBanHanh.format('YYYY-MM-DD'));
      if (values.coQuanBanHanh) fd.append('coQuanBanHanh', values.coQuanBanHanh);
      if (values.ghiChu) fd.append('ghiChu', values.ghiChu);

      await api(`/tai-lieu/${nhanSuId}`, {
        method: 'POST',
        body: fd,
      });

      message.success('Đã tải lên tài liệu thành công');
      setMoModalThem(false);
      formThem.resetFields();
      setFileChon(null);
      lamMoi();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        message.error(err.message);
      }
    } finally {
      setDangTaiLen(false);
    }
  };

  // Mở modal sửa
  const moFormSua = (r: TaiLieuItem) => {
    setItemSua(r);
    setFileMoi(null);
    formSua.setFieldsValue({
      ten: r.ten,
      loai: r.loai,
      soHieu: r.soHieu ?? undefined,
      ngayBanHanh: r.ngayBanHanh ? dayjs(r.ngayBanHanh) : undefined,
      coQuanBanHanh: r.coQuanBanHanh ?? undefined,
      ghiChu: r.ghiChu ?? undefined,
    });
    setMoModalSua(true);
  };

  // Xử lý cập nhật / chỉnh sửa
  const xuLyCapNhat = async () => {
    if (!itemSua) return;
    try {
      const values = await formSua.validateFields();
      setDangCapNhat(true);

      const fd = new FormData();
      if (fileMoi) {
        fd.append('file', fileMoi);
      }
      fd.append('ten', values.ten);
      fd.append('loai', values.loai);
      fd.append('soHieu', values.soHieu || '');
      fd.append('ngayBanHanh', values.ngayBanHanh ? values.ngayBanHanh.format('YYYY-MM-DD') : '');
      fd.append('coQuanBanHanh', values.coQuanBanHanh || '');
      fd.append('ghiChu', values.ghiChu || '');

      await api(`/tai-lieu/${nhanSuId}/${itemSua.id}`, {
        method: 'PATCH',
        body: fd,
      });

      message.success('Đã cập nhật tài liệu thành công');
      setMoModalSua(false);
      setItemSua(null);
      setFileMoi(null);
      formSua.resetFields();
      lamMoi();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        message.error(err.message);
      }
    } finally {
      setDangCapNhat(false);
    }
  };

  // Xử lý xóa
  const xuLyXoa = async (id: string, ten: string) => {
    try {
      await api(`/tai-lieu/${nhanSuId}/${id}`, { method: 'DELETE' });
      message.success(`Đã xóa tài liệu "${ten}"`);
      lamMoi();
    } catch (err: unknown) {
      if (err instanceof ApiError) message.error(err.message);
    }
  };

  // Cột bảng danh sách
  const cot: ColumnsType<TaiLieuItem> = [
    {
      title: 'Phân loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 170,
      render: (v: LoaiTaiLieu) => (
        <Tag color={MAU_LOAI_TAI_LIEU[v] ?? 'default'} style={{ margin: 0 }}>
          {NHAN_LOAI_TAI_LIEU[v] ?? v}
        </Tag>
      ),
    },
    {
      title: 'Tên văn bản / Giấy tờ',
      key: 'ten',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.ten}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {layIconFile(r.tenFile, r.dinhDang)}
            <span>{r.tenFile}</span>
            <span>•</span>
            <span>{fmtBytes(r.kichThuoc)}</span>
          </div>
          {r.ghiChu && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{r.ghiChu}</div>}
        </div>
      ),
    },
    {
      title: 'Số hiệu / Ban hành',
      key: 'soHieu',
      width: 200,
      render: (_, r) => (
        <div>
          {r.soHieu ? <div style={{ fontWeight: 500 }}>Số: {r.soHieu}</div> : <div style={{ color: '#94a3b8' }}>—</div>}
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {r.ngayBanHanh ? `Ngày: ${fmtNgay(r.ngayBanHanh)}` : ''}
            {r.ngayBanHanh && r.coQuanBanHanh ? ' • ' : ''}
            {r.coQuanBanHanh ? r.coQuanBanHanh : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Ngày tải',
      key: 'ngayTai',
      width: 130,
      render: (_, r) => (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <div>{dayjs(r.createdAt).format('DD/MM/YYYY')}</div>
          {r.nguoiTaiLen && <div style={{ color: '#94a3b8' }}>bởi {r.nguoiTaiLen}</div>}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem trực tiếp">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#0284c7', fontSize: 15 }} />}
              onClick={() => setItemXem(r)}
            />
          </Tooltip>

          <Tooltip title="Tải về máy tính">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined style={{ color: '#16a34a', fontSize: 15 }} />}
              onClick={() =>
                taiFile(`/tai-lieu/${nhanSuId}/${r.id}/tai-ve`, {
                  tenMacDinh: r.tenFile,
                })
              }
            />
          </Tooltip>

          {coQuyenSua && (
            <Tooltip title="Chỉnh sửa thông tin / Thay file">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#d97706', fontSize: 15 }} />}
                onClick={() => moFormSua(r)}
              />
            </Tooltip>
          )}

          {coQuyenSua && (
            <Popconfirm
              title={`Xác nhận xóa tài liệu "${r.ten}"?`}
              description="File đính kèm trên máy chủ sẽ bị xóa hoàn toàn."
              okText="Xóa vĩnh viễn"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => xuLyXoa(r.id, r.ten)}
            >
              <Tooltip title="Xóa tài liệu">
                <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 15 }} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Thanh công cụ lọc & thêm mới */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap size="middle">
            <Select
              value={locLoai}
              onChange={setLocLoai}
              style={{ width: 230 }}
              options={[
                { value: 'TAT_CA', label: 'Tất cả loại giấy tờ' },
                ...Object.entries(NHAN_LOAI_TAI_LIEU).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />
            <Input
              placeholder="Tìm theo tên, số hiệu, tên file..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
          </Space>

          {coQuyenSua && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                formThem.resetFields();
                setFileChon(null);
                formThem.setFieldsValue({ loai: 'QUYET_DINH_LUONG' });
                setMoModalThem(true);
              }}
            >
              Tải lên quyết định / Giấy tờ
            </Button>
          )}
        </div>
      </Card>

      {/* Bảng danh sách tài liệu */}
      <Table
        rowKey="id"
        columns={cot}
        dataSource={danhSach}
        loading={isLoading}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        locale={{
          emptyText: 'Chưa có giấy tờ, quyết định nào được đính kèm cho cán bộ này.',
        }}
      />

      {/* Modal Tải lên tài liệu mới */}
      <Modal
        title={`Tải lên hồ sơ, giấy tờ${hoTenCanBo ? ` cho ${hoTenCanBo}` : ''}`}
        open={moModalThem}
        onOk={xuLyTaiLen}
        onCancel={() => setMoModalThem(false)}
        confirmLoading={dangTaiLen}
        okText="Tải lên & Lưu"
        cancelText="Hủy"
        width={580}
        destroyOnClose
      >
        <Form form={formThem} layout="vertical" initialValues={{ loai: 'QUYET_DINH_LUONG' }} style={{ marginTop: 16 }}>
          <Form.Item label="File đính kèm (PDF, Word, Excel, Ảnh)" required>
            <Upload.Dragger
              maxCount={1}
              beforeUpload={(file) => {
                setFileChon(file);
                if (!formThem.getFieldValue('ten')) {
                  const tenGoiY = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                  formThem.setFieldValue('ten', tenGoiY);
                }
                return false;
              }}
              onRemove={() => setFileChon(null)}
              fileList={fileChon ? [fileChon as any] : []}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#0e7c86', fontSize: 36 }} />
              </p>
              <p className="ant-upload-text">Nhấp hoặc kéo thả file vào đây để tải lên</p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                Hỗ trợ định dạng PDF, Word, Excel, Ảnh (JPG, PNG). Dung lượng tối đa 25MB.
              </p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item
            name="loai"
            label="Phân loại giấy tờ"
            rules={[{ required: true, message: 'Vui lòng chọn loại giấy tờ' }]}
          >
            <Select
              options={Object.entries(NHAN_LOAI_TAI_LIEU).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="ten"
            label="Tên giấy tờ / Quyết định"
            rules={[{ required: true, message: 'Vui lòng nhập tên giấy tờ' }]}
          >
            <Input placeholder="Ví dụ: Quyết định nâng bậc lương thường xuyên năm 2024" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="soHieu" label="Số hiệu / Số quyết định">
              <Input placeholder="Ví dụ: 145/QĐ-CĐN" />
            </Form.Item>

            <Form.Item name="ngayBanHanh" label="Ngày ban hành / Ngày ký">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
            </Form.Item>
          </div>

          <Form.Item name="coQuanBanHanh" label="Cơ quan / Người ban hành">
            <Input placeholder="Ví dụ: Hiệu trưởng, Sở Nội vụ, ..." />
          </Form.Item>

          <Form.Item name="ghiChu" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Nội dung tóm tắt hoặc ghi chú lưu ý..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa tài liệu */}
      <Modal
        title="Chỉnh sửa thông tin giấy tờ / Quyết định"
        open={moModalSua}
        onOk={xuLyCapNhat}
        onCancel={() => {
          setMoModalSua(false);
          setItemSua(null);
          setFileMoi(null);
        }}
        confirmLoading={dangCapNhat}
        okText="Cập nhật thay đổi"
        cancelText="Hủy"
        width={580}
        destroyOnClose
      >
        <Form form={formSua} layout="vertical" style={{ marginTop: 16 }}>
          {itemSua && (
            <Alert
              style={{ marginBottom: 16 }}
              message={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>File hiện tại:</span>
                  {layIconFile(itemSua.tenFile, itemSua.dinhDang)}
                  <strong>{itemSua.tenFile}</strong>
                  <span>({fmtBytes(itemSua.kichThuoc)})</span>
                </div>
              }
              type="info"
              showIcon
            />
          )}

          <Form.Item
            name="loai"
            label="Phân loại giấy tờ"
            rules={[{ required: true, message: 'Vui lòng chọn loại giấy tờ' }]}
          >
            <Select
              options={Object.entries(NHAN_LOAI_TAI_LIEU).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="ten"
            label="Tên giấy tờ / Quyết định"
            rules={[{ required: true, message: 'Vui lòng nhập tên giấy tờ' }]}
          >
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="soHieu" label="Số hiệu / Số quyết định">
              <Input placeholder="Ví dụ: 145/QĐ-CĐN" />
            </Form.Item>

            <Form.Item name="ngayBanHanh" label="Ngày ban hành / Ngày ký">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
            </Form.Item>
          </div>

          <Form.Item name="coQuanBanHanh" label="Cơ quan / Người ban hành">
            <Input placeholder="Ví dụ: Hiệu trưởng, Sở Nội vụ, ..." />
          </Form.Item>

          <Form.Item name="ghiChu" label="Ghi chú thêm">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            label="Thay đổi file đính kèm (Tùy chọn)"
            extra="Nếu không muốn thay đổi file, hãy để trống phần này."
          >
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                setFileMoi(file);
                return false;
              }}
              onRemove={() => setFileMoi(null)}
              fileList={fileMoi ? [fileMoi as any] : []}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            >
              <Button icon={<UploadOutlined />}>Chọn file mới thay thế file cũ</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xem trước file (Preview) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 24 }}>
            {itemXem && layIconFile(itemXem.tenFile, itemXem.dinhDang)}
            <Typography.Text ellipsis style={{ maxWidth: 450 }}>
              {itemXem?.ten ?? 'Xem tài liệu'}
            </Typography.Text>
          </div>
        }
        open={!!itemXem}
        onCancel={() => setItemXem(null)}
        footer={[
          <Button key="close" onClick={() => setItemXem(null)}>
            Đóng
          </Button>,
          itemXem && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() =>
                taiFile(`/tai-lieu/${nhanSuId}/${itemXem.id}/tai-ve`, {
                  tenMacDinh: itemXem.tenFile,
                })
              }
            >
              Tải file về máy
            </Button>
          ),
        ]}
        width={900}
        destroyOnClose
      >
        {itemXem && (
          <div style={{ marginTop: 12 }}>
            {itemXem.dinhDang === 'application/pdf' || itemXem.tenFile.toLowerCase().endsWith('.pdf') ? (
              <iframe
                title={itemXem.ten}
                src={`/api/tai-lieu/${nhanSuId}/${itemXem.id}/xem?token=${tokenStore.get()}`}
                style={{ width: '100%', height: '70vh', border: '1px solid #e2e8f0', borderRadius: 6 }}
              />
            ) : itemXem.dinhDang.startsWith('image/') ||
              ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some((ext) => itemXem.tenFile.toLowerCase().endsWith(ext)) ? (
              <div style={{ textAlign: 'center', maxHeight: '70vh', overflow: 'auto', background: '#f8fafc', padding: 16, borderRadius: 6 }}>
                <img
                  src={`/api/tai-lieu/${nhanSuId}/${itemXem.id}/xem?token=${tokenStore.get()}`}
                  alt={itemXem.ten}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ marginBottom: 16 }}>{layIconFile(itemXem.tenFile, itemXem.dinhDang)}</div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  {itemXem.tenFile}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ maxWidth: 450, margin: '0 auto 20px' }}>
                  Định dạng này không hỗ trợ xem trực tiếp trên trình duyệt. Vui lòng bấm nút <strong>Tải file về máy</strong> bên dưới để mở bằng Microsoft Office trên máy tính của bạn.
                </Typography.Paragraph>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    taiFile(`/tai-lieu/${nhanSuId}/${itemXem.id}/tai-ve`, {
                      tenMacDinh: itemXem.tenFile,
                    })
                  }
                >
                  Tải file về máy ({fmtBytes(itemXem.kichThuoc)})
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
