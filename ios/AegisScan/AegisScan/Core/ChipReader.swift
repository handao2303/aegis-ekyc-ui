import Foundation
import UIKit
import CoreNFC
import NFCPassportReader

/// Kết quả đọc chip, đã chuyển sang dạng hiển thị. Chỉ nằm trong bộ nhớ, không lưu.
struct ChipResult: Identifiable {
    struct Field: Identifiable { let id = UUID(); let label: String; let value: String }

    let id = UUID()
    var kind: DocumentKind
    var photo: UIImage?
    var fullName: String
    var documentNumber: String
    var personalNumber: String?
    var dateOfBirth: String
    var expiryDate: String
    var sex: String
    var nationality: String
    var issuingCountry: String
    var placeOfBirth: String?
    var address: String?
    /// "PACE" hoặc "BAC"
    var accessMethod: String
    /// Hash các DG khớp với SOD (dữ liệu không bị sửa)
    var dataIntact: Bool
    /// Chữ ký số SOD được xác minh tới chứng thư gốc (CSCA) – cần danh sách CSCA
    var signatureVerified: Bool
    var chipAuthentication: String
    var dataGroups: [String]
    /// DG13 – dữ liệu riêng của CCCD Việt Nam
    var vnFields: [Field]
    var isSample = false
}

extension ChipResult {
    init(model: NFCPassportModel, kind: DocumentKind) {
        self.kind = kind
        photo = model.passportImage
        let name = [model.lastName, model.firstName].filter { !$0.isEmpty && $0 != "?" }.joined(separator: " ")
        fullName = name.isEmpty ? "—" : name
        documentNumber = model.documentNumber
        personalNumber = model.personalNumber?.replacingOccurrences(of: "<", with: "")
        dateOfBirth = DateText.chip(model.dateOfBirth)
        expiryDate = DateText.chip(model.documentExpiryDate, expiry: true)
        sex = model.gender
        nationality = model.nationality
        issuingCountry = model.issuingAuthority
        placeOfBirth = model.placeOfBirth
        address = model.residenceAddress
        accessMethod = model.PACEStatus == .success ? "PACE" : (model.BACStatus == .success ? "BAC" : "—")
        dataIntact = model.passportDataNotTampered
        signatureVerified = model.passportCorrectlySigned
        switch model.chipAuthenticationStatus {
        case .success: chipAuthentication = "success"
        case .failed: chipAuthentication = "failed"
        case .notDone: chipAuthentication = model.isChipAuthenticationSupported ? "notDone" : "unsupported"
        }
        dataGroups = model.dataGroupsRead.keys.map { $0.getName() }.sorted()
        if let dg13 = model.dataGroupsRead[.DG13] {
            vnFields = VietnamDG13.parse(dg13.data)
        } else {
            vnFields = []
        }
    }

    /// Kết quả mẫu để xem giao diện trên simulator (không có NFC)
    static func sample(kind: DocumentKind) -> ChipResult {
        ChipResult(
            kind: kind, photo: nil,
            fullName: kind == .cccd ? "NGUYEN THI MINH THU" : "NGUYEN THI MINH THU",
            documentNumber: kind == .cccd ? "089123456" : "C1234567",
            personalNumber: kind == .cccd ? "079192123456" : nil,
            dateOfBirth: "15/03/1992", expiryDate: "15/03/2032", sex: "F",
            nationality: "VNM", issuingCountry: "VNM",
            placeOfBirth: kind == .passport ? "AN GIANG" : nil, address: nil,
            accessMethod: "BAC", dataIntact: true, signatureVerified: false,
            chipAuthentication: "unsupported",
            dataGroups: kind == .cccd ? ["COM", "DG1", "DG13", "DG2", "SOD"] : ["COM", "DG1", "DG11", "DG2", "SOD"],
            vnFields: kind == .cccd ? [
                .init(label: "Số định danh", value: "079192123456"),
                .init(label: "Họ và tên", value: "Nguyễn Thị Minh Thư"),
                .init(label: "Ngày sinh", value: "15/03/1992"),
                .init(label: "Giới tính", value: "Nữ"),
                .init(label: "Quốc tịch", value: "Việt Nam"),
                .init(label: "Dân tộc", value: "Kinh"),
                .init(label: "Quê quán", value: "Tân Châu, An Giang"),
                .init(label: "Nơi thường trú", value: "12 Lê Lợi, Bến Nghé, Quận 1, TP. Hồ Chí Minh"),
            ] : [],
            isSample: true
        )
    }
}

