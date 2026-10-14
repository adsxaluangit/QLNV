import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';
import { VaiTro } from './constants';

export interface NguoiDung {
  id: string;
  tenDangNhap: string;
  hoTen: string;
  vaiTro: VaiTro;
  tenVaiTro: string;
  nhanSuId: string | null;
  donVi: string | null;
  phamVi: string | null;
  phaiDoiMatKhau: boolean;
}

interface AuthCtx {
  nguoiDung: NguoiDung | null;
  dangTai: boolean;
  dangNhap: (token: string, nd: NguoiDung) => void;
  dangXuat: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [nguoiDung, setNguoiDung] = useState<NguoiDung | null>(null);
  const [dangTai, setDangTai] = useState(!!tokenStore.get());

  const dangXuat = useCallback(() => {
    tokenStore.clear();
    setNguoiDung(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    if (tokenStore.get()) {
      api<NguoiDung>('/auth/toi')
        .then(setNguoiDung)
        .catch(() => tokenStore.clear())
        .finally(() => setDangTai(false));
    }
    const h = () => setNguoiDung(null);
    window.addEventListener('qlns:dang-xuat', h);
    return () => window.removeEventListener('qlns:dang-xuat', h);
  }, []);

  const dangNhap = useCallback((token: string, nd: NguoiDung) => {
    tokenStore.set(token);
    setNguoiDung(nd);
  }, []);

  return <Ctx.Provider value={{ nguoiDung, dangTai, dangNhap, dangXuat }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
