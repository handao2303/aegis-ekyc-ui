/* Hồ sơ mẫu TD-01 → TD-13 (C17 §4). Tên, số CCCD đều hư cấu.
   App dùng chúng thay cho kết quả OCR/NFC/liveness thật khi test; backend dùng cùng số CCCD làm fixture sandbox CIC/AML.
   File này không import gì để cả Next.js và Node dùng chung được. */

export type PersonaDoc = {
  /** Mặc định CCCD. Hộ chiếu chỉ có 1 trang dữ liệu (MRZ TD3), chip nằm ở bìa */
  doc_type?: "CCCD" | "PASSPORT";
  full_name: string;
  /** Số định danh cá nhân 12 số; hộ chiếu nước ngoài để trống */
  id_number: string;
  passport_no?: string;
  /** Mã quốc gia ICAO 3 ký tự, mặc định VNM */
  nationality?: string;
  dob: string; // YYYY-MM-DD
  sex: "F" | "M";
  origin: string;
  issued: string;
  expiry: string;
};

export type Persona = {
  code: string;
  label: string;
  expect: string;
  product: "payment" | "credit";
  device: { id: string; model: string; rooted?: boolean };
  phone: string;
  ocr: PersonaDoc;
  /** null = máy không có NFC / khách bỏ qua */
  chip: null | { dg1: Pick<PersonaDoc, "full_name" | "id_number" | "dob" | "expiry" | "passport_no" | "nationality">; sod_valid: boolean; chip_auth: boolean };
  liveness: number;
  face_match: number;
  /** Số lần chụp lỗi mô phỏng trước khi đọc được (TD-07) */
  capture_failures?: number;
  uat: string[];
};

const doc = (p: Partial<PersonaDoc> & Pick<PersonaDoc, "full_name" | "id_number" | "dob">): PersonaDoc => ({
  sex: "F", origin: "Tân Châu, An Giang", issued: "2021-06-12", expiry: "2032-03-15", ...p,
});
const chipOf = (d: PersonaDoc, over: Partial<PersonaDoc> = {}) => ({
  dg1: { full_name: d.full_name, id_number: d.id_number, dob: d.dob, expiry: d.expiry, passport_no: d.passport_no, nationality: d.nationality, ...over },
  sod_valid: true,
  chip_auth: true,
});

const td01 = doc({ full_name: "NGUYỄN THỊ MINH THƯ", id_number: "089192005678", dob: "1992-03-15" });
const td02 = doc({ full_name: "TRẦN VĂN NAM", id_number: "079095001122", dob: "1995-07-02", sex: "M", origin: "Quận 3, TP. Hồ Chí Minh", expiry: "2035-07-02" });
const td03 = doc({ full_name: "BÙI NGỌC ÁNH", id_number: "001196003344", dob: "1996-11-21", origin: "Đống Đa, Hà Nội", expiry: "2036-11-21" });
const td04 = doc({ full_name: "PHẠM QUỐC BẢO", id_number: "001075004455", dob: "1975-01-30", sex: "M", origin: "Ba Đình, Hà Nội", expiry: "2035-01-30" });
const td05 = doc({ full_name: "ĐINH CÔNG MẠNH", id_number: "031088005566", dob: "1988-04-09", sex: "M", origin: "Lê Chân, Hải Phòng", expiry: "2033-04-09" });
const td06 = doc({ full_name: "LÊ VĂN PHÚC", id_number: "048088006677", dob: "1988-09-14", sex: "M", origin: "Hải Châu, Đà Nẵng", expiry: "2033-09-14" });
const td07 = doc({ full_name: "VÕ THỊ HẠNH", id_number: "092099007788", dob: "1999-02-18", origin: "Ninh Kiều, Cần Thơ", expiry: "2039-02-18" });
const td08 = doc({ full_name: "HOÀNG THỊ LAN", id_number: "038085008899", dob: "1985-06-25", origin: "TP. Thanh Hoá", expiry: "2030-06-25" });
const td09 = doc({ full_name: "NGÔ ĐỨC TÀI", id_number: "036090009900", dob: "1990-12-03", sex: "M", origin: "Nam Định", issued: "2015-03-15", expiry: "2025-03-15" });
const td10 = doc({ full_name: "LÝ GIA HUY", id_number: "079209001010", dob: "2009-05-20", sex: "M", origin: "Quận 5, TP. Hồ Chí Minh", expiry: "2034-05-20" });
const td12 = doc({ full_name: "TẠ MINH KHOA", id_number: "060091001212", dob: "1991-08-08", sex: "M", origin: "Phan Thiết, Bình Thuận", expiry: "2031-08-08" });
const td14 = doc({ doc_type: "PASSPORT", full_name: "ĐẶNG MINH QUÂN", id_number: "079096001414", passport_no: "C1414141", nationality: "VNM", dob: "1996-04-14", sex: "M", origin: "TP. Hồ Chí Minh", issued: "2023-04-14", expiry: "2033-04-14" });
const td15 = doc({ doc_type: "PASSPORT", full_name: "JOHN MICHAEL SMITH", id_number: "", passport_no: "533415151", nationality: "GBR", dob: "1987-05-12", sex: "M", origin: "London", issued: "2021-05-12", expiry: "2031-05-12" });
// Hết hạn sau 20 ngày tính từ hôm nay để luôn rơi vào ngưỡng cảnh báo 30 ngày (C05 #2)
const in20Days = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
const td16 = doc({ full_name: "PHAN THỊ THU HÀ", id_number: "046097001616", dob: "1997-02-16", origin: "TP. Huế", issued: "2011-12-10", expiry: in20Days });
const td13 = doc({ full_name: "VŨ HOÀNG LONG", id_number: "034001001313", dob: "2001-10-10", sex: "M", origin: "Thái Bình", expiry: "2041-10-10" });