/// Giải mã DG13 của CCCD gắn chip Việt Nam.
/// Cấu trúc phổ biến: nhiều SEQUENCE { INTEGER số_trường, UTF8String giá_trị… }.
/// Nhãn theo số trường dưới đây là cách hiểu thông dụng, cần đối chiếu đặc tả chính thức trước khi dùng thật.
enum VietnamDG13 {
    static let labels: [Int: String] = [
        1: "Số định danh", 2: "Họ và tên", 3: "Ngày sinh", 4: "Giới tính", 5: "Quốc tịch",
        6: "Dân tộc", 7: "Tôn giáo", 8: "Quê quán", 9: "Nơi thường trú", 10: "Đặc điểm nhận dạng",
        11: "Ngày cấp", 12: "Có giá trị đến", 13: "Cha / Mẹ", 14: "Vợ / Chồng", 15: "Số CMND cũ",
    ]

    private struct TLV { let tag: UInt8; let constructed: Bool; let value: ArraySlice<UInt8> }

    private static func read(_ b: ArraySlice<UInt8>) -> [TLV] {
        var out: [TLV] = []
        var i = b.startIndex
        while i < b.endIndex {
            let tag = b[i]; i += 1
            // Bỏ qua tag nhiều byte (0x1F)
            if tag & 0x1F == 0x1F { while i < b.endIndex, b[i] & 0x80 != 0 { i += 1 }; i += 1 }
            guard i < b.endIndex else { break }
            var len = Int(b[i]); i += 1
            if len & 0x80 != 0 {
                let n = len & 0x7F
                guard n <= 3, i + n <= b.endIndex else { break }
                len = 0
                for _ in 0..<n { len = (len << 8) | Int(b[i]); i += 1 }
            }
            guard len >= 0, i + len <= b.endIndex else { break }
            out.append(TLV(tag: tag, constructed: tag & 0x20 != 0, value: b[i..<(i + len)]))
            i += len
        }
        return out
    }

    private static func string(_ t: TLV) -> String? {
        switch t.tag {
        case 0x0C, 0x13, 0x16, 0x1A: // UTF8String, PrintableString, IA5String, VisibleString
            return String(decoding: t.value, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        default: return nil
        }
    }

    static func parse(_ data: [UInt8]) -> [ChipResult.Field] {
        var numbered: [(Int, String)] = []
        var loose: [String] = []

        func walk(_ items: [TLV]) {
            for t in items {
                guard t.constructed else {
                    if let s = string(t), !s.isEmpty { loose.append(s) }
                    continue
                }
                let kids = read(t.value)
                if let first = kids.first, first.tag == 0x02, first.value.count <= 2 {
                    let n = first.value.reduce(0) { ($0 << 8) | Int($1) }
                    let vals = kids.dropFirst().compactMap(string).filter { !$0.isEmpty }
                    if !vals.isEmpty { numbered.append((n, vals.joined(separator: " · "))) }
                    // Trường lồng sâu hơn (vd. cha/mẹ)
                    let nested = kids.dropFirst().filter(\.constructed)
                    if !nested.isEmpty, vals.isEmpty {
                        var inner: [String] = []
                        for k in nested { inner.append(contentsOf: read(k.value).compactMap(string)) }
                        if !inner.isEmpty { numbered.append((n, inner.joined(separator: " · "))) }
                    }
                } else {
                    walk(kids)
                }
            }
        }

        walk(read(data[...]))
        if !numbered.isEmpty {
            return numbered.map { .init(label: labels[$0.0] ?? "Trường \($0.0)", value: $0.1) }
        }
        return loose.enumerated().map { .init(label: "Giá trị \($0.offset + 1)", value: $0.element) }
    }
}

/// Đọc chip qua NFC bằng NFCPassportReader (BAC/PACE, DG1, DG2, SOD…)
@MainActor
final class ChipReader: ObservableObject {
    enum Phase {
        case idle
        case reading
        case done(ChipResult)
        case failed(String)
    }

