import SwiftUI

@main
struct AegisScanApp: App {
    @StateObject private var lang = Lang()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(lang)
                .preferredColorScheme(.light)
                .tint(Theme.purpleText)
                .environment(\.locale, Locale(identifier: lang.english ? "en_GB" : "vi_VN"))
        }
    }
}

enum Route: Hashable {
    case scan(DocumentKind)
    case confirm(DocumentKind, MRZData?)
    case chip(DocumentKind, MRZData)
    case face
    case selfie
    case portrait
    case result
}

/// Giữ luồng điều hướng và kết quả chip, khuôn mặt (không lưu xuống máy)
final class Flow: ObservableObject {
    @Published var path: [Route] = []
    @Published var result: ChipResult?
    /// Ảnh chân dung in trên mặt trước giấy tờ – chỉ dùng khi không có ảnh chip
    @Published var printedPortrait: UIImage?
    @Published var biometric: BiometricResult?
    func restart() { result = nil; printedPortrait = nil; biometric = nil; path = [] }
}

struct RootView: View {
    @StateObject private var flow = Flow()
    var body: some View {
        NavigationStack(path: $flow.path) {
            HomeView()
                .navigationDestination(for: Route.self) { r in
                    switch r {
                    case .scan(let k): ScanView(kind: k)
                    case .confirm(let k, let m): ConfirmView(kind: k, scanned: m)
                    case .chip(let k, let m): ChipView(kind: k, mrz: m)
                    case .face: FaceIntroView()
                    case .selfie: SelfieView()
                    case .portrait: PortraitCaptureView()
                    case .result: ResultView()
                    }
                }
        }
        .environmentObject(flow)
    }
}

// MARK: 1 · Chọn giấy tờ

