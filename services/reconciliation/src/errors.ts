/* Lỗi nghiệp vụ → HTTP (R05 §6). Dạng trả về giống A03: { error: { code, message, ...extra } } */
export type Extra = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code: string;
  extra?: Extra;
  constructor(status: number, code: string, message: string, extra?: Extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const forbidden = (message = "Không đủ quyền", code = "FORBIDDEN", extra?: Extra) => new ApiError(403, code, message, extra);
export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `Không tìm thấy ${what}`);
export const invalidState = (message: string, extra?: Extra) => new ApiError(409, "INVALID_STATE", message, extra);
export const validation = (message: string, code = "VALIDATION", extra?: Extra) => new ApiError(422, code, message, extra);
