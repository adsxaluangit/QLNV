import { useRef, useState, useEffect } from 'react';
import { App, Button, Modal, Popconfirm, Slider, Space, Tooltip, Upload } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  EyeOutlined,
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { chuCaiDau } from '../constants';

export interface Anh3x4Props {
  nhanSuId: string;
  hoTen: string;
  gioiTinh?: 'NAM' | 'NU' | null;
  anhDaiDien?: string | null;
  coQuyenSua?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onUpdated?: (anhMoi: string | null) => void;
  hienHanhDong?: boolean;
}

const KICH_THUOC = {
  sm: { width: 36, height: 48, fontSize: 13, radius: 4 },
  md: { width: 75, height: 100, fontSize: 22, radius: 6 },
  lg: { width: 114, height: 152, fontSize: 32, radius: 8 },
};

export default function Anh3x4({
  nhanSuId,
  hoTen,
  gioiTinh,
  anhDaiDien,
  coQuyenSua = false,
  size = 'lg',
  onUpdated,
  hienHanhDong = true,
}: Anh3x4Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [moModal, setMoModal] = useState(false);
  const [moXemLon, setMoXemLon] = useState(false);
  const [dangXoa, setDangXoa] = useState(false);
  const [anhLoi, setAnhLoi] = useState(false);

  // URL hiển thị: ưu tiên `anhDaiDien` truyền vào, fallback endpoint `/api/nhan-su/${nhanSuId}/anh`
  const nguonAnh = anhDaiDien || (nhanSuId && !anhLoi ? `/api/nhan-su/${nhanSuId}/anh` : null);

  useEffect(() => {
    setAnhLoi(false);
  }, [anhDaiDien, nhanSuId]);

  const xoaAnh = async () => {
    setDangXoa(true);
    try {
      await api(`/nhan-su/${nhanSuId}/anh`, { method: 'DELETE' });
      message.success('Đã xóa ảnh 3x4');
      qc.invalidateQueries({ queryKey: ['nhan-su'] });
      qc.invalidateQueries({ queryKey: ['nhan-su', nhanSuId] });
      onUpdated?.(null);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDangXoa(false);
    }
  };

  const kt = KICH_THUOC[size];
  const mauNen = gioiTinh === 'NU' ? 'linear-gradient(145deg, #fbcfe8, #f472b6)' : 'linear-gradient(145deg, #0284c7, #0369a1)';

  return (
    <div className={`khung-anh-3x4-wrap size-${size}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Khung ảnh 3x4 */}
      <div
        className="khung-anh-3x4"
        style={{
          width: kt.width,
          height: kt.height,
          borderRadius: kt.radius,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          border: '2px solid rgba(255,255,255,0.85)',
          background: mauNen,
          cursor: coQuyenSua ? 'pointer' : 'default',
          flex: 'none',
        }}
        onClick={() => {
          if (coQuyenSua) setMoModal(true);
          else if (nguonAnh && !anhLoi) setMoXemLon(true);
        }}
      >
        {nguonAnh && !anhLoi ? (
          <img
            src={nguonAnh}
            alt={hoTen}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setAnhLoi(true)}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: kt.fontSize, fontWeight: 700, lineHeight: 1 }}>{chuCaiDau(hoTen)}</span>
            {size === 'lg' && (
              <span
                style={{
                  fontSize: 10,
                  marginTop: 6,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.25)',
                  letterSpacing: '1px',
                  fontWeight: 600,
                }}
              >
                ẢNH 3x4
              </span>
            )}
          </div>
        )}

        {/* Lớp phủ khi rê chuột */}
        {coQuyenSua && (
          <div
            className="lop-phu-anh"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              backdropFilter: 'blur(2px)',
            }}
          >
            <CameraOutlined style={{ fontSize: size === 'lg' ? 22 : 16 }} />
            {size === 'lg' && <span style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>Đổi ảnh 3x4</span>}
          </div>
        )}
      </div>

      {/* Thanh công cụ hành động bên dưới (chỉ hiện khi size lớn và có bật hienHanhDong) */}
      {hienHanhDong && size === 'lg' && (
        <Space size={4} style={{ marginTop: 8 }}>
          {coQuyenSua && (
            <Tooltip title="Tải ảnh 3x4 mới">
              <Button
                size="small"
                icon={<CameraOutlined />}
                onClick={() => setMoModal(true)}
                style={{ fontSize: 12 }}
              >
                {nguonAnh && !anhLoi ? 'Đổi ảnh' : 'Tải ảnh 3x4'}
              </Button>
            </Tooltip>
          )}

          {nguonAnh && !anhLoi && (
            <>
              <Tooltip title="Xem ảnh lớn">
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => setMoXemLon(true)}
                />
              </Tooltip>

              {coQuyenSua && (
                <Popconfirm
                  title="Xóa ảnh 3x4 của cán bộ này?"
                  description="Ảnh đại diện sẽ trở về mặc định"
                  onConfirm={xoaAnh}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: dangXoa }}
                >
                  <Tooltip title="Xóa ảnh">
                    <Button size="small" danger icon={<DeleteOutlined />} loading={dangXoa} />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      )}

      {/* Modal Tải và Cắt ảnh 3x4 */}
      <ModalTaiAnh3x4
        open={moModal}
        nhanSuId={nhanSuId}
        hoTen={hoTen}
        onClose={() => setMoModal(false)}
        onThanhCong={(anhBase64) => {
          setAnhLoi(false);
          setMoModal(false);
          onUpdated?.(anhBase64);
        }}
      />

      {/* Modal Xem ảnh lớn */}
      <Modal
        open={moXemLon}
        onCancel={() => setMoXemLon(false)}
        footer={null}
        width={360}
        centered
        title={`Ảnh chân dung 3x4 — ${hoTen}`}
      >
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          {nguonAnh && !anhLoi && (
            <img
              src={nguonAnh}
              alt={hoTen}
              style={{
                width: 240,
                height: 320,
                objectFit: 'cover',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
              }}
            />
          )}
        </div>
      </Modal>

      <style>{`
        .khung-anh-3x4:hover .lop-phu-anh {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

// ================================================================ Modal Tải ảnh 3x4
interface ModalTaiAnhProps {
  open: boolean;
  nhanSuId: string;
  hoTen: string;
  onClose: () => void;
  onThanhCong: (anhBase64: string) => void;
}

export function ModalTaiAnh3x4({ open, nhanSuId, hoTen, onClose, onThanhCong }: ModalTaiAnhProps) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [anhSrc, setAnhSrc] = useState<string | null>(null);
  const [thuPhong, setThuPhong] = useState<number>(1);
  const [dichX, setDichX] = useState<number>(0);
  const [dichY, setDichY] = useState<number>(0);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangKeo, setDangKeo] = useState(false);
  const diemBatDauRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dichBatDauRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Kích thước khung xem trước (tỷ lệ 3:4)
  const KHUNG_W = 240;
  const KHUNG_H = 320;

  useEffect(() => {
    if (!open) {
      setAnhSrc(null);
      setThuPhong(1);
      setDichX(0);
      setDichY(0);
    }
  }, [open]);

  // Đọc file ảnh sang Data URL để xem trước
  const khiChonFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn định dạng ảnh (JPG, PNG, WEBP)');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Dung lượng ảnh không được vượt quá 5MB');
      return false;
    }
    const doc = new FileReader();
    doc.onload = (e) => {
      setAnhSrc(e.target?.result as string);
      setThuPhong(1);
      setDichX(0);
      setDichY(0);
    };
    doc.readAsDataURL(file);
    return false; // Chặn upload tự động của antd
  };

  // Kéo thả di chuyển ảnh để căn chỉnh
  const batDauKeo = (e: React.MouseEvent) => {
    e.preventDefault();
    setDangKeo(true);
    diemBatDauRef.current = { x: e.clientX, y: e.clientY };
    dichBatDauRef.current = { x: dichX, y: dichY };
  };

  const dangKeoChuot = (e: React.MouseEvent) => {
    if (!dangKeo) return;
    const dx = e.clientX - diemBatDauRef.current.x;
    const dy = e.clientY - diemBatDauRef.current.y;
    setDichX(dichBatDauRef.current.x + dx);
    setDichY(dichBatDauRef.current.y + dy);
  };

  const ketThucKeo = () => {
    setDangKeo(false);
  };

  // Render ảnh đã căn chỉnh ra Canvas chuẩn 3x4 (450 x 600 px) và tải lên API
  const luuAnh = async () => {
    if (!anhSrc) return;
    setDangLuu(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = anhSrc;
      });

      // Canvas kích thước 450x600 (chuẩn nét 3:4)
      const OUT_W = 450;
      const OUT_H = 600;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không khởi tạo được bộ xử lý ảnh');

      // Nền trắng mặc định
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUT_W, OUT_H);

      // Tính tỷ lệ hiển thị trên khung xem trước
      const scaleToFrame = Math.max(KHUNG_W / img.naturalWidth, KHUNG_H / img.naturalHeight);
      const renderW = img.naturalWidth * scaleToFrame * thuPhong;
      const renderH = img.naturalHeight * scaleToFrame * thuPhong;
      const renderX = (KHUNG_W - renderW) / 2 + dichX;
      const renderY = (KHUNG_H - renderH) / 2 + dichY;

      // Nhân tỷ lệ từ khung xem trước lên kích thước thực tế OUT
      const tyLeOutput = OUT_W / KHUNG_W;
      ctx.drawImage(
        img,
        renderX * tyLeOutput,
        renderY * tyLeOutput,
        renderW * tyLeOutput,
        renderH * tyLeOutput,
      );

      // Xuất sang JPEG chất lượng 88% (~40KB - 70KB)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      // Gửi lên API
      await api(`/nhan-su/${nhanSuId}/anh`, {
        method: 'POST',
        body: { anh: dataUrl },
      });

      message.success('Đã cập nhật ảnh 3x4 thành công!');
      qc.invalidateQueries({ queryKey: ['nhan-su'] });
      qc.invalidateQueries({ queryKey: ['nhan-su', nhanSuId] });
      onThanhCong(dataUrl);
    } catch (e) {
      message.error((e as Error).message || 'Lỗi khi lưu ảnh');
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={560}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CameraOutlined style={{ color: '#0e7c86', fontSize: 18 }} />
          <span>Tải ảnh chân dung 3x4 — <b>{hoTen}</b></span>
        </div>
      }
      footer={
        <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {anhSrc ? (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setThuPhong(1);
                setDichX(0);
                setDichY(0);
              }}
            >
              Đặt lại vị trí
            </Button>
          ) : <div />}
          <Space>
            <Button onClick={onClose} disabled={dangLuu}>
              Hủy
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={luuAnh}
              loading={dangLuu}
              disabled={!anhSrc}
            >
              Lưu ảnh 3x4
            </Button>
          </Space>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ padding: '8px 0' }}>
        {!anhSrc ? (
          <Upload.Dragger
            accept="image/jpeg,image/png,image/webp"
            beforeUpload={khiChonFile}
            showUploadList={false}
            style={{ padding: '28px 16px', background: '#f8fafc', borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#0e7c86', fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
              Kéo thả hoặc nhấp để chọn ảnh chân dung
            </p>
            <p className="ant-upload-hint" style={{ color: '#64748b' }}>
              Hỗ trợ JPG, PNG, WEBP · Dung lượng tối đa 5MB.
              <br />
              Nên dùng ảnh thẻ chụp thẳng, phông nền xanh hoặc trắng theo chuẩn hồ sơ.
            </p>
          </Upload.Dragger>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {/* Khung cắt tỷ lệ 3:4 */}
              <div
                style={{
                  width: KHUNG_W,
                  height: KHUNG_H,
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '2px solid #0e7c86',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  background: '#f1f5f9',
                  cursor: dangKeo ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  flex: 'none',
                }}
                onMouseDown={batDauKeo}
                onMouseMove={dangKeoChuot}
                onMouseUp={ketThucKeo}
                onMouseLeave={ketThucKeo}
              >
                <img
                  src={anhSrc}
                  alt="Xem trước"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(calc(-50% + ${dichX}px), calc(-50% + ${dichY}px)) scale(${thuPhong})`,
                    transformOrigin: 'center center',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                />

                {/* Đường gióng khuôn mặt chuẩn 3x4 */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '1px dashed rgba(255,255,255,0.7)',
                    borderRadius: 6,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '15%',
                    left: '20%',
                    right: '20%',
                    bottom: '25%',
                    border: '1px dashed rgba(14, 124, 134, 0.6)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.9)',
                    background: 'rgba(15,23,42,0.6)',
                    padding: '2px 0',
                    pointerEvents: 'none',
                  }}
                >
                  Kéo chuột để di chuyển ảnh
                </div>
              </div>

              {/* Bảng điều khiển */}
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Thu phóng:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ZoomOutOutlined style={{ color: '#64748b' }} />
                    <Slider
                      min={0.8}
                      max={3}
                      step={0.05}
                      value={thuPhong}
                      onChange={setThuPhong}
                      style={{ flex: 1 }}
                    />
                    <ZoomInOutlined style={{ color: '#64748b' }} />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: '#475569',
                    marginBottom: 16,
                  }}
                >
                  <b style={{ color: '#0e7c86' }}>📌 Hướng dẫn canh chỉnh:</b>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    <li>Dùng thanh trượt để phóng to/thu nhỏ.</li>
                    <li>Giữ chuột kéo ảnh để căn khuôn mặt vào giữa vòng tròn gióng.</li>
                    <li>Đảm bảo phần đầu và vai cân đối trong khung 3x4.</li>
                  </ul>
                </div>

                <Upload
                  accept="image/jpeg,image/png,image/webp"
                  beforeUpload={khiChonFile}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>Chọn ảnh khác</Button>
                </Upload>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
