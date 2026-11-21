import Foundation

/// Loại giấy tờ người dùng chọn
enum DocumentKind: String, CaseIterable, Identifiable, Hashable {
    case cccd      // CCCD gắn chip / thẻ Căn cước – MRZ TD1 (3 dòng × 30)
    case passport  // Hộ chiếu điện tử – MRZ TD3 (2 dòng × 44)
    var id: String { rawValue }
}

enum MRZFormat: String, Hashable {
    case td1, td3
}

/// Dữ liệu đọc từ dòng MRZ (ICAO 9303). Đủ để mở khoá chip bằng BAC/PACE.
struct MRZData: Hashable {
    var format: MRZFormat
    var documentCode: String = ""
    var issuingCountry: String = ""
    /// Số giấy tờ trong MRZ. Với CCCD đây là 9 số cuối của số CCCD 12 số.
    var documentNumber: String
    /// YYMMDD
    var dateOfBirth: String
    var sex: String = ""
    /// YYMMDD
    var expiryDate: String
    var nationality: String = ""
    var surname: String = ""
    var givenNames: String = ""
    /// Số định danh 12 số (CCCD) hoặc số cá nhân (hộ chiếu), nếu có
    var personalNumber: String?
    /// Nhập tay thay vì quét
    var isManual = false

    var fullName: String {
        [surname, givenNames].filter { !$0.isEmpty }.joined(separator: " ")
    }

    /// Khoá MRZ cho BAC/PACE: số giấy tờ + kiểm tra, ngày sinh + kiểm tra, ngày hết hạn + kiểm tra
    var mrzKey: String {
        let doc = documentNumber.count < 9
            ? documentNumber.padding(toLength: 9, withPad: "<", startingAt: 0)
            : documentNumber
        return doc + String(MRZParser.checkDigit(doc))
            + dateOfBirth + String(MRZParser.checkDigit(dateOfBirth))
            + expiryDate + String(MRZParser.checkDigit(expiryDate))
    }
}

enum MRZParser {
    // MARK: Chữ số kiểm tra (trọng số 7-3-1)

    static func value(of c: Character) -> Int {
        if let d = c.wholeNumberValue, c.isASCII { return d }
        if let a = c.asciiValue, a >= 65, a <= 90 { return Int(a) - 55 } // A=10 … Z=35
        return 0 // '<'
    }

    static func checkDigit(_ s: String) -> Int {
        let w = [7, 3, 1]
        var sum = 0
        for (i, c) in s.enumerated() { sum += value(of: c) * w[i % 3] }
        return sum % 10
    }

    // MARK: Làm sạch kết quả OCR

    /// Chuẩn hoá một dòng OCR: chữ hoa, bỏ khoảng trắng, đổi ký tự hay bị nhận nhầm của dấu '<'
    static func clean(_ raw: String) -> String {
        var s = raw.uppercased()
        s = s.replacingOccurrences(of: "«", with: "<<")
            .replacingOccurrences(of: "‹", with: "<")
            .replacingOccurrences(of: "〈", with: "<")
            .replacingOccurrences(of: " ", with: "")
        return String(s.filter { ("A"..."Z").contains($0) || ("0"..."9").contains($0) || $0 == "<" })
    }

