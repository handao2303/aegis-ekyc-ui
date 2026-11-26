/* Đọc và chuẩn hoá file nguồn (UC-REC-01, TC-REC-B01/B02) – hàm thuần, DB do service xử lý.

   Định dạng hỗ trợ ở bản dev:
   - JSON     : mảng bản ghi (cổng ví điện tử, API NAPAS đã chuyển đổi)
   - CSV      : dòng tiêu đề + dữ liệu, phân cách dấu phẩy (CBS). TC33 (Visa) và IPM (Mastercard) là định dạng nhị phân /
                cố định độ dài – adapter đối tác chuyển sang bố cục CSV chuẩn này trước khi nạp.
   - CAMT053 / CAMT054 : ISO 20022 – đọc các thẻ <Ntry> tối thiểu (Amt@Ccy, CdtDbtInd, BookgDt, ValDt, AcctSvcrRef / EndToEndId)

   Chính sách: một bản ghi lỗi → cách ly cả file (nạp nguyên lô hoặc không nạp), để không có lô "nửa vời" khó đối soát. */
import { createHash } from "node:crypto";
import { toMinor, currency as ccy } from "./money.ts";
import { ApiError } from "./errors.ts";

export type RawRecord = Record<string, unknown>;
export type NormRecord = {
  side: "INTERNAL" | "EXTERNAL"; reference_no: string; amount_minor: number; currency: string; direction: "DEBIT" | "CREDIT";
  txn_at: number; value_date: string | null; account_no: string | null; counterparty_account: string | null; batch_id: string | null; channel: string | null;
};
export type ParseResult = { records: NormRecord[]; errors: string[] };

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** PCI DSS: không bao giờ lưu số thẻ đầy đủ. Chuỗi 13–19 chữ số được che giữ 4 số đầu + 4 số cuối */
export function maskPan(v: string | null): string | null {
  if (!v) return v;
  const d = v.replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(d) ? `${d.slice(0, 4)} •••• ${d.slice(-4)}` : v;
}

export function parseRecords(format: string, content: string, side: "INTERNAL" | "EXTERNAL"): ParseResult {
  let raws: RawRecord[];
  try {
    raws = format === "JSON" ? parseJson(content) : format.startsWith("CAMT") ? parseCamt(content) : parseCsv(content);
  } catch (e) {
    return { records: [], errors: [`Không đọc được file ${format}: ${(e as Error).message}`] };
  }
  const records: NormRecord[] = [];
  const errors: string[] = [];
  raws.forEach((r, i) => {
    try { records.push(normalize(r, side)); }
    catch (e) { errors.push(`Dòng ${i + 1}: ${(e as Error).message}`); }
  });
  if (!raws.length) errors.push("File không có bản ghi nào");
  return { records, errors };
}

function normalize(r: RawRecord, side: "INTERNAL" | "EXTERNAL"): NormRecord {
  const str = (k: string) => (r[k] === undefined || r[k] === null || r[k] === "" ? null : String(r[k]).trim());
  const ref = str("reference_no") ?? str("ref");
  if (!ref) throw new Error("thiếu reference_no");
  let amount: number;
  try { amount = toMinor(r.amount); } catch { throw new Error(`sai định dạng trường amount (${String(r.amount)})`); }
  let currency: string;
  try { currency = ccy(str("currency") ?? "VND"); } catch { throw new Error(`currency không hợp lệ (${String(r.currency)})`); }
  const dir = (str("direction") ?? "CREDIT").toUpperCase();
  if (dir !== "DEBIT" && dir !== "CREDIT") throw new Error(`direction phải là DEBIT/CREDIT (${dir})`);
  const at = str("txn_at");
  const txnAt = at === null ? NaN : /^\d+$/.test(at) ? Number(at) : Date.parse(at);
  if (!Number.isFinite(txnAt)) throw new Error(`sai định dạng trường txn_at (${at})`);
  const vd = str("value_date");
  if (vd && !/^\d{4}-\d{2}-\d{2}$/.test(vd)) throw new Error(`value_date phải dạng YYYY-MM-DD (${vd})`);
  return {
    side, reference_no: ref.replace(/\s+/g, "").toUpperCase(), amount_minor: amount, currency, direction: dir,
    txn_at: txnAt, value_date: vd, account_no: maskPan(str("account_no")), counterparty_account: maskPan(str("counterparty_account")),
    batch_id: str("batch_id"), channel: str("channel")?.toUpperCase() ?? null,
  };
}

