/* Engine đối soát (UC-REC-03) – hàm thuần, không đụng DB, để test độc lập (TC-REC-B03 → B05).

   Thứ tự áp dụng cho mỗi cặp nguồn, theo đúng BR-REC-03/04:
     1. EXACT  – khớp tuyệt đối theo khoá (RULE-REC-02). Khớp được thì không chạy Fuzzy.
     2. N1     – một giao dịch nội bộ ↔ nhiều giao dịch đối tác cùng lô, tìm subset-sum có giới hạn thời gian (RULE-REC-03).
     3. FUZZY  – chấm điểm 0..1; ≥ ngưỡng và cách ứng viên nhì ≥ gap → MATCHED (RULE-REC-01, REQ-REC-16).
     4. Còn lại → PARTIAL (có ứng viên đủ gần) hoặc UNMATCHED; giao dịch nội bộ lặp lại → DUPLICATE.

   Gán tham lam: duyệt giao dịch nội bộ theo thời gian, mỗi giao dịch đối tác chỉ dùng một lần. */

export type Txn = {
  txn_id: string; source: string; side: "INTERNAL" | "EXTERNAL"; reference_no: string;
  amount_minor: number; currency: string; direction: string; txn_at: number; value_date: string | null;
  account_no: string | null; counterparty_account: string | null; batch_id: string | null;
  /** Kênh đối tác của giao dịch nội bộ (CBS ghi theo mã kênh). Null với giao dịch đối tác */
  channel: string | null;
};
export type MatchKey = "REF" | "AMOUNT" | "CURRENCY" | "DATE" | "ACCOUNT" | "BATCH";
export type Rule = {
  rule_id: string; version: number; type: "EXACT" | "FUZZY" | "N1"; source_pair: string; match_keys: MatchKey[];
  amount_tolerance_pct: number | null; date_tolerance_days: number | null;
  fuzzy_threshold: number | null; fuzzy_gap: number | null; n1_max_items: number | null; n1_timeout_ms: number | null;
};
export type EngineOpts = { fuzzy_threshold: number; fuzzy_gap: number; partial_floor: number; n1_timeout_ms: number; n1_max_items: number };

export type Outcome =
  | { status: "MATCHED"; rule: Rule; score: number; internal: Txn; external: Txn[] }
  | { status: "PARTIAL"; rule: Rule; score: number; internal: Txn; external: Txn[]; diff_minor: number; hint: Hint }
  | { status: "UNMATCHED"; rule: Rule | null; score: 0; internal: Txn; external: []; diff_minor: number; hint: Hint }
  | { status: "DUPLICATE"; rule: Rule | null; score: 0; internal: Txn; external: Txn[]; diff_minor: number; hint: Hint };

/** Gợi ý ngữ cảnh cho bộ đề xuất nguyên nhân (thay cho mô hình AI ở bản dev – BR-REC-05) */
export type Hint = "AMOUNT_DIFF" | "AMBIGUOUS" | "NO_COUNTERPART" | "N1_SHORT" | "N1_TIMEOUT" | "REPEATED";

/** "CBS↔NAPAS" → ["CBS", "NAPAS"]; chấp nhận cả "<->" */
export function parsePair(pair: string): [string, string] {
  const [a, b] = pair.split(/↔|<->/).map((s) => s.trim().toUpperCase());
  if (!a || !b) throw new Error(`source_pair không hợp lệ: ${pair}`);
  return [a, b];
}

/** Chuẩn hoá mã tham chiếu: bỏ khoảng trắng, viết hoa (RULE-REC-02) */
export const normRef = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/** Ngày nghiệp vụ theo giờ Việt Nam (UTC+7) */
export const vnDate = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
const dayOf = (t: Txn) => t.value_date ?? vnDate(t.txn_at);
const last4 = (s: string | null) => (s ? s.replace(/\D/g, "").slice(-4) : null);

/** Giá trị khoá dùng cho EXACT – ACCOUNT so 4 số cuối vì phía thẻ chỉ có số đã che (PCI DSS) */
function keyValue(t: Txn, k: MatchKey): string | number | null {
  switch (k) {
    case "REF": return normRef(t.reference_no);
    case "AMOUNT": return t.amount_minor;
    case "CURRENCY": return t.currency;
    case "DATE": return dayOf(t);
    case "ACCOUNT": return last4(t.side === "INTERNAL" ? t.counterparty_account ?? t.account_no : t.account_no);
    case "BATCH": return t.batch_id;
  }
}
const tupleKey = (t: Txn, keys: MatchKey[]) => {
  const v = keys.map((k) => keyValue(t, k));
  return v.some((x) => x === null) ? null : JSON.stringify(v);
};

