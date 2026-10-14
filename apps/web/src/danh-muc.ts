import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface CoSo {
  id: string;
  ma: string;
  ten: string;
  diaChi: string | null;
  thuTu: number;
}
export interface DonVi {
  id: string;
  ma: string;
  ten: string;
  loai: string;
  thuTu: number;
  coSoId: string;
  parentId: string | null;
  coSo: { id: string; ten: string };
  _count: { nhanSus: number };
}
export interface ChucVu {
  id: string;
  ten: string;
  thuTu: number;
}

export const useCoSo = () => useQuery({ queryKey: ['co-so'], queryFn: () => api<CoSo[]>('/co-so'), staleTime: 60_000 });
export const useDonVi = () => useQuery({ queryKey: ['don-vi'], queryFn: () => api<DonVi[]>('/don-vi'), staleTime: 60_000 });
export const useChucVu = () => useQuery({ queryKey: ['chuc-vu'], queryFn: () => api<ChucVu[]>('/chuc-vu'), staleTime: 60_000 });

export interface NutCay {
  value: string;
  title: string;
  key: string;
  selectable?: boolean;
  children?: NutCay[];
}

/** Cây chọn đơn vị: Cơ sở (không chọn được) → đơn vị → đơn vị con. */
export function cayDonVi(coSos: CoSo[] = [], donVis: DonVi[] = [], choChonCoSo = false): NutCay[] {
  const con = (parentId: string | null, coSoId: string): NutCay[] =>
    donVis
      .filter((d) => d.parentId === parentId && d.coSoId === coSoId)
      .map((d) => ({ value: d.id, key: d.id, title: d.ten, children: con(d.id, coSoId) }));
  return coSos.map((c) => ({
    value: `cs:${c.id}`,
    key: `cs:${c.id}`,
    title: c.ten,
    selectable: choChonCoSo,
    children: con(null, c.id),
  }));
}