function parseJson(s: string): RawRecord[] {
  const v = JSON.parse(s);
  const arr = Array.isArray(v) ? v : Array.isArray(v?.records) ? v.records : null;
  if (!arr) throw new Error("JSON phải là mảng bản ghi hoặc { records: [...] }");
  return arr;
}

/** CSV đơn giản theo RFC 4180: hỗ trợ trường trong ngoặc kép có dấu phẩy và "" */
function parseCsv(s: string): RawRecord[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (q) throw new Error("ngoặc kép chưa đóng");
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  const [head, ...body] = rows;
  if (!head) throw new Error("thiếu dòng tiêu đề");
  const cols = head.map((h) => h.trim().toLowerCase());
  return body.map((r, i) => {
    if (r.length !== cols.length) throw new Error(`dòng ${i + 2} có ${r.length} cột, tiêu đề có ${cols.length}`);
    return Object.fromEntries(cols.map((c, k) => [c, r[k]]));
  });
}

/** ISO 20022 camt.053/054 tối thiểu – đủ cho kiểm thử, production dùng thư viện XML có kiểm schema */
function parseCamt(s: string): RawRecord[] {
  if (!/<Document[\s>]/.test(s)) throw new Error("không phải tài liệu ISO 20022");
  const tag = (x: string, t: string) => x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([^<]*)</${t}>`))?.[1]?.trim() ?? null;
  const entries = [...s.matchAll(/<Ntry>([\s\S]*?)<\/Ntry>/g)].map((m) => m[1]);
  return entries.map((x) => {
    const amt = x.match(/<Amt\s+Ccy="([A-Z]{3})">([^<]+)<\/Amt>/);
    const booked = x.match(/<BookgDt>\s*<(?:DtTm|Dt)>([^<]+)<\/(?:DtTm|Dt)>/)?.[1] ?? null;
    const valDt = x.match(/<ValDt>\s*<Dt>([^<]+)<\/Dt>/)?.[1] ?? null;
    return {
      reference_no: tag(x, "AcctSvcrRef") ?? tag(x, "EndToEndId"),
      amount: amt?.[2], currency: amt?.[1],
      direction: tag(x, "CdtDbtInd") === "DBIT" ? "DEBIT" : "CREDIT",
      txn_at: booked && booked.length === 10 ? `${booked}T00:00:00+07:00` : booked,
      value_date: valDt, account_no: tag(x, "IBAN") ?? tag(x, "Id"),
    };
  });
}

/** Kiểm tra đầu vào API nạp file (dùng cho job nạp và endpoint dev) */
export function assertIngestInput(b: any) {
  const sources = ["CBS", "NAPAS", "VISA", "MASTERCARD", "WALLET"];
  const formats = ["CSV", "CAMT053", "CAMT054", "TC33", "IPM", "JSON"];
  if (!sources.includes(b?.source)) throw new ApiError(422, "VALIDATION", `source phải thuộc ${sources.join(", ")}`);
  if (!formats.includes(b?.format)) throw new ApiError(422, "VALIDATION", `format phải thuộc ${formats.join(", ")}`);
  if (typeof b?.content !== "string" || !b.content.length) throw new ApiError(422, "VALIDATION", "content (nội dung file) bắt buộc");
  if (typeof b?.file_name !== "string" || !b.file_name.trim()) throw new ApiError(422, "VALIDATION", "file_name bắt buộc");
}
