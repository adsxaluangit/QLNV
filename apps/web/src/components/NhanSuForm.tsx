import { useEffect, useState } from 'react';
import { Alert, App, AutoComplete, Button, Checkbox, Col, DatePicker, Form, Input, Row, Select, Space, TreeSelect } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { api, ApiError } from '../api';
import { canhBaoCccd } from '../cccd';
import { LY_LUAN_CT, NHAN_GIOI_TINH, NHAN_LOAI_NS, NHAN_TRANG_THAI, NHAN_TRINH_DO, toDayjs, toIso, tuyChon } from '../constants';
import { cayDonVi, useChucVu, useCoSo, useDonVi } from '../danh-muc';

const TRUONG_NGAY = ['ngaySinh', 'ngayCapCccd', 'ngayTuyenDung', 'ngayVaoTruong', 'ngayVaoDang', 'ngayChinhThucDang'];

export type HoSo = Record<string, unknown> & { id?: string };

function Nhom({ children }: { children: React.ReactNode }) {
  return <div className="form-nhom-tieu-de">{children}</div>;
}

const ngay = <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} />;

export default function NhanSuForm({
  banDau,
  onDaLuu,
  onHuy,
}: {
  banDau?: HoSo;
  onDaLuu: (ns: HoSo) => void;
  onHuy: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [dangLuu, setDangLuu] = useState(false);
  const coSo = useCoSo();
  const donVi = useDonVi();
  const chucVu = useChucVu();

  useEffect(() => {
    if (!banDau) {
      form.setFieldsValue({ quocTich: 'Việt Nam', danToc: 'Kinh', loaiNhanSu: 'VIEN_CHUC', trangThai: 'DANG_LAM_VIEC' });
      return;
    }
    const v: Record<string, unknown> = { ...banDau };
    for (const k of TRUONG_NGAY) v[k] = toDayjs(banDau[k] as string);
    // Hồ sơ mã tạm (nhập từ bảng lương): để trống để TCHC gõ số CCCD thật
    if (String(banDau.maCanBo ?? '').startsWith('TAM-')) v.maCanBo = undefined;
    form.setFieldsValue(v);
    if (String(banDau.maCanBo ?? '').startsWith('TAM-')) {
      form.setFields([{ name: 'maCanBo', errors: ['Hồ sơ đang dùng mã tạm — nhập số CCCD để lưu'] }]);
    }
  }, [banDau, form]);

  const ma = Form.useWatch('maCanBo', form) as string | undefined;
  const gioiTinh = Form.useWatch('gioiTinh', form) as 'NAM' | 'NU' | undefined;
  const ngaySinh = Form.useWatch('ngaySinh', form) as Dayjs | undefined;
  const quocTich = Form.useWatch('quocTich', form) as string | undefined;
  const laGiangVien = Form.useWatch('laGiangVien', form) as boolean | undefined;
  const laVN = !quocTich || /^vi[eệ]t\s*nam$|^vn$/i.test(quocTich.trim());
  const canhBao = laVN ? canhBaoCccd(ma, gioiTinh, ngaySinh?.year()) : [];

  const luu = async (v: Record<string, unknown>) => {
    const body: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      body[k] = TRUONG_NGAY.includes(k) ? toIso(val as Dayjs | null) : val === undefined ? null : val;
    }
    body.laGiangVien = !!v.laGiangVien;
    body.kiemNhiem = !!v.laGiangVien && !!v.kiemNhiem;
    setDangLuu(true);
    try {
      const ns = banDau?.id
        ? await api<HoSo>(`/nhan-su/${banDau.id}`, { method: 'PATCH', body })
        : await api<HoSo>('/nhan-su', { method: 'POST', body });
      message.success('Đã lưu hồ sơ');
      onDaLuu(ns);
    } catch (e) {
      const err = e as ApiError;
      if (err.loi?.length) {
        form.setFields(err.loi.map((l) => ({ name: l.truong, errors: [l.loi] })));
        form.scrollToField(err.loi[0].truong);
      }
      message.error(err.message);
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={luu} scrollToFirstError>
      <Nhom>Thông tin định danh</Nhom>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="maCanBo"
            label={laVN ? 'Mã cán bộ (Số CCCD)' : 'Mã cán bộ (Số hộ chiếu)'}
            rules={[
              { required: true, message: 'Nhập số CCCD' },
              laVN
                ? { pattern: /^\d{12}$/, message: 'Số CCCD gồm đúng 12 chữ số' }
                : { pattern: /^[A-Za-z0-9]{6,15}$/, message: 'Số hộ chiếu 6–15 ký tự chữ/số' },
            ]}
            validateStatus={canhBao.length ? 'warning' : undefined}
            help={canhBao.length ? `Kiểm tra lại: ${canhBao.join('; ')}` : undefined}
            normalize={(v: string) => v?.replace(/\s+/g, '').toUpperCase()}
          >
            <Input id="ma-can-bo" className="ma-cccd" maxLength={15} placeholder="12 chữ số" />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item name="hoTen" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input id="ho-ten" placeholder="VD: Nguyễn Văn An" />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="tenGoiKhac" label="Tên gọi khác">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="gioiTinh" label="Giới tính" rules={[{ required: true, message: 'Chọn' }]}>
            <Select id="gioi-tinh" options={tuyChon(NHAN_GIOI_TINH)} />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="ngaySinh" label="Ngày sinh" rules={[{ required: true, message: 'Chọn ngày sinh' }]}>
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="ngayCapCccd" label="Ngày cấp CCCD">
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={12} md={10}>
          <Form.Item name="noiCapCccd" label="Nơi cấp">
            <AutoComplete options={[{ value: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội' }, { value: 'Bộ Công an' }]} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="quocTich" label="Quốc tịch">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="danToc" label="Dân tộc">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="tonGiao" label="Tôn giáo">
            <Input placeholder="Không" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="noiSinh" label="Nơi sinh">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="queQuan" label="Quê quán">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Nhom>Liên hệ</Nhom>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item name="dienThoai" label="Điện thoại">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="diaChiThuongTru" label="Địa chỉ thường trú">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="choOHienNay" label="Chỗ ở hiện nay">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Nhom>Công tác</Nhom>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="donViId" label="Đơn vị" rules={[{ required: true, message: 'Chọn đơn vị' }]}>
            <TreeSelect
              id="don-vi"
              showSearch
              treeNodeFilterProp="title"
              treeDefaultExpandAll
              treeData={cayDonVi(coSo.data, donVi.data)}
              placeholder="Chọn đơn vị"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="chucVuId" label="Chức vụ">
            <Select allowClear showSearch optionFilterProp="label" options={chucVu.data?.map((c) => ({ value: c.id, label: c.ten }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="loaiNhanSu" label="Loại nhân sự">
            <Select options={tuyChon(NHAN_LOAI_NS)} />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="trangThai" label="Trạng thái">
            <Select options={tuyChon(NHAN_TRANG_THAI)} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="chucDanhNgheNghiep" label="Chức danh nghề nghiệp (ngạch/hạng)">
            <AutoComplete
              options={[
                'Giảng viên giáo dục nghề nghiệp cao cấp (hạng I)',
                'Giảng viên chính GDNN (hạng II)',
                'Giảng viên GDNN lý thuyết (hạng III)',
                'Giảng viên GDNN thực hành (hạng III)',
                'Chuyên viên chính',
                'Chuyên viên',
                'Kế toán viên',
                'Cán sự',
                'Nhân viên',
              ].map((value) => ({ value }))}
              filterOption={(i, o) => !!o?.value.toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="ngayTuyenDung" label="Ngày tuyển dụng">
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="ngayVaoTruong" label="Ngày vào trường">
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="laGiangVien" valuePropName="checked" label=" ">
            <Checkbox id="la-giang-vien">Là giảng viên (tham gia giảng dạy)</Checkbox>
          </Form.Item>
          {laGiangVien && (
            <Form.Item name="kiemNhiem" valuePropName="checked" style={{ marginTop: -12 }}>
              <Checkbox id="kiem-nhiem">Giảng viên kiêm nhiệm (nghỉ phép như nhân viên)</Checkbox>
            </Form.Item>
          )}
        </Col>
      </Row>

      <Nhom>Trình độ</Nhom>
      <Row gutter={16}>
        <Col xs={12} md={4}>
          <Form.Item name="trinhDoChuyenMon" label="Trình độ chuyên môn">
            <Select allowClear options={tuyChon(NHAN_TRINH_DO)} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="chuyenNganh" label="Chuyên ngành">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="hocHam" label="Học hàm">
            <Select allowClear options={['Giáo sư', 'Phó Giáo sư'].map((value) => ({ value, label: value }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="danhHieu" label="Danh hiệu">
            <AutoComplete options={['Nhà giáo Nhân dân', 'Nhà giáo Ưu tú'].map((value) => ({ value }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="lyLuanChinhTri" label="Lý luận chính trị">
            <AutoComplete options={LY_LUAN_CT.map((value) => ({ value }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="ngoaiNgu" label="Ngoại ngữ">
            <Input placeholder="VD: Tiếng Anh B1" />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="tinHoc" label="Tin học">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={5}>
          <Form.Item name="nghiepVuSuPham" label="Nghiệp vụ sư phạm">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={5}>
          <Form.Item name="kyNangNghe" label="Kỹ năng nghề">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Nhom>Đảng viên · Tài chính – Bảo hiểm</Nhom>
      <Row gutter={16}>
        <Col xs={12} md={4}>
          <Form.Item name="ngayVaoDang" label="Ngày vào Đảng">
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="ngayChinhThucDang" label="Ngày chính thức">
            {ngay}
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="maSoThue" label="Mã số thuế">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="soBhxh" label="Số sổ BHXH">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="soTaiKhoan" label="Số tài khoản">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="nganHang" label="Ngân hàng">
            <Input />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Col>
      </Row>

      {banDau?.id && ma && ma !== banDau.maCanBo && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Bạn đang đổi Mã cán bộ (CCCD). Tên đăng nhập của cán bộ này cũng sẽ đổi theo số CCCD mới."
        />
      )}

      <Space style={{ position: 'sticky', bottom: 0, background: '#fff', padding: '12px 0', width: '100%', justifyContent: 'flex-end', borderTop: '1px solid #eef2f4' }}>
        <Button onClick={onHuy}>Hủy</Button>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={dangLuu} id="nut-luu-ho-so">
          Lưu hồ sơ
        </Button>
      </Space>
    </Form>
  );
}
