import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App as AntApp, Button, Card, DatePicker, InputNumber, Popconfirm, Select, Space, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, LockOutlined, ThunderboltOutlined, UnlockOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api, ApiError, taiFile } from '../api';
import { useAuth } from '../auth';

interface Tong {
  luongThoiGian: number;
  congTacHocTap: number;
  nghiKhac: number;
  nghiBhxh: number;
  nghiKhongLuong: number;
  huongLuong: number;
}
interface Dong {
  nhanSuId: string;
  hoTen: string;
  chucVu: string;
  chucVuDayDu: string | null;
  cong: Record<string, string>;
  goiY: Record<string, string>;
  luongKhoan: number | null;
  theoQuyetDinh: number | null;
  tong: Tong;
}
interface Bang {
  donVi: { id: string; ten: string };
  nam: number;
  thang: number;
  soNgay: number;
  congChuan: number;
  ngayLe: number[];
  daChot: boolean;
  nguoiChot: string | null;
  coQuyenCham: boolean;
  coQuyenMoChot: boolean;
  kyHieu: { ma: string; ten: string }[];
  rows: Dong[];
}
interface DsDonVi {
  macDinh: string | null;
  coQuyenCham: boolean;
  items: { id: string; ten: string; soNguoi: number }[];
}

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LOP_KY_HIEU = (k: string) => {
  const g = k.replace('/2', '');
  if (g === 'L') return 'cc-k-le';
  if (['Ô', 'Cô', 'T', 'Ts'].includes(g)) return 'cc-k-bhxh';
  if (g === 'No') return 'cc-k-no';
  if (g === '+') return '';
  return 'cc-k-nghi';
};
/** Phím tắt: gõ ký hiệu để chấm các ô đang chọn. */
const PHIM_TAT: Record<string, string> = { '+': '+', '=': '+', p: 'P', c: 'CT', h: 'H', l: 'L', o: 'Ô', s: 'Ts', n: 'No', b: 'Nb', v: 'Vr', k: 'K', t: 'T' };
const so = (v: number) => (v ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '');

