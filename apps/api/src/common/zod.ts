import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';

// Thông báo lỗi tiếng Việt mặc định cho zod
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Bắt buộc nhập' };
      return { message: 'Sai kiểu dữ liệu' };
    case 'too_small':
      return { message: issue.type === 'string' ? `Tối thiểu ${issue.minimum} ký tự` : `Tối thiểu ${issue.minimum}` };
    case 'too_big':
      return { message: issue.type === 'string' ? `Tối đa ${issue.maximum} ký tự` : `Tối đa ${issue.maximum}` };
    case 'invalid_enum_value':
      return { message: 'Giá trị không hợp lệ' };
    case 'invalid_string':
      return { message: 'Định dạng không hợp lệ' };
    default:
      return { message: ctx.defaultError };
  }
});

export class ZodPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      const loi = r.error.issues.map((i) => ({ truong: i.path.join('.'), loi: i.message }));
      throw new BadRequestException({
        message: loi.map((l) => (l.truong ? `${l.truong}: ${l.loi}` : l.loi)).join('; '),
        loi,
      });
    }
    return r.data;
  }
}

/** Chuỗi tùy chọn: rỗng → null */
export const txt = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const RE_NGAY = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Ngày bắt buộc, định dạng YYYY-MM-DD */
export const ngay = z.string({ required_error: 'Bắt buộc nhập' }).transform((s, ctx) => {
  if (!RE_NGAY.test(s) || isNaN(toDate(s).getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Ngày không hợp lệ' });
    return z.NEVER;
  }
  return toDate(s);
});

/** Ngày tùy chọn, định dạng YYYY-MM-DD; rỗng → null */
export const ngayOpt = z
  .string()
  .nullish()
  .transform((s, ctx) => {
    if (!s) return null;
    if (!RE_NGAY.test(s) || isNaN(toDate(s).getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Ngày không hợp lệ' });
      return z.NEVER;
    }
    return toDate(s);
  });

export const uuidOpt = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));
