const TOKEN_KEY = 'qlns_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface LoiTruong {
  truong: string;
  loi: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public loi?: LoiTruong[]) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function taoUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

async function goi(path: string, opts: { method?: string; body?: unknown; query?: Query } = {}) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(taoUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body });
  if (!res.ok) {
    let data: { message?: string | string[]; loi?: LoiTruong[] } = {};
    try {
      data = await res.json();
    } catch {
      /* phản hồi không phải JSON */
    }
    if (res.status === 401 && !path.startsWith('/auth/dang-nhap')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('qlns:dang-xuat'));
    }
    const msg = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    const macDinh =
      res.status >= 500 && !msg
        ? `Không kết nối được máy chủ API (mã ${res.status}). Vui lòng thử lại sau hoặc báo quản trị kiểm tra dịch vụ API.`
        : `Lỗi máy chủ (${res.status})`;
    throw new ApiError(msg || macDinh, res.status, data.loi);
  }
  return res;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const res = await goi(path, opts);
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Gọi API trả file và tải về máy. */
export async function taiFile(path: string, opts: { method?: string; query?: Query; tenMacDinh?: string } = {}) {
  const res = await goi(path, { method: opts.method, query: opts.query });
  const cd = res.headers.get('content-disposition') ?? '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/) ?? cd.match(/filename="?([^";]+)"?/);
  let ten = m ? decodeURIComponent(m[1]) : (opts.tenMacDinh ?? 'tai-ve.xlsx');
  if (!/\.[a-z0-9]{2,5}$/i.test(ten)) ten += '.xlsx';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  // Phải gắn vào trang và thu hồi URL sau một nhịp, nếu không Chrome/Edge
  // bỏ qua thuộc tính download và lưu file với tên mã ngẫu nhiên, không có đuôi .xlsx
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
