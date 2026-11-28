import SwiftUI

// MARK: 5 · Khuôn mặt: kiểm tra người thật + so khớp

struct FaceIntroView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow

    private var reference: UIImage? { flow.result?.photo ?? flow.printedPortrait }
    private var source: ReferenceSource {
        if flow.result?.photo != nil && flow.result?.isSample == false { return .chipDG2 }
        return flow.printedPortrait != nil ? .printedPortrait : .sample
    }

    var body: some View {
        Screen(title: lang.t("Xác thực khuôn mặt", "Face check"), step: 3) {
            PageTitle(
                title: lang.t("Xác thực khuôn mặt", "Verify your face"),
                subtitle: lang.t("Khoảng 15 giây. Làm theo hình hướng dẫn trên màn hình, app tự chụp – bạn không cần bấm nút.", "About 15 seconds. Follow the on-screen pictures; the app captures by itself – no button to press.")
            )

            // 4 bước có hình động
            VStack(spacing: 10) {
                guideRow(1, .frame, lang.t("Đưa khuôn mặt vào vòng tròn", "Fit your face in the circle"), lang.t("Giữ máy ngang tầm mắt, cách khoảng 30 cm.", "Hold the phone at eye level, about 30 cm away."))
                guideRow(2, .challenge(.blink), lang.t("Chớp mắt một lần", "Blink once"), lang.t("Nhắm hẳn mắt rồi mở ra.", "Close your eyes fully, then open them."))
                guideRow(3, .challenge(.turnLeft), lang.t("Quay đầu theo mũi tên", "Turn your head with the arrow"), lang.t("Sang trái hoặc phải – app chọn ngẫu nhiên.", "Left or right – the app picks at random."))
                guideRow(4, .capture, lang.t("Nhìn thẳng, app tự chụp", "Look straight, the app takes the photo"), lang.t("Vòng tròn đầy là xong.", "Done when the ring is full."))
            }
            .padding(.bottom, 16)

            // Mẹo nhanh
            HStack(spacing: 8) {
                tip("sun.max.fill", lang.t("Đủ sáng", "Good light"))
                tip("eyeglasses", lang.t("Bỏ kính râm", "No sunglasses"))
                tip("facemask", lang.t("Bỏ khẩu trang", "No mask"))
            }
            .padding(.bottom, 20)

            // Ảnh dùng để đối chiếu
            HStack(spacing: 14) {
                Group {
                    if let r = reference { Image(uiImage: r).resizable().scaledToFill() }
                    else { ZStack { Theme.sunken; Image(systemName: "person.crop.square").font(.system(size: 26)).foregroundStyle(Theme.tertiary) } }
                }
                .frame(width: 56, height: 70)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(lang.t("Ảnh đối chiếu", "Reference photo")).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.tertiary)
                    Text(sourceText).font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 16).stroke(Theme.border))
            .padding(.bottom, 12)

            if source != .chipDG2 {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "info.circle.fill").foregroundStyle(Theme.warning)
                    Text(lang.t("Chưa có ảnh trong chip. Bạn có thể chụp ảnh chân dung in trên mặt trước giấy tờ để so thử – kết quả tối đa là \"Cần xem lại\" vì ảnh in dễ làm giả.", "No chip photo yet. You can photograph the portrait printed on the front of the document to try matching – the best result is \"Needs review\" because printed photos are easy to forge."))
                        .font(.system(size: 14)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.warningBg))
            }
        } footer: {
            PrimaryButton(title: lang.t("Bắt đầu", "Start"), systemImage: "camera.fill") { flow.path.append(.selfie) }
            if source != .chipDG2 {
                SecondaryButton(title: flow.printedPortrait == nil ? lang.t("Chụp ảnh trên mặt trước giấy tờ", "Photograph the printed portrait") : lang.t("Chụp lại ảnh trên giấy tờ", "Retake the printed portrait"), systemImage: "person.crop.rectangle") {
                    flow.path.append(.portrait)
                }
            }
        }
    }

    private func guideRow(_ n: Int, _ step: FaceStep, _ title: String, _ detail: String) -> some View {
        HStack(spacing: 14) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Theme.soft).frame(width: 88, height: 88)
                Mascot3D(step: step).frame(width: 88, height: 88).clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                Text("\(n)").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 22, height: 22).background(Circle().fill(Theme.action)).offset(x: -6, y: -6)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                Text(detail).font(.system(size: 13)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func tip(_ icon: String, _ text: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color(hex: 0x8A45E0))
            Text(text).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 62)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.sunken))
        .accessibilityElement(children: .combine)
    }

    private var sourceText: String {
        switch source {
        case .chipDG2: return lang.t("Ảnh trong chip (DG2)", "Chip photo (DG2)")
        case .printedPortrait: return lang.t("Ảnh in trên mặt trước giấy tờ", "Portrait printed on the document")
        case .sample: return lang.t("Chưa có – chỉ kiểm tra người thật", "None – liveness check only")
        }
    }
}