struct HomeView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    @State private var kind: DocumentKind = .cccd

    var body: some View {
        Screen(title: "Aegis Bank", step: 0, showBack: false) {
            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Theme.soft)
                Mascot3D(action: .idle)
            }
            .frame(height: 230)
            .accessibilityHidden(true)
            .padding(.bottom, 28)
            PageTitle(
                title: lang.t("Chọn giấy tờ để tiếp tục", "Select a document to continue"),
                subtitle: lang.t("Dùng giấy tờ gốc, còn hạn, có gắn chip để xác minh danh tính của bạn.", "Use an original, valid chip document to verify your identity.")
            )
            VStack(spacing: 12) {
                option(.cccd, icon: "person.text.rectangle", title: lang.t("CCCD gắn chip", "Chip citizen ID"), desc: lang.t("Căn cước công dân / thẻ Căn cước", "Vietnamese citizen ID card"))
                option(.passport, icon: "book.closed", title: lang.t("Hộ chiếu", "Passport"), desc: lang.t("Hộ chiếu điện tử có biểu tượng chip", "e-Passport with the chip symbol"))
            }
            .accessibilityElement(children: .contain)
        } footer: {
            PrimaryButton(title: lang.t("Tiếp tục", "Continue")) { flow.path.append(.scan(kind)) }
        }
    }

    private func option(_ k: DocumentKind, icon: String, title: String, desc: String) -> some View {
        let selected = kind == k
        return Button { kind = k } label: {
            HStack(spacing: 16) {
                IconTile(systemImage: icon)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(desc).font(.system(size: 13)).foregroundStyle(Theme.tertiary)
                }
                Spacer()
                ZStack {
                    Circle().stroke(selected ? Color(hex: 0x8A45E0) : Color(hex: 0xCFD2DA), lineWidth: 2).frame(width: 24, height: 24)
                    if selected { Circle().fill(Theme.brand).frame(width: 12, height: 12) }
                }
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(selected ? Color(hex: 0xFAF6FF) : .white))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(selected ? Theme.purple : Theme.border, lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: 2 · Quét MRZ bằng camera

struct ScanView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cam = MRZCamera()
    let kind: DocumentKind

    private var ratio: CGFloat { kind == .cccd ? 1.586 : 1.42 }

    var body: some View {
        ZStack {
            Color(hex: 0x0D0B12).ignoresSafeArea()
            if cam.status == .running {
                CameraPreview(session: cam.session).ignoresSafeArea()
                // Phủ tối ngoài khung ngắm
                GeometryReader { g in
                    let w = g.size.width - 40
                    let h = w / ratio
                    let rect = CGRect(x: 20, y: g.size.height * 0.42 - h / 2, width: w, height: h)
                    Path { p in p.addRect(CGRect(origin: .zero, size: g.size)); p.addRoundedRect(in: rect, cornerSize: CGSize(width: 16, height: 16)) }
                        .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))
                    Corners(length: 30)
                        .stroke(cam.seesText ? Theme.amber : .white, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: rect.width + 12, height: rect.height + 12)
                        .position(x: rect.midX, y: rect.midY)
                    // Vị trí dòng MRZ
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Theme.brand, style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
                        .frame(width: rect.width - 24, height: rect.height * (kind == .cccd ? 0.36 : 0.26))
                        .position(x: rect.midX, y: rect.maxY - rect.height * (kind == .cccd ? 0.22 : 0.16))
                }
                .ignoresSafeArea()
            }

            VStack(spacing: 0) {
                HStack {
                    Button { cam.stop(); dismiss() } label: {
                        Image(systemName: "arrow.left").font(.system(size: 20, weight: .medium)).frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.12)))
                    }
                    .foregroundStyle(.white)
                    .accessibilityLabel(lang.t("Quay lại", "Back"))
                    Spacer()
                    Text(kind == .cccd ? lang.t("Mặt sau CCCD", "ID card – back") : lang.t("Trang thông tin hộ chiếu", "Passport data page"))
                        .font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                    Spacer()
                    LangToggle(onDark: true)
                }
                .padding(.horizontal, 12)
                StepBar(step: 1, onDark: true).padding(.horizontal, 24).padding(.top, 4)

                VStack(alignment: .leading, spacing: 6) {
                    Text(kind == .cccd ? lang.t("Đưa mặt sau CCCD vào khung", "Fit the back of your ID in the frame") : lang.t("Đưa trang có ảnh vào khung", "Fit the photo page in the frame"))
                        .font(.system(size: 22, weight: .semibold))
                    Text(kind == .cccd ? lang.t("3 dòng ký tự ở cuối thẻ nằm trong vùng nét đứt.", "Keep the 3 lines of characters at the bottom inside the dashed area.") : lang.t("2 dòng ký tự ở cuối trang nằm trong vùng nét đứt.", "Keep the 2 lines of characters at the bottom inside the dashed area."))
                        .font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 16)

                Spacer()

                statusBlock
                    .padding(.horizontal, 24)

                HStack(spacing: 12) {
                    if cam.status == .running {
                        Button { cam.toggleTorch() } label: {
                            Image(systemName: cam.torchOn ? "flashlight.on.fill" : "flashlight.off.fill").frame(width: 52, height: 52).background(Circle().fill(.white.opacity(0.12)))
                        }
                        .foregroundStyle(.white)
                        .accessibilityLabel(lang.t("Đèn pin", "Torch"))
                    }
                    Button { cam.stop(); flow.path.append(.confirm(kind, nil)) } label: {
                        Text(lang.t("Nhập tay thông tin", "Enter details manually"))
                            .font(.system(size: 16, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 52)
                            .background(Capsule().fill(.white)).foregroundStyle(Theme.ink)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 12)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .statusBarHidden(true)
        .onAppear { cam.start(kind: kind) }
        .onDisappear { cam.stop() }
        .onChange(of: cam.detected) { m in
            if let m { flow.path.append(.confirm(kind, m)) }
        }
    }

    @ViewBuilder private var statusBlock: some View {
        switch cam.status {
        case .running:
            Label(cam.seesText ? lang.t("Đã thấy MRZ – giữ yên…", "MRZ found – hold still…") : lang.t("Đang tìm dòng MRZ…", "Looking for the MRZ…"), systemImage: cam.seesText ? "viewfinder" : "camera.viewfinder")
                .font(.system(size: 15, weight: .medium))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Capsule().fill(cam.seesText ? Color.white : Color.white.opacity(0.15)))
                .foregroundStyle(cam.seesText ? Theme.ink : .white)
        case .denied:
            notice("camera.fill", lang.t("Chưa có quyền dùng camera", "Camera access is off"), lang.t("Vào Cài đặt › Aegis Scan › Camera để cho phép, hoặc nhập tay.", "Allow it in Settings › Aegis Scan › Camera, or enter details manually."))
        case .unavailable:
            notice("camera", lang.t("Không có camera", "No camera available"), lang.t("Simulator không có camera. Nhập tay thông tin để tiếp tục.", "The Simulator has no camera. Enter the details manually to continue."))
        default:
            ProgressView().tint(.white)
        }
    }

    private func notice(_ icon: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).font(.system(size: 18))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .semibold))
                Text(body).font(.system(size: 13)).foregroundStyle(.white.opacity(0.75))
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.1)))
    }
}

