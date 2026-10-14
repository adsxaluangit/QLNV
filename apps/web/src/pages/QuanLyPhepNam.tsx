import { useState } from 'react';
import { App as AntApp, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api, ApiError, taiFile } from '../api';
import { useAuth } from '../auth';
import { coQuyenSua, fmtNgay, toIso } from '../constants';
import { useDonVi } from '../danh-muc';
import { Don, khoangNgay, LichSuDuyet, MAU_TT } from './NghiPhepCuaToi';

interface DongQuy {
  quyId: string;
  maCanBo: string;
  hoTen: string;
  donVi: string;
  laGiangVien: boolean;
  kiemNhiem?: boolean;
  ngayTuyenDung: string | null;
  soThang: number;
  phepCoBan: number;
  phepThamNien: number;
  dieuChinh: number;
  lyDoDieuChinh: string | null;
  ghiChu: string | null;
  tongPhep: number;
  daNghi: number;
  choDuyet: number;
  conLai: number;
  om: number;
  thaiSan: number;
  khongLuong: number;
  viecRieng: number;
  khac: number;
}

const TRANG_THAI = [
  { value: 'CHO_TRUONG_DON_VI', label: 'Chờ Trưởng đơn vị' },
  { value: 'CHO_BGH', label: 'Chờ Ban giám hiệu' },
  { value: 'CHO_TCHC', label: 'Chờ TCHC xác nhận' },
  { value: 'DA_DUYET', label: 'Đã duyệt' },
  { value: 'TU_CHOI', label: 'Từ chối' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

function Loc({ nam, setNam, donViId, setDonViId, q, setQ, extra }: {
  nam: number; setNam: (n: number) => void; donViId?: string; setDonViId: (v?: string) => void; q: string; setQ: (v: string) => void; extra?: React.ReactNode;
}) {
  const dv = useDonVi();
  const y = dayjs().year();
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Select value={nam} style={{ width: 100 }} onChange={setNam} options={[y - 2, y - 1, y, y + 1].map((n) => ({ value: n, label: n }))} />
      <Select
        allowClear showSearch optionFilterProp="label" placeholder="Tất cả đơn vị" style={{ width: 240 }}
        value={donViId} onChange={setDonViId}
        options={(dv.data ?? []).map((d) => ({ value: d.id, label: d.ten }))}
      />
      <Input.Search allowClear placeholder="Tìm tên hoặc CCCD" style={{ width: 220 }} onSearch={setQ} defaultValue={q} />
      {extra}
    </Space>
  );
}

function TabQuy({ sua }: { sua: boolean }) {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [nam, setNam] = useState(dayjs().year());
  const [donViId, setDonViId] = useState<string>();
  const [q, setQ] = useState('');
  const [dc, setDc] = useState<DongQuy>();
  const [form] = Form.useForm<{ dieuChinh: number; lyDo?: string }>();
  const ds = useQuery({ queryKey: ['quy-phep', nam, donViId, q], queryFn: () => api<DongQuy[]>('/nghi-phep/quy-phep', { query: { nam, donViId, q } }) });
  const tinhLai = useMutation({
    mutationFn: () => api('/nghi-phep/quy-phep/tinh-lai', { method: 'POST', body: { nam } }),
    onSuccess: () => { message.success('Đã tính lại quỹ phép'); qc.invalidateQueries({ queryKey: ['quy-phep'] }); },
    onError: (e: ApiError) => message.error(e.message),
  });
  const luu = useMutation({
    mutationFn: (v: { dieuChinh: number; lyDo?: string }) => api(`/nghi-phep/quy-phep/${dc!.quyId}/dieu-chinh`, { method: 'PATCH', body: { dieuChinh: v.dieuChinh ?? 0, lyDo: v.lyDo } }),
    onSuccess: () => { message.success('Đã cập nhật'); setDc(undefined); qc.invalidateQueries({ queryKey: ['quy-phep'] }); },
    onError: (e: ApiError) => message.error(e.message),
  });

  return (
    <>
      <Loc nam={nam} setNam={setNam} donViId={donViId} setDonViId={setDonViId} q={q} setQ={setQ}
        extra={<>
          <Button icon={<DownloadOutlined />} onClick={() => taiFile('/nghi-phep/quy-phep/xuat-excel', { query: { nam, donViId, q } }).catch((e: ApiError) => message.error(e.message))}>Xuất Excel</Button>
          {sua && (
            <Popconfirm title={`Tính lại phép năm ${nam} cho toàn bộ cán bộ?`} description="Phần điều chỉnh thủ công được giữ nguyên." onConfirm={() => tinhLai.mutate()}>
              <Button icon={<ReloadOutlined />} loading={tinhLai.isPending}>Tính lại</Button>
            </Popconfirm>
          )}
        </>}
      />
      <Table<DongQuy>
        rowKey="quyId" size="small" loading={ds.isFetching} dataSource={ds.data} scroll={{ x: 1300 }}
        pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `${t} cán bộ` }}
        columns={[
          { title: 'Họ và tên', width: 250, fixed: 'left', render: (_, r) => (<span style={{ whiteSpace: 'nowrap' }}><b>{r.hoTen}</b>{r.laGiangVien && <Tag style={{ marginLeft: 6 }}>GV</Tag>}{r.kiemNhiem && <Tag color="cyan" style={{ marginLeft: 6 }}>GVKN</Tag>}</span>) },
          { title: 'Đơn vị', dataIndex: 'donVi', width: 200, ellipsis: true },
          { title: 'Tuyển dụng', dataIndex: 'ngayTuyenDung', width: 125, render: (v: string | null) => <span style={{ whiteSpace: 'nowrap' }}>{fmtNgay(v)}</span> },
          { title: 'Cơ bản', dataIndex: 'phepCoBan', width: 70, align: 'center' },
          { title: 'Thâm niên', dataIndex: 'phepThamNien', width: 85, align: 'center' },
          { title: 'Điều chỉnh', dataIndex: 'dieuChinh', width: 90, align: 'center', render: (v: number, r) => (v ? <span title={r.lyDoDieuChinh ?? ''}>{v > 0 ? `+${v}` : v}</span> : '') },
          { title: 'Tổng', dataIndex: 'tongPhep', width: 70, align: 'center', render: (v) => <b>{v}</b> },
          { title: 'Đã nghỉ', dataIndex: 'daNghi', width: 80, align: 'center' },
          { title: 'Chờ duyệt', dataIndex: 'choDuyet', width: 85, align: 'center' },
          { title: 'Còn lại', dataIndex: 'conLai', width: 80, align: 'center', render: (v) => <b style={{ color: '#0f766e' }}>{v}</b> },
          { title: 'Nghỉ riêng', width: 100, align: 'center', render: (_, r) => r.om + r.thaiSan + r.khongLuong + r.viecRieng + r.khac || '' },
          { title: 'Ghi chú', dataIndex: 'ghiChu', ellipsis: true },
          ...(sua ? [{ title: '', width: 60, fixed: 'right' as const, render: (_: unknown, r: DongQuy) => (
            <Button size="small" icon={<EditOutlined />} onClick={() => { setDc(r); form.setFieldsValue({ dieuChinh: r.dieuChinh, lyDo: r.lyDoDieuChinh ?? '' }); }} />
          ) }] : []),
        ]}
      />
      <Modal title={`Điều chỉnh phép năm – ${dc?.hoTen ?? ''}`} open={!!dc} okText="Lưu" cancelText="Đóng" confirmLoading={luu.isPending}
        onCancel={() => setDc(undefined)} onOk={() => form.validateFields().then((v) => luu.mutate(v))} destroyOnClose>
        <p style={{ color: '#64748b' }}>Số ngày phép tính theo quy định: <b>{dc?.tongPhep !== undefined ? dc.tongPhep - dc.dieuChinh : ''}</b>. Nhập số ngày cộng (+) hoặc trừ (−) thêm.</p>
        <Form form={form} layout="vertical">
          <Form.Item name="dieuChinh" label="Số ngày điều chỉnh" rules={[{ required: true }]}><InputNumber min={-30} max={30} step={0.5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="lyDo" label="Lý do điều chỉnh (bắt buộc nếu khác 0)"><Input.TextArea rows={2} maxLength={300} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function TabDon() {
  const [nam, setNam] = useState(dayjs().year());
  const [donViId, setDonViId] = useState<string>();
  const [q, setQ] = useState('');
  const [trangThai, setTrangThai] = useState<string>();
  const ds = useQuery({ queryKey: ['tat-ca-don', nam, donViId, q, trangThai], queryFn: () => api<Don[]>('/nghi-phep/don', { query: { nam, donViId, q, trangThai } }) });
  return (
    <>
      <Loc nam={nam} setNam={setNam} donViId={donViId} setDonViId={setDonViId} q={q} setQ={setQ}
        extra={<Select allowClear placeholder="Trạng thái" style={{ width: 200 }} options={TRANG_THAI} value={trangThai} onChange={setTrangThai} />} />
      <Table<Don>
        rowKey="id" size="small" loading={ds.isFetching} dataSource={ds.data} scroll={{ x: 900 }}
        expandable={{ expandedRowRender: (r) => <LichSuDuyet d={r} /> }}
        pagination={{ pageSize: 30, showSizeChanger: false, showTotal: (t) => `${t} đơn` }}
        columns={[
          { title: 'Cán bộ', width: 200, render: (_, r) => (<><b>{r.hoTen}</b><div style={{ color: '#64748b', fontSize: 12 }}>{r.donVi}</div></>) },
          { title: 'Loại nghỉ', dataIndex: 'tenLoai', width: 170 },
          { title: 'Thời gian', width: 190, render: (_, r) => khoangNgay(r) },
          { title: 'Số ngày', dataIndex: 'soNgay', width: 80, align: 'center' },
          { title: 'Lý do', dataIndex: 'lyDo', ellipsis: true },
          { title: 'Trạng thái', width: 170, render: (_, r) => <Tag color={MAU_TT[r.trangThai]}>{r.tenTrangThai}</Tag> },
        ]}
      />
    </>
  );
}

function TabLe({ sua }: { sua: boolean }) {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [nam, setNam] = useState(dayjs().year());
  const [mo, setMo] = useState(false);
  const [form] = Form.useForm<{ khoang: [dayjs.Dayjs, dayjs.Dayjs]; ten: string }>();
  const ds = useQuery({ queryKey: ['ngay-le', nam], queryFn: () => api<{ id: string; ngay: string; ten: string }[]>('/nghi-phep/ngay-le', { query: { nam } }) });
  const them = useMutation({
    mutationFn: (v: { khoang: [dayjs.Dayjs, dayjs.Dayjs]; ten: string }) => api('/nghi-phep/ngay-le', { method: 'POST', body: { tuNgay: toIso(v.khoang[0]), denNgay: toIso(v.khoang[1]), ten: v.ten } }),
    onSuccess: () => { message.success('Đã thêm ngày nghỉ lễ'); setMo(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['ngay-le'] }); },
    onError: (e: ApiError) => message.error(e.message),
  });
  const xoa = useMutation({
    mutationFn: (id: string) => api(`/nghi-phep/ngay-le/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ngay-le'] }),
    onError: (e: ApiError) => message.error(e.message),
  });
  const y = dayjs().year();
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select value={nam} style={{ width: 100 }} onChange={setNam} options={[y - 1, y, y + 1].map((n) => ({ value: n, label: n }))} />
        {sua && <Button type="primary" icon={<PlusOutlined />} onClick={() => setMo(true)}>Thêm ngày nghỉ lễ</Button>}
      </Space>
      <p style={{ color: '#64748b', marginTop: 0 }}>Ngày nghỉ lễ không bị tính vào số ngày nghỉ phép. Tết Nguyên đán và Giỗ Tổ (âm lịch) cần Phòng TCHC nhập theo thông báo hằng năm.</p>
      <Table rowKey="id" size="small" loading={ds.isFetching} dataSource={ds.data} pagination={false}
        columns={[
          { title: 'Ngày', dataIndex: 'ngay', width: 140, render: (v: string) => `${dayjs(v).format('DD/MM/YYYY')} (${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dayjs(v).day()]})` },
          { title: 'Tên ngày nghỉ', dataIndex: 'ten' },
          ...(sua ? [{ title: '', width: 70, render: (_: unknown, r: { id: string }) => (
            <Popconfirm title="Xóa ngày nghỉ này?" onConfirm={() => xoa.mutate(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
          ) }] : []),
        ]}
      />
      <Modal title="Thêm ngày nghỉ lễ" open={mo} okText="Thêm" cancelText="Đóng" confirmLoading={them.isPending} onCancel={() => setMo(false)} onOk={() => form.validateFields().then((v) => them.mutate(v))} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="ten" label="Tên ngày nghỉ" rules={[{ required: true, message: 'Nhập tên' }]}><Input placeholder="VD: Tết Nguyên đán" /></Form.Item>
          <Form.Item name="khoang" label="Từ ngày – đến ngày" rules={[{ required: true, message: 'Chọn ngày' }]}><DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

interface DongGV {
  id: string;
  maCanBo: string;
  hoTen: string;
  kiemNhiem: boolean;
  donVi: string;
  loaiDonVi: string;
  chucVu: string | null;
}

/** TCHC tích chọn giảng viên kiêm nhiệm (làm hành chính): phép năm tính như nhân viên. */
function TabKiemNhiem() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [donViId, setDonViId] = useState<string>();
  const [q, setQ] = useState('');
  const [chiKhongKhoa, setChiKhongKhoa] = useState(true);
  const [chon, setChon] = useState<string[]>([]);
  const dv = useDonVi();
  const ds = useQuery({
    queryKey: ['gv-kiem-nhiem', donViId, q, chiKhongKhoa],
    queryFn: () => api<DongGV[]>('/nghi-phep/giang-vien', { query: { donViId, q, chiKhongKhoa } }),
  });
  const luu = useMutation({
    mutationFn: (v: boolean) => api<{ soLuong: number }>('/nghi-phep/giang-vien/kiem-nhiem', { method: 'PUT', body: { ids: chon, kiemNhiem: v } }),
    onSuccess: (r, v) => {
      message.success(`${v ? 'Đã đánh dấu' : 'Đã bỏ đánh dấu'} kiêm nhiệm cho ${r.soLuong} cán bộ`);
      setChon([]);
      qc.invalidateQueries({ queryKey: ['gv-kiem-nhiem'] });
      qc.invalidateQueries({ queryKey: ['quy-phep'] });
    },
    onError: (e: ApiError) => message.error(e.message),
  });
  const soKN = ds.data?.filter((x) => x.kiemNhiem).length ?? 0;
  return (
    <>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Giảng viên không có phép năm (nghỉ hè). Giảng viên <b>kiêm nhiệm</b> (làm hành chính) được tính phép như nhân viên: 12 ngày + 1 ngày mỗi 5 năm thâm niên.
        Tích chọn các người cần đánh dấu rồi bấm nút. Phép năm hiện tại được tính lại ngay.
      </p>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear showSearch optionFilterProp="label" placeholder="Tất cả đơn vị" style={{ width: 260 }}
          value={donViId} onChange={(v) => { setDonViId(v); setChon([]); }}
          options={(dv.data ?? []).map((d) => ({ value: d.id, label: d.ten }))}
        />
        <Input.Search allowClear placeholder="Tìm tên hoặc CCCD" style={{ width: 220 }} onSearch={setQ} />
        <Checkbox checked={chiKhongKhoa} onChange={(e) => { setChiKhongKhoa(e.target.checked); setChon([]); }}>Chỉ hiện phòng / trung tâm / ban (ẩn các Khoa)</Checkbox>
        <Button type="primary" disabled={!chon.length} loading={luu.isPending} onClick={() => luu.mutate(true)} id="kn-danh-dau">Đánh dấu kiêm nhiệm ({chon.length})</Button>
        <Button disabled={!chon.length} loading={luu.isPending} onClick={() => luu.mutate(false)}>Bỏ đánh dấu</Button>
      </Space>
      <Table<DongGV>
        rowKey="id" size="small" loading={ds.isFetching} dataSource={ds.data}
        rowSelection={{ selectedRowKeys: chon, onChange: (k) => setChon(k as string[]), preserveSelectedRowKeys: false }}
        pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} giảng viên · ${soKN} kiêm nhiệm` }}
        columns={[
          { title: 'Họ và tên', dataIndex: 'hoTen', render: (v: string) => <b>{v}</b> },
          { title: 'Đơn vị', dataIndex: 'donVi' },
          { title: 'Chức vụ', dataIndex: 'chucVu', width: 180 },
          { title: 'Trạng thái', dataIndex: 'kiemNhiem', width: 190, render: (v: boolean) => (v ? <Tag color="cyan">Kiêm nhiệm – có phép năm</Tag> : <Tag>Giảng viên – không có phép</Tag>) },
        ]}
      />
    </>
  );
}

export default function QuanLyPhepNam() {
  const { nguoiDung } = useAuth();
  const sua = coQuyenSua(nguoiDung?.vaiTro);
  return (
    <Card className="card-mem">
      <Tabs
        items={[
          { key: 'quy', label: 'Quỹ phép năm', children: <TabQuy sua={sua} /> },
          { key: 'don', label: 'Tất cả đơn nghỉ', children: <TabDon /> },
          { key: 'le', label: 'Ngày nghỉ lễ', children: <TabLe sua={sua} /> },
          ...(sua ? [{ key: 'kn', label: 'Giảng viên kiêm nhiệm', children: <TabKiemNhiem /> }] : []),
        ]}
      />
    </Card>
  );
}