/// Camera trước: thử thách người thật rồi chụp, có hướng dẫn bằng hình
struct SelfieView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cam = FaceCamera()
    @State private var matching = false
    @State private var startedAt = Date()
    @State private var pop = 0

    private var steps: [FaceStep] { FaceStep.list(cam.challenges) }
    private var livenessDone: Bool { !cam.challenges.isEmpty && cam.completed.count == cam.challenges.count }
    /// Bước đang làm (chỉ số trong `steps`)
    private var current: Int {
        if cam.captured != nil { return steps.count }
        if livenessDone { return steps.count - 1 }
        if cam.completed.isEmpty, case .adjust = cam.event { return 0 }
        return min(1 + cam.completed.count, steps.count - 1)
    }
    private var currentStep: FaceStep { steps[min(current, steps.count - 1)] }
    private var progress: Double { Double(current) / Double(max(steps.count, 1)) }
    private var hint: FaceHint {
        switch cam.event {
        case .adjust(let h), .inProgress(_, let h): return h
        default: return .none
        }
    }

    var body: some View {
        ZStack {
            Color(hex: 0x0D0B12).ignoresSafeArea()
            if cam.status == .running {
                CameraPreview(session: cam.session).ignoresSafeArea()
                GeometryReader { g in
                    let c = Self.targetCircle(in: g.size)
                    Path { p in p.addRect(CGRect(origin: .zero, size: g.size)); p.addEllipse(in: c) }
                        .fill(Color(hex: 0x1A1426).opacity(0.72), style: FillStyle(eoFill: true))
                    CircleProgress(progress: progress, ok: hint == .none && cam.faceInFrame)
                        .frame(width: c.width, height: c.height)
                        .position(x: c.midX, y: c.midY)
                    // Mũi tên chỉ hướng quay đầu (ảnh xem trước đã lật gương: trái của bạn = trái màn hình)
                    if case .challenge(let ch) = currentStep, ch != .blink, hint != .returnToCenter {
                        TurnArrow(left: ch == .turnLeft)
                            .position(x: ch == .turnLeft ? c.minX - 4 : c.maxX + 4, y: c.midY)
                    }
                    if pop > 0 { SuccessPop().id(pop).position(x: c.midX, y: c.midY) }
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
                    Text(lang.t("Xác thực khuôn mặt", "Face check")).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                    Spacer()
                    LangToggle(onDark: true)
                }
                .padding(.horizontal, 12)
                if cam.status == .running {
                    FaceStepPills(steps: steps, current: current).padding(.top, 10)
                }
                Spacer()
                bottomCard.padding(.horizontal, 16).padding(.bottom, 12)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .statusBarHidden(true)
        .onAppear { startedAt = Date(); cam.start(mode: .selfie) }
        .onDisappear { cam.stop() }
        .onChange(of: cam.captured) { img in
            guard let img else { return }
            finish(selfies: [img] + cam.alternates, passed: true)
        }
        .onChange(of: cam.completed) { c in
            guard !c.isEmpty else { return }
            pop += 1
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { pop = 0 }
        }
        .onChange(of: instruction) { text in
            UIAccessibility.post(notification: .announcement, argument: text)
        }
        .onChange(of: cam.event) { e in
            if e == .timedOut { finish(selfies: [], passed: false) }
        }
    }

    /// Vòng tròn mục tiêu trên màn hình, tính từ FaceTarget (toạ độ ảnh) qua phép phóng aspect-fill
    static func targetCircle(in size: CGSize) -> CGRect {
        let a = FaceTarget.imageAspect
        let scale = max(size.width / CGFloat(a), size.height)          // ảnh: rộng a, cao 1 (đơn vị)
        let imgW = CGFloat(a) * scale, imgH = scale
        let ox = (size.width - imgW) / 2, oy = (size.height - imgH) / 2
        let cx = ox + CGFloat(FaceTarget.centerX) * imgW
        let cy = oy + CGFloat(FaceTarget.centerY) * imgH
        let r = CGFloat(FaceTarget.radius) * imgW
        return CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)
    }

    // MARK: Thẻ hướng dẫn ở đáy

    @ViewBuilder private var bottomCard: some View {
        switch cam.status {
        case .denied:
            notice(lang.t("Chưa có quyền dùng camera", "Camera access is off"), lang.t("Vào Cài đặt › Aegis Scan › Camera để cho phép.", "Allow it in Settings › Aegis Scan › Camera."))
        case .unavailable:
            notice(lang.t("Không có camera", "No camera available"), lang.t("Simulator không có camera trước. Dùng iPhone thật để thử bước này.", "The Simulator has no front camera. Use a real iPhone for this step."))
        case .running:
            VStack(spacing: 12) {
                HStack(spacing: 14) {
                    Mascot3D(step: matching ? .capture : currentStep)
                        .frame(width: 92, height: 92)
                        .background(Circle().fill(Theme.soft))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(matching ? lang.t("Đang so khớp khuôn mặt…", "Matching your face…") : instruction)
                            .font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(detail).font(.system(size: 14)).foregroundStyle(Theme.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                if hint != .none && !matching {
                    Label(hintText(hint), systemImage: hintIcon(hint))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.warning)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.warningBg))
                }
                if !matching { countdown }
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(.white))
            .animation(.easeInOut(duration: 0.2), value: current)
            .animation(.easeInOut(duration: 0.2), value: hint)
        default:
            ProgressView().tint(.white)
        }
    }

    /// Thanh thời gian còn lại
    private var countdown: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { ctx in
            let left = max(0, LivenessTracker.timeout - ctx.date.timeIntervalSince(startedAt))
            HStack(spacing: 10) {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.sunken)
                        Capsule().fill(left < 8 ? AnyShapeStyle(Theme.amber) : AnyShapeStyle(Theme.brand))
                            .frame(width: g.size.width * left / LivenessTracker.timeout)
                    }
                }
                .frame(height: 5)
                Text(lang.t("\(Int(left.rounded(.up))) giây", "\(Int(left.rounded(.up))) s"))
                    .font(.system(size: 12, weight: .medium)).monospacedDigit().foregroundStyle(Theme.tertiary)
            }
            .accessibilityHidden(true)
        }
    }

    private var instruction: String {
        if cam.event == .timedOut { return lang.t("Hết thời gian", "Time's up") }
        if hint == .returnToCenter { return lang.t("Quay lại nhìn thẳng", "Face forward again") }
        switch currentStep {
        case .frame: return lang.t("Đưa khuôn mặt vào vòng tròn", "Fit your face in the circle")
        case .challenge(.blink): return lang.t("Chớp mắt một lần", "Blink once")
        case .challenge(.turnLeft): return lang.t("Quay đầu sang trái", "Turn your head left")
        case .challenge(.turnRight): return lang.t("Quay đầu sang phải", "Turn your head right")
        case .capture: return lang.t("Nhìn thẳng, giữ yên", "Look straight, hold still")
        }
    }

    private var detail: String {
        switch currentStep {
        case .frame: return lang.t("Mặt nằm gọn trong vòng, chỉ một người, đủ sáng.", "Face inside the circle, one person, good light.")
        case .challenge(.blink): return lang.t("Nhắm hẳn mắt rồi mở ra, như linh vật.", "Close your eyes fully, then open – like the mascot.")
        case .challenge: return lang.t("Quay theo mũi tên rồi quay lại nhìn thẳng.", "Turn towards the arrow, then face forward again.")
        case .capture: return lang.t("App tự chụp ảnh rõ nhất, không cần bấm nút.", "The app picks the sharpest photo by itself.")
        }
    }

    private func hintText(_ h: FaceHint) -> String {
        switch h {
        case .none: return ""
        case .noFace: return lang.t("Chưa thấy khuôn mặt", "No face found")
        case .multipleFaces: return lang.t("Chỉ một người trong khung", "Only one person in frame")
        case .tooDark: return lang.t("Hơi tối – ra chỗ sáng hơn", "Too dark – move to better light")
        case .tooFar: return lang.t("Đưa máy lại gần hơn", "Move the phone closer")
        case .tooClose: return lang.t("Đưa máy ra xa một chút", "Move the phone a little further away")
        case .moveLeft: return lang.t("Dịch mặt sang trái một chút", "Move your face slightly left")
        case .moveRight: return lang.t("Dịch mặt sang phải một chút", "Move your face slightly right")
        case .moveUp: return lang.t("Nâng máy lên / dịch mặt lên", "Move your face up a little")
        case .moveDown: return lang.t("Hạ máy xuống / dịch mặt xuống", "Move your face down a little")
        case .lookStraight: return lang.t("Nhìn thẳng vào camera", "Look straight at the camera")
        case .straightenHead: return lang.t("Giữ đầu thẳng, không nghiêng", "Keep your head level")
        case .openEyes: return lang.t("Mở to mắt", "Open your eyes")
        case .returnToCenter: return lang.t("Tốt! Giờ quay lại nhìn thẳng", "Good! Now face forward")
        case .holdStill: return lang.t("Giữ yên…", "Hold still…")
        }
    }

    private func hintIcon(_ h: FaceHint) -> String {
        switch h {
        case .tooDark: return "sun.max"
        case .tooFar: return "arrow.up.left.and.arrow.down.right"
        case .tooClose: return "arrow.down.right.and.arrow.up.left"
        case .moveLeft: return "arrow.left"
        case .moveRight: return "arrow.right"
        case .moveUp: return "arrow.up"
        case .moveDown: return "arrow.down"
        case .multipleFaces: return "person.2"
        case .openEyes: return "eye"
        case .holdStill: return "hand.raised"
        default: return "face.smiling"
        }
    }

    private func notice(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 16, weight: .semibold))
            Text(body).font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.1)))
    }

    private func finish(selfies: [UIImage], passed: Bool) {
        guard !matching else { return }
        cam.stop()
        let reference = flow.result?.photo ?? flow.printedPortrait
        let chip = flow.result?.photo != nil && flow.result?.isSample == false
        let src: ReferenceSource = reference == nil ? .sample : (chip ? .chipDG2 : .printedPortrait)
        let challenges = cam.completed
        let quality = Double(cam.bestQuality)
        matching = true
        DispatchQueue.global(qos: .userInitiated).async {
            var sim: Double?
            if passed, !selfies.isEmpty, let r = reference { sim = FaceMatcher.compare(selfies, r) }
            let outcome = FaceMatcher.decide(similarity: sim, livenessPassed: passed, source: src)
            DispatchQueue.main.async {
                flow.biometric = BiometricResult(selfie: selfies.first, reference: reference, source: src,
                                                 challenges: challenges, livenessPassed: passed, similarity: sim,
                                                 quality: passed ? quality : nil, outcome: outcome)
                matching = false
                flow.path.append(.result)
            }
        }
    }
}

