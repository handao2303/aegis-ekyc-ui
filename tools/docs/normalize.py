#!/usr/bin/env python3
"""Chuẩn hoá cấu trúc tài liệu docs/ theo ISO/IEC/IEEE 15289:2019 §7 (nội dung chung của mọi tài liệu).

Mỗi tài liệu sau khi chạy có:
  1. Khối thuộc tính đầu trang, thứ tự cố định: Mã tài liệu · Phiên bản · Ngày phát hành · Trạng thái · Phân loại ·
     Tác giả · Người duyệt · Mục đích và phạm vi · Chuẩn tham chiếu · Thuật ngữ, rồi các trường riêng giữ nguyên thứ tự.
  2. Thân bài giữ nguyên, kể cả đánh số mục (tránh gãy tham chiếu chéo kiểu "R02 §3").
  3. Mục cuối "Kiểm soát tài liệu": Tài liệu tham chiếu (lập tự động từ liên kết) · Lịch sử phiên bản (5 cột, tăng dần) · Phê duyệt.

Chạy lại nhiều lần cho cùng kết quả. Lần đầu thêm một dòng lịch sử cho thay đổi định dạng.
    python3 tools/docs/normalize.py            # ghi file
    python3 tools/docs/normalize.py --check    # chỉ báo khác biệt
"""
import os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "docs")
TODAY = "26/11/2026"
FMT_NOTE = "Chuẩn hoá cấu trúc theo ISO/IEC/IEEE 15289: khối thuộc tính đầu trang, tài liệu tham chiếu, thuật ngữ dùng chung (G02), mục kiểm soát tài liệu thống nhất"
MOD = {"00-overview": "GEN", "01-ekyc": "EKYC", "02-reconciliation": "REC", "03-credit-limit": "LIM"}