// MARK: 3 · Xác nhận thông tin MRZ

struct ConfirmView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    let kind: DocumentKind
    let scanned: MRZData?

    @State private var number = ""
    @State private var dob = Calendar.current.date(from: DateComponents(year: 1995, month: 1, day: 1)) ?? Date()
    @State private var expiry = Calendar.current.date(byAdding: .year, value: 5, to: Date()) ?? Date()

    private var numberValid: Bool {
        let n = number.filter { $0.isLetter || $0.isNumber }
        return kind == .cccd ? (n.count == 12 && n.allSatisfy(\.isNumber)) || (n.count == 9 && n.allSatisfy(\.isNumber)) : (6...9).contains(n.count)
    }

    var body: some View {
        Screen(title: lang.t("Thông tin giấy tờ", "Document details"), step: 1) {
            if let m = scanned {
                PageTitle(title: lang.t("Đã đọc được MRZ", "MRZ read successfully"), subtitle: lang.t("Kiểm tra thông tin. Hệ thống dùng số giấy tờ, ngày sinh và ngày hết hạn để mở khoá chip.", "Check the details. The document number, date of birth and expiry date unlock the chip."))
                Card {
                    if !m.fullName.isEmpty { InfoRow(label: lang.t("Họ tên (MRZ)", "Name (MRZ)"), value: m.fullName); Divider() }
                    InfoRow(label: lang.t("Số giấy tờ", "Document no."), value: m.personalNumber.map { kind == .cccd ? $0 : m.documentNumber } ?? m.documentNumber, mono: true); Divider()
                    InfoRow(label: lang.t("Ngày sinh", "Date of birth"), value: DateText.display(m.dateOfBirth)); Divider()
                    InfoRow(label: lang.t("Có giá trị đến", "Expiry date"), value: DateText.display(m.expiryDate, expiry: true)); Divider()
                    InfoRow(label: lang.t("Quốc tịch", "Nationality"), value: m.nationality.isEmpty ? "—" : m.nationality)
                }
                Label(lang.t("Chữ số kiểm tra hợp lệ", "Check digits are valid"), systemImage: "checkmark.seal.fill")
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.success).padding(.top, 14)
            } else {
                PageTitle(title: lang.t("Nhập thông tin giấy tờ", "Enter your document details"), subtitle: kind == .cccd ? lang.t("Nhập số CCCD 12 số in trên thẻ.", "Enter the 12-digit number printed on your ID card.") : lang.t("Nhập số hộ chiếu ở trang thông tin (vd. C1234567).", "Enter the passport number from the data page (e.g. C1234567)."))
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(kind == .cccd ? lang.t("Số CCCD", "ID number") : lang.t("Số hộ chiếu", "Passport number")).font(.system(size: 14, weight: .semibold))
                        TextField(kind == .cccd ? "079192123456" : "C1234567", text: $number)
                            .keyboardType(kind == .cccd ? .numberPad : .asciiCapable)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .font(.system(size: 18, weight: .medium)).monospacedDigit()
                            .padding(14)
                            .background(RoundedRectangle(cornerRadius: 14).stroke(numberValid || number.isEmpty ? Theme.border : Theme.danger, lineWidth: 1.5))
                        if !number.isEmpty && !numberValid {
                            Text(kind == .cccd ? lang.t("Số CCCD gồm 12 chữ số.", "The ID number has 12 digits.") : lang.t("Số hộ chiếu gồm 6–9 ký tự.", "Passport numbers have 6–9 characters.")).font(.system(size: 13)).foregroundStyle(Theme.danger)
                        }
                    }
                    DatePicker(lang.t("Ngày sinh", "Date of birth"), selection: $dob, displayedComponents: .date)
                        .font(.system(size: 15, weight: .semibold))
                    DatePicker(lang.t("Có giá trị đến", "Expiry date"), selection: $expiry, displayedComponents: .date)
                        .font(.system(size: 15, weight: .semibold))
                }
                #if targetEnvironment(simulator)
                Button(lang.t("Điền dữ liệu mẫu", "Fill in sample data")) {
                    number = kind == .cccd ? "079192123456" : "C1234567"
                    dob = Calendar.current.date(from: DateComponents(year: 1992, month: 3, day: 15))!
                    expiry = Calendar.current.date(from: DateComponents(year: 2032, month: 3, day: 15))!
                }
                .font(.system(size: 15, weight: .semibold)).padding(.top, 18)
                #endif
            }
        } footer: {
            PrimaryButton(title: lang.t("Tiếp tục đọc chip", "Continue to chip"), disabled: scanned == nil && !numberValid) {
                let m = scanned ?? MRZParser.manual(kind: kind, number: number, dateOfBirth: dob, expiry: expiry)
                flow.path.append(.chip(kind, m))
            }
        }
    }
}

