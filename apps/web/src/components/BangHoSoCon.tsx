import { useState } from 'react';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table } from 'antd';
import type { FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { fmtHeSo, fmtNgay, fmtTien, toDayjs, toIso } from '../constants';

export interface TruongCon {
  name: string;
  label: string;
  kieu?: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'tien' | 'heSo';
  options?: { value: string; label: string }[];
  batBuoc?: boolean;
  /** Độ rộng cột trong form (thang 24) */
  span?: number;
  /** Ẩn khỏi bảng (chỉ có trong form) */
  anTrongBang?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** Gợi ý hiển thị dưới ô nhập */
  goiY?: string;
  render?: (v: unknown, r: Record<string, unknown>) => React.ReactNode;
}

export type LoaiHoSoCon = 'qua-trinh-cong-tac' | 'van-bang' | 'gia-dinh' | 'qua-trinh-luong' | 'phu-cap' | 'hop-dong';

interface Props {
  nhanSuId: string;
  loai: LoaiHoSoCon;
  tieuDe: string;
  truong: TruongCon[];
  coQuyenSua: boolean;
  /** Gọi khi giá trị form thay đổi — dùng để tự điền (vd hệ số theo ngạch/bậc) */
  onDoiGiaTri?: (doi: Record<string, unknown>, form: FormInstance) => void;
  /** Giá trị mặc định khi thêm mới */
  macDinh?: Record<string, unknown>;
  /** Sau khi lưu/xóa thành công */
  onThayDoi?: () => void;
}

type Dong = Record<string, unknown> & { id: string };

/** Bảng con của hồ sơ (quá trình, văn bằng, gia đình) có thêm/sửa/xóa qua hộp thoại. */
export default function BangHoSoCon({ nhanSuId, loai, tieuDe, truong, coQuyenSua, onDoiGiaTri, macDinh, onThayDoi }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [dangSua, setDangSua] = useState<Dong | 'moi' | null>(null);
  const [dangLuu, setDangLuu] = useState(false);
  const key = ['ho-so-con', nhanSuId, loai];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<Dong[]>(`/nhan-su/${nhanSuId}/${loai}`) });

  const mo = (r: Dong | 'moi') => {
    setDangSua(r);
    form.resetFields();
    if (r === 'moi') {
      if (macDinh) form.setFieldsValue(macDinh);
    } else {
      const v: Record<string, unknown> = {};
      for (const t of truong) v[t.name] = t.kieu === 'date' ? toDayjs(r[t.name] as string) : r[t.name];
      form.setFieldsValue(v);
    }
  };

  const luu = async () => {
    const v = await form.validateFields();
    const body: Record<string, unknown> = {};
    for (const t of truong) body[t.name] = t.kieu === 'date' ? toIso(v[t.name]) : (v[t.name] ?? null);
    setDangLuu(true);
    try {
      if (dangSua === 'moi') await api(`/nhan-su/${nhanSuId}/${loai}`, { method: 'POST', body });
      else if (dangSua) await api(`/nhan-su/${nhanSuId}/${loai}/${dangSua.id}`, { method: 'PATCH', body });
      message.success('Đã lưu');
      setDangSua(null);
      qc.invalidateQueries({ queryKey: key });
      onThayDoi?.();
    } catch (e) {
      const err = e as ApiError;
      if (err.loi?.length) form.setFields(err.loi.map((l) => ({ name: l.truong, errors: [l.loi] })));
      message.error(err.message);
    } finally {
      setDangLuu(false);
    }
  };

  const xoa = async (id: string) => {
    try {
      await api(`/nhan-su/${nhanSuId}/${loai}/${id}`, { method: 'DELETE' });
      message.success('Đã xóa');
      qc.invalidateQueries({ queryKey: key });
      onThayDoi?.();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const cot: ColumnsType<Dong> = truong
    .filter((t) => !t.anTrongBang)
    .map((t) => ({
      title: t.label,
      dataIndex: t.name,
      width: t.width,
      align: t.align ?? (t.kieu === 'date' || t.name === 'namSinh' ? 'center' : t.kieu === 'tien' || t.kieu === 'heSo' ? 'right' : 'left'),
      render: (v: unknown, r: Dong) =>
        t.render
          ? t.render(v, r)
          : t.kieu === 'date'
            ? <span style={{ whiteSpace: 'nowrap' }}>{fmtNgay(v as string)}</span>
            : t.kieu === 'tien'
              ? fmtTien(v as number)
              : t.kieu === 'heSo'
                ? fmtHeSo(v as number)
                : t.options
                  ? t.options.find((o) => o.value === v)?.label
                  : (v as React.ReactNode),
    }));
  if (coQuyenSua) {
    cot.push({
      title: '',
      key: 'hd',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="text" icon={<EditOutlined />} onClick={() => mo(r)} />
          <Popconfirm title="Xóa dòng này?" okText="Xóa" cancelText="Không" onConfirm={() => xoa(r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <>
      {coQuyenSua && (
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => mo('moi')} id={`them-${loai}`}>
            Thêm {tieuDe.toLowerCase()}
          </Button>
        </div>
      )}
      <Table rowKey="id" size="middle" loading={isLoading} dataSource={data} columns={cot} pagination={false} locale={{ emptyText: 'Chưa có dữ liệu' }} />
      <Modal
        open={!!dangSua}
        title={`${dangSua === 'moi' ? 'Thêm' : 'Sửa'} ${tieuDe.toLowerCase()}`}
        onCancel={() => setDangSua(null)}
        onOk={luu}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={dangLuu}
        width={740}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={true}
          style={{ marginTop: 14 }}
          onValuesChange={(doi) => onDoiGiaTri?.(doi, form)}
        >
          <Row gutter={[16, 0]}>
            {truong.map((t) => (
              <Col span={t.span ?? 12} key={t.name}>
                <Form.Item
                  name={t.name}
                  label={t.label}
                  extra={t.goiY}
                  rules={t.batBuoc ? [{ required: true, message: `Nhập ${t.label.toLowerCase()}` }] : []}
                >
                  {t.kieu === 'date' ? (
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="dd/mm/yyyy" />
                  ) : t.kieu === 'number' ? (
                    <InputNumber style={{ width: '100%' }} />
                  ) : t.kieu === 'heSo' ? (
                    <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2} />
                  ) : t.kieu === 'tien' ? (
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={100000}
                      addonAfter="đ"
                      formatter={(v) => (v ? Number(v).toLocaleString('vi-VN') : '')}
                      parser={(v) => (v && /\d/.test(v) ? Number(v.replace(/\D/g, '')) : '') as unknown as 0}
                    />
                  ) : t.kieu === 'select' ? (
                    <Select options={t.options} allowClear={!t.batBuoc} showSearch optionFilterProp="label" />
                  ) : t.kieu === 'textarea' ? (
                    <Input.TextArea rows={2} />
                  ) : (
                    <Input />
                  )}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </>
  );
}
