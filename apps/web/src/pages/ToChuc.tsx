import { useState } from 'react';
import { App, Badge, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, TreeSelect } from 'antd';
import { BankOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { coQuyenSua, NHAN_LOAI_DON_VI, tuyChon } from '../constants';
import { ChucVu, CoSo, DonVi, useChucVu, useCoSo, useDonVi } from '../danh-muc';

interface Dong {
  key: string;
  laCoSo: boolean;
  ma: string;
  ten: string;
  loai?: string;
  soNguoi: number;
  goc: CoSo | DonVi;
  children?: Dong[];
}

type HopThoai = { kieu: 'co-so'; ban?: CoSo } | { kieu: 'don-vi'; ban?: DonVi; macDinh?: Partial<DonVi> } | { kieu: 'chuc-vu'; ban?: ChucVu };

export default function ToChuc() {
  const { nguoiDung } = useAuth();
  const sua = coQuyenSua(nguoiDung?.vaiTro);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const coSo = useCoSo();
  const donVi = useDonVi();
  const chucVu = useChucVu();
  const [hop, setHop] = useState<HopThoai | null>(null);
  const [form] = Form.useForm();
  const coSoChon = Form.useWatch('coSoId', form);

  const xayCay = (): Dong[] => {
    const dvs = donVi.data ?? [];
    const tong = (id: string): number =>
      (dvs.find((d) => d.id === id)?._count.nhanSus ?? 0) + dvs.filter((d) => d.parentId === id).reduce((a, d) => a + tong(d.id), 0);
    const con = (parentId: string | null, coSoId: string): Dong[] | undefined => {
      const ds = dvs
        .filter((d) => d.parentId === parentId && d.coSoId === coSoId)
        .map((d) => ({ key: d.id, laCoSo: false, ma: d.ma, ten: d.ten, loai: d.loai, soNguoi: tong(d.id), goc: d, children: con(d.id, coSoId) }));
      return ds.length ? ds : undefined;
    };
    return (coSo.data ?? []).map((c) => {
      const children = con(null, c.id);
      return {
        key: `cs:${c.id}`,
        laCoSo: true,
        ma: c.ma,
        ten: c.ten,
        soNguoi: (children ?? []).reduce((a, d) => a + d.soNguoi, 0),
        goc: c,
        children,
      };
    });
  };

  const mo = (h: HopThoai) => {
    setHop(h);
    form.resetFields();
    if (h.ban) form.setFieldsValue(h.ban);
    else if (h.kieu === 'don-vi' && h.macDinh) form.setFieldsValue(h.macDinh);
  };

  const duongDan = (h: HopThoai) => (h.kieu === 'co-so' ? '/co-so' : h.kieu === 'don-vi' ? '/don-vi' : '/chuc-vu');

  const luu = async () => {
    if (!hop) return;
    const v = await form.validateFields();
    try {
      await api(`${duongDan(hop)}${hop.ban ? `/${hop.ban.id}` : ''}`, { method: hop.ban ? 'PATCH' : 'POST', body: v });
      message.success('Đã lưu');
      setHop(null);
      qc.invalidateQueries({ queryKey: [hop.kieu] });
    } catch (e) {
      const err = e as ApiError;
      if (err.loi) form.setFields(err.loi.map((l) => ({ name: l.truong, errors: [l.loi] })));
      message.error(err.message);
    }
  };

  const xoa = async (kieu: HopThoai['kieu'], id: string) => {
    try {
      await api(`/${kieu}/${id}`, { method: 'DELETE' });
      message.success('Đã xóa');
      qc.invalidateQueries({ queryKey: [kieu] });
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // Cây chọn đơn vị cấp trên: chỉ trong cùng cơ sở, loại bỏ chính nó
  const cayCha = (coSoId?: string, boQua?: string) => {
    const dvs = (donVi.data ?? []).filter((d) => d.coSoId === coSoId && d.id !== boQua);
    type Nut = { value: string; title: string; children: Nut[] };
    const con = (p: string | null): Nut[] =>
      dvs.filter((d) => d.parentId === p).map((d) => ({ value: d.id, title: d.ten, children: con(d.id) }));
    return con(null);
  };

  return (
    <Card className="card-mem" styles={{ body: { paddingTop: 8 } }}>
      <Tabs
        items={[
          {
            key: 'co-cau',
            label: 'Cơ sở & đơn vị',
            children: (
              <>
                {sua && (
                  <Space style={{ marginBottom: 12, float: 'right' }}>
                    <Button icon={<BankOutlined />} onClick={() => mo({ kieu: 'co-so' })} id="them-co-so">
                      Thêm cơ sở
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => mo({ kieu: 'don-vi' })} id="them-don-vi">
                      Thêm đơn vị
                    </Button>
                  </Space>
                )}
                <Table<Dong>
                  rowKey="key"
                  loading={coSo.isLoading || donVi.isLoading}
                  dataSource={xayCay()}
                  pagination={false}
                  expandable={{ defaultExpandAllRows: true }}
                  key={donVi.data?.length}
                  columns={[
                    {
                      title: 'Tên',
                      dataIndex: 'ten',
                      render: (v, r) => (r.laCoSo ? <b style={{ color: '#0b4f5c' }}><BankOutlined /> {v}</b> : v),
                    },
                    { title: 'Mã', dataIndex: 'ma', width: 140, render: (v) => <code>{v}</code> },
                    {
                      title: 'Loại',
                      dataIndex: 'loai',
                      width: 120,
                      render: (v, r) => (r.laCoSo ? <Tag color="geekblue">Cơ sở</Tag> : <Tag>{NHAN_LOAI_DON_VI[v as keyof typeof NHAN_LOAI_DON_VI]}</Tag>),
                    },
                    {
                      title: 'Số cán bộ',
                      dataIndex: 'soNguoi',
                      width: 110,
                      align: 'center',
                      render: (v) => <Badge count={v} showZero color={v ? '#0e7c86' : '#cbd5e1'} overflowCount={9999} />,
                    },
                    ...(sua
                      ? [
                          {
                            title: '',
                            key: 'hd',
                            width: 150,
                            align: 'right' as const,
                            render: (_: unknown, r: Dong) => (
                              <Space size={0}>
                                <Button
                                  type="text"
                                  icon={<PlusOutlined />}
                                  title="Thêm đơn vị con"
                                  onClick={() =>
                                    mo({
                                      kieu: 'don-vi',
                                      macDinh: r.laCoSo ? { coSoId: r.goc.id } : { coSoId: (r.goc as DonVi).coSoId, parentId: r.goc.id },
                                    })
                                  }
                                />
                                <Button
                                  type="text"
                                  icon={<EditOutlined />}
                                  onClick={() => mo(r.laCoSo ? { kieu: 'co-so', ban: r.goc as CoSo } : { kieu: 'don-vi', ban: r.goc as DonVi })}
                                />
                                <Popconfirm title={`Xóa "${r.ten}"?`} okText="Xóa" cancelText="Không" onConfirm={() => xoa(r.laCoSo ? 'co-so' : 'don-vi', r.goc.id)}>
                                  <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            ),
          },
          {
            key: 'chuc-vu',
            label: 'Danh mục chức vụ',
            children: (
              <>
                {sua && (
                  <div style={{ textAlign: 'right', marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => mo({ kieu: 'chuc-vu' })}>
                      Thêm chức vụ
                    </Button>
                  </div>
                )}
                <Table<ChucVu>
                  rowKey="id"
                  dataSource={chucVu.data}
                  loading={chucVu.isLoading}
                  pagination={false}
                  size="middle"
                  columns={[
                    { title: 'Thứ tự', dataIndex: 'thuTu', width: 90, align: 'center' },
                    { title: 'Tên chức vụ', dataIndex: 'ten' },
                    ...(sua
                      ? [
                          {
                            title: '',
                            key: 'hd',
                            width: 100,
                            align: 'right' as const,
                            render: (_: unknown, r: ChucVu) => (
                              <Space size={0}>
                                <Button type="text" icon={<EditOutlined />} onClick={() => mo({ kieu: 'chuc-vu', ban: r })} />
                                <Popconfirm title={`Xóa "${r.ten}"?`} okText="Xóa" cancelText="Không" onConfirm={() => xoa('chuc-vu', r.id)}>
                                  <Button type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        open={!!hop}
        onCancel={() => setHop(null)}
        onOk={luu}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
        title={hop ? `${hop.ban ? 'Sửa' : 'Thêm'} ${hop.kieu === 'co-so' ? 'cơ sở' : hop.kieu === 'don-vi' ? 'đơn vị' : 'chức vụ'}` : ''}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }} initialValues={{ thuTu: 0, loai: 'KHOA' }}>
          {hop?.kieu === 'chuc-vu' ? (
            <Form.Item name="ten" label="Tên chức vụ" rules={[{ required: true, message: 'Nhập tên' }]}>
              <Input />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="ma" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ không dấu, số, dấu chấm/gạch. Dùng khi nhập Excel.">
                <Input style={{ textTransform: 'uppercase' }} />
              </Form.Item>
              <Form.Item name="ten" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
                <Input />
              </Form.Item>
            </>
          )}
          {hop?.kieu === 'co-so' && (
            <Form.Item name="diaChi" label="Địa chỉ">
              <Input />
            </Form.Item>
          )}
          {hop?.kieu === 'don-vi' && (
            <>
              <Form.Item name="loai" label="Loại đơn vị">
                <Select options={tuyChon(NHAN_LOAI_DON_VI)} />
              </Form.Item>
              <Form.Item name="coSoId" label="Thuộc cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
                <Select options={coSo.data?.map((c) => ({ value: c.id, label: c.ten }))} onChange={() => form.setFieldValue('parentId', null)} />
              </Form.Item>
              <Form.Item name="parentId" label="Đơn vị cấp trên" extra="Để trống nếu trực thuộc trường/cơ sở">
                <TreeSelect allowClear treeDefaultExpandAll treeData={cayCha(coSoChon, hop.ban?.id)} placeholder="Không có" />
              </Form.Item>
            </>
          )}
          <Form.Item name="thuTu" label="Thứ tự hiển thị">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
