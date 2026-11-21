import XCTest
@testable import AegisScan

/// Mẫu MRZ theo tài liệu ICAO 9303 (dữ liệu hư cấu "UTOPIA")
final class MRZTests: XCTestCase {
    func testCheckDigit() {
        XCTAssertEqual(MRZParser.checkDigit("L898902C<"), 3)
        XCTAssertEqual(MRZParser.checkDigit("690806"), 1)
        XCTAssertEqual(MRZParser.checkDigit("940623"), 6)
    }

    func testBACKeyFromICAOExample() {
        let m = MRZData(format: .td3, documentNumber: "L898902C", dateOfBirth: "690806", expiryDate: "940623")
        XCTAssertEqual(m.mrzKey, "L898902C<369080619406236")
    }

    func testParsePassportTD3() throws {
        let m = try XCTUnwrap(MRZParser.find(in: [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
        ], prefer: .passport))
        XCTAssertEqual(m.format, .td3)
        XCTAssertEqual(m.documentNumber, "L898902C3")
        XCTAssertEqual(m.dateOfBirth, "740812")
        XCTAssertEqual(m.expiryDate, "120415")
        XCTAssertEqual(m.surname, "ERIKSSON")
        XCTAssertEqual(m.givenNames, "ANNA MARIA")
        XCTAssertEqual(m.sex, "F")
    }

    func testParseIDCardTD1() throws {
        let m = try XCTUnwrap(MRZParser.find(in: [
            "I<UTOD231458907<<<<<<<<<<<<<<<",
            "7408122F1204159UTO<<<<<<<<<<<6",
            "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
        ], prefer: .cccd))
        XCTAssertEqual(m.format, .td1)
        XCTAssertEqual(m.documentNumber, "D23145890")
        XCTAssertEqual(m.dateOfBirth, "740812")
        XCTAssertEqual(m.expiryDate, "120415")
        XCTAssertEqual(m.fullName, "ERIKSSON ANNA MARIA")
    }

    func testOCRNoiseInDatesIsCorrected() throws {
        // "O" thay cho "0" và khoảng trắng – lỗi OCR hay gặp
        let m = try XCTUnwrap(MRZParser.find(in: [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C36UTO74O8122F12O4159ZE184226B<<<<<1 0",
        ], prefer: .passport))
        XCTAssertEqual(m.dateOfBirth, "740812")
    }

    func testRejectsWrongCheckDigit() {
        XCTAssertNil(MRZParser.find(in: [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C37UTO7408122F1204159ZE184226B<<<<<10",
        ], prefer: .passport))
    }

    func testManualCCCDUsesLast9Digits() {
        let d = Calendar(identifier: .gregorian).date(from: DateComponents(timeZone: TimeZone(identifier: "UTC"), year: 1992, month: 3, day: 15))!
        let m = MRZParser.manual(kind: .cccd, number: "079192123456", dateOfBirth: d, expiry: d)
        XCTAssertEqual(m.documentNumber, "192123456")
        XCTAssertEqual(m.dateOfBirth, "920315")
        XCTAssertEqual(m.personalNumber, "079192123456")
    }

    func testVietnamTD1FixesOCRLettersInNumber() throws {
        // Số giấy tờ VN toàn số; "O" bị đọc nhầm phải được sửa thành "0"
        let doc = "O92123456", fixed = "092123456"
        let l1 = "IDVNM" + doc + String(MRZParser.checkDigit(fixed)) + "079092123456<<<"
        let l2 = "920315" + String(MRZParser.checkDigit("920315")) + "F" + "320315" + String(MRZParser.checkDigit("320315")) + "VNM" + "<<<<<<<<<<<" + "0"
        let m = try XCTUnwrap(MRZParser.find(in: [l1, l2, "NGUYEN<<THI<MINH<THU<<<<<<<<<<"], prefer: .cccd))
        XCTAssertEqual(m.documentNumber, fixed)
        XCTAssertEqual(m.personalNumber, "079092123456")
        XCTAssertEqual(m.fullName, "NGUYEN THI MINH THU")
    }

    func testDateDisplay() {
        XCTAssertEqual(DateText.display("920315"), "15/03/1992")
        XCTAssertEqual(DateText.display("320315", expiry: true), "15/03/2032")
        XCTAssertEqual(DateText.chip("19920315"), "15/03/1992")
    }

    func testDG13NumberedFields() {
        // SEQUENCE { SEQUENCE { INTEGER 2, UTF8String "Nguyễn Văn A" } }
        let name = Array("Nguyễn Văn A".utf8)
        let inner: [UInt8] = [0x02, 0x01, 0x02, 0x0C, UInt8(name.count)] + name
        let field: [UInt8] = [0x30, UInt8(inner.count)] + inner
        let dg: [UInt8] = [0x6D, UInt8(field.count + 2), 0x30, UInt8(field.count)] + field
        let f = VietnamDG13.parse(dg)
        XCTAssertEqual(f.first?.label, "Họ và tên")
        XCTAssertEqual(f.first?.value, "Nguyễn Văn A")
    }
}