# Mục đích và phạm vi – một câu cho mỗi tài liệu (ISO/IEC/IEEE 15289 §7 b: scope)
PURPOSE = {
    "A01": "Cho người đọc mới cái nhìn toàn cảnh 3 module: bối cảnh hệ thống, thành phần, luồng end-to-end, cây quyết định và bản đồ màn hình, trước khi đọc tài liệu chi tiết",
    "C01": "Ghi lại các lần chỉnh Jira Epic eKYC (SCRUM-6) và quy ước đặt tên, liên kết ticket cho cả 3 module",
    "C03": "Bổ sung yêu cầu BR, FR, RULE, NFR cho BRD/FSD/SRS v1.2 của eKYC và lập ma trận truy vết (RTM) tới thiết kế, test",
    "G01": "Ghi lượt rà soát từ góc nhìn từng vai trò (PO, Compliance, QA, Tech Lead, InfoSec, Kế toán, Risk) để người duyệt thật có sẵn phát hiện",
    "G02": "Định nghĩa thuật ngữ, chữ viết tắt, mã yêu cầu và ký hiệu trạng thái dùng chung cho mọi tài liệu",
    "Q01": "Đối chiếu từng loại tài liệu của 3 module với chuẩn quốc tế áp dụng và ghi mức đạt, việc còn thiếu",
    "X01": "Kiểm tra hành trình end-to-end qua 3 module, phát hiện điểm lệch giữa tài liệu, UI và thiết kế",
    "C04-C05": "Đặc tả quy tắc kiểm tra trùng khách hàng và hợp lệ giấy tờ, tuổi (RULE-EKYC-09, 10) chạy trước Liveness",
    "C06": "Đặc tả vòng đời phiên eKYC: trạng thái, bỏ dở, hết hạn, tiếp tục phiên và job dọn dữ liệu",
    "C07-C09": "Đặc tả quy trình hồ sơ REFER: yêu cầu bổ sung giấy tờ, ma trận thông báo và SLA hàng đợi Compliance",
    "C10": "Đặc tả Maker-Checker cho quyết định eKYC rủi ro cao và audit trail chỉ ghi thêm",
    "C02": "Đối chiếu yêu cầu pháp lý (NHNN, Luật 91/2025, PCRT) với hiện trạng eKYC, chỉ ra khoảng trống chặn go-live",
    "C11": "Quyết định nguồn ảnh đối chiếu sinh trắc (chip DG2, CSDL dân cư, ảnh in) và giới hạn kết quả theo nguồn",
    "C12": "Đặc tả rút lại đồng ý và chính sách lưu trữ, xoá dữ liệu cá nhân trong eKYC",
    "C13-C14": "Đặc tả kiểm soát gian lận theo thiết bị, velocity và kế hoạch spike chống giả mạo khuôn mặt",
    "P01": "Soạn điều khoản, thông báo quyền riêng tư và cơ sở pháp lý xử lý dữ liệu cá nhân cho luồng eKYC",
    "A02": "Mô tả app iPhone Aegis Scan: quét MRZ, đọc chip NFC CCCD / hộ chiếu và giới hạn hiện tại",
    "U01": "Đặc tả 23 màn hình app khách hàng mở tài khoản (eKYC) và Hạn mức thẻ, kèm trạng thái và quy tắc hiển thị",
    "U02": "Đặc tả giao diện Aegis Compliance: hàng đợi, chi tiết hồ sơ, Maker-Checker, cấu hình và báo cáo",
    "C15": "Lập kế hoạch đo hiệu năng end-to-end eKYC theo NFR-PERF-02, 03",
    "C16": "Lập kế hoạch kiểm thử tích hợp (SIT) eKYC với sandbox đối tác thật",
    "C17": "Cung cấp bộ kịch bản UAT, dữ liệu mẫu và biên bản nghiệm thu cho eKYC",
    "T01": "Kế hoạch kiểm thử tổng thể Module 1: phạm vi, cách tiếp cận, môi trường, lịch, tiêu chí vào/ra",
    "T02": "Liệt kê test case chi tiết Module 1 kèm dữ liệu, bước và kết quả mong đợi",
    "T03": "Báo cáo kết quả các vòng kiểm thử nội bộ Module 1, lỗi phát hiện và điều kiện vào UAT",
    "C18": "Định nghĩa dashboard KPI eKYC và từ điển chỉ số kèm công thức, nguồn dữ liệu",
    "A03": "Đặc tả API REST và mã lỗi của ekyc-service cho đội app, web và tích hợp",
    "D01": "Từ điển dữ liệu ekyc-service: bảng, trường, phân loại dữ liệu và kiểm soát bảo vệ",
    "R01": "Mô tả luồng đối soát, trạng thái quy tắc / ngoại lệ / bút toán và các kiểm soát Maker-Checker, truy vết",
    "R02": "Đối chiếu baseline BAS-BRD-v1.2 với UI và thiết kế Đối soát: yêu cầu bổ sung, điểm lệch, RTM",
    "R03": "Đặc tả giao diện Aegis Đối soát REC-01 → REC-06",
    "R04": "Kế hoạch kiểm thử, test case và kết quả các vòng của Module 2 (UI, backend, end-to-end)",
    "R05": "Đặc tả API và từ điển dữ liệu reconciliation-service",
    "R06": "Định nghĩa yêu cầu phi chức năng và từ điển chỉ số KPI cho Đối soát",
    "R07": "Kế hoạch SIT, kiểm thử hiệu năng, bộ UAT và biên bản nghiệm thu cho Đối soát",
    "R08": "Đối chiếu yêu cầu tuân thủ, cơ sở pháp lý và dữ liệu cá nhân cho Đối soát",
    "L01": "Mô tả luồng cấp phép thẻ ISO 8583, kiểm soát hạn mức đồng thời, Boost và phát hiện gian lận",
    "L02": "Đối chiếu baseline với UI và thiết kế Hạn mức: yêu cầu bổ sung, điểm lệch, RTM",
    "L03": "Đặc tả giao diện Aegis Hạn mức: web vận hành LIM-W1 → W4 và app LIM-M1 → M3",
    "L04": "Kế hoạch kiểm thử, test case và kết quả các vòng của Module 3",
    "L05": "Đặc tả API và từ điển dữ liệu limit-service (thiết kế đề xuất)",
    "L06": "Định nghĩa yêu cầu phi chức năng và từ điển chỉ số KPI cho Hạn mức",
    "L07": "Kế hoạch SIT, kiểm thử hiệu năng, bộ UAT và biên bản nghiệm thu cho Hạn mức",
    "L08": "Đối chiếu tuân thủ, điều khoản cho khách và dữ liệu cá nhân cho Hạn mức",
}
CLASSIFICATION = {"P01": "Nội bộ – phần điều khoản công bố cho khách sau khi Pháp chế duyệt"}

CONSUMED = {"Mã tài liệu", "Phiên bản", "Ngày phát hành", "Trạng thái", "Phân loại", "Tác giả", "Người duyệt", "Mục đích và phạm vi",
            "Mục đích", "Chuẩn tham chiếu", "Chuẩn", "Khung tài liệu", "Thuật ngữ", "Ngày", "Người soạn"}
CONTROL = re.compile(r"^## (?:(\d+)\.\s*)?(Kiểm soát tài liệu|Nhật ký thay đổi|Lịch sử phiên bản|Phê duyệt)\s*$")
# Dòng do script sinh ra trong mục kiểm soát – không coi là ghi chú của người viết
GENERATED = {"Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.", "Không tham chiếu tài liệu khác trong bộ."}
LINK = re.compile(r"\]\(([^)\s]+?\.md)(?:#[^)]*)?\)")


