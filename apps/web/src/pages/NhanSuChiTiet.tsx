import { useState } from 'react';
import { App, Avatar, Button, Card, Descriptions, Empty, Popconfirm, Skeleton, Space, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  chuCaiDau,
  fmtNgay,
  MAU_TRANG_THAI,
  NHAN_GIOI_TINH,
  NHAN_LOAI_HOP_DONG,
  NHAN_LOAI_NS,
  NHAN_LOAI_VB,
  NHAN_TRANG_THAI,
  NHAN_TRINH_DO,
  tuyChon,
} from '../constants';
import NhanSuForm, { HoSo } from '../components/NhanSuForm';
import BangHoSoCon from '../components/BangHoSoCon';
import TabLuong from '../components/TabLuong';

interface ChiTiet {
  id: string;
  maCanBo: string;
  hoTen: string;
  gioiTinh: keyof typeof NHAN_GIOI_TINH | null;
  loaiNhanSu: keyof typeof NHAN_LOAI_NS;
  trangThai: keyof typeof NHAN_TRANG_THAI;
  trinhDoChuyenMon: keyof typeof NHAN_TRINH_DO | null;
  laGiangVien: boolean;
  kiemNhiem?: boolean;
  donVi: { id: string; ten: string; coSo: { ten: string } };
  chucVu: { ten: string } | null;
  taiKhoan: { vaiTro: string; hoatDong: boolean; dangNhapCuoi: string | null } | null;
  coQuyenSua: boolean;
  [k: string]: unknown;
}

const s = (v: unknown) => (v === null || v === undefined || v === '' ? <span style={{ color: '#cbd5e1' }}>—</span> : String(v));

