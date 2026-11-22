/* Adapter tới hệ thống ngoài (A01 §2). Bản này là mock theo fixture sandbox;
   thay phần thân hàm bằng HTTP client thật khi có DEP-01→04, giữ nguyên chữ ký. */
import { SANDBOX } from "./personas.ts";
import { clock, type Db } from "./db.ts";

/** Ngắt mạch đơn giản (SCRUM-42): lỗi liên tiếp ≥ threshold → OPEN trong cooldownMs */
export class CircuitBreaker {
  state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  failures = 0;
  openedAt = 0;
  name: string; threshold: number; cooldownMs: number;
  constructor(name: string, threshold = 3, cooldownMs = 30_000) { this.name = name; this.threshold = threshold; this.cooldownMs = cooldownMs; }
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (clock.now() - this.openedAt < this.cooldownMs) throw new AdapterError(this.name, "CIRCUIT_OPEN");
      this.state = "HALF_OPEN";
    }
    try {
      const r = await fn();
      this.state = "CLOSED"; this.failures = 0;
      return r;
    } catch (e) {
      this.failures++;
      if (this.state === "HALF_OPEN" || this.failures >= this.threshold) { this.state = "OPEN"; this.openedAt = clock.now(); }
      throw e;
    }
  }
}

export class AdapterError extends Error {
  system: string; code: "TIMEOUT" | "CIRCUIT_OPEN" | "UNAVAILABLE";
  constructor(system: string, code: "TIMEOUT" | "CIRCUIT_OPEN" | "UNAVAILABLE") { super(`${system}: ${code}`); this.system = system; this.code = code; }
}

export const breakers = { cic: new CircuitBreaker("CIC"), aml: new CircuitBreaker("AML"), cbs: new CircuitBreaker("CBS") };

export type CicResult = { group: number; score: number };
export async function cicLookup(idNumber: string): Promise<CicResult> {
  return breakers.cic.call(async () => {
    const f = SANDBOX[idNumber];
    if (f?.cic_timeout) throw new AdapterError("CIC", "TIMEOUT");
    const group = f?.cic_group ?? 1;
    return { group, score: [0, 10, 30, 55, 80, 95][group] };
  });
}

export type AmlResult = { pep: boolean; sanction: boolean; hits: number };
export async function amlScreen(idNumber: string): Promise<AmlResult> {
  return breakers.aml.call(async () => {
    const f = SANDBOX[idNumber];
    return { pep: !!f?.pep, sanction: !!f?.sanction, hits: Number(!!f?.pep) + Number(!!f?.sanction) };
  });
}

/** Điểm rủi ro tổng hợp 0–100 (thay bằng risk engine thật) */
export function riskScore(idNumber: string, cic: CicResult | null, aml: AmlResult): number {
  const f = SANDBOX[idNumber];
  if (f?.risk != null) return f.risk;
  let r = 18 + (cic ? cic.score * 0.6 : 15);
  if (aml.pep) r += 20;
  if (aml.sanction) r += 40;
  return Math.min(100, Math.round(r * 10) / 10);
}

/** Tra khách hàng hiện hữu ở Core Banking (C04). Số CCCD kết thúc 0000 mô phỏng CBS lỗi. */
export async function cbsLookup(db: Db, idHash: string, idNumber: string) {
  if (idNumber.endsWith("0000")) throw new AdapterError("CBS", "UNAVAILABLE");
  return db.get<{ full_name: string; dob: string; account_no: string; status: string }>(
    "SELECT full_name, dob, account_no, status FROM customers WHERE id_number_hash = ?", idHash);
}

/** Tạo tài khoản – idempotent theo idempotency_key (TC2-1, SIT-09) */
export function cbsCreateAccount(db: Db, idempotencyKey: string): string {
  const existing = db.get<{ account_no: string }>("SELECT account_no FROM cbs_accounts WHERE idempotency_key = ?", idempotencyKey);
  if (existing) return existing.account_no;
  const n = (db.get<{ n: number }>("SELECT COUNT(*) AS n FROM cbs_accounts")?.n ?? 0) + 1;
  const accountNo = "1903" + String(66880000 + n).padStart(8, "0");
  db.run("INSERT INTO cbs_accounts (idempotency_key, account_no, created_at) VALUES (?, ?, ?)", idempotencyKey, accountNo, clock.now());
  return accountNo;
}

/** Notification Service mock: số 0900000000 luôn gửi lỗi để test retry / dead-letter (C08) */
export function sendNotification(recipient: string | null): boolean {
  return recipient !== "0900000000";
}
