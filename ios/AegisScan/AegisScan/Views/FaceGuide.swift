import SwiftUI

/// Các bước hiển thị trên màn khuôn mặt: đưa mặt vào khung → từng thử thách → chụp
enum FaceStep: Hashable {
    case frame
    case challenge(Challenge)
    case capture

    static func list(_ challenges: [Challenge]) -> [FaceStep] { [.frame] + challenges.map { .challenge($0) } + [.capture] }
}

extension Lang {
    func title(_ s: FaceStep) -> String {
        switch s {
        case .frame: return t("Đưa mặt vào khung", "Face in the oval")
        case .challenge(.blink): return t("Chớp mắt", "Blink")
        case .challenge(.turnLeft): return t("Quay trái", "Turn left")
        case .challenge(.turnRight): return t("Quay phải", "Turn right")
        case .capture: return t("Nhìn thẳng", "Look straight")
        }
    }
}

/// Hàng bước nhỏ: ✓ đã xong · ● đang làm · ○ chưa tới
struct FaceStepPills: View {
    @EnvironmentObject var lang: Lang
    let steps: [FaceStep]
    let current: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                let done = i < current, now = i == current
                HStack(spacing: 4) {
                    Image(systemName: done ? "checkmark.circle.fill" : (now ? "\(i + 1).circle.fill" : "\(i + 1).circle"))
                        .font(.system(size: 13, weight: .bold))
                    if now { Text(lang.title(s)).font(.system(size: 12, weight: .semibold)).lineLimit(1) }
                }
                .foregroundStyle(done ? Color(hex: 0x3DD68C) : (now ? Theme.ink : .white.opacity(0.7)))
                .padding(.horizontal, now ? 10 : 6).padding(.vertical, 6)
                .background(Capsule().fill(now ? Color.white : Color.white.opacity(0.12)))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: current)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(lang.t("Bước \(min(current + 1, steps.count)) trên \(steps.count): ", "Step \(min(current + 1, steps.count)) of \(steps.count): ") + lang.title(steps[min(current, steps.count - 1)]))
    }
}

/// Viền tròn có vòng tiến độ: xanh khi đúng tư thế, phần đã xong tô gradient
struct CircleProgress: View {
    let progress: Double
    let ok: Bool

    var body: some View {
        ZStack {
            Circle().stroke(ok ? Color(hex: 0x8BE3B5) : Color.white.opacity(0.55), lineWidth: 5)
            Circle()
                .trim(from: 0, to: max(0.001, progress))
                .stroke(Theme.brand, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.4), value: progress)
        }
        .animation(.easeInOut(duration: 0.2), value: ok)
    }
}

/// Dấu ✓ bật lên khi xong một bước
struct SuccessPop: View {
    @State private var show = false
    var body: some View {
        Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 84, weight: .bold))
            .foregroundStyle(.white, Color(hex: 0x1FB46A))
            .scaleEffect(show ? 1 : 0.4)
            .opacity(show ? 1 : 0)
            .onAppear { withAnimation(.spring(response: 0.3, dampingFraction: 0.55)) { show = true } }
            .accessibilityHidden(true)
    }
}