/** Khoảng cách Levenshtein – dùng cho khoá REF của Fuzzy (mã tham chiếu rút gọn của ví) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Điểm 0..1 cho một cặp theo các khoá của quy tắc. Trung bình đều các khoá – đơn giản, giải thích được cho Kế toán */
export function fuzzyScore(i: Txn, e: Txn, rule: Rule): number {
  const tolPct = (rule.amount_tolerance_pct ?? 0.5) / 100;
  const tolDays = rule.date_tolerance_days ?? 1;
  const parts = rule.match_keys.map((k): number => {
    switch (k) {
      case "AMOUNT": {
        const d = Math.abs(i.amount_minor - e.amount_minor) / Math.max(i.amount_minor, e.amount_minor);
        // Trong dung sai: 0.96..1; ngoài dung sai: giảm dần, về 0 khi lệch gấp 5 lần dung sai
        return d <= tolPct ? 1 - 0.04 * (tolPct ? d / tolPct : 0) : Math.max(0, 0.9 - (d - tolPct) / (tolPct * 4 || 1));
      }
      case "DATE": {
        const dd = Math.abs(Date.parse(dayOf(i)) - Date.parse(dayOf(e))) / 86_400_000;
        return dd <= tolDays ? 1 - 0.02 * dd : Math.max(0, 0.8 - 0.2 * (dd - tolDays));
      }
      case "REF": {
        const a = normRef(i.reference_no), b = normRef(e.reference_no);
        return 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
      }
      default: return keyValue(i, k) !== null && keyValue(i, k) === keyValue(e, k) ? 1 : 0;
    }
  });
  return parts.length ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 1000) / 1000 : 0;
}

/** Phân loại theo điểm (TC-REC-B04): trả về MATCHED / PARTIAL / NONE */
export function classifyFuzzy(scores: number[], threshold: number, gap: number, floor: number): "MATCHED" | "PARTIAL" | "NONE" {
  const [best = 0, second = -1] = [...scores].sort((a, b) => b - a);
  if (best >= threshold) return second >= 0 && best - second < gap ? "PARTIAL" : "MATCHED";
  return best >= floor ? "PARTIAL" : "NONE";
}

/** Subset-sum có giới hạn thời gian (RULE-REC-03, REQ-REC-15). Trả về chỉ số các phần tử, null nếu không có, "TIMEOUT" nếu hết giờ */
export function subsetSum(amounts: number[], target: number, timeoutMs: number): number[] | null | "TIMEOUT" {
  const idx = amounts.map((a, i) => i).sort((x, y) => amounts[y] - amounts[x]);
  const suffix: number[] = new Array(idx.length + 1).fill(0);
  for (let k = idx.length - 1; k >= 0; k--) suffix[k] = suffix[k + 1] + amounts[idx[k]];
  const deadline = performance.now() + timeoutMs;
  let steps = 0;
  const pick: number[] = [];
  const dfs = (k: number, rest: number): boolean | "TIMEOUT" => {
    if (rest === 0) return true;
    if (k === idx.length || rest < 0 || suffix[k] < rest) return false;
    if ((++steps & 1023) === 0 && performance.now() > deadline) return "TIMEOUT";
    pick.push(idx[k]);
    const a = dfs(k + 1, rest - amounts[idx[k]]);
    if (a) return a;
    pick.pop();
    return dfs(k + 1, rest);
  };
  const r = dfs(0, target);
  return r === "TIMEOUT" ? "TIMEOUT" : r ? [...pick] : null;
}