export const PERSONAS: Persona[] = [
  { code: "TD-01", label: "Khách chuẩn", expect: "STP_APPROVED", product: "payment", device: { id: "dev-td01", model: "iPhone 13 · iOS 18" }, phone: "0901000001", ocr: td01, chip: chipOf(td01), liveness: 0.97, face_match: 0.93, uat: ["UAT-EKYC-01", "UAT-EKYC-11", "UAT-EKYC-17"] },
  { code: "TD-02", label: "Máy không NFC", expect: "REFER · NFC_SKIPPED", product: "payment", device: { id: "dev-td02", model: "Xiaomi Redmi 9 · Android 11" }, phone: "0901000002", ocr: td02, chip: null, liveness: 0.94, face_match: 0.88, uat: ["UAT-EKYC-02"] },
  { code: "TD-03", label: "Liveness vùng biên", expect: "REFER · LIVENESS_BORDERLINE", product: "payment", device: { id: "dev-td03", model: "iPhone 14 · iOS 18" }, phone: "0901000003", ocr: td03, chip: chipOf(td03), liveness: 0.74, face_match: 0.89, uat: ["UAT-EKYC-04", "UAT-EKYC-08", "UAT-EKYC-16"] },
  { code: "TD-04", label: "Trùng PEP, điểm thấp", expect: "REFER · PEP_MATCH → Maker-Checker", product: "payment", device: { id: "dev-td04", model: "iPhone 15 · iOS 18" }, phone: "0901000004", ocr: td04, chip: chipOf(td04), liveness: 0.99, face_match: 0.96, uat: ["UAT-EKYC-05", "UAT-EKYC-19"] },
  { code: "TD-05", label: "Rủi ro cao", expect: "REJECTED", product: "payment", device: { id: "dev-td05", model: "Samsung A54 · Android 14" }, phone: "0901000005", ocr: td05, chip: chipOf(td05), liveness: 0.96, face_match: 0.92, uat: ["UAT-EKYC-06"] },
  { code: "TD-06", label: "CIC chậm", expect: "REFER · CIC_TIMEOUT", product: "payment", device: { id: "dev-td06", model: "Samsung A54 · Android 14" }, phone: "0901000006", ocr: td06, chip: chipOf(td06), liveness: 0.97, face_match: 0.93, uat: ["UAT-EKYC-07"] },
  { code: "TD-07", label: "Ảnh xấu", expect: "Chụp lỗi 3 lần → REFER", product: "payment", device: { id: "dev-td07", model: "Oppo A57 · Android 13" }, phone: "0901000007", ocr: td07, chip: chipOf(td07), liveness: 0.95, face_match: 0.9, capture_failures: 3, uat: ["UAT-EKYC-10"] },
  { code: "TD-08", label: "Khách cũ", expect: "STOPPED_DUPLICATE", product: "payment", device: { id: "dev-td08", model: "iPhone 12 · iOS 17" }, phone: "0901000008", ocr: td08, chip: chipOf(td08), liveness: 0.97, face_match: 0.94, uat: ["UAT-EKYC-12"] },
  { code: "TD-09", label: "CCCD hết hạn", expect: "REJECTED · DOC_EXPIRED", product: "payment", device: { id: "dev-td09", model: "Vivo Y36 · Android 14" }, phone: "0901000009", ocr: td09, chip: chipOf(td09), liveness: 0.97, face_match: 0.93, uat: ["UAT-EKYC-13"] },
  { code: "TD-10", label: "17 tuổi, sản phẩm tín dụng", expect: "REJECTED · UNDER_AGE", product: "credit", device: { id: "dev-td10", model: "iPhone 11 · iOS 17" }, phone: "0901000010", ocr: td10, chip: chipOf(td10), liveness: 0.97, face_match: 0.93, uat: ["UAT-EKYC-14"] },
  { code: "TD-12", label: "Chip sai chữ ký số", expect: "REFER · CHIP_AUTH_FAILED", product: "payment", device: { id: "dev-td12", model: "Pixel 8 · Android 15" }, phone: "0901000012", ocr: td12, chip: { ...chipOf(td12), sod_valid: false }, liveness: 0.97, face_match: 0.93, uat: ["UAT-EKYC-20"] },
  { code: "TD-13", label: "Một máy, hai CCCD", expect: "REFER · DEVICE_MULTI_IDENTITY", product: "payment", device: { id: "dev-shared-13", model: "Pixel 7 · Android 15" }, phone: "0901000013", ocr: td13, chip: chipOf(td13), liveness: 0.95, face_match: 0.91, uat: ["UAT-EKYC-22"] },
  { code: "TD-14", label: "Hộ chiếu Việt Nam gắn chip", expect: "STP_APPROVED", product: "payment", device: { id: "dev-td14", model: "iPhone 15 Pro · iOS 18" }, phone: "0901000014", ocr: td14, chip: chipOf(td14), liveness: 0.97, face_match: 0.94, uat: ["UAT-EKYC-25"] },
  { code: "TD-16", label: "CCCD sắp hết hạn (< 30 ngày)", expect: "STP_APPROVED + cảnh báo", product: "payment", device: { id: "dev-td16", model: "iPhone 13 mini · iOS 18" }, phone: "0901000016", ocr: td16, chip: chipOf(td16), liveness: 0.96, face_match: 0.93, uat: ["UAT-EKYC-13"] },
  { code: "TD-15", label: "Hộ chiếu nước ngoài", expect: "REFER · FOREIGN_NATIONAL", product: "payment", device: { id: "dev-td15", model: "iPhone 14 · iOS 18" }, phone: "0901000015", ocr: td15, chip: chipOf(td15), liveness: 0.96, face_match: 0.92, uat: ["UAT-EKYC-26"] },
];

export const findPersona = (code: string | null | undefined) => PERSONAS.find((p) => p.code === code) ?? PERSONAS[0];

/** Fixture sandbox CIC/AML theo số CCCD (thay cho đối tác thật khi chưa có DEP-01→04) */
export const SANDBOX: Record<string, { cic_group?: number; cic_timeout?: boolean; pep?: boolean; sanction?: boolean; risk?: number }> = {
  "001075004455": { pep: true, risk: 45 },
  "031088005566": { cic_group: 4, risk: 88 },
  "048088006677": { cic_timeout: true },
  "001196003344": { risk: 32 },
};
