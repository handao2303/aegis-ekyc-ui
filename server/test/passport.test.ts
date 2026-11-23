/* Hộ chiếu: Việt Nam (có số định danh) và nước ngoài */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, run, staff } from "./helpers.ts";
import { findPersona } from "../src/personas.ts";

const reasons = (svc: ReturnType<typeof setup>, id: string) => JSON.parse(svc.db.get("SELECT reasons_json FROM sessions WHERE id = ?", id)!.reasons_json);

test("UAT-EKYC-25 · hộ chiếu Việt Nam gắn chip → STP_APPROVED", async () => {
  const svc = setup();
  const { s, chip, res } = await run(svc, "TD-14");
  assert.equal(chip!.chip_verified, true);
  assert.deepEqual(chip!.mismatch, []);
  assert.equal(res!.status, "STP_APPROVED");
  assert.equal(svc.db.get("SELECT doc_type FROM sessions WHERE id = ?", s.session_id)!.doc_type, "PASSPORT");
});

test("UAT-EKYC-26 · hộ chiếu nước ngoài → REFER FOREIGN_NATIONAL, Compliance thấy quốc tịch", async () => {
  const svc = setup();
  const { s, res } = await run(svc, "TD-15");
  assert.equal(res!.status, "REFER");
  assert.deepEqual(reasons(svc, s.session_id), ["FOREIGN_NATIONAL"]);
  const d = svc.caseDetail(s.session_id, staff(svc, "u-anh"));
  assert.equal(d.doc_type, "PASSPORT");
  assert.equal(d.nationality, "GBR");
  assert.equal(d.document.ocr!.passport_no, "5•••151");
  assert.equal(d.document.ocr!.id_number, null);
});

test("C04 · hộ chiếu Việt Nam của người đã có tài khoản bằng CCCD → STOPPED_DUPLICATE", async () => {
  const svc = setup();
  const td08 = findPersona("TD-08").ocr; // khách cũ, đã có tài khoản
  const { doc } = await run(svc, "TD-14", { ocr: { ...findPersona("TD-14").ocr, full_name: td08.full_name, id_number: td08.id_number, dob: td08.dob } });
  assert.equal(doc!.next, "DUPLICATE");
});

test("C05 · hộ chiếu không hợp lệ bị chặn ở bước giấy tờ", async () => {
  const svc = setup();
  const p = findPersona("TD-14");
  const { s } = await run(svc, "TD-14", {}, "consent");
  await assert.rejects(svc.submitDocument(s.session_id, s.token, { ...p.ocr, id_number: undefined }), /số định danh/);
  await assert.rejects(svc.submitDocument(s.session_id, s.token, { ...p.ocr, passport_no: "C1-23" }), /Số hộ chiếu/);
  await assert.rejects(svc.submitDocument(s.session_id, s.token, { ...p.ocr, nationality: "VN" }), /quốc tịch/);
  const expired = await svc.submitDocument(s.session_id, s.token, { ...p.ocr, expiry: "2024-01-01" });
  assert.equal(expired.next, "EXPIRED_DOC");
});

test("C05 #5 · số hộ chiếu trên trang in khác trong chip → DOC_DATA_MISMATCH", async () => {
  const svc = setup();
  const p = findPersona("TD-14");
  const { chip, res } = await run(svc, "TD-14", { chip: { ...p.chip!, dg1: { ...p.chip!.dg1, passport_no: "C9999999" } } });
  assert.deepEqual(chip!.mismatch, ["passport_no"]);
  assert.equal(res!.status, "REFER");
});