// MARK: 4 · Đọc chip NFC

struct ChipView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    @StateObject private var reader = ChipReader()
    let kind: DocumentKind
    let mrz: MRZData
    @State private var pulse = false

    var body: some View {
        Screen(title: lang.t("Đọc chip", "Read chip"), step: 2) {
            ZStack {
                RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.sunken).frame(height: 230)
                ForEach(0..<2) { i in
                    Circle().stroke(Theme.brand, lineWidth: 2)
                        .frame(width: 120, height: 120)
                        .scaleEffect(pulse ? 1.6 : 0.8).opacity(pulse ? 0 : 0.7)
                        .animation(.easeOut(duration: 1.8).repeatForever(autoreverses: false).delay(Double(i) * 0.9), value: pulse)
                }
                Circle().fill(.white).frame(width: 104, height: 104).shadow(color: Theme.deep.opacity(0.12), radius: 14, y: 6)
                    .overlay(Image(systemName: "wave.3.right").font(.system(size: 40, weight: .medium)).foregroundStyle(Color(hex: 0x8A45E0)))
            }
            .accessibilityHidden(true)
            .padding(.bottom, 28)
            .onAppear { pulse = true }

            PageTitle(
                title: kind == .cccd ? lang.t("Áp CCCD vào mặt lưng iPhone", "Hold your ID to the back of your iPhone") : lang.t("Áp hộ chiếu vào mặt lưng iPhone", "Hold your passport to the back of your iPhone"),
                subtitle: lang.t("Bấm \"Bắt đầu đọc chip\", rồi giữ yên 5–10 giây cho đến khi có thông báo thành công.", "Tap \"Start reading\", then hold still for 5–10 seconds until it says done.")
            )
            VStack(alignment: .leading, spacing: 14) {
                tip("iphone.gen3", kind == .cccd ? lang.t("Đặt mặt sau thẻ (có chip) sát phần trên mặt lưng, gần camera.", "Place the chip side of the card against the top back of the phone, near the camera.") : lang.t("Hộ chiếu Việt Nam: chip thường ở bìa sau. Đặt bìa sau sát phần trên mặt lưng iPhone.", "The chip is usually in the back cover. Place it against the top back of the iPhone."))
                tip("iphone.slash", lang.t("Tháo ốp lưng dày hoặc có kim loại.", "Remove thick or metal phone cases."))
                tip("hand.raised", lang.t("Không di chuyển thẻ khi đang đọc.", "Don't move the card while reading."))
            }

        } footer: {
            if case .failed(let msg) = reader.phase {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warning)
                    Text(msg).font(.system(size: 14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.warningBg))
                .padding(.bottom, 4)
                .transition(.opacity)
            }
            PrimaryButton(title: reader.isReading ? lang.t("Đang đọc chip…", "Reading chip…") : lang.t("Bắt đầu đọc chip", "Start reading"), systemImage: "wave.3.right", disabled: reader.isReading) {
                reader.read(mrz, kind: kind, english: lang.english)
            }
            if !ChipReader.isAvailable {
                SecondaryButton(title: lang.t("Xem kết quả mẫu", "View a sample result"), systemImage: "doc.text.magnifyingglass") {
                    flow.result = .sample(kind: kind)
                    flow.biometric = nil
                    flow.path.append(.face)
                }
            }
        }
        .onChange(of: reader.doneToken) { _ in
            if case .done(let r) = reader.phase {
                flow.result = r
                flow.biometric = nil
                flow.path.append(.face)
            }
        }
    }

    private func tip(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color(hex: 0x8A45E0)).frame(width: 24)
            Text(text).font(.system(size: 15)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }
}

