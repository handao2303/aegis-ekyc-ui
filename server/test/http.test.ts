/* Kiểm thử qua HTTP thật: luồng khách + quyền nhân viên */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { setup } from "./helpers.ts";
import { createApp } from "../src/http.ts";
import { findPersona } from "../src/personas.ts";

process.env.LOG = "0";
const svc = setup();
const server = createApp(svc, { dev: true }).server().listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => server.close());

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: (await r.json()) as any };
};

test("HTTP · TD-01 đi hết luồng tới STP_APPROVED", async () => {
  const p = findPersona("TD-01");
  const s = await call("POST", "/api/sessions", { device_id: "http-dev", device_model: p.device.model, phone: "0909000001" });
  assert.equal(s.status, 200);
  const h = { "x-session-token": s.body.token };
  const id = s.body.session_id;
  assert.equal((await call("POST", `/api/sessions/${id}/consent`, { scopes: ["identity", "screening"], terms_version: s.body.terms_version }, h)).body.next, "DOC");
  assert.equal((await call("POST", `/api/sessions/${id}/document`, p.ocr, h)).body.next, "NFC");
  assert.equal((await call("POST", `/api/sessions/${id}/chip`, p.chip, h)).body.next, "LIVENESS");
  const res = await call("POST", `/api/sessions/${id}/liveness`, { liveness: p.liveness, face_match: p.face_match }, h);
  assert.equal(res.body.status, "STP_APPROVED");
  assert.equal((await call("GET", `/api/sessions/${id}`, undefined, h)).body.outcome, "approved");
  assert.equal((await call("GET", `/api/sessions/${id}`)).status, 403, "thiếu token");
});

test("HTTP · API nhân viên cần x-staff-id, lỗi nghiệp vụ trả mã rõ ràng", async () => {
  assert.equal((await call("GET", "/api/cases")).status, 401);
  const q = await call("GET", "/api/cases?view=queue", undefined, { "x-staff-id": "u-anh" });
  assert.equal(q.status, 200);
  assert.ok(q.body.items.length >= 8);
  const same = await call("POST", "/api/cases/EKS-2611-0036/checker", { decision: "APPROVE" }, { "x-staff-id": "u-yen" });
  assert.equal(same.status, 403);
  assert.equal(same.body.error.code, "MAKER_CHECKER_SAME");
  assert.equal((await call("GET", "/api/nope")).status, 404);
});

test("HTTP · CORS preflight cho app chạy khác cổng", async () => {
  const r = await fetch(base + "/api/sessions", { method: "OPTIONS", headers: { origin: "http://192.168.1.5:5179" } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "http://192.168.1.5:5179");
});

test("HTTP · G-SE-01 production: không khởi động khi thiếu bí mật Gateway; giả danh x-staff-id → 401; CORS theo danh sách", async () => {
  assert.throws(() => createApp(svc, {}), /GATEWAY_SHARED_SECRET/);
  assert.throws(() => createApp(svc, { security: { gatewaySecret: "" } }), /GATEWAY_SHARED_SECRET/);
  const SECRET = "test-gateway-secret";
  const prod = createApp(svc, { security: { gatewaySecret: SECRET, allowedOrigins: ["https://compliance.aegis.example"] } }).server().listen(0);
  const pb = `http://127.0.0.1:${(prod.address() as AddressInfo).port}`;
  try {
    const req = (path: string, headers: Record<string, string>, method = "GET", body?: unknown) =>
      fetch(pb + path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    // Kẻ gian tự khai mã Checker, không qua Gateway
    const r1 = await req("/api/cases/EKS-2611-0036/checker", { "x-staff-id": "u-huy" }, "POST", { decision: "APPROVE" });
    assert.equal(r1.status, 401);
    assert.equal((await req("/api/cases", { "x-staff-id": "u-anh", "x-gateway-auth": "sai-bi-mat" })).status, 401);
    const ok = await req("/api/cases", { "x-staff-id": "u-anh", "x-gateway-auth": SECRET, origin: "https://compliance.aegis.example" });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://compliance.aegis.example");
    const evil = await req("/api/cases", { "x-staff-id": "u-anh", "x-gateway-auth": SECRET, origin: "https://evil.example" });
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    // Luồng khách dùng x-session-token, không phụ thuộc Gateway
    const s = await req("/api/sessions", {}, "POST", { device_id: "prod-dev", device_model: "iPhone 15", phone: "0909000099" });
    assert.equal(s.status, 200);
    // Endpoint dev không có ở production
    assert.equal((await req("/api/dev/jobs/run", {}, "POST")).status, 404);
  } finally { prod.close(); }
});
