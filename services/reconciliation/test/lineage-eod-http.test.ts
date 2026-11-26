/* Truy vết (TC-REC-B08), sự kiện + EOD (TC-REC-B09), báo cáo, cấu hình, HTTP (Idempotency-Key, lỗi, CSV) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp as createRaw, type Security } from "../src/http.ts";
import type { RecService } from "../src/service.ts";
import type { Db } from "../src/db.ts";
/** App như production nhưng tự gắn header Gateway cho test – trừ khi test muốn kiểm việc thiếu header */
const SECRET = "test-gateway-secret";
const createApp = (svc: RecService, opts: { dev?: boolean; resetDb?: () => Db; security?: Security } = {}) => {
  const app = createRaw(svc, { security: { gatewaySecret: SECRET, allowedOrigins: ["https://ops.aegis.example"] }, ...opts });
  return { ...app, handle: (req: any, res: any) => { if (!req.noGateway) req.headers["x-gateway-auth"] = SECRET; return app.handle(req, res); } };
};
import { setup, who, code, caseByRef } from "./helpers.ts";

test("TC-REC-B08: truy vết theo entry_id, case_id, txn_id trả đủ chuỗi 4 bước", () => {
  const svc = setup();
  const c = caseByRef(svc, "FT2611094410");
  for (const q of [{ entry_id: c.pending_entry!.entry_id }, { case_id: c.case_id }, { txn_id: "FT2611094410" }]) {
    const l = svc.lineage(q);
    assert.deepEqual(l.chain.map((s) => s.step), ["SOURCE_TRANSACTION", "MATCH_RESULT", "EXCEPTION_CASE", "GL_ENTRY"]);
    assert.equal(l.chain[0].ref, "FT2611094410");
    assert.equal(l.chain[1].note, "Không tìm thấy đối ứng");
    assert.equal(l.chain[2].id, c.case_id);
    assert.equal(l.chain[3].id, c.pending_entry!.entry_id);
    assert.ok(l.integrity.ok);
  }
  const auto = svc.entries({}).find((g) => g.match_id && !g.case_id)!;
  const la = svc.lineage({ entry_id: auto.entry_id });
  assert.equal(la.chain[2].note, "Khớp tự động, không có ngoại lệ");
  assert.match(String(la.chain[1].note), /IPM-77801/);
});

test("TC-REC-B08: bản ghi mồ côi (thiếu khoá liên kết) bị báo trong integrity.orphans", () => {
  const svc = setup();
  const c = caseByRef(svc, "FT2611094410");
  svc.db.raw.exec("PRAGMA foreign_keys = OFF");
  svc.db.run("DELETE FROM match_items WHERE match_id = (SELECT match_id FROM exception_cases WHERE case_id = ?)", c.case_id);
  const l = svc.lineage({ case_id: c.case_id });
  assert.equal(l.integrity.ok, false);
  assert.match(l.integrity.orphans.join(" "), /không có giao dịch/);
  assert.throws(() => svc.lineage({}), code("VALIDATION"));
});

const ev = (id: string, data: Record<string, unknown>) => ({ messageId: id, data: { card_id: "C-01", currency: "VND", processed_at: Date.parse("2026-11-26T03:00:00Z"), ...data } });

test("TC-REC-B09: gửi lại cùng messageId → 0 bút toán trùng; REVERSED đảo đúng bút toán gốc", () => {
  const svc = setup();
  const n0 = svc.entries({}).length;
  const a = svc.consumeLimitEvent(ev("m-1", { auth_id: "AUTH-1", amount: "1500000.00", result: "APPROVE" }));
  assert.equal(a.status, "PROCESSED");
  assert.equal(svc.consumeLimitEvent(ev("m-1", { auth_id: "AUTH-1", amount: "1500000.00", result: "APPROVE" })).status, "DUPLICATE");
  assert.equal(svc.consumeLimitEvent(ev("m-2", { auth_id: "AUTH-2", amount: "200000.00", result: "DECLINE" })).entry_id, null);
  const r = svc.consumeLimitEvent(ev("m-3", { auth_id: "AUTH-1", amount: "1500000.00", result: "REVERSED" }));
  assert.equal(svc.entry(r.entry_id!).reversal_of, a.entry_id);
  assert.equal(svc.entries({}).length, n0 + 2);
  const bad = svc.consumeLimitEvent(ev("m-4", { amount: "1.00", result: "APPROVE" }));
  assert.equal(bad.status, "FAILED");
  assert.equal(bad.ack, true, "luôn ack để Pub/Sub không gửi lại vô hạn; lỗi nằm ở inbound_events");
});

