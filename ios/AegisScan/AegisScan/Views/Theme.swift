import SwiftUI

/// Song ngữ: t("Tiếng Việt", "English"), lựa chọn được nhớ giữa các lần mở app
final class Lang: ObservableObject {
    @Published var english: Bool {
        didSet { UserDefaults.standard.set(english, forKey: "aegis.lang.en") }
    }
    init() { english = UserDefaults.standard.bool(forKey: "aegis.lang.en") }
    func t(_ vi: String, _ en: String) -> String { english ? en : vi }
}

/// Màu & gradient skin "Aurora" – trùng token của bản web
enum Theme {
    static let ink = Color(hex: 0x1A1A1A)
    static let secondary = Color(hex: 0x575C6B)
    static let tertiary = Color(hex: 0x6B7080)
    static let sunken = Color(hex: 0xF4F5F8)
    static let border = Color(hex: 0xE9EAEE)
    static let purple = Color(hex: 0xB46CF6)
    static let purpleText = Color(hex: 0x6A2FB5)
    static let amber = Color(hex: 0xF7B31B)
    static let deep = Color(hex: 0x482B64)
    static let success = Color(hex: 0x157347)
    static let successBg = Color(hex: 0xE8F7EF)
    static let warning = Color(hex: 0x8A5300)
    static let warningBg = Color(hex: 0xFEF4DD)
    static let danger = Color(hex: 0xB42318)
    static let dangerBg = Color(hex: 0xFDF0EE)

    /// Trang trí
    static let brand = LinearGradient(colors: [Color(hex: 0xB46CF6), Color(hex: 0xD98CA0), Color(hex: 0xF7B31B)], startPoint: .leading, endPoint: .trailing)
    /// Nút chính – đậm hơn để chữ trắng đạt tương phản AA ở giữa nút
    static let action = LinearGradient(colors: [Color(hex: 0x8640E0), Color(hex: 0xB04F80), Color(hex: 0xCF7212)], startPoint: .leading, endPoint: .trailing)
    static let soft = LinearGradient(colors: [Color(hex: 0xF3ECFE), Color(hex: 0xFDF1F0), Color(hex: 0xFEF4DD)], startPoint: .topLeading, endPoint: .bottomTrailing)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

// MARK: Thành phần dùng chung

struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                if let s = systemImage { Image(systemName: s) }
            }
            .font(.system(size: 17, weight: .semibold))
            .frame(maxWidth: .infinity, minHeight: 56)
            .foregroundStyle(disabled ? Theme.secondary : .white)
            .background {
                if disabled { Capsule().fill(Color(hex: 0xD9DBE1)) } else { Capsule().fill(Theme.action) }
            }
        }
        .disabled(disabled)
        .buttonStyle(PressableStyle())
    }
}

struct SecondaryButton: View {
    let title: String
    var systemImage: String?
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let s = systemImage { Image(systemName: s) }
                Text(title)
            }
            .font(.system(size: 16, weight: .semibold))
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundStyle(Theme.ink)
        }
        .buttonStyle(PressableStyle())
    }
}

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Ô icon nền gradient nhạt, icon tím
struct IconTile: View {
    let systemImage: String
    var size: CGFloat = 48
    var body: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Theme.soft)
            .frame(width: size, height: size)
            .overlay(Image(systemName: systemImage).font(.system(size: size * 0.42, weight: .medium)).foregroundStyle(Color(hex: 0x8A45E0)))
    }
}

