import { Alert, Card, Col, Descriptions, Divider, Row, Statistic, Tag, Typography } from 'antd';
import { RiseOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { fmtHeSo, fmtNgay, NHAN_LOAI_PHU_CAP, tuyChon } from '../constants';
import BangHoSoCon from './BangHoSoCon';

export interface NgachLuong {
  id: string;
  ma: string;
  ten: string;
  nhom: string;
  heSo: number[];
  thangNangBac: number;
  thuTu: number;
  _count?: { quaTrinhLuongs: number };
}

interface UocTinh {
  uocTinh: {
    luongCoSo: number;
    heSo: number;
    vuotKhung: number;
    heSoPhuCapChucVu: number;
    heSoPhuCapKhac: number;
    phanTramUuDai: number;
    phanTramThamNien: number;
    tongThuNhap: number;
  } | null;
  thieuLuongCoSo: boolean;
  nangLuongKeTiep: {
    loai: 'NANG_BAC' | 'VUOT_KHUNG';
    ngayDenHan: string;
    bacMoi: number;
    heSoMoi: number;
    vuotKhungMoi: number;
    soThangKeoDai?: number;
    lyDoKeoDai?: string;
    mocNangBac?: string;
    mocNangBacGoc?: string;
  } | null;
}

export function useNgachLuong() {
  return useQuery({ queryKey: ['ngach-luong'], queryFn: () => api<NgachLuong[]>('/ngach-luong'), staleTime: 5 * 60_000 });
}

/** Tab "Lương & phụ cấp" trong hồ sơ cán bộ. */
export default function TabLuong({ nhanSuId, coQuyenSua }: { nhanSuId: string; coQuyenSua: boolean }) {
  const qc = useQueryClient();
  const { data: ngachs = [] } = useNgachLuong();
  const { data: ut } = useQuery({
    queryKey: ['uoc-tinh', nhanSuId],
    queryFn: () => api<UocTinh>(`/luong/uoc-tinh/${nhanSuId}`),
  });
  const lamMoi = () => qc.invalidateQueries({ queryKey: ['uoc-tinh', nhanSuId] });
  const theoId = new Map(ngachs.map((n) => [n.id, n]));
  const u = ut?.uocTinh;

  return (
    <>
      {ut?.thieuLuongCoSo && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Chưa khai báo mức lương cơ sở — vào Danh mục lương để thêm." />
      )}
      {u ? (
        <Card className="the-luong" style={{ marginBottom: 20 }}>
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={8}>
              <Statistic
                title="Ước tính thu nhập theo lương & phụ cấp (tháng)"
                value={u.tongThuNhap}
                suffix="đ"
                groupSeparator="."
                valueStyle={{ color: '#0e7c86', fontWeight: 700 }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Trước khấu trừ BHXH, BHYT, BHTN, thuế TNCN; chưa gồm thu nhập tăng thêm.
              </Typography.Text>
            </Col>
            <Col xs={24} md={16}>
              <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                <Descriptions.Item label="Lương cơ sở">{u.luongCoSo.toLocaleString('vi-VN')} đ</Descriptions.Item>
                <Descriptions.Item label="Hệ số lương">{fmtHeSo(u.heSo)}</Descriptions.Item>
                <Descriptions.Item label="Vượt khung">{u.vuotKhung ? `${u.vuotKhung}%` : '—'}</Descriptions.Item>
                <Descriptions.Item label="PC chức vụ">{u.heSoPhuCapChucVu ? fmtHeSo(u.heSoPhuCapChucVu) : '—'}</Descriptions.Item>
                <Descriptions.Item label="PC trách nhiệm, khác">{u.heSoPhuCapKhac ? fmtHeSo(u.heSoPhuCapKhac) : '—'}</Descriptions.Item>
                <Descriptions.Item label="Ưu đãi / Thâm niên">
                  {u.phanTramUuDai || 0}% / {u.phanTramThamNien || 0}%
                </Descriptions.Item>
              </Descriptions>
              {ut?.nangLuongKeTiep && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Tag icon={<RiseOutlined />} color="green" style={{ padding: '4px 10px' }}>
                      {ut.nangLuongKeTiep.loai === 'NANG_BAC'
                        ? `Nâng lên bậc ${ut.nangLuongKeTiep.bacMoi} (hệ số ${fmtHeSo(ut.nangLuongKeTiep.heSoMoi)})`
                        : `Vượt khung ${ut.nangLuongKeTiep.vuotKhungMoi}%`}{' '}
                      từ {fmtNgay(ut.nangLuongKeTiep.ngayDenHan)}
                    </Tag>
                    {ut.nangLuongKeTiep.soThangKeoDai && ut.nangLuongKeTiep.soThangKeoDai > 0 ? (
                      <Tag color="orange" style={{ padding: '4px 8px' }}>
                        Lùi ${ut.nangLuongKeTiep.soThangKeoDai} tháng (${ut.nangLuongKeTiep.lyDoKeoDai?.toLowerCase() ?? 'nghỉ không lương'})
                      </Tag>
                    ) : null}
                  </div>
                )}
            </Col>
          </Row>
        </Card>
      ) : null}

      <Divider orientation="left" orientationMargin={0}>
        Quá trình lương
      </Divider>
      <BangHoSoCon
        nhanSuId={nhanSuId}
        loai="qua-trinh-luong"
        tieuDe="Quá trình lương"
        coQuyenSua={coQuyenSua}
        onThayDoi={lamMoi}
        onDoiGiaTri={(doi, form) => {
          if ('ngachId' in doi || 'bac' in doi) {
            const n = theoId.get(form.getFieldValue('ngachId'));
            const bac = form.getFieldValue('bac') as number | null;
            if (n && bac && bac >= 1 && bac <= n.heSo.length) form.setFieldValue('heSo', n.heSo[bac - 1]);
          }
        }}
        truong={[
          { name: 'tuNgay', label: 'Ngày hưởng', kieu: 'date', batBuoc: true, span: 8, width: 120, align: 'center' },
          {
            name: 'ngachId',
            label: 'Ngạch / CDNN',
            kieu: 'select',
            span: 16,
            options: ngachs.map((n) => ({ value: n.id, label: `${n.ma} – ${n.ten} (${n.nhom})` })),
            render: (_, r) => {
              const n = r.ngach as { ma: string; ten: string } | null;
              return n ? <span title={n.ten}>{n.ma}</span> : <Tag color="blue">Lương cố định</Tag>;
            },
          },
          { name: 'bac', label: 'Bậc', kieu: 'number', span: 5, width: 70, align: 'center', render: (v, r) => (r.luongThoaThuan ? '—' : ((v ?? '—') as React.ReactNode)) },
          { name: 'heSo', label: 'Hệ số', kieu: 'heSo', span: 5, width: 90, align: 'right', goiY: 'Tự điền theo bảng (với Viên chức)', render: (v, r) => r.luongThoaThuan ? '—' : (v ? fmtHeSo(v as number) : '—') },
          {
            name: 'luongThoaThuan',
            label: 'Lương cố định / thỏa thuận',
            kieu: 'tien',
            span: 12,
            width: 150,
            align: 'right',
            goiY: 'Áp dụng cho Hợp đồng lao động',
            render: (v) => (v ? <strong style={{ color: '#0958d9' }}>{Number(v).toLocaleString('vi-VN')} đ</strong> : '—'),
          },
          {
            name: 'phanTramVuotKhung',
            label: '% vượt khung',
            kieu: 'number',
            span: 6,
            width: 100,
            align: 'right',
            render: (v, r) => (r.luongThoaThuan ? '—' : (v ? `${v}%` : '')),
          },
          {
            name: 'mocNangBac',
            label: 'Mốc nâng bậc sau',
            kieu: 'date',
            span: 8,
            width: 130,
            align: 'center',
            goiY: 'Mặc định = ngày hưởng',
            render: (v, r) => (r.luongThoaThuan ? <span style={{ color: '#8c8c8c' }}>Không áp dụng</span> : fmtNgay(v as string)),
          },
          { name: 'soQuyetDinh', label: 'Số quyết định / HĐ', span: 6, width: 130 },
          { name: 'ngayQuyetDinh', label: 'Ngày QĐ', kieu: 'date', span: 6, anTrongBang: true, align: 'center' },
          { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24 },
        ]}
      />

      <Divider orientation="left" orientationMargin={0} style={{ marginTop: 28 }}>
        Phụ cấp
      </Divider>
      <BangHoSoCon
        nhanSuId={nhanSuId}
        loai="phu-cap"
        tieuDe="Phụ cấp"
        coQuyenSua={coQuyenSua}
        onThayDoi={lamMoi}
        truong={[
          { name: 'loai', label: 'Loại phụ cấp', kieu: 'select', batBuoc: true, span: 12, options: tuyChon(NHAN_LOAI_PHU_CAP), width: 220 },
          { name: 'ten', label: 'Diễn giải', span: 12 },
          { name: 'heSo', label: 'Hệ số', kieu: 'heSo', span: 6, width: 90, align: 'right', goiY: 'Chức vụ, trách nhiệm' },
          {
            name: 'phanTram',
            label: 'Tỷ lệ %',
            kieu: 'number',
            span: 6,
            width: 90,
            align: 'right',
            goiY: 'Ưu đãi nghề',
            render: (v) => (v ? `${v}%` : ''),
          },
          { name: 'tuNgay', label: 'Từ ngày', kieu: 'date', batBuoc: true, span: 6, width: 120, align: 'center', goiY: 'Mốc bắt đầu' },
          {
            name: 'denNgay',
            label: 'Đến ngày',
            kieu: 'date',
            span: 6,
            width: 120,
            align: 'center',
            render: (v) => (v ? fmtNgay(v as string) : <Tag color="green">Đang hưởng</Tag>),
          },
          { name: 'soQuyetDinh', label: 'Số quyết định', span: 12, width: 130 },
          { name: 'ghiChu', label: 'Ghi chú', kieu: 'textarea', span: 24, anTrongBang: true },
        ]}
      />
    </>
  );
}
