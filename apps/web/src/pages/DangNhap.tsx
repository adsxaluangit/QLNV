import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../api';
import { NguoiDung, useAuth } from '../auth';

export default function DangNhap() {
  const { dangNhap } = useAuth();
  const [loi, setLoi] = useState<string>();
  const [dangGui, setDangGui] = useState(false);

  const gui = async (v: { tenDangNhap: string; matKhau: string }) => {
    setLoi(undefined);
    setDangGui(true);
    try {
      const r = await api<{ token: string; nguoiDung: NguoiDung }>('/auth/dang-nhap', { method: 'POST', body: v });
      dangNhap(r.token, r.nguoiDung);
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDangGui(false);
    }
  };

  return (
    <main className="dang-nhap">
      <section className="hero">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.95)', padding: '8px 16px', borderRadius: 12, marginBottom: 18, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <img src="/logo.png" alt="MIC1" width={28} height={28} style={{ objectFit: 'contain' }} />
            <span style={{ color: '#0b4f5c', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Trường Cao đẳng Hàng hải và Đường thủy I
            </span>
          </div>
          <h2>Hệ thống Quản lý Nhân sự</h2>
          <p>Hồ sơ cán bộ, giảng viên, nhân viên của toàn trường — tập trung, chính xác, cập nhật theo thời gian thực.</p>
        </div>
      </section>
      <section className="ben-phai">
        <div className="the-dang-nhap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <img
              src="/logo.png"
              alt="Logo MIC1"
              width={52}
              height={52}
              style={{ objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0e7c86', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                CĐ Hàng hải &amp; Đường thủy I
              </div>
              <h1 style={{ margin: 0, fontSize: 22, color: '#0f2b35' }}>Đăng nhập</h1>
            </div>
          </div>
          <div className="phu">Cán bộ đăng nhập bằng số CCCD</div>
          {loi && <Alert type="error" showIcon message={loi} style={{ marginBottom: 16 }} />}
          <Form layout="vertical" size="large" onFinish={gui} requiredMark={false}>
            <Form.Item name="tenDangNhap" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập số CCCD hoặc tên đăng nhập' }]}>
              <Input id="ten-dang-nhap" prefix={<UserOutlined />} placeholder="Số CCCD (12 số)" autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="matKhau" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password id="mat-khau" prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
            </Form.Item>
            <Button id="nut-dang-nhap" type="primary" htmlType="submit" block loading={dangGui} style={{ height: 46, marginTop: 4 }}>
              Đăng nhập
            </Button>
          </Form>
          <div style={{ marginTop: 18, fontSize: 12.5, color: '#94a3b8', textAlign: 'center' }}>
            Quên mật khẩu? Liên hệ Phòng Tổ chức – Hành chính để được cấp lại.
          </div>
        </div>
      </section>
    </main>
  );
}