test("TC-REC-B09: EOD – khớp đủ thì 0 lệch; thiếu / thừa / lệch số đều có người phụ trách", () => {
  const svc = setup();
  const date = "2026-11-26";
  svc.consumeLimitEvent(ev("e-1", { auth_id: "A-1", amount: "1000000.00", result: "APPROVE" }));
  svc.consumeLimitEvent(ev("e-2", { auth_id: "A-2", amount: "2000000.00", result: "APPROVE" }));
  svc.loadLimitLedger([{ auth_id: "A-1", business_date: date, amount: "1000000.00", result: "APPROVE" }, { auth_id: "A-2", business_date: date, amount: "2000000.00", result: "APPROVE" }]);
  assert.equal(svc.runEod(date).diff_count, 0);

  svc.consumeLimitEvent(ev("e-3", { auth_id: "A-3", amount: "500000.00", result: "APPROVE" }));          // có GL, không có ledger
  svc.loadLimitLedger([{ auth_id: "A-4", business_date: date, amount: "700000.00", result: "APPROVE" },    // có ledger, không có GL
    { auth_id: "A-2", business_date: date, amount: "2100000.00", result: "APPROVE" }]);                      // lệch số
  const run = svc.runEod(date);
  assert.deepEqual(run.diffs.map((d: any) => [d.auth_id, d.diff_type]).sort(), [["A-2", "AMOUNT_MISMATCH"], ["A-3", "MISSING_LEDGER"], ["A-4", "MISSING_GL"]]);
  assert.ok(run.diffs.every((d: any) => d.owner_id), "mọi dòng lệch có người phụ trách (REQ-REC-20)");
  assert.throws(() => svc.assignDiff(who(svc, "u-nam"), run.run_id, run.diffs[0].diff_id, "u-nam"), code("FORBIDDEN"));
  assert.equal(svc.assignDiff(who(svc, "u-quan"), run.run_id, run.diffs[0].diff_id, "u-nam")!.owner_id, "u-nam");
  assert.throws(() => svc.assignDiff(who(svc, "u-quan"), run.run_id, run.diffs[0].diff_id, "u-ha"), code("VALIDATION"));
});

test("Báo cáo KPI: lọc theo nguồn và loại quy tắc; CSV cùng số (REQ-REC-17)", () => {
  const svc = setup();
  const all = svc.kpi({});
  assert.equal(all.open_exceptions, 5);
  assert.equal(all.auto_match_rate, 62.5);
  const visa = svc.kpi({ source: "VISA" });
  assert.equal(visa.auto_match_rate, 0);
  const n1 = svc.kpi({ rule_type: "N1" });
  assert.equal(n1.auto_match_rate, 50);
  assert.match(svc.kpiCsv({ source: "VISA" }), /Tỷ lệ khớp tự động \(%\);0/);
  assert.ok(svc.causes({}).some((c) => c.code === "FX_DIFF" && c.count === 2));
});

test("Cấu hình qua Maker-Checker: ngoài giới hạn bị chặn, người đề xuất không tự duyệt", () => {
  const svc = setup();
  const quan = who(svc, "u-quan"), ha = who(svc, "u-ha");
  assert.throws(() => svc.requestConfigChange(who(svc, "u-trang"), { key: "gl_threshold_minor", value: 1, reason: "Thử đổi ngưỡng" }), code("FORBIDDEN"));
  assert.throws(() => svc.requestConfigChange(quan, { key: "gl_threshold_minor", value: 1, reason: "Thử đổi ngưỡng" }), code("OUT_OF_RANGE"));
  const ch = svc.requestConfigChange(quan, { key: "gl_threshold_minor", value: 100_000_000_00, reason: "CR-002 đã được duyệt" })!;
  assert.throws(() => svc.decideConfigChange(quan, ch.id, true), code("SOD_MAKER_SAME"));
  svc.decideConfigChange(ha, ch.id, true);
  assert.equal(svc.cfg().gl_threshold_minor, 100_000_000_00);
});

/* ---------- HTTP ---------- */

async function call(app: ReturnType<typeof createApp>, method: string, path: string, opt: { staff?: string; body?: unknown; idem?: string; noGateway?: boolean; origin?: string } = {}) {
  const { PassThrough } = await import("node:stream");
  const req: any = new PassThrough();
  req.method = method; req.url = `/api/v1/rec${path}`;
  req.headers = { ...(opt.staff ? { "x-staff-id": opt.staff } : {}), ...(opt.idem ? { "idempotency-key": opt.idem } : {}), ...(opt.origin ? { origin: opt.origin } : {}) };
  req.noGateway = opt.noGateway;
  req.end(opt.body === undefined ? undefined : JSON.stringify(opt.body));
  const res: any = { status: 0, headers: {} as Record<string, string>, body: "",
    setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; },
    writeHead(s: number, h: Record<string, string> = {}) { this.status = s; for (const [k, v] of Object.entries(h)) this.headers[k.toLowerCase()] = v; },
    end(b?: string) { this.body = b ?? ""; } };
  await app.handle(req, res);
  const json = res.headers["content-type"]?.startsWith("application/json") ? JSON.parse(res.body) : res.body;
  return { status: res.status, headers: res.headers, body: json };
}