    @Published var phase: Phase = .idle
    private var reader: PassportReader?

    static var isAvailable: Bool {
        #if NO_NFC || targetEnvironment(simulator)
        return false
        #else
        return NFCTagReaderSession.readingAvailable
        #endif
    }

    static var unavailableReason: (vi: String, en: String) {
        #if targetEnvironment(simulator)
        return ("Simulator không có NFC. Dùng iPhone thật để đọc chip, hoặc xem kết quả mẫu.",
                "The Simulator has no NFC. Use a real iPhone to read the chip, or view a sample result.")
        #elseif NO_NFC
        return ("Bản cài này không bật quyền NFC (scheme AegisScan-NoNFC, dành cho tài khoản Apple miễn phí). Chọn scheme AegisScan với tài khoản Apple Developer để đọc chip.",
                "This build has no NFC entitlement (AegisScan-NoNFC scheme, for free Apple accounts). Use the AegisScan scheme with an Apple Developer account to read the chip.")
        #else
        return ("Máy này không hỗ trợ đọc NFC (cần iPhone 7 trở lên).", "This device can't read NFC (iPhone 7 or later required).")
        #endif
    }

    func read(_ mrz: MRZData, kind: DocumentKind, english: Bool) {
        guard Self.isAvailable else {
            phase = .failed(english ? Self.unavailableReason.en : Self.unavailableReason.vi)
            return
        }
        phase = .reading
        let reader = PassportReader()
        self.reader = reader
        var tags: [DataGroupId] = [.COM, .SOD, .DG1, .DG2, .DG14]
        tags.append(kind == .cccd ? .DG13 : .DG11)
        let key = mrz.mrzKey

        Task { @MainActor in
            do {
                let model = try await reader.readPassport(accessKey: .mrz(key), tags: tags) { msg in
                    ChipReader.message(msg, english: english)
                }
                self.phase = .done(ChipResult(model: model, kind: kind))
            } catch let e as NFCPassportReaderError {
                if case .UserCanceled = e { self.phase = .idle } else { self.phase = .failed(Self.describe(e, english: english)) }
            } catch {
                self.phase = .failed(error.localizedDescription)
            }
            self.reader = nil
        }
    }

    nonisolated static func message(_ m: NFCViewDisplayMessage, english: Bool) -> String? {
        switch m {
        case .requestPresentPassport:
            return english ? "Hold the top of your iPhone against the chip and keep still." : "Áp phần trên mặt lưng iPhone vào chip và giữ yên."
        case .authenticatingWithPassport:
            return english ? "Unlocking the chip…" : "Đang mở khoá chip…"
        case .readingDataGroupProgress(let dg, let p):
            let bar = String(repeating: "●", count: max(0, min(10, p / 10))) + String(repeating: "○", count: max(0, 10 - p / 10))
            return (english ? "Reading \(dg.getName())\n" : "Đang đọc \(dg.getName())\n") + bar
        case .activeAuthentication:
            return english ? "Checking the chip…" : "Đang kiểm tra chip…"
        case .successfulRead:
            return english ? "Chip read successfully" : "Đọc chip thành công"
        case .error:
            return nil
        }
    }

    static func describe(_ e: NFCPassportReaderError, english: Bool) -> String {
        switch e {
        case .InvalidMRZKey:
            return english ? "The chip rejected the MRZ details. Check the document number, date of birth and expiry date." : "Chip không chấp nhận thông tin MRZ. Kiểm tra lại số giấy tờ, ngày sinh và ngày hết hạn."
        case .ConnectionError, .TimeOutError, .TagNotValid, .NoConnectedTag:
            return english ? "Lost connection to the chip. Keep the card still against the top of the phone and try again." : "Mất kết nối với chip. Giữ yên thẻ sát phần trên mặt lưng điện thoại rồi thử lại."
        case .MoreThanOneTagFound:
            return english ? "More than one card detected. Keep only one card near the phone." : "Phát hiện nhiều thẻ. Chỉ để một thẻ gần điện thoại."
        case .NFCNotSupported:
            return english ? "This device can't read NFC." : "Máy này không hỗ trợ đọc NFC."
        default:
            return (english ? "Couldn't read the chip: " : "Không đọc được chip: ") + e.localizedDescription
        }
    }
}
