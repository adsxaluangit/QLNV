import { useState } from 'react';
import { App as AntApp, Button, Card, Form, Input, Modal, Space, Table, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { fmtNgayGio } from '../constants';
import { Don, khoangNgay, LichSuDuyet, MAU_TT } from './NghiPhepCuaToi';

export default function DuyetNghiPhep() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [tuChoi, setTuChoi] = useState<Don>();
  const [duyet, setDuyet] = useState<Don>();
  const [fTuChoi] = Form.useForm<{ lyDo: string }>();
  const [fDuyet] = Form.useForm<{ ghiChu?: string }>();

  const ds = useQuery({ queryKey: ['don-cho-duyet'], queryFn: () => api<Don[]>('/nghi-phep/don/cho-duyet') });
  const lamMoi = () => {
    qc.invalidateQueries({ queryKey: ['don-cho-duyet'] });
    qc.invalidateQueries({ queryKey: ['so-cho-duyet'] });
  };
  const mDuyet = useMutation({
    mutationFn: (v: { id: string; ghiChu?: string }) => api(`/nghi-phep/don/${v.id}/duyet`, { method: 'POST', body: { ghiChu: v.ghiChu } }),
    onSuccess: () => {
      message.success('Đã duyệt đơn');
      setDuyet(undefined);
      lamMoi();
    },
    onError: (e: ApiError) => message.error(e.message),
  });
  const mTuChoi = useMutation({
    mutationFn: (v: { id: string; lyDo: string }) => api(`/nghi-phep/don/${v.id}/tu-choi`, { method: 'POST', body: { lyDo: v.lyDo } }),
    onSuccess: () => {
      message.success('Đã từ chối đơn');
      setTuChoi(undefined);
      fTuChoi.resetFields();
      lamMoi();
    },
    onError: (e: ApiError) => message.error(e.message),
  });

  return (
    <Card className="card-mem" title="Đơn xin nghỉ đang chờ bạn xử lý">
      <Table<Don>
        rowKey="id"
        loading={ds.isFetching}
        dataSource={ds.data}
        locale={{ emptyText: 'Không có đơn nào đang chờ duyệt' }}
        expandable={{ expandedRowRender: (r) => <LichSuDuyet d={r} /> }}
        scroll={{ x: 1000 }}
        columns={[
          { title: 'Cán bộ', width: 200, render: (_, r) => (<><b>{r.hoTen}</b><div style={{ color: '#64748b', fontSize: 12 }}>{r.donVi}</div></>) },
          { title: 'Loại nghỉ', dataIndex: 'tenLoai', width: 170 },
          { title: 'Thời gian', width: 190, render: (_, r) => khoangNgay(r) },
          { title: 'Số ngày', dataIndex: 'soNgay', width: 80, align: 'center' },
          {
            title: 'Phép còn lại',
            dataIndex: 'phepConLai',
            width: 110,
            align: 'center',
            render: (v: number | null | undefined) => (v === null || v === undefined ? '—' : v),
          },
          { title: 'Lý do', dataIndex: 'lyDo', ellipsis: true },
          { title: 'Ngày gửi', dataIndex: 'ngayGui', width: 140, render: fmtNgayGio },
          { title: 'Bước', width: 150, render: (_, r) => <Tag color={MAU_TT[r.trangThai]}>{r.tenTrangThai}</Tag> },
          {
            title: '',
            width: 190,
            fixed: 'right',
            render: (_, r) => (
              <Space>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setDuyet(r)}>
                  {r.trangThai === 'CHO_TCHC' ? 'Xác nhận' : 'Duyệt'}
                </Button>
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => setTuChoi(r)}>
                  Từ chối
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={`Duyệt đơn của ${duyet?.hoTen ?? ''}`}
        open={!!duyet}
        okText="Đồng ý"
        cancelText="Đóng"
        confirmLoading={mDuyet.isPending}
        onCancel={() => setDuyet(undefined)}
        onOk={() => fDuyet.validateFields().then((v) => duyet && mDuyet.mutate({ id: duyet.id, ghiChu: v.ghiChu }))}
        destroyOnClose
      >
        <Form form={fDuyet} layout="vertical">
          <Form.Item name="ghiChu" label="Ghi chú (không bắt buộc)">
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Từ chối đơn của ${tuChoi?.hoTen ?? ''}`}
        open={!!tuChoi}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={mTuChoi.isPending}
        onCancel={() => setTuChoi(undefined)}
        onOk={() => fTuChoi.validateFields().then((v) => tuChoi && mTuChoi.mutate({ id: tuChoi.id, lyDo: v.lyDo }))}
        destroyOnClose
      >
        <Form form={fTuChoi} layout="vertical">
          <Form.Item name="lyDo" label="Lý do từ chối" rules={[{ required: true, min: 3, message: 'Nhập lý do từ chối' }]}>
            <Input.TextArea rows={3} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