/// Mũi tên nhấp nháy cạnh vòng tròn
struct TurnArrow: View {
    let left: Bool
    @State private var on = false
    var body: some View {
        Image(systemName: left ? "chevron.left.2" : "chevron.right.2")
            .font(.system(size: 40, weight: .heavy))
            .foregroundStyle(Color(hex: 0xFCD98C))
            .shadow(color: .black.opacity(0.35), radius: 6)
            .offset(x: on ? (left ? -10 : 10) : 0)
            .opacity(on ? 1 : 0.55)
            .onAppear { withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) { on = true } }
            .accessibilityHidden(true)
    }
}

/// Camera sau: chụp ảnh chân dung in trên mặt trước giấy tờ (dự phòng khi không có ảnh chip)
struct PortraitCaptureView: View {
    @EnvironmentObject var lang: Lang
    @EnvironmentObject var flow: Flow
    @Environment(\.dismiss) private var dismiss
    @StateObject private var cam = FaceCamera()

    var body: some View {
        ZStack {
            Color(hex: 0x0D0B12).ignoresSafeArea()
            if cam.status == .running {
                CameraPreview(session: cam.session).ignoresSafeArea()
                GeometryReader { g in
                    let w = g.size.width - 40
                    let rect = CGRect(x: 20, y: g.size.height * 0.42 - w / 3.17, width: w, height: w / 1.586)
                    Path { p in p.addRect(CGRect(origin: .zero, size: g.size)); p.addRoundedRect(in: rect, cornerSize: CGSize(width: 16, height: 16)) }
                        .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))
                    Corners(length: 30)
                        .stroke(cam.faceInFrame ? Theme.amber : .white, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: rect.width + 12, height: rect.height + 12)
                        .position(x: rect.midX, y: rect.midY)
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
                    Text(lang.t("Mặt trước giấy tờ", "Document – front")).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                    Spacer()
                    LangToggle(onDark: true)
                }
                .padding(.horizontal, 12)
                VStack(alignment: .leading, spacing: 6) {
                    Text(lang.t("Đưa mặt trước có ảnh vào khung", "Fit the photo side in the frame")).font(.system(size: 22, weight: .semibold))
                    Text(lang.t("Ảnh chân dung rõ nét, không loá. App tự chụp khi thấy khuôn mặt.", "Keep the portrait sharp and glare-free. The app captures automatically when it sees the face."))
                        .font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24).padding(.top, 16)
                Spacer()
                if cam.status == .unavailable || cam.status == .denied {
                    Text(cam.status == .denied ? lang.t("Chưa có quyền dùng camera. Vào Cài đặt › Aegis Scan › Camera để cho phép.", "Camera access is off. Allow it in Settings › Aegis Scan › Camera.") : lang.t("Simulator không có camera. Dùng iPhone thật để chụp ảnh trên giấy tờ.", "The Simulator has no camera. Use a real iPhone to photograph the document."))
                        .font(.system(size: 14)).foregroundStyle(.white)
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.1)))
                        .padding(.horizontal, 24).padding(.bottom, 12)
                }
                Label(cam.faceInFrame ? lang.t("Đã thấy khuôn mặt – giữ yên…", "Face found – hold still…") : lang.t("Đang tìm ảnh chân dung…", "Looking for the portrait…"), systemImage: "person.crop.rectangle")
                    .font(.system(size: 15, weight: .medium))
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Capsule().fill(cam.faceInFrame ? Color.white : Color.white.opacity(0.15)))
                    .foregroundStyle(cam.faceInFrame ? Theme.ink : .white)
                    .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .statusBarHidden(true)
        .onAppear { cam.start(mode: .printedPortrait) }
        .onDisappear { cam.stop() }
        .onChange(of: cam.captured) { img in
            guard let img else { return }
            flow.printedPortrait = img
            dismiss()
        }
    }
}

