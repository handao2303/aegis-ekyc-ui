import Foundation

/// Kiểm tra người thật kiểu "active liveness": người dùng làm theo thử thách ngẫu nhiên
/// (chớp mắt, quay đầu). Ảnh in hoặc ảnh trên màn hình không chớp mắt được.
/// Logic thuần – không phụ thuộc camera – để kiểm thử bằng XCTest.
enum Challenge: String, CaseIterable, Equatable {
    case blink, turnLeft, turnRight

    /// Hai thử thách: luôn có chớp mắt + một hướng quay đầu ngẫu nhiên, thứ tự ngẫu nhiên
    static func random<G: RandomNumberGenerator>(using g: inout G) -> [Challenge] {
        let turn: Challenge = Bool.random(using: &g) ? .turnLeft : .turnRight
        return Bool.random(using: &g) ? [.blink, turn] : [turn, .blink]
    }
}

/// Khung tròn mục tiêu, tính trong toạ độ ảnh camera đã xoay đứng (x: 0…1 theo bề rộng,
/// y: 0…1 theo chiều cao, gốc ở góc trên trái). Màn camera vẽ đúng vòng tròn này.
enum FaceTarget {
    /// Tỉ lệ khung hình camera trước ở chế độ dọc (720 × 1280)
    static let imageAspect = 9.0 / 16.0
    static let centerX = 0.5
    static let centerY = 0.42
    /// Bán kính, tính theo bề rộng ảnh
    static let radius = 0.36
}

/// Một khung hình đã phân tích
struct FaceSample: Equatable {
    /// radian, dương = người dùng quay sang trái của họ (ảnh đã lật gương như người dùng thấy)
    var yaw: Double
    var leftEye: Double
    var rightEye: Double
    /// Bề rộng khuôn mặt / bề rộng ảnh
    var faceWidth: Double
    var time: TimeInterval
    /// Tâm khuôn mặt trong ảnh (0…1, gốc trên trái)
    var centerX = 0.5
    var centerY = FaceTarget.centerY
    /// Nghiêng đầu (radian), cúi / ngửa (radian)
    var roll = 0.0
    var pitch = 0.0
    /// Độ sáng trung bình 0…1
    var brightness = 0.5

    var eyes: Double { (leftEye + rightEye) / 2 }
}

/// Lời nhắc chỉnh tư thế – hiển thị cho người dùng
enum FaceHint: Equatable {
    case none, noFace, multipleFaces, tooDark, tooFar, tooClose, moveLeft, moveRight, moveUp, moveDown
    case lookStraight, straightenHead, openEyes, returnToCenter, holdStill
}

struct LivenessTracker {
    enum Event: Equatable {
        case adjust(FaceHint)                 // chưa đúng tư thế – chưa tính thử thách
        case inProgress(Challenge, FaceHint)
        case challengeDone(Challenge)
        case passed
        case timedOut
    }

    // Ngưỡng – chỉnh ở một chỗ
    static let turnYaw = 0.32            // ≈ 18°: đủ để coi là đã quay
    static let frontalYaw = 0.13         // ≈ 7°: coi là nhìn thẳng
    static let maxRoll = 0.26            // ≈ 15°
    static let maxPitch = 0.30
    static let blinkDrop = 0.62          // nhắm khi độ mở < 62% mức mở bình thường
    static let blinkRecover = 0.85
    static let openForCapture = 0.80
    static let minFaceWidth = 0.32       // mặt nhỏ hơn → xa quá
    static let maxFaceWidth = 0.70       // mặt lớn hơn → gần quá
    static let maxOffset = 0.11          // lệch tâm tối đa (theo bề rộng ảnh)
    static let minBrightness = 0.22
    static let turnHoldFrames = 2        // phải giữ hướng quay ít nhất 2 khung hình liên tiếp
    static let maxJump = 0.22            // mặt nhảy quá xa giữa 2 khung hình → nghi đổi người
    static let faceLostReset: TimeInterval = 1.5
    static let timeout: TimeInterval = 30

    let challenges: [Challenge]
    private(set) var index = 0
    private(set) var completed: [Challenge] = []
    /// Mức mở mắt bình thường của người này (đo khi nhìn thẳng)
    private(set) var openBaseline: Double = 0
    private var startedAt: TimeInterval?
    private var lastFaceAt: TimeInterval?
    private var last: FaceSample?
    private var eyesClosed = false
    private var turnFrames = 0
    private var turnReached = false

    init(challenges: [Challenge]) { self.challenges = challenges }

    var isPassed: Bool { index >= challenges.count }
    var current: Challenge? { isPassed ? nil : challenges[index] }

