import { useState } from 'react';
import { App, Avatar, Button, Card, Checkbox, Input, Select, Space, Table, Tag, Tooltip, TreeSelect, Typography } from 'antd';
import { DownloadOutlined, PlusOutlined, UploadOutlined, ClearOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, taiFile } from '../api';
import { useAuth } from '../auth';
import {
  chuCaiDau,
  coQuyenSua,
  fmtNgay,
  MAU_TRANG_THAI,
  NHAN_GIOI_TINH,
  NHAN_LOAI_NS,
  NHAN_TRANG_THAI,
  NHAN_TRINH_DO,
  tuyChon,
} from '../constants';
import { cayDonVi, useCoSo, useDonVi } from '../danh-muc';
import NhapExcel from '../components/NhapExcel';

export interface NhanSuDong {
  id: string;
  maCanBo: string;
  hoTen: string;
  gioiTinh: keyof typeof NHAN_GIOI_TINH | null;
  ngaySinh: string | null;
  dienThoai: string | null;
  loaiNhanSu: keyof typeof NHAN_LOAI_NS;
  trangThai: keyof typeof NHAN_TRANG_THAI;
  laGiangVien: boolean;
  kiemNhiem?: boolean;
  trinhDoChuyenMon: keyof typeof NHAN_TRINH_DO | null;
  chucDanhNgheNghiep: string | null;
  donVi: { id: string; ten: string; coSo: { id: string; ten: string } };
  chucVu: { id: string; ten: string } | null;
}

const BO_LOC = ['q', 'coSoId', 'donViId', 'loaiNhanSu', 'trangThai', 'trinhDo', 'gioiTinh', 'thieuCccd'] as const;

export const laMaTam = (ma: string) => ma.startsWith('TAM-');

