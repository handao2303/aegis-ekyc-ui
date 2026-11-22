import { Db, clock } from "../src/db.ts";
import { EkycService } from "../src/service.ts";
import { seed } from "../src/seed.ts";
import { findPersona, type Persona } from "../src/personas.ts";
import { breakers } from "../src/adapters.ts";

export const T0 = Date.parse("2026-11-22T03:00:00Z");

export function setup() {
  clock.set(T0);
  for (const b of Object.values(breakers)) { b.state = "CLOSED"; b.failures = 0; }
  const svc = new EkycService(new Db(), "test-salt");
  seed(svc);
  return svc;
}

export const staff = (svc: EkycService, id: "u-anh" | "u-yen" | "u-huy" | "u-trang") => svc.staff(id);

/** Chạy một hồ sơ mẫu qua các bước; dừng ở bước `until` nếu có */
export async function run(svc: EkycService, code: string, over: Partial<Persona> = {}, until?: "consent" | "document" | "chip") {
  const p = { ...findPersona(code), ...over };
  const s = svc.createSession({ device_id: p.device.id, device_model: p.device.model, device_rooted: p.device.rooted, phone: p.phone, product: p.product });
  const c = svc.consent(s.session_id, s.token, { scopes: ["identity", "screening"], terms_version: s.terms_version });
  if (until === "consent") return { s, c };
  const doc = await svc.submitDocument(s.session_id, s.token, p.ocr);
  if (until === "document" || doc.next !== "NFC") return { s, doc };
  const chip = svc.submitChip(s.session_id, s.token, p.chip ? p.chip : { skipped: true });
  if (until === "chip") return { s, doc, chip };
  const res = await svc.submitLiveness(s.session_id, s.token, { liveness: p.liveness, face_match: p.face_match });
  return { s, doc, chip, res };
}