def cells(line):
    """Tách một dòng bảng Markdown thành ô; giữ '|' nằm trong `code`."""
    s, out, cur, tick = line.strip()[1:-1], [], "", False
    for ch in s:
        if ch == "`": tick = not tick
        if ch == "|" and not tick: out.append(cur.strip()); cur = ""
        else: cur += ch
    out.append(cur.strip())
    return out


def table_at(lines, i):
    """Đọc bảng bắt đầu ở dòng i: trả về (tiêu đề, các dòng, chỉ số sau bảng)."""
    head = cells(lines[i]); rows = []; j = i + 2
    while j < len(lines) and lines[j].startswith("|"):
        rows.append(cells(lines[j])); j += 1
    return head, rows, j


def vkey(v):
    return [int(x) if x.isdigit() else x for x in re.findall(r"\d+|[a-z]+", v.lower())]


def bump(v):
    m = re.match(r"^(.*?)(\d+)$", v)
    return f"{m.group(1)}{int(m.group(2)) + 1}" if m else v + ".1"


def clean_status(status, versions):
    """Bỏ số phiên bản của chính tài liệu khỏi Trạng thái – phiên bản đã có trường riêng, ghi ở đây sẽ cũ đi sau mỗi lần sửa.
    Chỉ bỏ các số có trong lịch sử của tài liệu (giữ 'reconciliation-service v1.0' vì đó là phiên bản phần mềm)."""
    for v in sorted({v.lstrip("v") for v in versions}, key=len, reverse=True):
        status = re.sub(r"\s*\bv" + re.escape(v) + r"\b(?![.\w-])", "", status)
    status = re.sub(r"(✅|🔧|📝|⛔|🟡)\s*·\s*", r"\1 ", status)
    return re.sub(r"\s{2,}", " ", status).strip()


def doc_index():
    idx = {}
    for d, _, fs in os.walk(ROOT):
        for f in fs:
            if f.endswith(".md") and f != "README.md":
                p = os.path.normpath(os.path.join(d, f))
                code = re.match(r"^([A-Z]\d+(?:-[A-Z]\d+)?)", f).group(1)
                title = open(p, encoding="utf-8").readline().lstrip("# ").strip()
                idx[p] = (code, title, MOD[os.path.relpath(p, ROOT).split(os.sep)[0]])
    return idx