/** Chạy engine cho một tập giao dịch chưa khớp và các quy tắc ACTIVE */
export function runEngine(txns: Txn[], rules: Rule[], opts: EngineOpts): Outcome[] {
  const out: Outcome[] = [];
  const usedExt = new Set<string>();
  const doneInt = new Set<string>();
  const order = { EXACT: 0, N1: 1, FUZZY: 2 } as const;
  const sorted = [...rules].sort((a, b) => order[a.type] - order[b.type] || a.rule_id.localeCompare(b.rule_id));
  // Giao dịch nội bộ chỉ đối soát với kênh của nó (CBS ↔ NAPAS không lẫn với CBS ↔ Visa)
  const internalsOf = (src: string, ch: string) => txns.filter((t) => t.side === "INTERNAL" && t.source === src && (t.channel ?? ch) === ch).sort((a, b) => a.txn_at - b.txn_at);
  const externalsOf = (src: string) => txns.filter((t) => t.side === "EXTERNAL" && t.source === src && !usedExt.has(t.txn_id));
  const sameCcy = (i: Txn, e: Txn) => i.currency === e.currency;

  for (const rule of sorted) {
    const [intSrc, extSrc] = parsePair(rule.source_pair);
    const ints = internalsOf(intSrc, extSrc).filter((t) => !doneInt.has(t.txn_id));
    if (rule.type === "EXACT") {
      const keys: MatchKey[] = rule.match_keys.includes("CURRENCY") ? rule.match_keys : [...rule.match_keys, "CURRENCY"];
      const index = new Map<string, Txn[]>();
      for (const e of externalsOf(extSrc)) { const k = tupleKey(e, keys); if (k) index.set(k, [...(index.get(k) ?? []), e]); }
      for (const i of ints) {
        const k = tupleKey(i, keys);
        const cands = (k && index.get(k)?.filter((e) => !usedExt.has(e.txn_id))) || [];
        if (cands.length === 1) { // nhiều hơn 1 ứng viên tuyệt đối → để Fuzzy/người xử lý quyết định
          out.push({ status: "MATCHED", rule, score: 1, internal: i, external: cands });
          usedExt.add(cands[0].txn_id); doneInt.add(i.txn_id);
        }
      }
    } else if (rule.type === "N1") {
      const maxItems = rule.n1_max_items ?? opts.n1_max_items;
      const timeout = rule.n1_timeout_ms ?? opts.n1_timeout_ms;
      for (const i of ints.filter((t) => t.batch_id)) {
        const batch = externalsOf(extSrc).filter((e) => e.batch_id === i.batch_id && sameCcy(i, e));
        if (!batch.length) continue;
        const total = batch.reduce((s, e) => s + e.amount_minor, 0);
        let picked: Txn[] | null = null;
        let hint: Hint = "N1_SHORT";
        if (total === i.amount_minor) picked = batch;
        else if (batch.length <= maxItems) {
          const r = subsetSum(batch.map((e) => e.amount_minor), i.amount_minor, timeout);
          if (r === "TIMEOUT") hint = "N1_TIMEOUT";
          else if (r) picked = r.map((k) => batch[k]);
        } else hint = "N1_TIMEOUT"; // vượt số phần tử tối đa: không thử tổ hợp, chuyển ngoại lệ ngay
        doneInt.add(i.txn_id);
        batch.forEach((e) => usedExt.add(e.txn_id));
        if (picked) out.push({ status: "MATCHED", rule, score: 1, internal: i, external: picked });
        else out.push({ status: "PARTIAL", rule, score: 0, internal: i, external: batch, diff_minor: Math.abs(i.amount_minor - total), hint });
      }
    } else {
      const threshold = rule.fuzzy_threshold ?? opts.fuzzy_threshold;
      const gap = rule.fuzzy_gap ?? opts.fuzzy_gap;
      for (const i of ints) {
        const scored = externalsOf(extSrc).filter((e) => sameCcy(i, e)).map((e) => ({ e, s: fuzzyScore(i, e, rule) })).sort((a, b) => b.s - a.s);
        const verdict = classifyFuzzy(scored.map((x) => x.s), threshold, gap, opts.partial_floor);
        if (verdict === "NONE") continue;
        const best = scored[0];
        doneInt.add(i.txn_id); usedExt.add(best.e.txn_id);
        if (verdict === "MATCHED") out.push({ status: "MATCHED", rule, score: best.s, internal: i, external: [best.e] });
        else {
          const ambiguous = best.s >= threshold;
          out.push({ status: "PARTIAL", rule, score: best.s, internal: i, external: [best.e], diff_minor: Math.abs(i.amount_minor - best.e.amount_minor), hint: ambiguous ? "AMBIGUOUS" : "AMOUNT_DIFF" });
        }
      }
    }
  }

  // Giao dịch nội bộ còn lại: lặp lại một giao dịch đã khớp trong 10 phút → DUPLICATE, ngược lại UNMATCHED
  const matchedInt = out.filter((o) => o.status === "MATCHED").map((o) => o.internal);
  for (const i of txns.filter((t) => t.side === "INTERNAL" && !doneInt.has(t.txn_id))) {
    const rule = sorted.find((r) => { const [a, b] = parsePair(r.source_pair); return a === i.source && (i.channel ?? b) === b; }) ?? null;
    const twin = matchedInt.find((m) => m.source === i.source && m.amount_minor === i.amount_minor && m.currency === i.currency
      && m.direction === i.direction && last4(m.account_no) === last4(i.account_no) && Math.abs(m.txn_at - i.txn_at) <= 10 * 60_000);
    if (twin) out.push({ status: "DUPLICATE", rule, score: 0, internal: i, external: [], diff_minor: i.amount_minor, hint: "REPEATED" });
    else out.push({ status: "UNMATCHED", rule, score: 0, internal: i, external: [], diff_minor: i.amount_minor, hint: "NO_COUNTERPART" });
  }
  return out;
}

