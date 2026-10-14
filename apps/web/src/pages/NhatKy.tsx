import { useState } from 'react';
import { Card, Input, Select, Table, Tag } from 'antd';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { fmtNgayGio } from '../constants';

interface Dong {
  id: string;
  tenDangNhap: string | null;
  hanhDong: string;
  doiTuong: string;
  moTa: string;
  duLieu: unknown;
  ip: string | null;
  thoiGian: string;
}

const HANH_DONG: Record<string, [string, string]> = {
  TAO: ['Thêm', 'green'],
  SUA: ['Sửa', 'blue'],
  XOA: ['Xóa', 'red'],
  NHAP_EXCEL: ['Nhập Excel', 'cyan'],
  DANG_NHAP: ['Đăng nhập', 'default'],
  DOI_MAT_KHAU: ['Đổi mật khẩu', 'purple'],
  DAT_LAI_MAT_KHAU: ['Đặt lại MK', 'orange'],
};

const DOI_TUONG = [
  { value: 'NhanSu', label: 'Hồ sơ nhân sự' },
  { value: 'quaTrinhCongTac', label: 'Quá trình công tác' },
  { value: 'vanBang', label: 'Văn bằng – chứng chỉ' },
  { value: 'quanHeGiaDinh', label: 'Quan hệ gia đình' },
  { value: 'DonVi', label: 'Đơn vị' },
  { value: 'CoSo', label: 'Cơ sở' },
  { value: 'ChucVu', label: 'Chức vụ' },
  { value: 'TaiKhoan', label: 'Tài khoản' },
  { value: 'DonNghi', label: 'Đơn xin nghỉ' },
  { value: 'QuyPhep', label: 'Quỹ phép năm' },
  { value: 'NgayNghiLe', label: 'Ngày nghỉ lễ' },
  { value: 'ChamCong', label: 'Chấm công' },
];

/** Hiển thị dữ liệu thay đổi dạng { truong: [cũ, mới] } */
function ThayDoi({ d }: { d: unknown }) {
  if (!d || typeof d !== 'object') return null;
  const dong = Object.entries(d as Record<string, unknown>).filter(([, v]) => Array.isArray(v) && v.length === 2) as [string, [unknown, unknown]][];
  if (!dong.length) return <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(d, null, 2)}</pre>;
  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(r) => r[0]}
      dataSource={dong}
      columns={[
        { title: 'Trường', render: (_, r) => <code>{r[0]}</code>, width: 200 },
        { title: 'Giá trị cũ', render: (_, r) => <span style={{ color: '#dc2626' }}>{String(r[1][0] ?? '—')}</span> },
        { title: 'Giá trị mới', render: (_, r) => <span style={{ color: '#16a34a' }}>{String(r[1][1] ?? '—')}</span> },
      ]}
    />
  );
}

export default function NhatKy() {
  const [q, setQ] = useState('');
  const [doiTuong, setDoiTuong] = useState<string>();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({
    queryKey: ['nhat-ky', q, doiTuong, page],
    queryFn: () => api<{ items: Dong[]; total: number }>('/nhat-ky', { query: { q, doiTuong, page, pageSize: 30 } }),
    placeholderData: keepPreviousData,
  });

  return (
    <Card className="card-mem">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input.Search allowClear placeholder="Tìm theo nội dung, người thực hiện" style={{ width: 340 }} onSearch={(v) => { setQ(v); setPage(1); }} />
        <Select allowClear placeholder="Đối tượng" style={{ width: 220 }} options={DOI_TUONG} value={doiTuong} onChange={(v) => { setDoiTuong(v); setPage(1); }} />
      </div>
      <Table<Dong>
        rowKey="id"
        loading={isFetching}
        dataSource={data?.items}
        expandable={{
          rowExpandable: (r) => !!r.duLieu,
          expandedRowRender: (r) => <ThayDoi d={r.duLieu} />,
        }}
        pagination={{ current: page, pageSize: 30, total: data?.total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `${t} bản ghi` }}
        columns={[
          { title: 'Thời gian', dataIndex: 'thoiGian', width: 160, render: fmtNgayGio },
          { title: 'Người thực hiện', dataIndex: 'tenDangNhap', width: 160, render: (v) => <span className="ma-cccd">{v}</span> },
          {
            title: 'Hành động',
            dataIndex: 'hanhDong',
            width: 130,
            render: (v: string) => <Tag color={HANH_DONG[v]?.[1]}>{HANH_DONG[v]?.[0] ?? v}</Tag>,
          },
          { title: 'Nội dung', dataIndex: 'moTa' },
          { title: 'IP', dataIndex: 'ip', width: 140 },
        ]}
      />
    </Card>
  );
}
