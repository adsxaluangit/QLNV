import { useState } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, taiFile } from '../api';
import { useAuth } from '../auth';
import { chuCaiDau, coQuyenSua, fmtNgay } from '../constants';
import { useDonVi } from '../danh-muc';

export type TinhTrangBoNhiem =
  | 'QUA_HAN'
  | 'DEN_HAN_90_NGAY'
  | 'SAP_DEN_HAN_180_NGAY'
  | 'BINH_THUONG'
  | 'CHUA_CO_NGAY';

export interface CanBoQuanLyDong {
  id: string;
  maCanBo: string;
  hoTen: string;
  gioiTinh: string | null;
  soQdBoNhiem: string | null;
  ngayBoNhiem: string | null;
  ngayHetHanBoNhiem: string | null;
  lanBoNhiem: number;
  donVi: { id: string; ten: string; ma: string } | null;
  chucVu: { id: string; ten: string; capQuanLy: number; laQuanLy: boolean } | null;
  soLanBoNhiem: number;
  tinhTrang: TinhTrangBoNhiem;
  ngayHetHan: string | null;
  ngayBatDauQuyTrinh: string | null;
  soNgayConLaiNhiemKy: number | null;
  soNgayConLaiDenMoc90: number | null;
  moTa: string;
}

export interface ThongKeBoNhiem {
  tongSo: number;
  quaHan: number;
  denHan90Ngay: number;
  sapDenHan180Ngay: number;
  binhThuong: number;
  chuaCoNgay: number;
  theoCap: {
    banGiamHieu: number;
    truongPhoKhoaPhong: number;
    toTruongPho: number;
  };
}

export interface LichSuBoNhiem {
  id: string;
  soQuyetDinh: string;
  ngayQuyetDinh: string;
  ngayHieuLuc: string;
  ngayHetHan: string | null;
  thoiHanNam: number;
  loaiQuyetDinh: string;
  chucVu: string;
  donVi: string;
  nguoiKy: string | null;
  ghiChu: string | null;
  createdAt: string;
}

const NHAN_LOAI_QD: Record<string, { label: string; color: string }> = {
  BO_NHIEM_LAI: { label: 'Bổ nhiệm lại', color: 'blue' },
  BO_NHIEM_LAN_DAU: { label: 'Bổ nhiệm lần đầu', color: 'green' },
  KEO_DAI: { label: 'Kéo dài thời gian giữ chức vụ', color: 'purple' },
  THOI_GIU_CHUC_VU: { label: 'Thôi giữ chức vụ', color: 'default' },
};

const NHAN_CAP_QL: Record<number, { label: string; color: string }> = {
  1: { label: 'Ban Giám hiệu', color: 'magenta' },
  2: { label: 'Trưởng/Phó Khoa/Phòng/TT', color: 'geekblue' },
  3: { label: 'Tổ trưởng/Phó BM', color: 'cyan' },
};