// MARK: Kết quả sinh trắc

struct BiometricSection: View {
    @EnvironmentObject var lang: Lang
    let b: BiometricResult

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(lang.t("Sinh trắc học", "Biometrics")).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.ink).padding(.bottom, 10)
            HStack(spacing: 12) {
                thumb(b.selfie, lang.t("Selfie", "Selfie"))
                Image(systemName: "arrow.left.arrow.right").foregroundStyle(Theme.tertiary)
                thumb(b.reference, sourceLabel)
                Spacer(minLength: 0)
            }
            .padding(.bottom, 14)

            HStack(spacing: 10) {
                Image(systemName: outcomeIcon).font(.system(size: 22)).foregroundStyle(outcomeColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(outcomeTitle).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.ink)
                    Text(outcomeDetail).font(.system(size: 13)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 16).fill(outcomeBg))
            .padding(.bottom, 12)

            Card {
                row(lang.t("Kiểm tra người thật", "Liveness"), b.livenessPassed ? lang.t("Đạt", "Passed") : lang.t("Không đạt", "Failed"), ok: b.livenessPassed); Divider()
                row(lang.t("Thử thách đã làm", "Challenges done"), b.challenges.isEmpty ? "—" : b.challenges.map(challengeText).joined(separator: ", "), ok: nil); Divider()
                row(lang.t("Chất lượng ảnh selfie", "Selfie quality"), b.quality.map { String(format: "%.0f%%", $0 * 100) } ?? "—", ok: b.quality.map { $0 >= 0.3 }); Divider()
                row(lang.t("Điểm tương đồng", "Similarity"), b.similarity.map { String(format: "%.0f%%", $0 * 100) } ?? "—", ok: nil); Divider()
                row(lang.t("Nguồn ảnh đối chiếu", "Reference"), sourceLabel, ok: b.source == .chipDG2 ? true : nil)
            }
            Text(lang.t("Bản thử nghiệm: so khớp bằng Apple Vision trên máy, ngưỡng chưa hiệu chỉnh, chưa chứng nhận chống giả mạo (ISO/IEC 30107-3). Ngưỡng: ≥ 80% khớp · 60–79% cần xem lại · < 60% không khớp.", "Prototype: on-device matching with Apple Vision, uncalibrated thresholds, not certified for presentation-attack detection (ISO/IEC 30107-3). Thresholds: ≥ 80% match · 60–79% review · < 60% no match."))
                .font(.system(size: 12)).foregroundStyle(Theme.tertiary).padding(.top, 8)
        }
        .padding(.bottom, 24)
    }

    private var sourceLabel: String {
        switch b.source {
        case .chipDG2: return lang.t("Ảnh chip", "Chip photo")
        case .printedPortrait: return lang.t("Ảnh in", "Printed photo")
        case .sample: return lang.t("Không có", "None")
        }
    }

    private func challengeText(_ c: Challenge) -> String {
        switch c {
        case .blink: return lang.t("chớp mắt", "blink")
        case .turnLeft: return lang.t("quay trái", "turn left")
        case .turnRight: return lang.t("quay phải", "turn right")
        }
    }

    private var outcomeTitle: String {
        switch b.outcome {
        case .match: return lang.t("Khuôn mặt khớp", "Face matches")
        case .review: return lang.t("Cần xem lại", "Needs review")
        case .noMatch: return lang.t("Khuôn mặt không khớp", "Face doesn't match")
        case .livenessFailed: return lang.t("Không qua kiểm tra người thật", "Liveness check failed")
        }
    }

    private var outcomeDetail: String {
        switch b.outcome {
        case .match: return lang.t("Selfie khớp với ảnh trong chip. Trong luồng eKYC: được xét STP.", "The selfie matches the chip photo. In the eKYC flow: eligible for STP.")
        case .review:
            if b.source != .chipDG2 { return lang.t("Không có ảnh chip nên không tự động duyệt (C11). Trong luồng eKYC: REFER.", "No chip photo, so no automatic approval (C11). In the eKYC flow: REFER.") }
            if b.similarity == nil { return lang.t("Không tìm thấy khuôn mặt rõ trong một trong hai ảnh. Trong luồng eKYC: REFER.", "A clear face wasn't found in one of the photos. In the eKYC flow: REFER.") }
            return lang.t("Điểm nằm ở vùng biên. Trong luồng eKYC: REFER cho Compliance.", "Score is borderline. In the eKYC flow: REFER to Compliance.")
        case .noMatch: return lang.t("Selfie khác ảnh đối chiếu. Trong luồng eKYC: REJECTED hoặc REFER tuỳ cấu hình.", "The selfie differs from the reference. In the eKYC flow: REJECTED or REFER depending on config.")
        case .livenessFailed: return lang.t("Chưa hoàn thành thử thách trong 30 giây. Thử lại nơi đủ sáng.", "Challenges weren't completed within 30 seconds. Try again in good light.")
        }
    }

    private var outcomeIcon: String {
        switch b.outcome {
        case .match: return "checkmark.seal.fill"
        case .review: return "exclamationmark.triangle.fill"
        case .noMatch, .livenessFailed: return "xmark.octagon.fill"
        }
    }
    private var outcomeColor: Color { b.outcome == .match ? Theme.success : (b.outcome == .review ? Theme.warning : Theme.danger) }
    private var outcomeBg: Color { b.outcome == .match ? Theme.successBg : (b.outcome == .review ? Theme.warningBg : Theme.dangerBg) }

    private func thumb(_ img: UIImage?, _ label: String) -> some View {
        VStack(spacing: 6) {
            Group {
                if let img { Image(uiImage: img).resizable().scaledToFill() }
                else { ZStack { Theme.sunken; Image(systemName: "person.fill").font(.system(size: 26)).foregroundStyle(Theme.tertiary) } }
            }
            .frame(width: 84, height: 104)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.tertiary)
        }
        .accessibilityElement(children: .combine)
    }

    private func row(_ label: String, _ value: String, ok: Bool?) -> some View {
        HStack(spacing: 10) {
            Image(systemName: ok == true ? "checkmark.circle.fill" : (ok == false ? "xmark.circle.fill" : "minus.circle.fill"))
                .foregroundStyle(ok == true ? Theme.success : (ok == false ? Theme.danger : Theme.tertiary))
            Text(label).font(.system(size: 14)).foregroundStyle(Theme.ink)
            Spacer(minLength: 8)
            Text(value).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.secondary).multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}