export default function NhanSuChiTiet({ taoMoi = false, cuaToi = false }: { taoMoi?: boolean; cuaToi?: boolean }) {
  const params = useParams();
  const { nguoiDung } = useAuth();
  const { message } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const id = cuaToi ? nguoiDung?.nhanSuId : params.id;
  const [dangSua, setDangSua] = useState(false);
  const [sp, setSp] = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['nhan-su', id],
    queryFn: () => api<ChiTiet>(`/nhan-su/${id}`),
    enabled: !taoMoi && !!id,
  });

  if (taoMoi) {
    return (
      <Card className="card-mem">
        <NhanSuForm
          onHuy={() => nav(-1)}
          onDaLuu={(ns) => {
            qc.invalidateQueries({ queryKey: ['nhan-su'] });
            nav(`/nhan-su/${ns.id}`, { replace: true });
          }}
        />
      </Card>
    );
  }
  if (cuaToi && !id) return <Empty description="Tài khoản của bạn chưa gắn với hồ sơ cán bộ" />;
  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (error || !data) return <Empty description={(error as Error)?.message ?? 'Không tìm thấy hồ sơ'} />;

  const xoa = async () => {
    try {
      await api(`/nhan-su/${data.id}`, { method: 'DELETE' });
      message.success('Đã xóa hồ sơ');
      qc.invalidateQueries({ queryKey: ['nhan-su'] });
      nav('/nhan-su', { replace: true });
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const sua = data.coQuyenSua;

  return (
    <>
      <div className="ho-so-dau">
        <Avatar size={76} style={{ fontSize: 28 }}>
          {chuCaiDau(data.hoTen)}
        </Avatar>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>{data.hoTen}</h2>
          <div className="meta">
            <span>
              {data.maCanBo.startsWith('TAM-') ? (
                <Tag color="orange">Chưa có CCCD · mã tạm {data.maCanBo}</Tag>
              ) : (
                <>
                  CCCD: <b className="ma-cccd">{data.maCanBo}</b>
                </>
              )}
            </span>
            <span>{data.chucVu?.ten ?? (data.laGiangVien ? 'Giảng viên' : 'Cán bộ')}</span>
            <span>
              {data.donVi.ten} · {data.donVi.coSo.ten}
            </span>
          </div>
          <Space size={6} style={{ marginTop: 10 }} wrap>
            <Tag color={MAU_TRANG_THAI[data.trangThai]}>{NHAN_TRANG_THAI[data.trangThai]}</Tag>
            <Tag color="cyan">{NHAN_LOAI_NS[data.loaiNhanSu]}</Tag>
            {data.trinhDoChuyenMon && <Tag color="gold">{NHAN_TRINH_DO[data.trinhDoChuyenMon]}</Tag>}
            {data.laGiangVien && <Tag color="purple">{data.kiemNhiem ? 'Giảng viên kiêm nhiệm' : 'Giảng viên'}</Tag>}
          </Space>
        </div>
        <Space className="hanh-dong">
          {!cuaToi && (
            <Button ghost icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>
              Quay lại
            </Button>
          )}
          {sua && !dangSua && (
            <Button icon={<EditOutlined />} onClick={() => setDangSua(true)} id="nut-sua-ho-so">
              Sửa hồ sơ
            </Button>
          )}
          {sua && (
            <Popconfirm
              title="Xóa hồ sơ này?"
              description="Toàn bộ quá trình, văn bằng, tài khoản của cán bộ sẽ bị xóa. Nếu cán bộ đã nghỉ, nên đổi trạng thái thay vì xóa."
              okText="Xóa"
              okButtonProps={{ danger: true }}
              cancelText="Không"
              onConfirm={xoa}
            >
              <Button danger icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {dangSua ? (
        <Card className="card-mem" title="Sửa hồ sơ">
          <NhanSuForm
            banDau={data as unknown as HoSo}
            onHuy={() => setDangSua(false)}
            onDaLuu={() => {
              setDangSua(false);
              qc.invalidateQueries({ queryKey: ['nhan-su'] });
            }}
          />
        </Card>
      ) : (
        <Card className="card-mem" styles={{ body: { paddingTop: 8 } }}>
          <Tabs
            activeKey={sp.get('tab') ?? 'ly-lich'}
            onChange={(k) => setSp(k === 'ly-lich' ? {} : { tab: k }, { replace: true })}
            items={[
              {
                key: 'ly-lich',
                label: 'Lý lịch',
                children: <LyLich d={data} />,
              },
              {
                key: 'qua-trinh',
                label: 'Quá trình công tác',
                children: (
                  <BangHoSoCon
                    nhanSuId={data.id}
                    loai="qua-trinh-cong-tac"
                    tieuDe="Quá trình công tác"
                    coQuyenSua={sua}
                    truong={[
                      { name: 'tuNgay', label: 'Từ ngày', kieu: 'date', batBuoc: true, width: 120, span: 6, align: 'center' },
                      { name: 'denNgay', label: 'Đến ngày', kieu: 'date', width: 120, span: 6, align: 'center', render: (v) => (v ? fmtNgay(v as string) : <Tag color="green">Nay</Tag>) },
                      { name: 'chucVu', label: 'Chức vụ', span: 12 },
                      { name: 'noiCongTac', label: 'Nơi công tác', batBuoc: true, span: 16 },
                      { name: 'soQuyetDinh', label: 'Số quyết định', span: 8, width: 140 },
                      { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24, anTrongBang: true },
                    ]}
                  />
                ),
              },
              {
                key: 'van-bang',
                label: 'Văn bằng – Chứng chỉ',
                children: (
                  <BangHoSoCon
                    nhanSuId={data.id}
                    loai="van-bang"
                    tieuDe="Văn bằng / chứng chỉ"
                    coQuyenSua={sua}
                    truong={[
                      { name: 'loai', label: 'Loại văn bằng / chứng chỉ', kieu: 'select', options: tuyChon(NHAN_LOAI_VB), batBuoc: true, span: 8, width: 120 },
                      { name: 'ten', label: 'Tên văn bằng / chứng chỉ', batBuoc: true, span: 16 },
                      { name: 'chuyenNganh', label: 'Chuyên ngành', span: 12 },
                      { name: 'noiCap', label: 'Nơi cấp', span: 12 },
                      { name: 'soHieu', label: 'Số hiệu văn bằng', span: 6, anTrongBang: true },
                      { name: 'xepLoai', label: 'Xếp loại', span: 6, width: 100, align: 'center' },
                      { name: 'ngayCap', label: 'Ngày cấp', kieu: 'date', span: 6, width: 120, align: 'center' },
                      {
                        name: 'ngayHetHan',
                        label: 'Ngày hết hạn',
                        kieu: 'date',
                        span: 6,
                        width: 125,
                        align: 'center',
                        render: (v) => {
                          if (!v) return '';
                          const het = new Date(v as string) < new Date();
                          return <Tag color={het ? 'red' : 'default'}>{fmtNgay(v as string)}</Tag>;
                        },
                      },
                      { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24, anTrongBang: true },
                    ]}
                  />
                ),
              },
              {
                key: 'gia-dinh',
                label: 'Quan hệ gia đình',
                children: (
                  <BangHoSoCon
                    nhanSuId={data.id}
                    loai="gia-dinh"
                    tieuDe="Quan hệ gia đình"
                    coQuyenSua={sua}
                    truong={[
                      { name: 'quanHe', label: 'Quan hệ', batBuoc: true, span: 7, width: 120 },
                      { name: 'hoTen', label: 'Họ và tên', batBuoc: true, span: 11 },
                      { name: 'namSinh', label: 'Năm sinh', kieu: 'number', span: 6, width: 110, align: 'center' },
                      { name: 'ngheNghiep', label: 'Nghề nghiệp, nơi làm việc', span: 12 },
                      { name: 'noiO', label: 'Nơi ở', span: 12 },
                      { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24, anTrongBang: true },
                    ]}
                  />
                ),
              },
              {
                key: 'luong',
                label: 'Lương & phụ cấp',
                children: <TabLuong nhanSuId={data.id} coQuyenSua={sua} />,
              },
              {
                key: 'hop-dong',
                label: 'Hợp đồng',
                children: (
                  <BangHoSoCon
                    nhanSuId={data.id}
                    loai="hop-dong"
                    tieuDe="Hợp đồng"
                    coQuyenSua={sua}
                    truong={[
                      { name: 'soHopDong', label: 'Số hợp đồng', span: 8, width: 130 },
                      { name: 'loai', label: 'Loại hợp đồng', kieu: 'select', options: tuyChon(NHAN_LOAI_HOP_DONG), batBuoc: true, span: 16 },
                      { name: 'ngayKy', label: 'Ngày ký', kieu: 'date', span: 8, width: 120, align: 'center' },
                      { name: 'tuNgay', label: 'Từ ngày', kieu: 'date', batBuoc: true, span: 8, width: 120, align: 'center' },
                      {
                        name: 'denNgay',
                        label: 'Đến ngày',
                        kieu: 'date',
                        span: 8,
                        width: 135,
                        align: 'center',
                        goiY: 'Để trống nếu không xác định thời hạn',
                        render: (v) => {
                          if (!v) return <Tag color="green">Không thời hạn</Tag>;
                          const conLai = (new Date(v as string).getTime() - Date.now()) / 86_400_000;
                          return <Tag color={conLai < 0 ? 'red' : conLai <= 60 ? 'orange' : 'default'}>{fmtNgay(v as string)}</Tag>;
                        },
                      },
                      { name: 'chucDanh', label: 'Chức danh / công việc', span: 12 },
                      { name: 'luongThoaThuan', label: 'Lương thỏa thuận', kieu: 'tien', span: 12, width: 140, align: 'right' },
                      { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24, anTrongBang: true },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}

function LyLich({ d }: { d: ChiTiet }) {
  const col = { xs: 1, md: 2, xl: 3 };
  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Descriptions title="Thông tin cá nhân" column={col} size="small" bordered>
        <Descriptions.Item label="Họ và tên">{d.hoTen}</Descriptions.Item>
        <Descriptions.Item label="Tên gọi khác">{s(d.tenGoiKhac)}</Descriptions.Item>
        <Descriptions.Item label="Giới tính">{s(d.gioiTinh ? NHAN_GIOI_TINH[d.gioiTinh] : null)}</Descriptions.Item>
        <Descriptions.Item label="Ngày sinh">{s(fmtNgay(d.ngaySinh as string))}</Descriptions.Item>
        <Descriptions.Item label="Nơi sinh">{s(d.noiSinh)}</Descriptions.Item>
        <Descriptions.Item label="Quê quán">{s(d.queQuan)}</Descriptions.Item>
        <Descriptions.Item label="Số CCCD">
          <span className="ma-cccd">{d.maCanBo}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Ngày cấp">{s(fmtNgay(d.ngayCapCccd as string))}</Descriptions.Item>
        <Descriptions.Item label="Nơi cấp">{s(d.noiCapCccd)}</Descriptions.Item>
        <Descriptions.Item label="Dân tộc">{s(d.danToc)}</Descriptions.Item>
        <Descriptions.Item label="Tôn giáo">{s(d.tonGiao)}</Descriptions.Item>
        <Descriptions.Item label="Quốc tịch">{s(d.quocTich)}</Descriptions.Item>
        <Descriptions.Item label="Điện thoại">{s(d.dienThoai)}</Descriptions.Item>
        <Descriptions.Item label="Email">{s(d.email)}</Descriptions.Item>
        <Descriptions.Item label="Thường trú">{s(d.diaChiThuongTru)}</Descriptions.Item>
        <Descriptions.Item label="Chỗ ở hiện nay" span={3}>
          {s(d.choOHienNay)}
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="Công tác" column={col} size="small" bordered>
        <Descriptions.Item label="Đơn vị">{d.donVi.ten}</Descriptions.Item>
        <Descriptions.Item label="Cơ sở">{d.donVi.coSo.ten}</Descriptions.Item>
        <Descriptions.Item label="Chức vụ">{s(d.chucVu?.ten)}</Descriptions.Item>
        <Descriptions.Item label="Chức danh nghề nghiệp">{s(d.chucDanhNgheNghiep)}</Descriptions.Item>
        <Descriptions.Item label="Ngày tuyển dụng">{s(fmtNgay(d.ngayTuyenDung as string))}</Descriptions.Item>
        <Descriptions.Item label="Ngày vào trường">{s(fmtNgay(d.ngayVaoTruong as string))}</Descriptions.Item>
      </Descriptions>

      <Descriptions title="Trình độ" column={col} size="small" bordered>
        <Descriptions.Item label="Chuyên môn">{s(d.trinhDoChuyenMon ? NHAN_TRINH_DO[d.trinhDoChuyenMon] : null)}</Descriptions.Item>
        <Descriptions.Item label="Chuyên ngành">{s(d.chuyenNganh)}</Descriptions.Item>
        <Descriptions.Item label="Học hàm / Danh hiệu">{s([d.hocHam, d.danhHieu].filter(Boolean).join(', '))}</Descriptions.Item>
        <Descriptions.Item label="Lý luận chính trị">{s(d.lyLuanChinhTri)}</Descriptions.Item>
        <Descriptions.Item label="Ngoại ngữ">{s(d.ngoaiNgu)}</Descriptions.Item>
        <Descriptions.Item label="Tin học">{s(d.tinHoc)}</Descriptions.Item>
        <Descriptions.Item label="Nghiệp vụ sư phạm">{s(d.nghiepVuSuPham)}</Descriptions.Item>
        <Descriptions.Item label="Kỹ năng nghề" span={2}>
          {s(d.kyNangNghe)}
        </Descriptions.Item>
      </Descriptions>

      <Descriptions title="Đảng viên · Tài chính – Bảo hiểm" column={col} size="small" bordered>
        <Descriptions.Item label="Ngày vào Đảng">{s(fmtNgay(d.ngayVaoDang as string))}</Descriptions.Item>
        <Descriptions.Item label="Ngày chính thức">{s(fmtNgay(d.ngayChinhThucDang as string))}</Descriptions.Item>
        <Descriptions.Item label="Mã số thuế">{s(d.maSoThue)}</Descriptions.Item>
        <Descriptions.Item label="Số sổ BHXH">{s(d.soBhxh)}</Descriptions.Item>
        <Descriptions.Item label="Số tài khoản">{s(d.soTaiKhoan)}</Descriptions.Item>
        <Descriptions.Item label="Ngân hàng">{s(d.nganHang)}</Descriptions.Item>
        {d.ghiChu ? (
          <Descriptions.Item label="Ghi chú" span={3}>
            {String(d.ghiChu)}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </Space>
  );
}