export default function BoNhiem() {
  const { nguoiDung } = useAuth();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const donVi = useDonVi();
  const [sp, setSp] = useSearchParams();

  const [dangXuat, setDangXuat] = useState(false);
  const [canBoLapQd, setCanBoLapQd] = useState<CanBoQuanLyDong | null>(null);
  const [canBoCapNhatNhanh, setCanBoCapNhatNhanh] = useState<CanBoQuanLyDong | null>(null);
  const [canBoXemLichSu, setCanBoXemLichSu] = useState<CanBoQuanLyDong | null>(null);

  const [formQd] = Form.useForm();
  const [formNhanh] = Form.useForm();

  // Filters
  const q = sp.get('q') ?? '';
  const donViId = sp.get('donViId') ?? '';
  const capQuanLy = sp.get('capQuanLy') ?? '';
  const tinhTrang = sp.get('tinhTrang') ?? '';

  const datLoc = (k: string, v?: string) => {
    const moi = new URLSearchParams(sp);
    if (v) moi.set(k, v);
    else moi.delete(k);
    setSp(moi, { replace: true });
  };

  // Queries
  const { data: thongKe, isLoading: dangTaiTk } = useQuery({
    queryKey: ['bo-nhiem', 'thong-ke'],
    queryFn: () => api<ThongKeBoNhiem>('/bo-nhiem/thong-ke'),
  });

  const { data: danhSach = [], isLoading: dangTaiDs, refetch } = useQuery({
    queryKey: ['bo-nhiem', 'can-bo-quan-ly', { q, donViId, capQuanLy, tinhTrang }],
    queryFn: () =>
      api<CanBoQuanLyDong[]>('/bo-nhiem/can-bo-quan-ly', {
        query: {
          q: q || undefined,
          donViId: donViId || undefined,
          capQuanLy: capQuanLy || undefined,
          tinhTrang: tinhTrang || undefined,
        },
      }),
  });

  const { data: lichSu = [], isLoading: dangTaiLichSu } = useQuery({
    queryKey: ['bo-nhiem', canBoXemLichSu?.id, 'lich-su'],
    enabled: !!canBoXemLichSu?.id,
    queryFn: () => api<LichSuBoNhiem[]>(`/bo-nhiem/${canBoXemLichSu!.id}/lich-su`),
  });

  // Mutations
  const dotLapQd = useMutation({
    mutationFn: (values: any) => api('/bo-nhiem/lap-quyet-dinh', { method: 'POST', body: values }),
    onSuccess: () => {
      message.success('Đã lập quyết định bổ nhiệm và cập nhật hồ sơ thành công!');
      setCanBoLapQd(null);
      formQd.resetFields();
      qc.invalidateQueries({ queryKey: ['bo-nhiem'] });
      qc.invalidateQueries({ queryKey: ['nhan-su'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Lỗi khi lập quyết định');
    },
  });

  const dotCapNhatNhanh = useMutation({
    mutationFn: (values: any) =>
      api(`/bo-nhiem/${canBoCapNhatNhanh!.id}/cap-nhat-nhanh`, { method: 'PATCH', body: values }),
    onSuccess: () => {
      message.success('Đã cập nhật thông tin bổ nhiệm thành công!');
      setCanBoCapNhatNhanh(null);
      formNhanh.resetFields();
      qc.invalidateQueries({ queryKey: ['bo-nhiem'] });
    },
    onError: (err: any) => {
      message.error(err.message || 'Lỗi khi cập nhật');
    },
  });

  const xuatExcel = async () => {
    try {
      setDangXuat(true);
      await taiFile(
        `/bo-nhiem/xuat-excel?${new URLSearchParams({
          donViId,
          tinhTrang,
        }).toString()}`,
        { tenMacDinh: 'Danh_Sach_Can_Bo_Quan_Ly_Bo_Nhiem_Lai.xlsx' },
      );
      message.success('Xuất file Excel thành công!');
    } catch (e: any) {
      message.error(e.message || 'Lỗi xuất file Excel');
    } finally {
      setDangXuat(false);
    }
  };

  const moModalLapQd = (cb: CanBoQuanLyDong) => {
    setCanBoLapQd(cb);
    const dNow = dayjs();
    const dHieuLuc = cb.ngayHetHan ? dayjs(cb.ngayHetHan) : dNow;
    formQd.setFieldsValue({
      nhanSuId: cb.id,
      loaiQuyetDinh: cb.ngayBoNhiem ? 'BO_NHIEM_LAI' : 'BO_NHIEM_LAN_DAU',
      soQuyetDinh: '',
      ngayQuyetDinh: dNow,
      ngayHieuLuc: dHieuLuc,
      thoiHanNam: 5,
      chucVu: cb.chucVu?.ten || '',
      donVi: cb.donVi?.ten || '',
      nguoiKy: 'Hiệu trưởng',
      ghiChu: cb.ngayBoNhiem
        ? `Bổ nhiệm lại nhiệm kỳ ${cb.lanBoNhiem + 1 || 2} sau 5 năm`
        : 'Quyết định bổ nhiệm chức vụ quản lý',
    });
  };

  const moModalCapNhatNhanh = (cb: CanBoQuanLyDong) => {
    setCanBoCapNhatNhanh(cb);
    formNhanh.setFieldsValue({
      ngayBoNhiem: cb.ngayBoNhiem ? dayjs(cb.ngayBoNhiem) : null,
      soQdBoNhiem: cb.soQdBoNhiem || '',
      thoiHanNam: 5,
    });
  };

  const tagTinhTrang = (cb: CanBoQuanLyDong) => {
    switch (cb.tinhTrang) {
      case 'QUA_HAN':
        return (
          <Tag color="error" icon={<ExclamationCircleOutlined />}>
            Quá hạn ({Math.abs(cb.soNgayConLaiNhiemKy ?? 0)} ngày)
          </Tag>
        );
      case 'DEN_HAN_90_NGAY':
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Đến hạn 90 ngày (còn {cb.soNgayConLaiNhiemKy} ngày)
          </Tag>
        );
      case 'SAP_DEN_HAN_180_NGAY':
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            Sắp đến hạn (còn {cb.soNgayConLaiNhiemKy} ngày)
          </Tag>
        );
      case 'BINH_THUONG':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            {cb.moTa}
          </Tag>
        );
      default:
        return <Tag color="default">Chưa có ngày</Tag>;
    }
  };

  const quyenSua = coQuyenSua(nguoiDung?.vaiTro);

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center' as const,
      render: (_: any, __: any, idx: number) => idx + 1,
    },
    {
      title: 'Cán bộ quản lý',
      key: 'canBo',
      width: 220,
      render: (_: any, r: CanBoQuanLyDong) => (
        <Space size={10}>
          <Avatar
            size={40}
            style={{
              backgroundColor: r.chucVu?.capQuanLy === 1 ? '#c026d3' : '#0e7c86',
              fontWeight: 600,
            }}
          >
            {chuCaiDau(r.hoTen)}
          </Avatar>
          <div>
            <Link to={`/nhan-su/${r.id}`} style={{ fontWeight: 600, color: '#0958d9' }}>
              {r.hoTen}
            </Link>
            <div style={{ fontSize: 12, color: '#64748b' }}>Mã: {r.maCanBo}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Chức vụ & Đơn vị',
      key: 'chucVu',
      width: 240,
      render: (_: any, r: CanBoQuanLyDong) => {
        const cap = r.chucVu?.capQuanLy ? NHAN_CAP_QL[r.chucVu.capQuanLy] : null;
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.chucVu?.ten}</div>
            <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{r.donVi?.ten}</div>
            {cap && (
              <Tag color={cap.color} style={{ fontSize: 11, marginTop: 4 }}>
                {cap.label}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Quyết định bổ nhiệm',
      key: 'quyetDinh',
      width: 170,
      render: (_: any, r: CanBoQuanLyDong) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.soQdBoNhiem || <span style={{ color: '#94a3b8' }}>Chưa có</span>}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Ngày bổ nhiệm: {r.ngayBoNhiem ? fmtNgay(r.ngayBoNhiem) : '-'}
          </div>
          {r.lanBoNhiem > 1 && (
            <Tag color="cyan" style={{ fontSize: 11, marginTop: 2 }}>
              Lần {r.lanBoNhiem}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Nhiệm kỳ (5 năm)',
      key: 'nhiemKy',
      width: 170,
      render: (_: any, r: CanBoQuanLyDong) => (
        <div>
          <div>
            Hết hạn: <b style={{ color: r.tinhTrang === 'QUA_HAN' ? '#dc2626' : '#1e293b' }}>{fmtNgay(r.ngayHetHan)}</b>
          </div>
          <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>
            Mốc 90 ngày: {fmtNgay(r.ngayBatDauQuyTrinh)}
          </div>
        </div>
      ),
    },
    {
      title: 'Tình trạng bổ nhiệm',
      key: 'tinhTrang',
      width: 210,
      render: (_: any, r: CanBoQuanLyDong) => (
        <div>
          {tagTinhTrang(r)}
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>{r.moTa}</div>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'thaoTac',
      width: 170,
      align: 'center' as const,
      render: (_: any, r: CanBoQuanLyDong) => (
        <Space size={6} wrap>
          {quyenSua && (
            <Tooltip title="Lập quyết định bổ nhiệm lại / gia hạn">
              <Button
                type="primary"
                size="small"
                icon={<AuditOutlined />}
                style={{
                  background: r.tinhTrang === 'QUA_HAN' || r.tinhTrang === 'DEN_HAN_90_NGAY' ? '#d97706' : '#0e7c86',
                  borderColor: r.tinhTrang === 'QUA_HAN' || r.tinhTrang === 'DEN_HAN_90_NGAY' ? '#d97706' : '#0e7c86',
                }}
                onClick={() => moModalLapQd(r)}
              >
                Bổ nhiệm lại
              </Button>
            </Tooltip>
          )}
          {quyenSua && (
            <Tooltip title="Cập nhật nhanh ngày bổ nhiệm / số quyết định">
              <Button size="small" onClick={() => moModalCapNhatNhanh(r)}>
                Sửa ngày
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Xem lịch sử các quyết định bổ nhiệm">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => setCanBoXemLichSu(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner & Quy định */}
      <Alert
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                QUY ĐỊNH THỜI HẠN BỔ NHIỆM & BỔ NHIỆM LẠI VIÊN CHỨC QUẢN LÝ
              </span>
              <span style={{ marginLeft: 8, fontSize: 12.5, opacity: 0.85 }}>
                (Căn cứ Điều 41 & Điều 50 Nghị định số 115/2020/NĐ-CP)
              </span>
            </div>
            <Tag color="volcano" style={{ fontWeight: 600 }}>
              Cảnh báo sớm 90 ngày
            </Tag>
          </div>
        }
        description={
          <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
            • <b>Thời hạn bổ nhiệm:</b> Giữ chức vụ quản lý là <b>05 năm (60 tháng)</b> tính từ ngày quyết định bổ nhiệm
            có hiệu lực.
            <br />• <b>Quy trình bổ nhiệm lại:</b> Chậm nhất <b>90 ngày</b> trước ngày hết thời hạn bổ nhiệm, cơ quan/đơn
            vị phải ra thông báo và thực hiện quy trình xem xét bổ nhiệm lại hoặc kéo dài thời gian giữ chức vụ.
          </div>
        }
        type="info"
        showIcon
        icon={<AuditOutlined style={{ fontSize: 24, color: '#0e7c86' }} />}
        style={{
          border: '1px solid #99f6e4',
          background: '#f0fdfa',
          borderRadius: 12,
        }}
      />

      {/* Thẻ Thống Kê */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', '')}
            style={{
              cursor: 'pointer',
              borderColor: !tinhTrang ? '#0e7c86' : undefined,
              boxShadow: !tinhTrang ? '0 0 0 2px #0e7c8620' : undefined,
              borderRadius: 10,
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#64748b' }}>Tổng cán bộ quản lý</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0e7c86', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.tongSo ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Trưởng, Phó, BGH...</div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', 'QUA_HAN')}
            style={{
              cursor: 'pointer',
              borderColor: tinhTrang === 'QUA_HAN' ? '#dc2626' : undefined,
              boxShadow: tinhTrang === 'QUA_HAN' ? '0 0 0 2px #dc262620' : undefined,
              borderRadius: 10,
              background: '#fef2f2',
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>Quá hạn bổ nhiệm</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.quaHan ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Cần bổ nhiệm gấp</div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', 'DEN_HAN_90_NGAY')}
            style={{
              cursor: 'pointer',
              borderColor: tinhTrang === 'DEN_HAN_90_NGAY' ? '#d97706' : undefined,
              boxShadow: tinhTrang === 'DEN_HAN_90_NGAY' ? '0 0 0 2px #d9770620' : undefined,
              borderRadius: 10,
              background: '#fffbeb',
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>Đến hạn 90 ngày</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.denHan90Ngay ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Bắt đầu làm quy trình</div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', 'SAP_DEN_HAN_180_NGAY')}
            style={{
              cursor: 'pointer',
              borderColor: tinhTrang === 'SAP_DEN_HAN_180_NGAY' ? '#0284c7' : undefined,
              boxShadow: tinhTrang === 'SAP_DEN_HAN_180_NGAY' ? '0 0 0 2px #0284c720' : undefined,
              borderRadius: 10,
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#0369a1' }}>Sắp đến hạn (≤ 180 ngày)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.sapDenHan180Ngay ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>Chuẩn bị hồ sơ</div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', 'BINH_THUONG')}
            style={{
              cursor: 'pointer',
              borderColor: tinhTrang === 'BINH_THUONG' ? '#059669' : undefined,
              boxShadow: tinhTrang === 'BINH_THUONG' ? '0 0 0 2px #05966920' : undefined,
              borderRadius: 10,
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#047857' }}>Nhiệm kỳ bình thường</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.binhThuong ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>Còn trên 6 tháng</div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <Card
            hoverable
            onClick={() => datLoc('tinhTrang', 'CHUA_CO_NGAY')}
            style={{
              cursor: 'pointer',
              borderColor: tinhTrang === 'CHUA_CO_NGAY' ? '#64748b' : undefined,
              boxShadow: tinhTrang === 'CHUA_CO_NGAY' ? '0 0 0 2px #64748b20' : undefined,
              borderRadius: 10,
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <div style={{ fontSize: 12, color: '#475569' }}>Chưa có ngày bổ nhiệm</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
              {dangTaiTk ? '-' : thongKe?.chuaCoNgay ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Cần bổ sung hồ sơ</div>
          </Card>
        </Col>
      </Row>

      {/* Bộ Lọc & Bảng Danh Sách */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AuditOutlined style={{ color: '#0e7c86' }} />
            <span>Danh sách Cán bộ Quản lý & Theo dõi Bổ nhiệm lại</span>
            <Tag color="cyan">{danhSach.length} cán bộ</Tag>
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<FileExcelOutlined style={{ color: '#16a34a' }} />}
              onClick={xuatExcel}
              loading={dangXuat}
            >
              Xuất Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
          </Space>
        }
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12 }}
      >
        {/* Filter bar */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={7}>
            <Input
              allowClear
              placeholder="Tìm theo họ tên, mã cán bộ..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={q}
              onChange={(e) => datLoc('q', e.target.value)}
            />
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Select
              allowClear
              placeholder="-- Tình trạng nhiệm kỳ --"
              style={{ width: '100%' }}
              value={tinhTrang || undefined}
              onChange={(v) => datLoc('tinhTrang', v)}
              options={[
                { value: 'QUA_HAN', label: '🔴 Đã quá hạn bổ nhiệm' },
                { value: 'DEN_HAN_90_NGAY', label: '🟡 Đến hạn 90 ngày (Quy trình)' },
                { value: 'SAP_DEN_HAN_180_NGAY', label: '🔵 Sắp đến hạn (≤ 180 ngày)' },
                { value: 'BINH_THUONG', label: '🟢 Còn hạn bình thường' },
                { value: 'CHUA_CO_NGAY', label: '⚪ Chưa cập nhật ngày bổ nhiệm' },
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={6}>
            <Select
              allowClear
              showSearch
              placeholder="-- Đơn vị / Khoa / Phòng --"
              style={{ width: '100%' }}
              value={donViId || undefined}
              onChange={(v) => datLoc('donViId', v)}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={donVi.data?.map((d) => ({ value: d.id, label: d.ten })) ?? []}
            />
          </Col>

          <Col xs={12} sm={6} md={6}>
            <Select
              allowClear
              placeholder="-- Cấp quản lý --"
              style={{ width: '100%' }}
              value={capQuanLy || undefined}
              onChange={(v) => datLoc('capQuanLy', v)}
              options={[
                { value: '1', label: 'Cấp 1: Ban Giám hiệu' },
                { value: '2', label: 'Cấp 2: Trưởng/Phó Khoa, Phòng, TT' },
                { value: '3', label: 'Cấp 3: Tổ trưởng, Tổ phó bộ môn' },
              ]}
            />
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={danhSach}
          loading={dangTaiDs}
          pagination={{ pageSize: 20, showTotal: (t) => `Tổng số ${t} cán bộ quản lý` }}
          scroll={{ x: 1080 }}
          bordered
        />
      </Card>

      {/* Modal Lập Quyết Định Bổ Nhiệm Lại */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AuditOutlined style={{ color: '#0e7c86' }} />
            <span>Lập Quyết định Bổ nhiệm lại / Kéo dài thời gian giữ chức vụ</span>
          </div>
        }
        open={!!canBoLapQd}
        onCancel={() => {
          setCanBoLapQd(null);
          formQd.resetFields();
        }}
        onOk={() => formQd.submit()}
        confirmLoading={dotLapQd.isPending}
        okText="Ký & Ban hành quyết định"
        cancelText="Đóng"
        width={680}
        destroyOnClose
      >
        {canBoLapQd && (
          <Form
            form={formQd}
            layout="vertical"
            onFinish={(vals) => {
              dotLapQd.mutate({
                ...vals,
                ngayQuyetDinh: vals.ngayQuyetDinh ? vals.ngayQuyetDinh.format('YYYY-MM-DD') : undefined,
                ngayHieuLuc: vals.ngayHieuLuc ? vals.ngayHieuLuc.format('YYYY-MM-DD') : undefined,
              });
            }}
          >
            <Form.Item name="nhanSuId" hidden>
              <Input />
            </Form.Item>

            <Alert
              message={
                <div>
                  Cán bộ: <b>{canBoLapQd.hoTen}</b> - Mã CB: <b>{canBoLapQd.maCanBo}</b>
                  <br />
                  Chức vụ: <b>{canBoLapQd.chucVu?.ten}</b> - Đơn vị: <b>{canBoLapQd.donVi?.ten}</b>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Loại quyết định"
                  name="loaiQuyetDinh"
                  rules={[{ required: true, message: 'Chọn loại quyết định' }]}
                >
                  <Select
                    options={[
                      { value: 'BO_NHIEM_LAI', label: 'Bổ nhiệm lại (sau 5 năm)' },
                      { value: 'BO_NHIEM_LAN_DAU', label: 'Bổ nhiệm lần đầu' },
                      { value: 'KEO_DAI', label: 'Kéo dài thời gian giữ chức vụ' },
                      { value: 'THOI_GIU_CHUC_VU', label: 'Thôi giữ chức vụ quản lý' },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Số quyết định"
                  name="soQuyetDinh"
                  rules={[{ required: true, message: 'Nhập số quyết định' }]}
                >
                  <Input placeholder="Ví dụ: 256/QĐ-CĐHH" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Ngày ký quyết định"
                  name="ngayQuyetDinh"
                  rules={[{ required: true, message: 'Chọn ngày ký' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Ngày có hiệu lực"
                  name="ngayHieuLuc"
                  rules={[{ required: true, message: 'Chọn ngày hiệu lực' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Thời hạn bổ nhiệm (năm)"
                  name="thoiHanNam"
                  rules={[{ required: true, message: 'Nhập số năm' }]}
                  extra="Theo NĐ 115/2020: Thời hạn bổ nhiệm là 05 năm"
                >
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Người ký quyết định" name="nguoiKy">
                  <Input placeholder="Ví dụ: Hiệu trưởng" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Chức vụ bổ nhiệm" name="chucVu">
                  <Input placeholder="Chức vụ quản lý" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Đơn vị / Bộ phận" name="donVi">
                  <Input placeholder="Đơn vị trực thuộc" />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item label="Ghi chú / Căn cứ" name="ghiChu">
                  <Input.TextArea rows={2} placeholder="Nội dung căn cứ, quy trình tổ chức thực hiện..." />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Modal>

      {/* Modal Cập Nhật Nhanh Ngày Bổ Nhiệm */}
      <Modal
        title="Cập nhật nhanh thông tin bổ nhiệm"
        open={!!canBoCapNhatNhanh}
        onCancel={() => {
          setCanBoCapNhatNhanh(null);
          formNhanh.resetFields();
        }}
        onOk={() => formNhanh.submit()}
        confirmLoading={dotCapNhatNhanh.isPending}
        okText="Lưu thông tin"
        cancelText="Hủy"
        destroyOnClose
      >
        {canBoCapNhatNhanh && (
          <Form
            form={formNhanh}
            layout="vertical"
            onFinish={(vals) => {
              dotCapNhatNhanh.mutate({
                ngayBoNhiem: vals.ngayBoNhiem ? vals.ngayBoNhiem.format('YYYY-MM-DD') : null,
                soQdBoNhiem: vals.soQdBoNhiem || null,
                thoiHanNam: vals.thoiHanNam || 5,
              });
            }}
          >
            <div style={{ marginBottom: 12 }}>
              Cán bộ: <b>{canBoCapNhatNhanh.hoTen}</b> ({canBoCapNhatNhanh.chucVu?.ten} -{' '}
              {canBoCapNhatNhanh.donVi?.ten})
            </div>

            <Form.Item label="Ngày bổ nhiệm (tính mốc 5 năm)" name="ngayBoNhiem">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày quyết định bổ nhiệm" />
            </Form.Item>

            <Form.Item label="Số quyết định bổ nhiệm" name="soQdBoNhiem">
              <Input placeholder="Ví dụ: 158/QĐ-CĐHH" />
            </Form.Item>

            <Form.Item
              label="Thời hạn bổ nhiệm (năm)"
              name="thoiHanNam"
              extra="Mặc định 5 năm (hệ thống tự động tính ngày hết hạn và mốc 90 ngày)"
            >
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Modal Lịch Sử Các Lần Bổ Nhiệm */}
      <Modal
        title={`Lịch sử bổ nhiệm: ${canBoXemLichSu?.hoTen ?? ''}`}
        open={!!canBoXemLichSu}
        onCancel={() => setCanBoXemLichSu(null)}
        footer={[
          <Button key="close" onClick={() => setCanBoXemLichSu(null)}>
            Đóng
          </Button>,
        ]}
        width={640}
      >
        {dangTaiLichSu ? (
          <div>Đang tải dữ liệu...</div>
        ) : lichSu.length === 0 ? (
          <Empty description="Chưa có dữ liệu lịch sử các quyết định bổ nhiệm" />
        ) : (
          <Timeline
            style={{ marginTop: 16 }}
            items={lichSu.map((ls) => {
              const loai = NHAN_LOAI_QD[ls.loaiQuyetDinh] || { label: ls.loaiQuyetDinh, color: 'default' };
              return {
                color: loai.color,
                children: (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={loai.color}>{loai.label}</Tag>
                      <span style={{ fontWeight: 600 }}>{ls.soQuyetDinh}</span>
                    </div>
                    <div style={{ marginTop: 4, color: '#334155' }}>
                      Chức vụ: <b>{ls.chucVu}</b> - {ls.donVi}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                      Hiệu lực: {fmtNgay(ls.ngayHieuLuc)} → Hết hạn: {fmtNgay(ls.ngayHetHan)} ({ls.thoiHanNam} năm)
                    </div>
                    {ls.nguoiKy && <div style={{ fontSize: 12, color: '#64748b' }}>Người ký: {ls.nguoiKy}</div>}
                    {ls.ghiChu && (
                      <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>
                        {ls.ghiChu}
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        )}
      </Modal>
    </div>
  );
}
