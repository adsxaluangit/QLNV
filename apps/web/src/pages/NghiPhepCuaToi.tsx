import { useState } from 'react';
import { Alert, App as AntApp, Button, Card, Checkbox, Col, DatePicker, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api, ApiError } from '../api';
import { fmtNgay, fmtNgayGio, toIso } from '../constants';

export interface Duyet {
  nguoiDuyet: string;
  buoc: string;
  ketQua: string;
  ghiChu: string | null;
  thoiGian: string;
}
export interface Don {
  id: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  loai: string;
  tenLoai: string;
  tuNgay: string;
  denNgay: string;
  nuaNgay: boolean;
  soNgay: number;
  lyDo: string;
  trangThai: string;
  tenTrangThai: string;
  lyDoTuChoi: string | null;
  ngayGui: string;
  duyets: Duyet[];
  phepConLai?: number | null;
}

export const MAU_TT: Record<string, string> = {
  CHO_TRUONG_DON_VI: 'gold',
  CHO_BGH: 'gold',
  CHO_TCHC: 'processing',
  DA_DUYET: 'success',
  TU_CHOI: 'error',
  DA_HUY: 'default',
};

const BUOC: Record<string, string> = {
  GUI_DON: 'Gửi đơn',
  CHO_TRUONG_DON_VI: 'Trưởng đơn vị',
  CHO_BGH: 'Ban giám hiệu',
  CHO_TCHC: 'Phòng TCHC xác nhận',
  HUY: 'Hủy đơn',
};
const KET_QUA: Record<string, string> = { GUI: 'đã gửi', DUYET: 'đã duyệt', TU_CHOI: 'từ chối', HUY: 'đã hủy' };

export function LichSuDuyet({ d }: { d: Don }) {
  return (
    <Timeline
      style={{ marginTop: 8, marginBottom: -16 }}
      items={d.duyets.map((x) => ({
        color: x.ketQua === 'TU_CHOI' ? 'red' : x.ketQua === 'DUYET' ? 'green' : 'blue',
        children: (
          <span>
            <b>{BUOC[x.buoc] ?? x.buoc}</b> – {x.nguoiDuyet} {KET_QUA[x.ketQua] ?? x.ketQua}
            <small style={{ color: '#64748b' }}> · {fmtNgayGio(x.thoiGian)}</small>
            {x.ghiChu ? <div style={{ color: '#475569' }}>“{x.ghiChu}”</div> : null}
          </span>
        ),
      }))}
    />
  );
}

export const khoangNgay = (r: Pick<Don, 'tuNgay' | 'denNgay' | 'nuaNgay'>) =>
  r.tuNgay === r.denNgay ? `${fmtNgay(r.tuNgay)}${r.nuaNgay ? ' (nửa ngày)' : ''}` : `${fmtNgay(r.tuNgay)} → ${fmtNgay(r.denNgay)}`;

interface Quy {
  nam: number;
  laGiangVien: boolean;
  kiemNhiem?: boolean;
  phepCoBan: number;
  phepThamNien: number;
  dieuChinh: number;
  ghiChu: string | null;
  tongPhep: number;
  daNghi: number;
  choDuyet: number;
  conLai: number;
  khaDung: number;
  nghiKhac: Record<string, number>;
}

const LOAI: Record<string, string> = {
  PHEP_NAM: 'Nghỉ phép năm',
  OM_DAU: 'Nghỉ ốm đau',
  THAI_SAN: 'Nghỉ thai sản',
  KHONG_LUONG: 'Nghỉ không lương',
  VIEC_RIENG: 'Nghỉ việc riêng (hiếu, hỉ)',
  KHAC: 'Nghỉ khác',
};

interface FormGia {
  loai: string;
  khoang: [Dayjs, Dayjs];
  nuaNgay?: boolean;
  lyDo: string;
}