/* ---------- Đề xuất nguyên nhân (BR-REC-05) ----------
   Bản dev dùng luật đơn giản theo ngữ cảnh thay cho mô hình AI; giao diện trả về giữ đúng dạng top-3 {code, label, probability}
   để thay bằng mô hình thật không phải đổi API. Danh mục mã khớp danh mục chuẩn của UI (REQ-REC-01, R02 §7 câu 3). */
export const CAUSE_CATALOGUE = {
  FX_DIFF: { vi: "Chênh lệch tỷ giá", en: "FX difference" },
  UNBOOKED_FEE: { vi: "Phí chưa hạch toán", en: "Unbooked fee" },
  LATE_PARTNER_DATA: { vi: "Dữ liệu đối tác về trễ", en: "Late partner data" },
  WRONG_REFERENCE: { vi: "Sai mã tham chiếu", en: "Wrong reference" },
  DUPLICATE_TXN: { vi: "Giao dịch trùng", en: "Duplicate transaction" },
  REVERSED_TXN: { vi: "Giao dịch bị huỷ / đảo", en: "Reversed transaction" },
  OTHER: { vi: "Khác", en: "Other" },
} as const;
export type CauseCode = keyof typeof CAUSE_CATALOGUE;
export type Cause = { code: CauseCode; vi: string; en: string; probability: number };

export function suggestCauses(hint: Hint, ctx: { fx: boolean; partner: string }): Cause[] {
  const c = (code: CauseCode, probability: number, vi?: string, en?: string): Cause =>
    ({ code, vi: vi ?? CAUSE_CATALOGUE[code].vi, en: en ?? CAUSE_CATALOGUE[code].en, probability });
  switch (hint) {
    case "AMOUNT_DIFF":
      return ctx.fx
        ? [c("FX_DIFF", 78, "Chênh lệch tỷ giá quy đổi USD/VND", "USD/VND conversion difference"), c("UNBOOKED_FEE", 15, "Phí chuyển đổi ngoại tệ chưa hạch toán", "Unbooked FX fee"), c("OTHER", 7, "Làm tròn của tổ chức thẻ", "Card scheme rounding")]
        : [c("UNBOOKED_FEE", 61), c("WRONG_REFERENCE", 24), c("OTHER", 15)];
    case "AMBIGUOUS":
      return [c("DUPLICATE_TXN", 55, "Hai giao dịch đối tác gần giống nhau", "Two near-identical partner records"), c("WRONG_REFERENCE", 30), c("OTHER", 15)];
    case "N1_SHORT":
    case "N1_TIMEOUT":
      return [c("UNBOOKED_FEE", 71, "Thiếu 1 giao dịch phí trong lô", "One fee transaction missing from batch"), c("OTHER", 22, "Phí interchange thay đổi", "Interchange fee changed"), c("LATE_PARTNER_DATA", 7, "Lô bị tách 2 file", "Batch split across two files")];
    case "NO_COUNTERPART":
      return [c("LATE_PARTNER_DATA", 64, `Giao dịch ${ctx.partner} chưa về (T+1)`, `${ctx.partner} record not yet received (T+1)`), c("WRONG_REFERENCE", 24, "Sai mã tham chiếu do nhập tay", "Manually mistyped reference"), c("REVERSED_TXN", 12, "Giao dịch bị huỷ phía ngân hàng nhận", "Reversed by the beneficiary bank")];
    case "REPEATED":
      return [c("DUPLICATE_TXN", 82, "Khách bấm chuyển 2 lần", "Customer submitted twice"), c("OTHER", 18, `${ctx.partner} gửi lại bản ghi`, `${ctx.partner} resent the record`)];
  }
}