export default function ChamCong() {
  const { message } = AntApp.useApp();
  const { nguoiDung } = useAuth();
  const qc = useQueryClient();
  const [donViId, setDonViId] = useState<string>();
  const [thang, setThang] = useState<Dayjs>(dayjs().startOf('month'));
  const [chon, setChon] = useState<Set<string>>(new Set()); // "nhanSuId|ngay"
  const [neo, setNeo] = useState<string | null>(null);

  const dsDv = useQuery({ queryKey: ['cc-don-vi'], queryFn: () => api<DsDonVi>('/cham-cong/don-vi') });
  useEffect(() => {
    if (!donViId && dsDv.data?.macDinh) setDonViId(dsDv.data.macDinh);
  }, [dsDv.data, donViId]);

  const nam = thang.year();
  const th = thang.month() + 1;
  const keyBang = ['cc-bang', donViId, nam, th];
  const bang = useQuery({
    queryKey: keyBang,
    enabled: !!donViId,
    queryFn: () => api<Bang>('/cham-cong/bang', { query: { donViId, nam, thang: th } }),
  });
  const b = bang.data;
  const sua = !!b && b.coQuyenCham && (!b.daChot || b.coQuyenMoChot);

  const lamMoi = () => qc.invalidateQueries({ queryKey: ['cc-bang'] });
  const loi = (e: ApiError) => {
    message.error(e.message);
    lamMoi();
  };

  const luu = useMutation({
    mutationFn: (cells: { nhanSuId: string; ngay: number; kyHieu: string | null }[]) =>
      api('/cham-cong/bang', { method: 'PUT', body: { donViId, nam, thang: th, cells } }),
    onSuccess: lamMoi,
    onError: loi,
  });
  const dien = useMutation({
    mutationFn: (ghiDe: boolean) => api<{ soO: number }>('/cham-cong/dien-mac-dinh', { method: 'POST', body: { donViId, nam, thang: th, ghiDe } }),
    onSuccess: (r) => {
      message.success(`Đã điền sẵn ${r.soO} ô`);
      lamMoi();
    },
    onError: loi,
  });
  const chot = useMutation({
    mutationFn: (v: boolean) => api('/cham-cong/chot', { method: 'POST', body: { donViId, nam, thang: th, chot: v } }),
    onSuccess: (_, v) => {
      message.success(v ? 'Đã chốt bảng chấm công' : 'Đã mở lại bảng chấm công');
      lamMoi();
    },
    onError: loi,
  });
  const luuThang = useMutation({
    mutationFn: (v: { nhanSuId: string; luongKhoan: number | null; theoQuyetDinh: number | null }) =>
      api('/cham-cong/thang', { method: 'PATCH', body: { ...v, nam, thang: th } }),
    onSuccess: lamMoi,
    onError: loi,
  });

  const ap = useCallback(
    (kyHieu: string | null) => {
      if (!b || !sua || !chon.size) return;
      const cells = [...chon].map((k) => {
        const [nhanSuId, ngay] = k.split('|');
        return { nhanSuId, ngay: Number(ngay), kyHieu };
      });
      // Cập nhật tạm thời để giao diện phản hồi ngay
      qc.setQueryData<Bang>(keyBang, (cu) =>
        cu
          ? {
              ...cu,
              rows: cu.rows.map((r) => {
                const cong = { ...r.cong };
                for (const c of cells) if (c.nhanSuId === r.nhanSuId) (c.kyHieu ? (cong[c.ngay] = c.kyHieu) : delete cong[c.ngay]);
                return { ...r, cong };
              }),
            }
          : cu,
      );
      luu.mutate(cells);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b, sua, chon],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sua || !chon.size) return;
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,.ant-select,.ant-picker')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        ap(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = PHIM_TAT[e.key.toLowerCase()];
      if (k) {
        e.preventDefault();
        ap(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sua, chon, ap]);

  const ngayLe = useMemo(() => new Set(b?.ngayLe ?? []), [b]);
  const cuoiTuan = (d: number) => [0, 6].includes(new Date(Date.UTC(nam, th - 1, d)).getUTCDay());
  const dsNgay = useMemo(() => Array.from({ length: b?.soNgay ?? 0 }, (_, i) => i + 1), [b]);

  const bamO = (e: React.MouseEvent, nhanSuId: string, ngay: number, iRow: number) => {
    if (!sua) return;
    const key = `${nhanSuId}|${ngay}`;
    if (e.shiftKey && neo && b) {
      const [nid, nng] = neo.split('|');
      const r1 = b.rows.findIndex((r) => r.nhanSuId === nid);
      const [ra, rb] = [Math.min(r1, iRow), Math.max(r1, iRow)];
      const [na, nb] = [Math.min(Number(nng), ngay), Math.max(Number(nng), ngay)];
      const s = new Set(e.ctrlKey || e.metaKey ? chon : []);
      for (let r = ra; r <= rb; r++) for (let d = na; d <= nb; d++) s.add(`${b.rows[r].nhanSuId}|${d}`);
      setChon(s);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const s = new Set(chon);
      s.has(key) ? s.delete(key) : s.add(key);
      setChon(s);
    } else setChon(new Set([key]));
    setNeo(key);
  };

  const chonHang = (nhanSuId: string) => {
    if (!sua) return;
    setChon(new Set(dsNgay.filter((d) => !cuoiTuan(d)).map((d) => `${nhanSuId}|${d}`)));
  };
  const chonCot = (ngay: number) => {
    if (!sua || !b) return;
    setChon(new Set(b.rows.map((r) => `${r.nhanSuId}|${ngay}`)));
  };

  const tongCot = b?.rows.reduce((a, r) => ({
    tg: a.tg + r.tong.luongThoiGian,
    ct: a.ct + r.tong.congTacHocTap,
    nk: a.nk + r.tong.nghiKhac,
    no: a.no + r.tong.nghiKhongLuong,
    bh: a.bh + r.tong.nghiBhxh,
    hl: a.hl + r.tong.huongLuong,
  }), { tg: 0, ct: 0, nk: 0, no: 0, bh: 0, hl: 0 });
  const laQuanLy = nguoiDung && ['QUAN_TRI', 'TCHC', 'KE_TOAN', 'BAN_GIAM_HIEU'].includes(nguoiDung.vaiTro);

  return (
    <Card className="card-mem">
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: 300 }}
          placeholder="Chọn đơn vị"
          value={donViId}
          onChange={(v) => {
            setDonViId(v);
            setChon(new Set());
          }}
          loading={dsDv.isLoading}
          options={(dsDv.data?.items ?? []).map((d) => ({ value: d.id, label: `${d.ten} (${d.soNguoi})` }))}
        />
        <DatePicker
          picker="month"
          allowClear={false}
          format="[Tháng] MM/YYYY"
          value={thang}
          onChange={(v) => {
            if (v) {
              setThang(v.startOf('month'));
              setChon(new Set());
            }
          }}
        />
        {b && (b.daChot ? <Tag color="red" icon={<LockOutlined />}>Đã chốt{b.nguoiChot ? ` bởi ${b.nguoiChot}` : ''}</Tag> : <Tag color="processing">Đang chấm công</Tag>)}
      </Space>
      <Space wrap style={{ marginBottom: 12, float: 'right' }}>
        {b?.coQuyenCham && !b.daChot && (
          <Popconfirm
            title="Điền sẵn bảng chấm công?"
            description='Đặt "+" cho các ngày làm việc đã qua, "L" cho ngày lễ và ký hiệu nghỉ từ đơn đã duyệt. Ô đã chấm được giữ nguyên.'
            okText="Điền sẵn"
            cancelText="Hủy"
            onConfirm={() => dien.mutate(false)}
          >
            <Button icon={<ThunderboltOutlined />} loading={dien.isPending} id="cc-dien-san">Điền sẵn</Button>
          </Popconfirm>
        )}
        {b?.coQuyenCham && !b.daChot && (
          <Popconfirm title="Chốt bảng chấm công tháng này?" description="Sau khi chốt, chỉ Phòng TCHC mới sửa hoặc mở lại được." okText="Chốt" cancelText="Hủy" onConfirm={() => chot.mutate(true)}>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={chot.isPending} id="cc-chot">Chốt tháng</Button>
          </Popconfirm>
        )}
        {b?.daChot && b.coQuyenMoChot && (
          <Button icon={<UnlockOutlined />} loading={chot.isPending} onClick={() => chot.mutate(false)}>Mở lại</Button>
        )}
        <Button icon={<DownloadOutlined />} disabled={!donViId} id="cc-xuat" onClick={() => taiFile('/cham-cong/xuat-excel', { query: { donViId, nam, thang: th } }).catch((e: ApiError) => message.error(e.message))}>
          Xuất Excel
        </Button>
        {laQuanLy && (
          <Button icon={<DownloadOutlined />} onClick={() => taiFile('/cham-cong/xuat-tong-hop', { query: { nam, thang: th } }).catch((e: ApiError) => message.error(e.message))}>
            Tổng hợp tính lương
          </Button>
        )}
      </Space>
      <div style={{ clear: 'both' }} />

      {b && !b.coQuyenCham && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Bạn chỉ có quyền xem bảng chấm công." />}
      {b?.daChot && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Bảng chấm công đã chốt. Liên hệ Phòng TCHC nếu cần chỉnh sửa." />}

      {sua && (
        <div className="cc-palette">
          <b style={{ marginRight: 4 }}>{chon.size ? `Đã chọn ${chon.size} ô:` : 'Bấm vào ô (Shift: chọn vùng, Ctrl: chọn thêm) rồi chọn ký hiệu:'}</b>
          {b?.kyHieu.map((k) => (
            <Tooltip key={k.ma} title={k.ten}>
              <Button size="small" disabled={!chon.size} onClick={() => ap(k.ma)}>{k.ma}</Button>
            </Tooltip>
          ))}
          <Tooltip title="Nghỉ nửa ngày: giữ ô, chọn ký hiệu rồi thêm /2 qua nút bên cạnh">
            <Button size="small" disabled={!chon.size} onClick={() => ap('P/2')}>P/2</Button>
          </Tooltip>
          <Button size="small" danger disabled={!chon.size} onClick={() => ap(null)}>Xóa ô</Button>
          <span style={{ color: '#64748b', fontSize: 12 }}>Phím tắt: + P C(CT) H L O(Ô) S(Ts) N(No) B(Nb) · Delete = xóa</span>
        </div>
      )}

      <div className="cc-wrap">
        <table className="cc-table">
          <thead>
            <tr>
              <th className="cc-sticky" style={{ left: 0, minWidth: 36 }}>TT</th>
              <th className="cc-sticky" style={{ left: 36, minWidth: 190 }}>Họ và tên</th>
              <th className="cc-sticky" style={{ left: 226, minWidth: 54 }}>Chức vụ</th>
              {dsNgay.map((d) => (
                <th key={d} className={`cc-th-ngay ${cuoiTuan(d) ? 'cc-cuoituan' : ''} ${ngayLe.has(d) ? 'cc-le' : ''}`} style={{ cursor: sua ? 'pointer' : undefined }} onClick={() => chonCot(d)}>
                  {d}
                  <small>{THU[new Date(Date.UTC(nam, th - 1, d)).getUTCDay()]}</small>
                </th>
              ))}
              <th className="cc-tong">Lương thời gian</th>
              <th className="cc-tong">C.tác, H.tập</th>
              <th className="cc-tong">Nghỉ khác</th>
              <th className="cc-tong">Nghỉ No</th>
              <th className="cc-tong">Nghỉ BHXH</th>
              <th className="cc-tong">Hưởng lương</th>
              <th className="cc-tong" style={{ minWidth: 110 }}>Lương khoán</th>
              <th className="cc-tong" style={{ minWidth: 90 }}>Theo QĐ</th>
            </tr>
          </thead>
          <tbody>
            {b?.rows.map((r, i) => (
              <tr key={r.nhanSuId}>
                <td className="cc-sticky" style={{ left: 0, textAlign: 'center' }}>{i + 1}</td>
                <td className="cc-sticky" style={{ left: 36, fontWeight: 500, cursor: sua ? 'pointer' : undefined }} title={r.chucVuDayDu ?? ''} onClick={() => chonHang(r.nhanSuId)}>
                  {r.hoTen}
                </td>
                <td className="cc-sticky" style={{ left: 226, textAlign: 'center' }}>{r.chucVu}</td>
                {dsNgay.map((d) => {
                  const k = r.cong[d];
                  const gy = !k ? r.goiY[d] : undefined;
                  const hien = k ?? gy ?? '';
                  return (
                    <td
                      key={d}
                      className={`cc-o ${cuoiTuan(d) ? 'cc-cuoituan' : ''} ${ngayLe.has(d) ? 'cc-le' : ''} ${chon.has(`${r.nhanSuId}|${d}`) ? 'cc-chon' : ''} ${gy ? 'cc-goiy' : LOP_KY_HIEU(hien)}`}
                      title={gy ? 'Gợi ý từ đơn nghỉ đã duyệt (bấm "Điền sẵn" để ghi nhận)' : undefined}
                      onMouseDown={(e) => bamO(e, r.nhanSuId, d, i)}
                    >
                      {hien}
                    </td>
                  );
                })}
                <td className="cc-tong">{so(r.tong.luongThoiGian)}</td>
                <td className="cc-tong">{so(r.tong.congTacHocTap)}</td>
                <td className="cc-tong">{so(r.tong.nghiKhac)}</td>
                <td className="cc-tong">{so(r.tong.nghiKhongLuong)}</td>
                <td className="cc-tong">{so(r.tong.nghiBhxh)}</td>
                <td className="cc-tong" style={{ color: '#0f766e' }}>{so(r.tong.huongLuong)}</td>
                <td className="cc-tong">
                  <InputNumber
                    size="small"
                    controls={false}
                    min={0}
                    disabled={!sua}
                    style={{ width: 100 }}
                    key={`${r.nhanSuId}-k-${r.luongKhoan}`}
                    defaultValue={r.luongKhoan ?? undefined}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value.replace(/\./g, '')) : null;
                      if (v !== r.luongKhoan) luuThang.mutate({ nhanSuId: r.nhanSuId, luongKhoan: v, theoQuyetDinh: r.theoQuyetDinh });
                    }}
                  />
                </td>
                <td className="cc-tong">
                  <InputNumber
                    size="small"
                    controls={false}
                    min={0}
                    step={0.5}
                    disabled={!sua}
                    style={{ width: 80 }}
                    key={`${r.nhanSuId}-q-${r.theoQuyetDinh}`}
                    defaultValue={r.theoQuyetDinh ?? undefined}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== r.theoQuyetDinh) luuThang.mutate({ nhanSuId: r.nhanSuId, luongKhoan: r.luongKhoan, theoQuyetDinh: v });
                    }}
                  />
                </td>
              </tr>
            ))}
            {b && tongCot && (
              <tr style={{ fontWeight: 700 }}>
                <td className="cc-sticky" style={{ left: 0 }} />
                <td className="cc-sticky" style={{ left: 36 }}>Tổng</td>
                <td className="cc-sticky" style={{ left: 226 }} />
                {dsNgay.map((d) => <td key={d} />)}
                <td className="cc-tong">{so(tongCot.tg)}</td>
                <td className="cc-tong">{so(tongCot.ct)}</td>
                <td className="cc-tong">{so(tongCot.nk)}</td>
                <td className="cc-tong">{so(tongCot.no)}</td>
                <td className="cc-tong">{so(tongCot.bh)}</td>
                <td className="cc-tong">{so(tongCot.hl)}</td>
                <td /><td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {b && (
        <div style={{ marginTop: 12, color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>
          Số công chuẩn tháng {th}/{nam}: <b>{b.congChuan}</b> ngày (T2–T6). Ký hiệu:{' '}
          {b.kyHieu.map((k) => (
            <span key={k.ma} style={{ marginRight: 12 }}><b>{k.ma}</b> {k.ten}</span>
          ))}
          · hậu tố <b>/2</b> = nghỉ nửa ngày.
        </div>
      )}
    </Card>
  );
}