struct LangToggle: View {
    @EnvironmentObject var lang: Lang
    var onDark = false
    var body: some View {
        HStack(spacing: 0) {
            ForEach([false, true], id: \.self) { en in
                Button { lang.english = en } label: {
                    Text(en ? "EN" : "VI")
                        .font(.system(size: 12, weight: .bold))
                        .frame(minWidth: 34, minHeight: 26)
                        .foregroundStyle(lang.english == en ? Theme.ink : (onDark ? .white.opacity(0.75) : Theme.tertiary))
                        .background(Capsule().fill(lang.english == en ? Color.white : .clear).shadow(color: .black.opacity(lang.english == en ? 0.08 : 0), radius: 2, y: 1))
                }
                .accessibilityLabel(en ? "English" : "Tiếng Việt")
                .accessibilityAddTraits(lang.english == en ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Capsule().fill(onDark ? Color.white.opacity(0.15) : Theme.sunken))
    }
}

/// Khung màn hình kiểu ảnh mẫu: nút quay lại, tiêu đề nhỏ, nội dung căn trái, nút chính ở đáy
struct Screen<Content: View, Footer: View>: View {
    @EnvironmentObject var lang: Lang
    @Environment(\.dismiss) private var dismiss
    var title: String = ""
    var step: Int?
    var showBack = true
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                if showBack {
                    Button { dismiss() } label: {
                        Image(systemName: "arrow.left").font(.system(size: 20, weight: .medium)).frame(width: 44, height: 44)
                    }
                    .foregroundStyle(Theme.ink)
                    .accessibilityLabel(lang.t("Quay lại", "Back"))
                } else {
                    Color.clear.frame(width: 44, height: 44)
                }
                Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.tertiary).frame(maxWidth: .infinity)
                LangToggle()
            }
            .padding(.horizontal, 12)
            if let step { StepBar(step: step).padding(.horizontal, 24).padding(.top, 4) }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) { content() }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
            }
            VStack(spacing: 8) {
                footer()
                Label(lang.t("Dữ liệu chỉ xử lý trên máy, không gửi đi", "Processed on this device only, never uploaded"), systemImage: "lock")
                    .font(.system(size: 12)).foregroundStyle(Theme.tertiary)
                    .padding(.top, 2)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 8)
        }
        .background(Color.white.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct StepBar: View {
    @EnvironmentObject var lang: Lang
    let step: Int
    var onDark = false
    private var names: [String] { [lang.t("Giấy tờ", "Document"), lang.t("Quét MRZ", "Scan MRZ"), lang.t("Đọc chip", "Read chip"), lang.t("Khuôn mặt", "Face"), lang.t("Kết quả", "Result")] }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(names[step]).font(.system(size: 12, weight: .semibold))
                Spacer()
                Text(lang.t("Bước \(step + 1)/\(names.count)", "Step \(step + 1) of \(names.count)")).font(.system(size: 12)).foregroundStyle(onDark ? .white.opacity(0.7) : Theme.tertiary)
            }
            .foregroundStyle(onDark ? .white : Theme.ink)
            HStack(spacing: 6) {
                ForEach(0..<names.count, id: \.self) { i in
                    Capsule()
                        .fill(i <= step ? AnyShapeStyle(Theme.brand) : AnyShapeStyle(onDark ? Color.white.opacity(0.2) : Theme.sunken))
                        .frame(height: 4)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct PageTitle: View {
    let title: String
    var subtitle: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 30, weight: .semibold)).tracking(-0.4).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
            if let subtitle { Text(subtitle).font(.system(size: 15)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true) }
        }
        .padding(.bottom, 24)
    }
}

/// Minh hoạ "quét giấy tờ": thẻ trắng có khuôn mặt trong khung ngắm + vạch quét gradient
struct ScanIllustration: View {
    var symbol = "person.fill"
    @State private var y: CGFloat = 0
    var body: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(Theme.sunken)
            .frame(height: 220)
            .overlay {
                HStack(spacing: 18) {
                    ZStack {
                        Corners().stroke(Theme.ink, style: StrokeStyle(lineWidth: 3, lineCap: .round)).frame(width: 84, height: 84)
                        Circle().fill(LinearGradient(colors: [Color(hex: 0xFFD7C4), Color(hex: 0xF4A487)], startPoint: .top, endPoint: .bottom)).frame(width: 58, height: 58)
                        Image(systemName: symbol).font(.system(size: 30)).foregroundStyle(Color(hex: 0x3A3A42))
                        Capsule().fill(Theme.brand).frame(width: 84, height: 3).offset(y: y)
                    }
                    .frame(width: 84, height: 84)
                    .clipped()
                    VStack(alignment: .leading, spacing: 10) {
                        Capsule().fill(Theme.sunken).frame(width: 70, height: 10)
                        Capsule().fill(Theme.sunken).frame(width: 96, height: 10)
                        Capsule().fill(Theme.sunken).frame(width: 80, height: 10)
                        Capsule().fill(Theme.sunken).frame(width: 96, height: 10)
                    }
                }
                .padding(22)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white).shadow(color: Theme.deep.opacity(0.1), radius: 16, y: 8))
            }
            .accessibilityHidden(true)
            .onAppear {
                y = -36
                withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) { y = 36 }
            }
    }
}

/// 4 góc khung ngắm
struct Corners: Shape {
    var length: CGFloat = 18
    func path(in r: CGRect) -> Path {
        var p = Path()
        let l = length
        p.move(to: CGPoint(x: r.minX, y: r.minY + l)); p.addLine(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.minX + l, y: r.minY))
        p.move(to: CGPoint(x: r.maxX - l, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY + l))
        p.move(to: CGPoint(x: r.maxX, y: r.maxY - l)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY)); p.addLine(to: CGPoint(x: r.maxX - l, y: r.maxY))
        p.move(to: CGPoint(x: r.minX + l, y: r.maxY)); p.addLine(to: CGPoint(x: r.minX, y: r.maxY)); p.addLine(to: CGPoint(x: r.minX, y: r.maxY - l))
        return p
    }
}

struct InfoRow: View {
    let label: String
    let value: String
    var mono = false
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(label).font(.system(size: 14)).foregroundStyle(Theme.tertiary)
            Spacer(minLength: 8)
            Text(value).font(.system(size: 15, weight: .medium)).monospacedDigit().multilineTextAlignment(.trailing).foregroundStyle(Theme.ink).textSelection(.enabled)
        }
        .padding(.vertical, 12)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .padding(.horizontal, 16)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }
}