    private mutating func resetProgress() {
        index = 0; completed = []; eyesClosed = false; openBaseline = 0
        turnFrames = 0; turnReached = false; last = nil
    }

    private func expired(_ t: TimeInterval) -> Bool {
        guard let s = startedAt else { return false }
        return t - s > Self.timeout && !isPassed
    }

    /// Không thấy mặt, hoặc có nhiều hơn một mặt
    mutating func noFace(at time: TimeInterval, multiple: Bool = false) -> Event {
        if expired(time) { return .timedOut }
        if let lf = lastFaceAt, time - lf > Self.faceLostReset {
            // Mất mặt quá lâu → làm lại từ đầu (chống đổi người giữa chừng)
            resetProgress(); lastFaceAt = nil
        }
        if multiple { resetProgress() }
        return .adjust(multiple ? .multipleFaces : .noFace)
    }

    /// Vị trí, khoảng cách, ánh sáng – kiểm trước mọi thử thách
    static func positionHint(_ s: FaceSample) -> FaceHint {
        if s.brightness < minBrightness { return .tooDark }
        if s.faceWidth < minFaceWidth { return .tooFar }
        if s.faceWidth > maxFaceWidth { return .tooClose }
        let dx = s.centerX - FaceTarget.centerX
        let dy = (s.centerY - FaceTarget.centerY) / FaceTarget.imageAspect   // đổi sang đơn vị bề rộng
        if abs(dx) > maxOffset || abs(dy) > maxOffset {
            // Ảnh đã lật gương: mặt lệch phải màn hình → người dùng dịch sang trái của họ
            if abs(dx) >= abs(dy) { return dx > 0 ? .moveLeft : .moveRight }
            return dy > 0 ? .moveUp : .moveDown
        }
        return .none
    }

    mutating func feed(_ s: FaceSample) -> Event {
        if startedAt == nil { startedAt = s.time }
        if expired(s.time) { return .timedOut }

        // Liên tục: mặt nhảy đột ngột → có thể đã đổi người / đổi ảnh
        if let p = last, abs(s.centerX - p.centerX) > Self.maxJump || abs(s.faceWidth - p.faceWidth) > Self.maxJump {
            resetProgress()
        }
        last = s
        lastFaceAt = s.time

        let pos = Self.positionHint(s)
        if pos != .none { return .adjust(pos) }
        if abs(s.roll) > Self.maxRoll { return .adjust(.straightenHead) }
        guard let c = current else { return .passed }

        let frontal = abs(s.yaw) < Self.frontalYaw && abs(s.pitch) < Self.maxPitch
        // Mức mở mắt bình thường: chỉ lấy khi nhìn thẳng và mắt đang mở
        if frontal, !eyesClosed {
            openBaseline = openBaseline == 0 ? s.eyes : max(openBaseline * 0.98, s.eyes)
        }

        var done = false
        var hint: FaceHint = .none
        switch c {
        case .blink:
            guard openBaseline > 0 else { return .inProgress(c, .lookStraight) }
            guard abs(s.yaw) < Self.turnYaw else { return .inProgress(c, .lookStraight) }
            if !eyesClosed, s.eyes < openBaseline * Self.blinkDrop { eyesClosed = true }
            else if eyesClosed, s.eyes > openBaseline * Self.blinkRecover { eyesClosed = false; done = true }
        case .turnLeft, .turnRight:
            let rightWay = c == .turnLeft ? s.yaw > Self.turnYaw : s.yaw < -Self.turnYaw
            if !turnReached {
                turnFrames = rightWay ? turnFrames + 1 : 0
                if turnFrames >= Self.turnHoldFrames { turnReached = true }
            }
            // Quay đủ rồi phải quay lại nhìn thẳng mới tính xong (tránh làm 2 thử thách một lúc)
            if turnReached {
                if frontal { done = true; turnReached = false; turnFrames = 0 } else { hint = .returnToCenter }
            }
        }
        guard done else { return .inProgress(c, hint) }
        completed.append(c)
        index += 1
        return isPassed ? .passed : .challengeDone(c)
    }

    /// Đủ điều kiện chụp selfie: đúng vị trí, nhìn thẳng, đầu thẳng, mắt mở
    func captureHint(_ s: FaceSample) -> FaceHint {
        let pos = Self.positionHint(s)
        if pos != .none { return pos }
        if abs(s.roll) > Self.maxRoll { return .straightenHead }
        if abs(s.yaw) > Self.frontalYaw || abs(s.pitch) > Self.maxPitch { return .lookStraight }
        if openBaseline > 0, s.eyes < openBaseline * Self.openForCapture { return .openEyes }
        return .none
    }
}