    /// Trường chỉ có số: đổi chữ hay bị đọc nhầm sang số
    static func numeric(_ s: Substring) -> String {
        let map: [Character: Character] = ["O": "0", "Q": "0", "D": "0", "U": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6", "T": "7"]
        return String(s.map { map[$0] ?? $0 })
    }

    private static func fit(_ s: String, _ n: Int) -> String {
        s.count >= n ? String(s.prefix(n)) : s.padding(toLength: n, withPad: "<", startingAt: 0)
    }

    private static func slice(_ s: String, _ from: Int, _ to: Int) -> Substring {
        let a = s.index(s.startIndex, offsetBy: from)
        let b = s.index(s.startIndex, offsetBy: to)
        return s[a..<b]
    }

    private static func ok(_ field: String, _ check: Character) -> Bool {
        guard let d = Int(numeric(Substring(String(check)))) else { return false }
        return checkDigit(field) == d
    }

    private static func names(_ s: Substring) -> (String, String) {
        let parts = s.components(separatedBy: "<<").filter { !$0.isEmpty }
        let sur = (parts.first ?? "").replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespaces)
        let given = parts.dropFirst().joined(separator: " ").replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespaces)
        return (sur, given)
    }

    private static func validDate(_ yymmdd: String) -> Bool {
        guard yymmdd.count == 6, yymmdd.allSatisfy(\.isNumber),
              let mm = Int(yymmdd.dropFirst(2).prefix(2)), let dd = Int(yymmdd.suffix(2)) else { return false }
        return (1...12).contains(mm) && (1...31).contains(dd)
    }

    // MARK: TD1 – CCCD (3 dòng × 30)

    static func parseTD1(_ l1: String, _ l2: String, _ l3: String) -> MRZData? {
        let a = fit(l1, 30), b = fit(l2, 30), c = fit(l3, 30)
        // CCCD Việt Nam: số giấy tờ toàn số → sửa chữ OCR đọc nhầm. Nước khác giữ nguyên (có thể có chữ).
        let country = String(slice(a, 2, 5))
        let doc = country == "VNM" ? numeric(slice(a, 5, 14)) : String(slice(a, 5, 14))
        let dob = numeric(slice(b, 0, 6))
        let exp = numeric(slice(b, 8, 14))
        guard ok(doc, a[a.index(a.startIndex, offsetBy: 14)]),
              ok(dob, b[b.index(b.startIndex, offsetBy: 6)]),
              ok(exp, b[b.index(b.startIndex, offsetBy: 14)]),
              validDate(dob), validDate(exp) else { return nil }
        let opt = String(slice(a, 15, 30))
        let digits = String(numeric(Substring(opt)).prefix(while: \.isNumber))
        let (sur, given) = names(Substring(c))
        return MRZData(
            format: .td1,
            documentCode: String(slice(a, 0, 2)).replacingOccurrences(of: "<", with: ""),
            issuingCountry: country,
            documentNumber: doc.replacingOccurrences(of: "<", with: ""),
            dateOfBirth: dob,
            sex: String(slice(b, 7, 8)).replacingOccurrences(of: "<", with: ""),
            expiryDate: exp,
            nationality: String(slice(b, 15, 18)),
            surname: sur,
            givenNames: given,
            personalNumber: digits.count >= 12 ? String(digits.prefix(12)) : nil
        )
    }

    // MARK: TD3 – Hộ chiếu (2 dòng × 44)

    static func parseTD3(_ l1: String, _ l2: String) -> MRZData? {
        let a = fit(l1, 44), b = fit(l2, 44)
        let doc = String(slice(b, 0, 9))
        let dob = numeric(slice(b, 13, 19))
        let exp = numeric(slice(b, 21, 27))
        guard ok(doc, b[b.index(b.startIndex, offsetBy: 9)]),
              ok(dob, b[b.index(b.startIndex, offsetBy: 19)]),
              ok(exp, b[b.index(b.startIndex, offsetBy: 27)]),
              validDate(dob), validDate(exp) else { return nil }
        let (sur, given) = names(slice(a, 5, 44))
        let personal = String(slice(b, 28, 42)).replacingOccurrences(of: "<", with: "")
        return MRZData(
            format: .td3,
            documentCode: String(slice(a, 0, 2)).replacingOccurrences(of: "<", with: ""),
            issuingCountry: String(slice(a, 2, 5)),
            documentNumber: doc.replacingOccurrences(of: "<", with: ""),
            dateOfBirth: dob,
            sex: String(slice(b, 20, 21)).replacingOccurrences(of: "<", with: ""),
            expiryDate: exp,
            nationality: String(slice(b, 10, 13)),
            surname: sur,
            givenNames: given,
            personalNumber: personal.isEmpty ? nil : personal
        )
    }

    /// Tìm MRZ hợp lệ trong các dòng chữ đọc được (đã sắp từ trên xuống dưới)
    static func find(in rawLines: [String], prefer kind: DocumentKind) -> MRZData? {
        let lines = rawLines.map(clean).filter { $0.count >= 25 }
        func td3() -> MRZData? {
            guard lines.count >= 2 else { return nil }
            for i in 0..<(lines.count - 1) where lines[i].hasPrefix("P") && (40...46).contains(lines[i].count) && (40...46).contains(lines[i + 1].count) {
                if let m = parseTD3(lines[i], lines[i + 1]) { return m }
            }
            return nil
        }
        func td1() -> MRZData? {
            guard lines.count >= 3 else { return nil }
            for i in 0..<(lines.count - 2) where (27...33).contains(lines[i].count) && (27...33).contains(lines[i + 1].count) && (24...33).contains(lines[i + 2].count) {
                if let m = parseTD1(lines[i], lines[i + 1], lines[i + 2]) { return m }
            }
            return nil
        }
        return kind == .passport ? (td3() ?? td1()) : (td1() ?? td3())
    }

    // MARK: Nhập tay

    /// Tạo dữ liệu MRZ từ thông tin nhập tay. CCCD 12 số → lấy 9 số cuối (đúng trường số giấy tờ trong MRZ).
    static func manual(kind: DocumentKind, number: String, dateOfBirth: Date, expiry: Date) -> MRZData {
        let n = number.uppercased().filter { $0.isLetter || $0.isNumber }
        let doc = kind == .cccd && n.count == 12 ? String(n.suffix(9)) : n
        return MRZData(
            format: kind == .cccd ? .td1 : .td3,
            documentNumber: doc,
            dateOfBirth: DateText.yymmdd(dateOfBirth),
            expiryDate: DateText.yymmdd(expiry),
            personalNumber: kind == .cccd && n.count == 12 ? n : nil,
            isManual: true
        )
    }
}

/// Đổi ngày MRZ (YYMMDD) sang hiển thị dd/MM/yyyy và ngược lại
enum DateText {
    private static let utc = TimeZone(identifier: "UTC")!

    static func yymmdd(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = utc; f.dateFormat = "yyMMdd"
        return f.string(from: d)
    }

    /// expiry = true: luôn hiểu là 20xx; ngày sinh: lớn hơn năm hiện tại → 19xx
    static func display(_ yymmdd: String, expiry: Bool = false) -> String {
        guard yymmdd.count == 6, let yy = Int(yymmdd.prefix(2)) else { return yymmdd }
        let nowYY = Calendar(identifier: .gregorian).component(.year, from: Date()) % 100
        let century = expiry ? 2000 : (yy > nowYY ? 1900 : 2000)
        let mm = yymmdd.dropFirst(2).prefix(2), dd = yymmdd.suffix(2)
        return "\(dd)/\(mm)/\(century + yy)"
    }

    /// Dữ liệu chip có thể là YYMMDD hoặc YYYYMMDD
    static func chip(_ s: String, expiry: Bool = false) -> String {
        if s.count == 8, s.allSatisfy(\.isNumber) {
            return "\(s.suffix(2))/\(s.dropFirst(4).prefix(2))/\(s.prefix(4))"
        }
        return display(s, expiry: expiry)
    }
}
