import { useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Radio, Select, Space, Switch, Table, Tag, TreeSelect, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, taiFile } from '../api';
import { useAuth } from '../auth';
import { fmtNgayGio, MAU_VAI_TRO, NHAN_VAI_TRO, tuyChon, VAI_TRO_THEO_CO_SO, VaiTro } from '../constants';
import { cayDonVi, useCoSo, useDonVi } from '../danh-muc';
import type { NhanSuDong } from './NhanSuList';

interface TK {
  id: string;
  tenDangNhap: string;
  tenHienThi: string | null;
  vaiTro: VaiTro;
  hoatDong: boolean;
  phaiDoiMatKhau: boolean;
  dangNhapCuoi: string | null;
  khoaDen: string | null;
  phamViCoSo: { id: string; ten: string } | null;
  phamViDonVi: { id: string; ten: string } | null;
  nhanSu: { id: string; hoTen: string; donVi: { ten: string } } | null;
}

function MatKhauMoi({ ten, mk }: { ten: string; mk: string }) {
  return (
    <div>
      <p>Gửi thông tin sau cho người dùng. Mật khẩu chỉ hiển thị một lần; người dùng sẽ phải đổi khi đăng nhập.</p>
      <p>
        Tên đăng nhập: <Typography.Text copyable strong className="ma-cccd">{ten}</Typography.Text>
      </p>
      <p>
        Mật khẩu tạm: <Typography.Text copyable strong className="ma-cccd">{mk}</Typography.Text>
      </p>
    </div>
  );
}