export default function NhanSuList() {
  const { nguoiDung } = useAuth();
  const { message } = App.useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams({ trangThai: 'DANG_LAM_VIEC' });
  const [moNhap, setMoNhap] = useState(false);
  const [dangXuat, setDangXuat] = useState(false);
  const coSo = useCoSo();
  const donVi = useDonVi();

  const loc = Object.fromEntries(BO_LOC.map((k) => [k, sp.get(k) ?? undefined])) as Record<(typeof BO_LOC)[number], string | undefined>;
  const page = Number(sp.get('page') ?? 1);
  const pageSize = Number(sp.get('pageSize') ?? 20);

  const datLoc = (k: string, v?: string) => {
    const moi = new URLSearchParams(sp);
    if (v) moi.set(k, v);
    else moi.delete(k);
    if (k !== 'page' && k !== 'pageSize') moi.delete('page');
    // Giữ "trangThai" rỗng có chủ đích (xem tất cả)
    if (k === 'trangThai' && !v) moi.set('trangThai', '');
    setSp(moi, { replace: true });
  };

  const { data, isFetching } = useQuery({
    queryKey: ['nhan-su', loc, page, pageSize],
    queryFn: () => api<{ items: NhanSuDong[]; total: number }>('/nhan-su', { query: { ...loc, page, pageSize } }),
    placeholderData: keepPreviousData,
  });

  const xuat = async () => {
    setDangXuat(true);
    try {
      await taiFile('/nhan-su/xuat-excel', { query: loc });
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDangXuat(false);
    }
  };

  const sua = coQuyenSua(nguoiDung?.vaiTro);

  return (
    <Card className="card-mem" styles={{ body: { paddingTop: 20 } }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Input.Search
          id="tim-nhan-su"
          allowClear
          placeholder="Tìm theo tên, CCCD, email, điện thoại"
          defaultValue={loc.q}
          onSearch={(v) => datLoc('q', v.trim())}
          style={{ width: 320 }}
        />
        <Select
          allowClear
          placeholder="Cơ sở"
          style={{ width: 190 }}
          value={loc.coSoId}
          onChange={(v) => datLoc('coSoId', v)}
          options={coSo.data?.map((c) => ({ value: c.id, label: c.ten }))}
        />
        <TreeSelect
          allowClear
          showSearch
          treeNodeFilterProp="title"
          placeholder="Đơn vị"
          style={{ width: 240 }}
          value={loc.donViId}
          onChange={(v) => datLoc('donViId', v)}
          treeData={cayDonVi(
            coSo.data?.filter((c) => !loc.coSoId || c.id === loc.coSoId),
            donVi.data,
          )}
          treeDefaultExpandAll
        />
        <Select allowClear placeholder="Loại nhân sự" style={{ width: 170 }} value={loc.loaiNhanSu} onChange={(v) => datLoc('loaiNhanSu', v)} options={tuyChon(NHAN_LOAI_NS)} />
        <Select allowClear placeholder="Trình độ" style={{ width: 130 }} value={loc.trinhDo} onChange={(v) => datLoc('trinhDo', v)} options={tuyChon(NHAN_TRINH_DO)} />
        <Select allowClear placeholder="Tất cả trạng thái" style={{ width: 170 }} value={loc.trangThai || undefined} onChange={(v) => datLoc('trangThai', v)} options={tuyChon(NHAN_TRANG_THAI)} />
        <Checkbox
          id="loc-chua-cccd"
          checked={loc.thieuCccd === 'true'}
          onChange={(e) => datLoc('thieuCccd', e.target.checked ? 'true' : undefined)}
          style={{ alignSelf: 'center' }}
        >
          Chưa có CCCD
        </Checkbox>
        <Button icon={<ClearOutlined />} onClick={() => setSp({ trangThai: 'DANG_LAM_VIEC' }, { replace: true })}>
          Xóa lọc
        </Button>
        <Space style={{ marginLeft: 'auto' }}>
          <Button icon={<DownloadOutlined />} onClick={xuat} loading={dangXuat} id="nut-xuat-excel">
            Xuất Excel
          </Button>
          {sua && (
            <Button icon={<UploadOutlined />} onClick={() => setMoNhap(true)} id="nut-nhap-excel">
              Nhập Excel
            </Button>
          )}
          {sua && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/nhan-su/moi')} id="nut-them-nhan-su">
              Thêm cán bộ
            </Button>
          )}
        </Space>
      </div>

      <Table<NhanSuDong>
        rowKey="id"
        loading={isFetching}
        dataSource={data?.items}
        scroll={{ x: 1200 }}
        onRow={(r) => ({ onDoubleClick: () => nav(`/nhan-su/${r.id}`) })}
        pagination={{
          current: page,
          pageSize,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (t) => `Tổng ${t} cán bộ`,
          onChange: (p, s) => {
            const moi = new URLSearchParams(sp);
            moi.set('page', String(p));
            moi.set('pageSize', String(s));
            setSp(moi, { replace: true });
          },
        }}
        columns={[
          { title: 'STT', width: 60, align: 'center', render: (_, __, i) => (page - 1) * pageSize + i + 1 },
          {
            title: 'Họ và tên',
            key: 'hoTen',
            width: 250,
            fixed: 'left',
            render: (_, r) => (
              <Space>
                <Avatar style={{ background: r.gioiTinh === 'NU' ? '#ec4899' : '#0e7c86' }}>{chuCaiDau(r.hoTen)}</Avatar>
                <div>
                  <Link to={`/nhan-su/${r.id}`} style={{ fontWeight: 600 }}>
                    {r.hoTen}
                  </Link>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{r.chucVu?.ten ?? (r.laGiangVien ? (r.kiemNhiem ? 'Giảng viên kiêm nhiệm' : 'Giảng viên') : '')}</div>
                </div>
              </Space>
            ),
          },
          {
            title: 'Mã cán bộ (CCCD)',
            dataIndex: 'maCanBo',
            width: 160,
            align: 'center',
            render: (v: string) =>
              laMaTam(v) ? (
                <Tooltip title={`Mã tạm ${v} — cần bổ sung số CCCD`}>
                  <Tag color="orange">Chưa có CCCD</Tag>
                </Tooltip>
              ) : (
                <span className="ma-cccd" style={{ whiteSpace: 'nowrap' }}>{v}</span>
              ),
          },
          {
            title: 'Ngày sinh',
            dataIndex: 'ngaySinh',
            width: 125,
            align: 'center',
            render: (v) => <span style={{ whiteSpace: 'nowrap' }}>{fmtNgay(v)}</span>,
          },
          {
            title: 'Giới tính',
            dataIndex: 'gioiTinh',
            width: 90,
            align: 'center',
            render: (v: keyof typeof NHAN_GIOI_TINH | null) => (v ? NHAN_GIOI_TINH[v] : ''),
          },
          {
            title: 'Đơn vị',
            key: 'donVi',
            render: (_, r) => (
              <>
                <div style={{ fontWeight: 500 }}>{r.donVi.ten}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.donVi.coSo.ten}
                </Typography.Text>
              </>
            ),
          },
          {
            title: 'Trình độ',
            dataIndex: 'trinhDoChuyenMon',
            width: 115,
            align: 'center',
            render: (v: keyof typeof NHAN_TRINH_DO | null) => (v ? <Tag color="blue">{NHAN_TRINH_DO[v]}</Tag> : '—'),
          },
          {
            title: 'Loại cán bộ',
            dataIndex: 'loaiNhanSu',
            width: 135,
            align: 'center',
            render: (v: keyof typeof NHAN_LOAI_NS) => NHAN_LOAI_NS[v],
          },
          {
            title: 'Trạng thái',
            dataIndex: 'trangThai',
            width: 135,
            align: 'center',
            render: (v: keyof typeof NHAN_TRANG_THAI) => <Tag color={MAU_TRANG_THAI[v]}>{NHAN_TRANG_THAI[v]}</Tag>,
          },
        ]}
      />
      <NhapExcel open={moNhap} onClose={() => setMoNhap(false)} />
    </Card>
  );
}
