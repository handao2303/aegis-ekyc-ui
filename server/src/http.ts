/* REST API (A01 §3, C06, C07, C10). Xác thực bản dev:
   - Khách: header x-session-token (cấp khi tạo phiên)
   - Nhân viên: header x-staff-id (thay cho SSO/OAuth2 ở API Gateway) */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ApiError, type EkycService } from "./service.ts";
import { runJobs } from "./jobs.ts";
import { clock, H, type Db } from "./db.ts";
import { seed } from "./seed.ts";

type Ctx = { req: IncomingMessage; params: Record<string, string>; query: URLSearchParams; body: any; token?: string; staffId?: string };
type Handler = (c: Ctx) => unknown | Promise<unknown>;

export function createApp(svc: EkycService, opts: { dev?: boolean; resetDb?: () => Db } = {}) {
  const routes: { method: string; re: RegExp; keys: string[]; h: Handler }[] = [];
  const route = (method: string, path: string, h: Handler) => {
    const keys: string[] = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    routes.push({ method, re, keys, h });
  };
  const staff = (c: Ctx) => svc.staff(c.staffId);

  route("GET", "/health", () => ({ ok: true, service: "ekyc-service", time: new Date(clock.now()).toISOString() }));
  route("GET", "/api/meta", () => ({ terms_version: svc.cfg().terms_version, staff: svc.db.all("SELECT id, name, role FROM staff ORDER BY role, name"), dev: !!opts.dev }));

  // ---- Khách hàng ----
  route("POST", "/api/sessions", (c) => svc.createSession(c.body));
  route("GET", "/api/sessions/resume", (c) => svc.findResumable(c.query.get("device_id") ?? "") ?? { session_id: null });
  route("GET", "/api/sessions/:id", (c) => { svc.sessionForToken(c.params.id, c.token); return svc.result(c.params.id); });
  route("POST", "/api/sessions/:id/consent", (c) => svc.consent(c.params.id, c.token!, c.body));
  route("POST", "/api/sessions/:id/capture-failures", (c) => svc.captureFailure(c.params.id, c.token!));
  route("POST", "/api/sessions/:id/document", (c) => svc.submitDocument(c.params.id, c.token!, c.body));
  route("POST", "/api/sessions/:id/chip", (c) => svc.submitChip(c.params.id, c.token!, c.body));
  route("POST", "/api/sessions/:id/liveness", (c) => svc.submitLiveness(c.params.id, c.token!, c.body));
  route("POST", "/api/sessions/:id/resume", (c) => svc.resume(c.params.id, c.token!));
  route("POST", "/api/sessions/:id/cancel", (c) => svc.cancel(c.params.id, c.token!));
  route("POST", "/api/sessions/:id/consents/withdraw", (c) => svc.withdrawConsent(c.params.id, c.token!, c.body?.scope));
  route("GET", "/api/sessions/:id/notifications", (c) => svc.customerNotifications(c.params.id, c.token!));
  route("POST", "/api/sessions/:id/info-request/submit", (c) => svc.submitInfo(c.params.id, c.token!, c.body));

  // ---- Compliance ----
  route("GET", "/api/me", (c) => staff(c));
  route("GET", "/api/cases", (c) => svc.listCases(staff(c), c.query.get("view") ?? "queue"));
  route("GET", "/api/cases/:id", (c) => svc.caseDetail(c.params.id, staff(c), { pii: c.query.get("pii") === "1" }));
  route("POST", "/api/cases/:id/claim", (c) => svc.claim(c.params.id, staff(c)));
  route("POST", "/api/cases/:id/release", (c) => svc.release(c.params.id, staff(c)));
  route("POST", "/api/cases/:id/info-requests", (c) => svc.requestInfo(c.params.id, staff(c), c.body));
  route("POST", "/api/cases/:id/decision", (c) => svc.makerDecision(c.params.id, staff(c), c.body));
  route("POST", "/api/cases/:id/checker", (c) => svc.checkerDecision(c.params.id, staff(c), c.body));
  route("POST", "/api/cases/:id/cic-retry", (c) => svc.retryCic(c.params.id, staff(c)));
  route("GET", "/api/config", (c) => { staff(c); return svc.configView(); });
  route("POST", "/api/config/changes", (c) => svc.requestConfigChange(staff(c), c.body));
  route("POST", "/api/config/changes/:cid/approve", (c) => svc.decideConfigChange(staff(c), Number(c.params.cid), true));
  route("POST", "/api/config/changes/:cid/reject", (c) => svc.decideConfigChange(staff(c), Number(c.params.cid), false));
  route("GET", "/api/reports/sla", (c) => { const s = staff(c); if (s.role === "CS") throw new ApiError(403, "FORBIDDEN", "Không đủ quyền"); return svc.slaReport(Number(c.query.get("days") ?? 7)); });
  route("GET", "/api/reports/kpi", (c) => { const s = staff(c); if (s.role === "CS") throw new ApiError(403, "FORBIDDEN", "Không đủ quyền"); return svc.kpi(Number(c.query.get("days") ?? 30)); });

  // ---- Chỉ môi trường dev: chạy job, tua đồng hồ, đặt lại dữ liệu ----
  if (opts.dev) {
    route("POST", "/api/dev/jobs/run", () => runJobs(svc));
    route("POST", "/api/dev/clock/advance", (c) => { clock.advance(Number(c.body?.hours ?? 1) * H); return { now: new Date(clock.now()).toISOString(), jobs: runJobs(svc) }; });
    route("POST", "/api/dev/reset", () => {
      if (!opts.resetDb) throw new ApiError(400, "UNSUPPORTED", "Không hỗ trợ đặt lại");
      clock.reset();
      svc.db = opts.resetDb();
      seed(svc);
      return { ok: true };
    });
    route("GET", "/api/dev/notifications", () => svc.db.all("SELECT * FROM notifications ORDER BY id DESC LIMIT 100"));
    route("GET", "/api/dev/events", () => svc.db.all("SELECT * FROM events ORDER BY id DESC LIMIT 100"));
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-session-token, x-staff-id");
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
      const out = await r.h({
        req, params, query: url.searchParams, body,
        token: header(req, "x-session-token"), staffId: header(req, "x-staff-id"),
      });
      send(res, 200, out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) send(res, e.status, { error: { code: e.code, message: e.message, ...e.extra } });
      else { console.error(e); send(res, 500, { error: { code: "INTERNAL", message: "Lỗi hệ thống" } }); }
    } finally {
      if (process.env.LOG !== "0") console.log(`${req.method} ${url.pathname} ${res.statusCode} ${(performance.now() - started).toFixed(1)}ms`);
    }
  }
  return { handle, server: () => createServer((req, res) => void handle(req, res)) };
}

const header = (req: IncomingMessage, k: string) => { const v = req.headers[k]; return Array.isArray(v) ? v[0] : v; };
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function readJson(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const ch of req) { size += ch.length; if (size > 1_000_000) throw new ApiError(413, "TOO_LARGE", "Dữ liệu quá lớn"); chunks.push(ch as Buffer); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ApiError(400, "BAD_JSON", "JSON không hợp lệ"); }
}