test("HTTP: thiếu danh tính → 401; API không có → 404; lỗi đúng dạng { error: { code, message } }", async () => {
  const app = createApp(setup());
  assert.equal((await call(app, "GET", "/exceptions")).status, 401);
  assert.equal((await call(app, "GET", "/nope", { staff: "u-nam" })).status, 404);
  const r = await call(app, "POST", "/gl-entries/GL-90311/approve", { staff: "u-quan" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "SOD_RULE_CREATOR");
  assert.equal((await call(app, "GET", "/health")).body.service, "reconciliation-service");
});

test("HTTP: Idempotency-Key – gọi lại trả đúng kết quả lần đầu, không tạo bản ghi mới", async () => {
  const svc = setup();
  const app = createApp(svc);
  const body = { name: "Quy tắc thử HTTP", type: "EXACT", source_pair: "CBS↔NAPAS", match_keys: ["REF"] };
  const a = await call(app, "POST", "/rules", { staff: "u-nam", body, idem: "k-1" });
  const b = await call(app, "POST", "/rules", { staff: "u-nam", body, idem: "k-1" });
  assert.equal(a.status, 200);
  assert.deepEqual(b.body, a.body);
  assert.equal(b.headers["idempotent-replay"], "true");
  assert.equal(svc.db.get("SELECT count(*) n FROM matching_rules WHERE name = ?", body.name)!.n, 1);
  const c = await call(app, "POST", "/rules", { staff: "u-nam", body, idem: "k-2" });
  assert.notEqual(c.body.rule_id, a.body.rule_id);
});

test("HTTP: luồng đầy đủ qua API – nhận, hạch toán > ngưỡng, Checker duyệt, truy vết", async () => {
  const app = createApp(setup());
  const list = (await call(app, "GET", "/exceptions?status=open", { staff: "u-nam" })).body;
  const mc = list.find((c: any) => c.source_pair === "CBS↔MASTERCARD");
  assert.equal((await call(app, "POST", `/exceptions/${mc.case_id}/claim`, { staff: "u-nam" })).body.status, "IN_PROGRESS");
  const res = await call(app, "POST", `/exceptions/${mc.case_id}/resolution`, { staff: "u-nam", body: {
    root_cause: { code: "UNBOOKED_FEE" }, type: "ADJUSTMENT", adjustment: { memo: "Phí interchange chưa hạch toán", lines: [
      { side: "DEBIT", account_code: "6311.02", amount: "18000.00" }, { side: "CREDIT", account_code: "1131.02", amount: "18000.00" }] } } });
  assert.equal(res.status, 200);
  assert.equal(res.body.entry.status, "POSTED");
  const lin = await call(app, "GET", `/lineage?case_id=${mc.case_id}`, { staff: "u-ha" });
  assert.equal(lin.body.chain[3].id, res.body.entry.entry_id);
  const csv = await call(app, "GET", "/reports/kpi/export", { staff: "u-ha" });
  assert.match(csv.headers["content-type"], /text\/csv/);
  assert.match(csv.body, /Chỉ số;Giá trị/);
});

test("HTTP: endpoint dev chỉ mở khi dev = true", async () => {
  const svc = setup();
  assert.equal((await call(createApp(svc), "POST", "/dev/match", { staff: "u-quan" })).status, 404);
  assert.equal((await call(createApp(svc, { dev: true }), "POST", "/dev/match")).status, 200);
});

test("Bảo mật production: thiếu bí mật Gateway → 401 dù có x-staff-id; CORS chỉ cho origin trong danh sách", async () => {
  const svc = setup();
  assert.throws(() => createRaw(svc, {}), /GATEWAY_SHARED_SECRET/, "không khởi động production khi thiếu cấu hình");
  const app = createApp(svc);
  const forged = await call(app, "POST", "/gl-entries/GL-90311/approve", { staff: "u-trang", noGateway: true });
  assert.equal(forged.status, 401);
  assert.equal(svc.entry("GL-90311").status, "PENDING", "không ai giả danh Checker được");
  assert.equal((await call(app, "GET", "/health", { noGateway: true })).status, 200);
  const good = await call(app, "GET", "/me", { staff: "u-ha", origin: "https://ops.aegis.example" });
  assert.equal(good.headers["access-control-allow-origin"], "https://ops.aegis.example");
  const evil = await call(app, "GET", "/me", { staff: "u-ha", origin: "https://evil.example" });
  assert.equal(evil.headers["access-control-allow-origin"], undefined);
});
