import { Db, clock } from "../src/db.ts";
import { RecService } from "../src/service.ts";
import { seed } from "../src/seed.ts";

export const T0 = Date.parse("2026-11-26T03:00:00Z");

/** Dịch vụ mới với DB trong bộ nhớ; seed = true nạp bộ dữ liệu mẫu (đi qua luồng thật) */
export function setup(withSeed = true) {
  clock.set(T0);
  const svc = new RecService(new Db());
  if (withSeed) seed(svc);
  else for (const [id, name, role] of [["u-nam", "Lê Hoàng Nam", "REC_OFFICER"], ["u-trang", "Phạm Thu Trang", "REC_CHECKER"], ["u-quan", "Đỗ Minh Quân", "REC_LEAD"], ["u-ha", "Vũ Thanh Hà", "FIN_VIEWER"]])
    svc.db.run("INSERT INTO staff(id, name, role) VALUES(?,?,?)", id, name, role);
  return svc;
}
export const who = (svc: RecService, id: "u-nam" | "u-trang" | "u-quan" | "u-ha") => svc.staff(id);

/** Lỗi nghiệp vụ có đúng mã không – dùng với assert.throws */
export const code = (c: string) => (e: any) => e?.code === c;

export const csv = (rows: Record<string, unknown>[]) => {
  const cols = ["reference_no", "amount", "currency", "direction", "txn_at", "account_no", "counterparty_account", "batch_id", "channel"];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => r[c] ?? "").join(","))].join("\n");
};
export const caseByRef = (svc: RecService, ref: string) => svc.exceptions({ status: "all" }).find((c) => c.internal?.reference_no === ref)!;
export const lines = (amount: string, debit = "1131.01", credit = "4211.01") => [
  { side: "DEBIT", account_code: debit, amount }, { side: "CREDIT", account_code: credit, amount },
];