export default function NghiPhepCuaToi() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [nam, setNam] = useState(dayjs().year());
  const [mo, setMo] = useState(false);
  const [form] = Form.useForm<FormGia>();
  const khoang = Form.useWatch('khoang', form);
  const nua = Form.useWatch('nuaNgay', form);
  const loai = Form.useWatch('loai', form);

  const quy = useQuery({ queryKey: ['quy-cua-toi', nam], queryFn: () => api<Quy>('/nghi-phep/quy-phep/cua-toi', { query: { nam } }) });
  const dons = useQuery({ queryKey: ['don-cua-toi', nam], queryFn: () => api<Don[]>('/nghi-phep/don/cua-toi', { query: { nam } }) });
  const motNgay = !!khoang && khoang[0].isSame(khoang[1], 'day');
  const uoc = useQuery({
    queryKey: ['uoc-tinh', khoang?.[0]?.format(), khoang?.[1]?.format(), nua],
    enabled: !!khoang,
    queryFn: () => api<{ soNgay: number }>('/nghi-phep/don/uoc-tinh', { query: { tuNgay: toIso(khoang[0]), denNgay: toIso(khoang[1]), nuaNgay: motNgay && !!nua } }),
  });

  const lamMoi = () => {
    qc.invalidateQueries({ queryKey: ['quy-cua-toi'] });
    qc.invalidateQueries({ queryKey: ['don-cua-toi'] });
  };
  const gui = useMutation({
    mutationFn: (v: FormGia) =>
      api('/nghi-phep/don', {
        method: 'POST',
        body: { loai: v.loai, tuNgay: toIso(v.khoang[0]), denNgay: toIso(v.khoang[1]), nuaNgay: motNgay && !!v.nuaNgay, lyDo: v.lyDo },
      }),
    onSuccess: () => {
      message.success('Đã gửi đơn xin nghỉ');
      setMo(false);
      form.resetFields();
      lamMoi();
    },
    onError: (e: ApiError) => message.error(e.message),
  });
  const huy = useMutation({
    mutationFn: (id: string) => api(`/nghi-phep/don/${id}/huy`, { method: 'PATCH' }),
    onSuccess: () => {
      message.success('Đã hủy đơn');
      lamMoi();
    },
    onError: (e: ApiError) => message.error(e.message),
  });

  const q = quy.data;
  const khac = Object.entries(q?.nghiKhac ?? {}).filter(([, v]) => v > 0);
  const choHuy = (t: string) => ['CHO_TRUONG_DON_VI', 'CHO_BGH', 'CHO_TCHC'].includes(t);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="card-mem" loading={quy.isLoading}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Typography.Text strong>Năm</Typography.Text>
            <Select
              value={nam}
              style={{ width: 110 }}
              onChange={setNam}
              options={[dayjs().year() - 1, dayjs().year(), dayjs().year() + 1].map((n) => ({ value: n, label: n }))}
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} id="xin-nghi" onClick={() => { form.setFieldsValue({ loai: q?.laGiangVien ? 'KHAC' : 'PHEP_NAM' }); setMo(true); }}>
            Xin nghỉ
          </Button>
        </div>
        {q?.laGiangVien && q.tongPhep === 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Giảng viên không có ngày phép năm (nghỉ hè thay thế). Các loại nghỉ khác (ốm đau, thai sản, việc riêng…) vẫn được gửi đơn bình thường."
          />
        )}
        <Row gutter={16}>
          <Col xs={12} md={5}><Statistic title="Phép năm được hưởng" value={q?.tongPhep} suffix="ngày" /></Col>
          <Col xs={12} md={5}><Statistic title="Đã nghỉ" value={q?.daNghi} suffix="ngày" /></Col>
          <Col xs={12} md={5}><Statistic title="Đang chờ duyệt" value={q?.choDuyet} suffix="ngày" valueStyle={{ color: '#d97706' }} /></Col>
          <Col xs={12} md={5}><Statistic title="Còn lại" value={q?.conLai} suffix="ngày" valueStyle={{ color: '#0f766e' }} /></Col>
        </Row>
        {q && (
          <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
            Cơ bản {q.phepCoBan} + thâm niên {q.phepThamNien}
            {q.dieuChinh ? ` + điều chỉnh ${q.dieuChinh}` : ''}. {q.ghiChu ?? ''} Phép chưa nghỉ hết trong năm sẽ không được chuyển sang năm sau.
          </div>
        )}
        {khac.length > 0 && (
          <div style={{ marginTop: 8 }}>
            Nghỉ riêng (không trừ phép năm):{' '}
            {khac.map(([k, v]) => (
              <Tag key={k}>{LOAI[k]}: {v} ngày</Tag>
            ))}
          </div>
        )}
      </Card>

      <Card className="card-mem" title="Đơn xin nghỉ của tôi">
        <Table<Don>
          rowKey="id"
          loading={dons.isFetching}
          dataSource={dons.data}
          size="middle"
          expandable={{ expandedRowRender: (r) => <LichSuDuyet d={r} /> }}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Loại nghỉ', dataIndex: 'tenLoai', width: 190 },
            { title: 'Thời gian', width: 200, render: (_, r) => khoangNgay(r) },
            { title: 'Số ngày', dataIndex: 'soNgay', width: 90, align: 'center' },
            { title: 'Lý do', dataIndex: 'lyDo', ellipsis: true },
            {
              title: 'Trạng thái',
              width: 190,
              render: (_, r) => (
                <>
                  <Tag color={MAU_TT[r.trangThai]}>{r.tenTrangThai}</Tag>
                  {r.lyDoTuChoi && <div style={{ color: '#dc2626', fontSize: 12 }}>{r.lyDoTuChoi}</div>}
                </>
              ),
            },
            {
              title: '',
              width: 90,
              render: (_, r) =>
                choHuy(r.trangThai) ? (
                  <Popconfirm title="Hủy đơn này?" okText="Hủy đơn" cancelText="Không" onConfirm={() => huy.mutate(r.id)}>
                    <Button size="small" danger>Hủy</Button>
                  </Popconfirm>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal title="Đơn xin nghỉ" open={mo} onCancel={() => setMo(false)} okText="Gửi đơn" cancelText="Đóng" confirmLoading={gui.isPending} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => gui.mutate(v)}>
          <Form.Item name="loai" label="Loại nghỉ" rules={[{ required: true }]}>
            <Select options={Object.entries(LOAI).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="khoang" label="Thời gian nghỉ" rules={[{ required: true, message: 'Chọn thời gian nghỉ' }]}>
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          {motNgay && (
            <Form.Item name="nuaNgay" valuePropName="checked">
              <Checkbox>Chỉ nghỉ nửa ngày</Checkbox>
            </Form.Item>
          )}
          {khoang && (
            <Alert
              style={{ marginBottom: 16 }}
              type={uoc.data && uoc.data.soNgay <= 0 ? 'warning' : 'info'}
              showIcon
              message={
                uoc.data
                  ? `Số ngày nghỉ (không tính T7, CN, ngày lễ): ${uoc.data.soNgay}` +
                    (loai === 'PHEP_NAM' && q ? ` · Phép khả dụng: ${q.khaDung} ngày` : '')
                  : 'Đang tính số ngày…'
              }
            />
          )}
          <Form.Item name="lyDo" label="Lý do" rules={[{ required: true, min: 3, message: 'Nhập lý do xin nghỉ' }]}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
