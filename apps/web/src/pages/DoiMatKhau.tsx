import { Alert, App, Button, Card, Form, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { NguoiDung, useAuth } from '../auth';

export default function DoiMatKhau({ batBuoc = false }: { batBuoc?: boolean }) {
  const { dangNhap, dangXuat, nguoiDung } = useAuth();
  const { message } = App.useApp();
  const nav = useNavigate();
  const [form] = Form.useForm();

  const gui = async (v: { matKhauCu: string; matKhauMoi: string }) => {
    try {
      const r = await api<{ token: string; nguoiDung: NguoiDung }>('/auth/doi-mat-khau', { method: 'POST', body: v });
      dangNhap(r.token, r.nguoiDung);
      message.success('Đã đổi mật khẩu');
      form.resetFields();
      if (!batBuoc) nav('/');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const the = (
    <Card className="card-mem" style={{ maxWidth: 440, width: '100%', margin: batBuoc ? undefined : '0 auto' }} title="Đổi mật khẩu">
      {batBuoc && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Xin chào ${nguoiDung?.hoTen}`}
          description="Đây là lần đăng nhập đầu tiên hoặc mật khẩu vừa được cấp lại. Vui lòng đặt mật khẩu mới để tiếp tục."
        />
      )}
      <Form form={form} layout="vertical" onFinish={gui} requiredMark={false}>
        <Form.Item name="matKhauCu" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
          <Input.Password id="mk-cu" autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="matKhauMoi"
          label="Mật khẩu mới"
          extra="Ít nhất 8 ký tự, gồm cả chữ và số"
          rules={[
            { required: true, message: 'Nhập mật khẩu mới' },
            { min: 8, message: 'Ít nhất 8 ký tự' },
            { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Phải có cả chữ và số' },
          ]}
        >
          <Input.Password id="mk-moi" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="xacNhan"
          label="Nhập lại mật khẩu mới"
          dependencies={['matKhauMoi']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, v) => (!v || v === getFieldValue('matKhauMoi') ? Promise.resolve() : Promise.reject('Mật khẩu nhập lại không khớp')),
            }),
          ]}
        >
          <Input.Password id="mk-xac-nhan" autoComplete="new-password" />
        </Form.Item>
        <Button id="nut-doi-mk" type="primary" htmlType="submit" block>
          Lưu mật khẩu mới
        </Button>
        {batBuoc && (
          <Button type="link" block onClick={dangXuat} style={{ marginTop: 8 }}>
            Đăng xuất
          </Button>
        )}
      </Form>
    </Card>
  );

  if (!batBuoc) return the;
  return (
    <div className="dang-nhap" style={{ gridTemplateColumns: '1fr' }}>
      <div className="ben-phai">{the}</div>
    </div>
  );
}