extension ChipReader {
    var isReading: Bool { if case .reading = phase { return true }; return false }
    /// Đổi mỗi khi đọc xong, để màn hình bắt sự kiện
    var doneToken: UUID? { if case .done(let r) = phase { return r.id }; return nil }
}

// MARK: 5 · Kết quả

struct ResultView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow

    var body: some View {
        Screen(title: lang.t("Kết quả", "Result"), step: 4, showBack: false) {
            if let r = flow.result {
                content(r)
            }
        } footer: {
            PrimaryButton(title: lang.t("Quét giấy tờ khác", "Scan another document"), systemImage: "arrow.counterclockwise") { flow.restart() }
        }
    }

    @ViewBuilder private func content(_ r: ChipResult) -> some View {
        if r.isSample {
            Label(lang.t("Dữ liệu mẫu – chưa đọc chip thật", "Sample data – no real chip was read"), systemImage: "info.circle.fill")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.warning)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Capsule().fill(Theme.warningBg))
                .padding(.bottom, 16)
        }
        // Thẻ danh tính
        HStack(alignment: .center, spacing: 16) {
            Group {
                if let img = r.photo {
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    ZStack { Theme.soft; Image(systemName: "person.fill").font(.system(size: 34)).foregroundStyle(Color(hex: 0x8A45E0)) }
                }
            }
            .frame(width: 88, height: 112)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(.white.opacity(0.6), lineWidth: 2))
            .accessibilityLabel(lang.t("Ảnh khuôn mặt lưu trong chip", "Face photo stored in the chip"))
            VStack(alignment: .leading, spacing: 6) {
                Text(r.kind == .cccd ? lang.t("CCCD gắn chip", "Chip citizen ID") : lang.t("Hộ chiếu điện tử", "e-Passport"))
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
                Text(r.fullName).font(.system(size: 19, weight: .bold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text(r.personalNumber ?? r.documentNumber).font(.system(size: 16, weight: .semibold)).monospacedDigit().foregroundStyle(.white)
                Label(r.dataIntact ? lang.t("Chip hợp lệ", "Chip verified") : lang.t("Cần kiểm tra", "Needs review"), systemImage: r.dataIntact ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Capsule().fill(r.dataIntact ? Theme.amber : Color.white))
                    .foregroundStyle(Theme.ink)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .background(
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Theme.deep)
                Circle().fill(Theme.brand).frame(width: 180, height: 180).blur(radius: 50).opacity(0.55).offset(x: 50, y: -60)
            }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        )
        .padding(.bottom, 24)

        if let b = flow.biometric { BiometricSection(b: b) }

        section(lang.t("Thông tin trong chip", "Chip data"))
        Card {
            InfoRow(label: lang.t("Số giấy tờ", "Document no."), value: r.documentNumber, mono: true); Divider()
            InfoRow(label: lang.t("Ngày sinh", "Date of birth"), value: r.dateOfBirth); Divider()
            InfoRow(label: lang.t("Giới tính", "Sex"), value: sex(r.sex)); Divider()
            InfoRow(label: lang.t("Quốc tịch", "Nationality"), value: r.nationality); Divider()
            if let p = r.placeOfBirth, !p.isEmpty { InfoRow(label: lang.t("Nơi sinh", "Place of birth"), value: p); Divider() }
            InfoRow(label: lang.t("Có giá trị đến", "Expiry date"), value: r.expiryDate)
        }
        .padding(.bottom, 24)

        if !r.vnFields.isEmpty {
            section(lang.t("Dữ liệu CCCD (DG13)", "Vietnamese ID data (DG13)"))
            Card {
                ForEach(Array(r.vnFields.enumerated()), id: \.element.id) { i, f in
                    InfoRow(label: f.label, value: f.value)
                    if i < r.vnFields.count - 1 { Divider() }
                }
            }
            Text(lang.t("Nhãn trường theo cấu trúc DG13 phổ biến, cần đối chiếu đặc tả chính thức.", "Field labels follow the common DG13 layout; verify against the official specification."))
                .font(.system(size: 12)).foregroundStyle(Theme.tertiary).padding(.top, 8)
                .padding(.bottom, 24)
        }

        section(lang.t("Kiểm tra bảo mật", "Security checks"))
        Card {
            check(lang.t("Mở khoá chip", "Chip access"), r.accessMethod, ok: r.accessMethod != "—"); Divider()
            check(lang.t("Dữ liệu không bị sửa (hash khớp SOD)", "Data not altered (hashes match SOD)"), r.dataIntact ? lang.t("Đạt", "Passed") : lang.t("Không đạt", "Failed"), ok: r.dataIntact); Divider()
            check(lang.t("Chữ ký số tới CSCA", "Signature to CSCA"), r.signatureVerified ? lang.t("Đạt", "Passed") : lang.t("Chưa kiểm tra", "Not checked"), ok: r.signatureVerified ? true : nil); Divider()
            check(lang.t("Chip Authentication", "Chip Authentication"), caText(r.chipAuthentication), ok: r.chipAuthentication == "success" ? true : (r.chipAuthentication == "failed" ? false : nil))
        }
        Text(lang.t("Chữ ký CSCA cần danh sách chứng thư gốc (master list); ngân hàng thật xác thực thêm qua hệ thống của Bộ Công an. DG đã đọc: ", "CSCA verification needs a master list of root certificates; banks also verify via the national system. Data groups read: ") + r.dataGroups.joined(separator: ", "))
            .font(.system(size: 12)).foregroundStyle(Theme.tertiary).padding(.top, 8)
    }

    private func section(_ t: String) -> some View {
        Text(t).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.ink).padding(.bottom, 10)
    }

    private func sex(_ s: String) -> String {
        switch s.uppercased() {
        case "F": return lang.t("Nữ", "Female")
        case "M": return lang.t("Nam", "Male")
        default: return s
        }
    }

    private func caText(_ s: String) -> String {
        switch s {
        case "success": return lang.t("Đạt", "Passed")
        case "failed": return lang.t("Không đạt", "Failed")
        case "unsupported": return lang.t("Chip không hỗ trợ", "Not supported")
        default: return lang.t("Chưa chạy", "Not run")
        }
    }

    private func check(_ label: String, _ value: String, ok: Bool?) -> some View {
        HStack(spacing: 10) {
            Image(systemName: ok == true ? "checkmark.circle.fill" : (ok == false ? "xmark.circle.fill" : "minus.circle.fill"))
                .foregroundStyle(ok == true ? Theme.success : (ok == false ? Theme.danger : Theme.tertiary))
            Text(label).font(.system(size: 14)).foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            Text(value).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.secondary)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}
