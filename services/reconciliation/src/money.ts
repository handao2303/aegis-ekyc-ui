/* Tiền tệ (R05 §1): API dùng chuỗi thập phân "125000000.00" + mã ISO 4217; bên trong lưu số nguyên 1/100.
   Không bao giờ dùng phép tính số thực trên số tiền – chỉ cộng trừ số nguyên an toàn. */
import { ApiError } from "./errors.ts";

const DEC = /^\d{1,16}(\.\d{1,2})?$/;
const ISO_4217 = new Set(["VND", "USD", "EUR", "JPY", "SGD", "GBP", "AUD", "KRW", "CNY", "THB"]);

/** "125000000.5" → 12500000050. Ném VALIDATION nếu không phải số dương hợp lệ */
export function toMinor(v: unknown, field = "amount"): number {
  const s = typeof v === "number" ? v.toFixed(2) : String(v ?? "").trim();
  if (!DEC.test(s)) throw new ApiError(422, "VALIDATION", `${field} phải là chuỗi thập phân dương, tối đa 2 chữ số lẻ`);
  const [int, frac = ""] = s.split(".");
  const minor = Number(int) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new ApiError(422, "VALIDATION", `${field} vượt giới hạn hoặc bằng 0`);
  return minor;
}

/** 12500000050 → "125000000.50" */
export const fromMinor = (m: number): string => `${Math.trunc(m / 100)}.${String(Math.abs(m % 100)).padStart(2, "0")}`;

export function currency(v: unknown): string {
  const c = String(v ?? "").toUpperCase();
  if (!ISO_4217.has(c)) throw new ApiError(422, "VALIDATION", "currency phải là mã ISO 4217 được hỗ trợ");
  return c;
}

/** Hiển thị log/thông điệp: 125000000 → "125.000.000 ₫" */
export const vnd = (m: number) => `${Math.round(m / 100).toLocaleString("vi-VN")} ₫`;