export default function TaiKhoan() {
  const { nguoiDung } = useAuth();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const coSo = useCoSo();
  const donVi = useDonVi();
  const [q, setQ] = useState('');
  const [vaiTro, setVaiTro] = useState<VaiTro>();
  const [hop, setHop] = useState<{ ban?: TK } | null>(null);
  const [form] = Form.useForm();
  const vaiTroChon = Form.useWatch('vaiTro', form) as VaiTro | undefined;
  const cachTao = Form.useWatch('cachTao', form) as 'can-bo' | 'rieng' | undefined;
  const [timNs, setTimNs] = useState('');
  const [dangTaoLoat, setDangTaoLoat] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tai-khoan', q, vaiTro],
    queryFn: () => api<{ items: TK[]; chuaCoTaiKhoan: number }>('/tai-khoan', { query: { q, vaiTro } }),
  });
  const nhanSu = useQuery({
    queryKey: ['tim-ns', timNs],
    queryFn: () => api<{ items: NhanSuDong[] }>('/nhan-su', { query: { q: timNs, pageSize: 20 } }),
    enabled: !!hop && !hop.ban,
  });

  const lamMoi = () => qc.invalidateQueries({ queryKey: ['tai-khoan'] });

  const mo = (ban?: TK) => {
    setHop({ ban });
    form.resetFields();
    form.setFieldsValue(
      ban
        ? { vaiTro: ban.vaiTro, hoatDong: ban.hoatDong, phamViCoSoId: ban.phamViCoSo?.id, phamViDonViId: ban.phamViDonVi?.id, tenHienThi: ban.tenHienThi }
        : { cachTao: 'can-bo', vaiTro: 'CAN_BO' },
    );
  };

  const luu = async () => {
    const v = await form.validateFields();
    const phamVi = {
      phamViCoSoId: VAI_TRO_THEO_CO_SO.includes(v.vaiTro) ? v.phamViCoSoId : null,
      phamViDonViId: v.vaiTro === 'TRUONG_DON_VI' ? v.phamViDonViId : null,
    };
    try {
      if (hop?.ban) {
        await api(`/tai-khoan/${hop.ban.id}`, { method: 'PATCH', body: { vaiTro: v.vaiTro, hoatDong: v.hoatDong, tenHienThi: v.tenHienThi, ...phamVi } });
        message.success('Đã lưu');
      } else {
        const r = await api<{ tenDangNhap: string; matKhau: string }>('/tai-khoan', {
          method: 'POST',
          body: {
            vaiTro: v.vaiTro,
            ...phamVi,
            ...(v.cachTao === 'can-bo' ? { nhanSuId: v.nhanSuId } : { tenDangNhap: v.tenDangNhap, tenHienThi: v.tenHienThi }),
          },
        });
        modal.success({ title: 'Đã tạo tài khoản', content: <MatKhauMoi ten={r.tenDangNhap} mk={r.matKhau} />, width: 480 });
      }
      setHop(null);
      lamMoi();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const datLai = async (tk: TK) => {
    try {
      const r = await api<{ tenDangNhap: string; matKhau: string }>(`/tai-khoan/${tk.id}/dat-lai-mat-khau`, { method: 'POST' });
      modal.success({ title: 'Đã đặt lại mật khẩu', content: <MatKhauMoi ten={r.tenDangNhap} mk={r.matKhau} />, width: 480 });
      lamMoi();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const xoa = async (tk: TK) => {
    try {
      await api(`/tai-khoan/${tk.id}`, { method: 'DELETE' });
      message.success('Đã xóa');
      lamMoi();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const taoLoat = () =>
    modal.confirm({
      title: `Tạo tài khoản cho ${data?.chuaCoTaiKhoan} cán bộ?`,
      content: 'Tên đăng nhập là số CCCD, mật khẩu tạm ngẫu nhiên. Hệ thống sẽ tải về file Excel danh sách mật khẩu để phát cho cán bộ. Hãy bảo mật file này.',
      okText: 'Tạo và tải file',
      cancelText: 'Hủy',
      onOk: async () => {
        setDangTaoLoat(true);
        try {
          await taiFile('/tai-khoan/tao-hang-loat', { method: 'POST' });
          message.success('Đã tạo tài khoản');
          lamMoi();
        } catch (e) {
          message.error((e as Error).message);
        } finally {
          setDangTaoLoat(false);
        }
      },
    });

  return (
    <Card className="card-mem">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Input.Search allowClear placeholder="Tìm tên đăng nhập, họ tên" onSearch={setQ} style={{ width: 300 }} />
        <Select allowClear placeholder="Vai trò" style={{ width: 220 }} value={vaiTro} onChange={setVaiTro} options={tuyChon(NHAN_VAI_TRO)} />
        <Space style={{ marginLeft: 'auto' }}>
          {!!data?.chuaCoTaiKhoan && (
            <Button icon={<UsergroupAddOutlined />} onClick={taoLoat} loading={dangTaoLoat} id="nut-tao-hang-loat">
              Tạo cho {data.chuaCoTaiKhoan} cán bộ chưa có tài khoản
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => mo()} id="nut-tao-tai-khoan">
            Tạo tài khoản
          </Button>
        </Space>
      </div>

      <Table<TK>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items}
        pagination={{ pageSize: 30, showTotal: (t) => `${t} tài khoản` }}
        columns={[
          { title: 'Tên đăng nhập', dataIndex: 'tenDangNhap', width: 160, render: (v) => <span className="ma-cccd">{v}</span> },
          {
            title: 'Người dùng',
            key: 'nd',
            render: (_, r) => (
              <>
                <div style={{ fontWeight: 500 }}>{r.nhanSu?.hoTen ?? r.tenHienThi}</div>
                {r.nhanSu && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.nhanSu.donVi.ten}</Typography.Text>}
              </>
            ),
          },
          { title: 'Vai trò', dataIndex: 'vaiTro', width: 220, render: (v: VaiTro) => <Tag color={MAU_VAI_TRO[v]}>{NHAN_VAI_TRO[v]}</Tag> },
          {
            title: 'Phạm vi dữ liệu',
            key: 'pv',
            width: 200,
            render: (_, r) =>
              r.phamViCoSo?.ten ??
              r.phamViDonVi?.ten ??
              (['QUAN_TRI', 'BAN_GIAM_HIEU', ...VAI_TRO_THEO_CO_SO].includes(r.vaiTro) ? 'Toàn trường' : r.vaiTro === 'TRUONG_DON_VI' ? 'Đơn vị của mình' : 'Bản thân'),
          },
          {
            title: 'Trạng thái',
            key: 'tt',
            width: 140,
            render: (_, r) =>
              !r.hoatDong ? <Tag color="red">Đã khóa</Tag> : r.phaiDoiMatKhau ? <Tag color="orange">Chưa đổi MK</Tag> : <Tag color="green">Hoạt động</Tag>,
          },
          { title: 'Đăng nhập gần nhất', dataIndex: 'dangNhapCuoi', width: 160, render: fmtNgayGio },
          {
            title: '',
            key: 'hd',
            width: 130,
            align: 'right',
            render: (_, r) => (
              <Space size={0}>
                <Button type="text" icon={<EditOutlined />} title="Sửa quyền" onClick={() => mo(r)} />
                <Popconfirm title="Cấp mật khẩu tạm mới cho tài khoản này?" okText="Đặt lại" cancelText="Không" onConfirm={() => datLai(r)}>
                  <Button type="text" icon={<KeyOutlined />} title="Đặt lại mật khẩu" />
                </Popconfirm>
                <Popconfirm title="Xóa tài khoản?" okText="Xóa" cancelText="Không" onConfirm={() => xoa(r)} disabled={r.id === nguoiDung?.id}>
                  <Button type="text" danger icon={<DeleteOutlined />} disabled={r.id === nguoiDung?.id} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={!!hop}
        title={hop?.ban ? `Sửa tài khoản ${hop.ban.tenDangNhap}` : 'Tạo tài khoản'}
        onCancel={() => setHop(null)}
        onOk={luu}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {!hop?.ban && (
            <>
              <Form.Item name="cachTao">
                <Radio.Group
                  optionType="button"
                  options={[
                    { value: 'can-bo', label: 'Cho cán bộ (đăng nhập bằng CCCD)' },
                    { value: 'rieng', label: 'Tài khoản riêng' },
                  ]}
                />
              </Form.Item>
              {cachTao === 'rieng' ? (
                <>
                  <Form.Item name="tenDangNhap" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="tenHienThi" label="Tên hiển thị">
                    <Input />
                  </Form.Item>
                </>
              ) : (
                <Form.Item name="nhanSuId" label="Cán bộ" rules={[{ required: true, message: 'Chọn cán bộ' }]}>
                  <Select
                    showSearch
                    filterOption={false}
                    onSearch={setTimNs}
                    loading={nhanSu.isFetching}
                    placeholder="Gõ tên hoặc số CCCD để tìm"
                    options={nhanSu.data?.items.map((n) => ({ value: n.id, label: `${n.hoTen} — ${n.maCanBo} — ${n.donVi.ten}` }))}
                  />
                </Form.Item>
              )}
            </>
          )}
          {hop?.ban && !hop.ban.nhanSu && (
            <Form.Item name="tenHienThi" label="Tên hiển thị">
              <Input />
            </Form.Item>
          )}
          <Form.Item name="vaiTro" label="Vai trò" rules={[{ required: true }]}>
            <Select options={tuyChon(NHAN_VAI_TRO)} />
          </Form.Item>
          {vaiTroChon && VAI_TRO_THEO_CO_SO.includes(vaiTroChon) && (
            <Form.Item name="phamViCoSoId" label="Phạm vi cơ sở" extra="Để trống = toàn trường">
              <Select allowClear placeholder="Toàn trường" options={coSo.data?.map((c) => ({ value: c.id, label: c.ten }))} />
            </Form.Item>
          )}
          {vaiTroChon === 'TRUONG_DON_VI' && (
            <Form.Item name="phamViDonViId" label="Đơn vị quản lý" extra="Để trống = đơn vị của chính cán bộ. Bao gồm cả các đơn vị con.">
              <TreeSelect allowClear treeDefaultExpandAll treeData={cayDonVi(coSo.data, donVi.data)} placeholder="Đơn vị của cán bộ" />
            </Form.Item>
          )}
          {hop?.ban && (
            <Form.Item name="hoatDong" label="Cho phép đăng nhập" valuePropName="checked">
              <Switch disabled={hop.ban.id === nguoiDung?.id} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
