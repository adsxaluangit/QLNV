import { useState } from 'react';
import { Alert, App, Button, Modal, Space, Statistic, Table, Upload, Row, Col } from 'antd';
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { api, taiFile } from '../api';

interface KetQua {
  tong: number;
  taoMoi: number;
  capNhat: number;
  loi: { dong: number; maCanBo: string; loi: string }[];
  kiemTra: boolean;
}

/** Nhập Excel 2 bước: Kiểm tra (không ghi) → Nhập thật. */
export default function NhapExcel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [file, setFile] = useState<UploadFile & { raw?: File }>();
  const [kq, setKq] = useState<KetQua>();
  const [dangGui, setDangGui] = useState(false);

  const dong = () => {
    setFile(undefined);
    setKq(undefined);
    onClose();
  };

  const gui = async (kiemTra: boolean) => {
    if (!file?.raw) return;
    const fd = new FormData();
    fd.append('file', file.raw);
    setDangGui(true);
    try {
      const r = await api<KetQua>('/nhan-su/nhap-excel', { method: 'POST', body: fd, query: { kiemTra: kiemTra ? 1 : undefined } });
      setKq(r);
      if (!kiemTra) {
        message.success(`Đã thêm ${r.taoMoi}, cập nhật ${r.capNhat} hồ sơ`);
        qc.invalidateQueries({ queryKey: ['nhan-su'] });
        qc.invalidateQueries({ queryKey: ['tong-quan'] });
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDangGui(false);
    }
  };

  const daNhap = kq && !kq.kiemTra;

  return (
    <Modal
      title="Nhập hồ sơ từ Excel"
      open={open}
      onCancel={dong}
      width={760}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={dong}>{daNhap ? 'Đóng' : 'Hủy'}</Button>
          {!daNhap && (
            <Button onClick={() => gui(true)} disabled={!file} loading={dangGui && !kq}>
              1. Kiểm tra dữ liệu
            </Button>
          )}
          {!daNhap && (
            <Button
              type="primary"
              id="nut-nhap-that"
              disabled={!kq || kq.taoMoi + kq.capNhat === 0}
              loading={dangGui && !!kq}
              onClick={() => gui(false)}
            >
              2. Nhập {kq ? kq.taoMoi + kq.capNhat : ''} dòng hợp lệ
            </Button>
          )}
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dùng đúng file mẫu. Mã cán bộ = số CCCD; cán bộ đã có sẽ được cập nhật các ô có dữ liệu."
        action={
          <Button size="small" icon={<DownloadOutlined />} onClick={() => taiFile('/nhan-su/mau-nhap')}>
            Tải file mẫu
          </Button>
        }
      />
      <Upload.Dragger
        accept=".xlsx"
        maxCount={1}
        fileList={file ? [file] : []}
        beforeUpload={(f) => {
          setFile({ uid: f.uid, name: f.name, raw: f });
          setKq(undefined);
          return false;
        }}
        onRemove={() => {
          setFile(undefined);
          setKq(undefined);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file .xlsx</p>
      </Upload.Dragger>

      {kq && (
        <div style={{ marginTop: 20 }}>
          {daNhap && <Alert type="success" showIcon message="Đã nhập xong" style={{ marginBottom: 12 }} />}
          <Row gutter={16}>
            <Col span={6}><Statistic title="Tổng số dòng" value={kq.tong} /></Col>
            <Col span={6}><Statistic title="Thêm mới" value={kq.taoMoi} valueStyle={{ color: '#16a34a' }} /></Col>
            <Col span={6}><Statistic title="Cập nhật" value={kq.capNhat} valueStyle={{ color: '#0e7c86' }} /></Col>
            <Col span={6}><Statistic title="Lỗi" value={kq.loi.length} valueStyle={{ color: kq.loi.length ? '#dc2626' : undefined }} /></Col>
          </Row>
          {kq.loi.length > 0 && (
            <Table
              style={{ marginTop: 16 }}
              size="small"
              rowKey="dong"
              dataSource={kq.loi}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              columns={[
                { title: 'Dòng', dataIndex: 'dong', width: 70 },
                { title: 'Mã cán bộ', dataIndex: 'maCanBo', width: 140, render: (v) => <span className="ma-cccd">{v}</span> },
                { title: 'Lỗi', dataIndex: 'loi' },
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
