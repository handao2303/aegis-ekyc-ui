/* REST API /api/v1/rec (R05 §5). Xác thực bản dev: header x-staff-id thay cho SSO ở API Gateway.
   Mọi POST nhận Idempotency-Key: gọi lại cùng khoá (cùng người, cùng đường dẫn) trả đúng kết quả lần đầu (R05 §1). */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ApiError } from "./errors.ts";
import { clock, H, type Db } from "./db.ts";
import type { RecService, Staff } from "./service.ts";
import { runJobs } from "./jobs.ts";
import { seed } from "./seed.ts";

type Ctx = { params: Record<string, string>; query: URLSearchParams; body: any; me: () => Staff };
type Out = unknown | { __raw: string; type: string; filename?: string };
type Handler = (c: Ctx) => Out;

const BASE = "/api/v1/rec";
const ms = (v: string | null) => (v ? (/^\d+$/.test(v) ? Number(v) : Date.parse(v)) : undefined);

/** Production: danh tính chỉ tin khi yêu cầu đi qua API Gateway (header bí mật dùng chung); CORS theo danh sách cho phép.
    Dev: tin header x-staff-id như ekyc-service để chạy thử nhanh. */
export type Security = { gatewaySecret?: string; allowedOrigins?: string[] };

export function createApp(svc: RecService, opts: { dev?: boolean; resetDb?: () => Db; security?: Security } = {}) {
  if (!opts.dev && !opts.security?.gatewaySecret) throw new Error("Production cần GATEWAY_SHARED_SECRET – không chạy với danh tính từ header tự khai");
  const routes: { method: string; re: RegExp; keys: string[]; h: Handler; path: string }[] = [];
  const route = (method: "GET" | "POST", path: string, h: Handler) => {
    const keys: string[] = [];
    const re = new RegExp("^" + (BASE + path).replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    routes.push({ method, re, keys, h, path });
  };

  route("GET", "/health", () => ({ ok: true, service: "reconciliation-service", time: new Date(clock.now()).toISOString() }));
  route("GET", "/meta", () => ({ ...svc.meta(), dev: !!opts.dev }));
  route("GET", "/me", (c) => c.me());

  // §5.1 Nguồn và lô file
  route("GET", "/sources", (c) => { c.me(); return svc.sources(); });
  route("GET", "/files", (c) => svc.files(c.me(), { status: c.query.get("status"), source: c.query.get("source") }));
  route("GET", "/files/:id", (c) => svc.file(c.me(), c.params.id));
  route("POST", "/files/:id/reload", (c) => svc.reloadFile(c.me(), c.params.id, c.body));

  // §5.2 Quy tắc
  route("GET", "/rules", (c) => { c.me(); return svc.rules(c.query.get("status")); });
  route("GET", "/rules/:id", (c) => { c.me(); return svc.rule(c.params.id); });
  route("POST", "/rules", (c) => svc.createRule(c.me(), c.body));
  route("POST", "/rules/:id/submit", (c) => svc.submitRule(c.me(), c.params.id, c.body));
  route("POST", "/rules/:id/approve", (c) => svc.decideRule(c.me(), c.params.id, true));
  route("POST", "/rules/:id/reject", (c) => svc.decideRule(c.me(), c.params.id, false, c.body?.reason));
  route("POST", "/rules/:id/versions", (c) => svc.newRuleVersion(c.me(), c.params.id, c.body));
  route("POST", "/rules/:id/retire", (c) => svc.retireRule(c.me(), c.params.id, c.body));
  route("POST", "/rules/:id/copy", (c) => svc.copyRule(c.me(), c.params.id));

  // §5.3 Ngoại lệ
  route("GET", "/exceptions", (c) => { c.me(); return svc.exceptions({ status: c.query.get("status"), kind: c.query.get("kind"), source: c.query.get("source"), q: c.query.get("q") }); });
  route("GET", "/exceptions/:id", (c) => svc.exception(c.me(), c.params.id, c.query.get("unmask") === "1"));
  route("POST", "/exceptions/:id/claim", (c) => svc.claim(c.me(), c.params.id));
  route("POST", "/exceptions/:id/release", (c) => svc.release(c.me(), c.params.id));
  route("POST", "/exceptions/:id/escalate", (c) => svc.escalate(c.me(), c.params.id, c.body?.reason));
  route("POST", "/exceptions/:id/resolution", (c) => svc.resolve(c.me(), c.params.id, c.body));

  // §5.4 Bút toán
  route("GET", "/gl-entries", (c) => { c.me(); return svc.entries({ status: c.query.get("status"), mode: c.query.get("mode") }); });
  route("GET", "/gl-entries/:id", (c) => { c.me(); return svc.entry(c.params.id); });
  route("POST", "/gl-entries/:id/approve", (c) => svc.approveEntry(c.me(), c.params.id));
  route("POST", "/gl-entries/:id/return", (c) => svc.returnOrReject(c.me(), c.params.id, "return", c.body?.note));
  route("POST", "/gl-entries/:id/reject", (c) => svc.returnOrReject(c.me(), c.params.id, "reject", c.body?.reason));
  route("POST", "/gl-entries/:id/resubmit", (c) => svc.resubmitEntry(c.me(), c.params.id, c.body ?? {}));
  route("POST", "/gl-entries/:id/escalate", (c) => svc.escalateEntry(c.me(), c.params.id, c.body ?? {}));
  route("POST", "/gl-entries/:id/reverse", (c) => svc.reverseEntry(c.me(), c.params.id, c.body?.reason));

  // §5.5 – 5.7
  route("GET", "/lineage", (c) => { c.me(); return svc.lineage({ entry_id: c.query.get("entry_id"), case_id: c.query.get("case_id"), txn_id: c.query.get("txn_id") }); });
  const kq = (c: Ctx) => ({ from: ms(c.query.get("from")), to: ms(c.query.get("to")), source: c.query.get("source"), rule_type: c.query.get("rule_type") });
  route("GET", "/reports/kpi", (c) => { c.me(); return svc.kpi(kq(c)); });
  route("GET", "/reports/kpi/export", (c) => { c.me(); return { __raw: svc.kpiCsv(kq(c)), type: "text/csv; charset=utf-8", filename: "rec-kpi.csv" }; });
  route("GET", "/reports/causes", (c) => { c.me(); return svc.causes({ from: ms(c.query.get("from")), to: ms(c.query.get("to")) }); });
  route("GET", "/eod-runs", (c) => { c.me(); return svc.eodRuns(c.query.get("business_date")); });
  route("GET", "/eod-runs/:id", (c) => { c.me(); return svc.eodRun(c.params.id); });
  route("GET", "/eod-runs/:id/diffs", (c) => { c.me(); return svc.eodDiffs(c.params.id, c.query.get("status")); });
  route("POST", "/eod-runs/:id/diffs/:did/assign", (c) => svc.assignDiff(c.me(), c.params.id, c.params.did, c.body?.owner_id));

  // Cấu hình (Maker-Checker)
  route("GET", "/config", (c) => { c.me(); return svc.configView(); });
  route("POST", "/config/changes", (c) => svc.requestConfigChange(c.me(), c.body));
  route("POST", "/config/changes/:cid/approve", (c) => svc.decideConfigChange(c.me(), Number(c.params.cid), true));
  route("POST", "/config/changes/:cid/reject", (c) => svc.decideConfigChange(c.me(), Number(c.params.cid), false));

  // Chỉ môi trường dev: thay SFTP watcher, Pub/Sub push, Cloud Scheduler
  if (opts.dev) {
    route("POST", "/dev/ingest", (c) => svc.ingestFile(c.body));
    route("POST", "/dev/match", () => svc.runMatching());
    route("POST", "/dev/events/limit", (c) => svc.consumeLimitEvent(c.body));
    route("POST", "/dev/limit-ledger", (c) => svc.loadLimitLedger(c.body?.rows ?? []));
    route("POST", "/dev/eod", (c) => svc.runEod(String(c.body?.business_date ?? "")));
    route("POST", "/dev/jobs/run", () => runJobs(svc));
    route("POST", "/dev/clock/advance", (c) => { clock.advance(Number(c.body?.hours ?? 1) * H); return { now: new Date(clock.now()).toISOString(), jobs: runJobs(svc) }; });
    route("GET", "/dev/audit", () => svc.db.all("SELECT * FROM audit_event ORDER BY id DESC LIMIT 200"));
    route("GET", "/dev/events", () => svc.db.all("SELECT * FROM events ORDER BY id DESC LIMIT 200"));
    route("POST", "/dev/reset", () => {
      if (!opts.resetDb) throw new ApiError(400, "UNSUPPORTED", "Không hỗ trợ đặt lại");
      clock.reset();
      svc.db = opts.resetDb();
      seed(svc);
      return { ok: true };
    });
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    const allowed = opts.dev ? origin ?? "*" : origin && opts.security?.allowedOrigins?.includes(origin) ? origin : null;
    if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-staff-id, idempotency-key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const url = new URL(req.url ?? "/", "http://localhost");
    const started = performance.now();
    try {
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new ApiError(404, "NOT_FOUND", "Không có API này");
      const m = url.pathname.match(r.re)!;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const body = req.method === "POST" ? await readJson(req) : undefined;
      const staffId = header(req, "x-staff-id");
      // Không có bí mật của Gateway → coi như chưa xác thực, kể cả khi có x-staff-id (chống giả danh người duyệt)
      if (!opts.dev && r.path !== "/health" && header(req, "x-gateway-auth") !== opts.security!.gatewaySecret)
        throw new ApiError(401, "UNAUTHENTICATED", "Yêu cầu phải đi qua API Gateway");
      const me = () => svc.staff(staffId);
      const idemKey = req.method === "POST" ? header(req, "idempotency-key") : undefined;
      if (idemKey) {
        const hit = svc.db.get("SELECT status, response FROM idempotency WHERE key = ? AND actor_id = ? AND route = ?", idemKey, staffId ?? "-", url.pathname);
        if (hit) { res.setHeader("Idempotent-Replay", "true"); return sendJson(res, hit.status, JSON.parse(hit.response)); }
      }
      const out = r.h({ params, query: url.searchParams, body, me }) ?? { ok: true };
      if (out && typeof out === "object" && "__raw" in out) {
        const o = out as { __raw: string; type: string; filename?: string };
        res.writeHead(200, { "content-type": o.type, "cache-control": "no-store", ...(o.filename ? { "content-disposition": `attachment; filename="${o.filename}"` } : {}) });
        return res.end(o.__raw);
      }
      if (idemKey) svc.db.run("INSERT OR IGNORE INTO idempotency(key, actor_id, route, status, response, created_at) VALUES(?,?,?,?,?,?)",
        idemKey, staffId ?? "-", url.pathname, 200, JSON.stringify(out), clock.now());
      sendJson(res, 200, out);
    } catch (e) {
      if (e instanceof ApiError) sendJson(res, e.status, { error: { code: e.code, message: e.message, ...e.extra } });
      else if (/UNIQUE constraint failed: gl_entries\.case_id/.test(String((e as Error).message))) // chốt chặn cuối: unique index một phần
        sendJson(res, 409, { error: { code: "ADJUSTMENT_PENDING", message: "Ngoại lệ đã có bút toán đang chờ Checker" } });
      else { console.error(e); sendJson(res, 500, { error: { code: "INTERNAL", message: "Lỗi hệ thống" } }); }
    } finally {
      if (process.env.LOG !== "0") console.log(`${req.method} ${url.pathname} ${res.statusCode} ${(performance.now() - started).toFixed(1)}ms`);
    }
  }
  return { handle, routes, server: () => createServer((req, res) => void handle(req, res)) };
}

const header = (req: IncomingMessage, k: string) => { const v = req.headers[k]; return Array.isArray(v) ? v[0] : v; };
function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readJson(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const ch of req) { size += ch.length; if (size > 1_000_000) throw new ApiError(413, "TOO_LARGE", "Dữ liệu quá lớn"); chunks.push(ch as Buffer); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ApiError(400, "BAD_JSON", "JSON không hợp lệ"); }
}