def normalize(path, idx):
    src = open(path, encoding="utf-8").read()
    lines = src.rstrip("\n").split("\n")
    code, title, mod = idx[path]
    here = os.path.dirname(path)

    # --- khối thuộc tính đầu trang ---
    h0 = next(i for i, l in enumerate(lines[:8]) if l.startswith("|"))
    _, hrows, hend = table_at(lines, h0)
    fields = [(r[0], " | ".join(r[1:])) for r in hrows if r and r[0]]
    fmap = dict(fields)

    # --- vùng kiểm soát tài liệu ở cuối ---
    h2 = [i for i, l in enumerate(lines) if l.startswith("## ")]
    start = next((i for i in h2 if all(CONTROL.match(lines[k]) for k in h2 if k >= i)), len(lines))
    m = CONTROL.match(lines[start]) if start < len(lines) else None
    num = m.group(1) if m else None
    body = lines[hend:start]
    ctrl = lines[start:]

    history, approval, extra = [], [], []
    i = 0
    while i < len(ctrl):
        l = ctrl[i]
        if l.startswith("| Phiên bản | Ngày"):
            head, rows, i = table_at(ctrl, i)
            col = {h: k for k, h in enumerate(head)}
            for r in rows:
                g = lambda *names: next((r[col[n]] for n in names if n in col and col[n] < len(r)), "")
                change = g("Thay đổi", "Nội dung")
                if "Trạng thái" in col and g("Trạng thái"): change += f" (trạng thái: {g('Trạng thái')})"
                history.append([g("Phiên bản"), g("Ngày"), g("Người sửa", "Người"), g("Commit") or "—", change])
            continue
        if l.startswith("| Vai trò | Người"):
            _, approval, i = table_at(ctrl, i); continue
        if l.startswith("#") or not l.strip() or l.startswith("|") or l in GENERATED:
            i += 1; continue
        extra.append(l); i += 1
    if len(history) > 1 and vkey(history[0][0]) > vkey(history[-1][0]):
        history.reverse()
    if history and all(h[4] != FMT_NOTE for h in history) and code != "G02":  # G02 viết theo mẫu mới từ đầu
        history.append([bump(history[-1][0]), TODAY, "Han Dao", "—", FMT_NOTE])
    if not approval:
        approval = [["BA (soạn)", "Han Dao", TODAY, "Trình duyệt"], ["Product Owner", "", "", ""]]

    # --- tài liệu tham chiếu: lập từ liên kết trong đầu trang và thân bài ---
    refs, seen = [], set()
    for l in lines[:start]:
        for target in LINK.findall(l):
            p = os.path.normpath(os.path.join(here, target))
            if p in idx and p != path and p not in seen and idx[p][0] != "G02":
                seen.add(p); refs.append((idx[p], os.path.relpath(p, here)))

    reviewers = [r for r in approval if r and not r[0].startswith("BA")]
    names = [f"{r[0]}{' (' + r[1] + ')' if len(r) > 1 and r[1] else ''}" for r in reviewers]
    approved = reviewers and all(len(r) > 3 and r[3] for r in reviewers)
    std = " · ".join(v for k in ("Chuẩn tham chiếu", "Chuẩn", "Khung tài liệu") if (v := fmap.get(k)))
    glossary = os.path.relpath(os.path.join(ROOT, "00-overview", "G02-glossary.md"), here)
    ver, date = (history[-1][0], history[-1][1]) if history else (fmap.get("Phiên bản", ""), TODAY)

    head = [
        ("Mã tài liệu", f"AEG-{mod}-{code}"),
        ("Phiên bản", ver),
        ("Ngày phát hành", date),
        ("Trạng thái", clean_status(fmap.get("Trạng thái", "—"), [h[0] for h in history])),
        ("Phân loại", CLASSIFICATION.get(code, "Nội bộ")),
        ("Tác giả", "Han Dao (BA)"),
        ("Người duyệt", (" · ".join(names) or "—") + ("" if approved else " – chưa duyệt")),
        ("Mục đích và phạm vi", PURPOSE[code]),
        ("Chuẩn tham chiếu", std or "—"),
    ]
    if code != "G02":
        head.append(("Thuật ngữ", f"[G02 Thuật ngữ và chữ viết tắt]({glossary})"))
    head += [(k, v) for k, v in fields if k not in CONSUMED]

    out = [lines[0], "", "| | |", "|---|---|"] + [f"| {k} | {v} |" for k, v in head]
    b = "\n".join(body).strip("\n")
    out += ["", b, ""] if b else [""]
    out += [f"## {num + '. ' if num else ''}Kiểm soát tài liệu", "", "### Tài liệu tham chiếu", ""]
    if refs:
        out += ["| Mã | Tài liệu |", "|---|---|"] + [f"| {c} | [{t}]({rel}) |" for (c, t, _), rel in refs]
    else:
        out += ["Không tham chiếu tài liệu khác trong bộ."]
    out += ["", "Chuẩn quốc tế: xem trường *Chuẩn tham chiếu* ở đầu trang.", "", "### Lịch sử phiên bản", "",
            "| Phiên bản | Ngày | Người sửa | Commit | Thay đổi |", "|---|---|---|---|---|"]
    out += ["| " + " | ".join(r) + " |" for r in history]
    out += ["", "### Phê duyệt", ""] + ([*extra, ""] if extra else [])
    out += ["| Vai trò | Người | Ngày | Kết luận |", "|---|---|---|---|"] + ["| " + " | ".join((r + ["", "", "", ""])[:4]) + " |" for r in approval]
    new = "\n".join(out) + "\n"

    # Kiểm tra: phiên bản ghi ở đầu trang cũ có khớp lịch sử không
    old_ver = re.match(r"v?([\w.\-]+)", fmap.get("Phiên bản", "") or "")
    note = ""
    if old_ver and history and len(history) > 1 and old_ver.group(1).lstrip("v") not in (history[-2][0].lstrip("v"), history[-1][0].lstrip("v")):
        note = f"  ⚠ đầu trang ghi {old_ver.group(1)}, lịch sử ghi {history[-2][0]}"
    return new, new != src, ver, note


def main():
    check = "--check" in sys.argv
    idx = doc_index()
    versions = {}
    for path in sorted(idx):
        new, changed, ver, note = normalize(path, idx)
        versions[idx[path][0]] = ver
        if changed and not check:
            open(path, "w", encoding="utf-8").write(new)
        print(f"{'đổi' if changed else 'giữ'}  {os.path.relpath(path, ROOT)} → v{ver}{note}")
    # Mục lục docs/README.md: đồng bộ số phiên bản "vX.Y" ở cột trạng thái
    rp = os.path.join(ROOT, "README.md")
    s = open(rp, encoding="utf-8").read()
    def fix(m):
        row = m.group(0)
        code = re.search(r"\[([A-Z]\d+(?:[–-][A-Z]\d+)?) ", row)
        ver = versions.get(code.group(1).replace("–", "-")) if code else None
        return re.sub(r"v\d+\.\d+[\w-]*", "v" + ver.lstrip("v"), row, count=1) if ver and re.search(r"v\d+\.\d+", row) else row
    s2 = re.sub(r"^\| \[[A-Z]\d+.*$", fix, s, flags=re.M)
    if s2 != s and not check:
        open(rp, "w", encoding="utf-8").write(s2)
    print("README:", "đổi" if s2 != s else "giữ")


if __name__ == "__main__":
    main()
