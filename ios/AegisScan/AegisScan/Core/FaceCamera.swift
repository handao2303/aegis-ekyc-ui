import AVFoundation
import CoreImage
import SwiftUI
import Vision

/// Camera + Apple Vision cho bước khuôn mặt. Chạy hoàn toàn trên máy, không lưu ảnh.
/// - `.selfie`: camera trước, kiểm tra người thật (chớp mắt, quay đầu) rồi chụp selfie.
/// - `.printedPortrait`: camera sau, chụp ảnh chân dung in trên mặt trước giấy tờ
///   (chỉ dùng khi không đọc được ảnh trong chip – C11: nguồn này tối đa REFER).
final class FaceCamera: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    enum Mode { case selfie, printedPortrait }
    enum Status: Equatable { case idle, starting, running, denied, unavailable }

    @Published var status: Status = .idle
    @Published var event: LivenessTracker.Event = .adjust(.noFace)
    @Published var completed: [Challenge] = []
    @Published var captured: UIImage?
    @Published var faceInFrame = false

    let session = AVCaptureSession()
    private(set) var challenges: [Challenge] = []
    private let queue = DispatchQueue(label: "aegis.face.camera")
    private let ciContext = CIContext()
    private var mode: Mode = .selfie
    private var tracker = LivenessTracker(challenges: [])
    private var configuredFor: AVCaptureDevice.Position?
    private var busy = false
    private var lastRun = Date.distantPast
    private var stableHits = 0
    private var done = false
    private var captureStartedAt: TimeInterval?
    private var candidates: [(Float, UIImage)] = []
    /// Điểm chất lượng của ảnh selfie đã chọn (0…1)
    private(set) var bestQuality: Float = 0
    /// Các ảnh selfie tốt nhì, ba – dùng thêm khi so khớp
    @Published var alternates: [UIImage] = []

    var position: AVCaptureDevice.Position { mode == .selfie ? .front : .back }
    /// Hướng ảnh để Vision và ảnh chụp ra đứng thẳng như người dùng thấy
    private var orientation: CGImagePropertyOrientation { mode == .selfie ? .leftMirrored : .right }

    func start(mode: Mode) {
        self.mode = mode
        var g = SystemRandomNumberGenerator()
        challenges = mode == .selfie ? Challenge.random(using: &g) : []
        tracker = LivenessTracker(challenges: challenges)
        completed = []
        captured = nil
        event = .adjust(.noFace)
        stableHits = 0
        done = false
        captureStartedAt = nil
        candidates = []
        alternates = []
        bestQuality = 0
        #if targetEnvironment(simulator)
        status = .unavailable
        #else
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: configureAndRun()
        case .notDetermined:
            status = .starting
            AVCaptureDevice.requestAccess(for: .video) { ok in
                DispatchQueue.main.async { ok ? self.configureAndRun() : (self.status = .denied) }
            }
        default: status = .denied
        }
        #endif
    }

    func stop() {
        queue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    private func configureAndRun() {
        status = .starting
        let pos = position
        queue.async {
            if self.configuredFor != pos {
                self.session.beginConfiguration()
                self.session.inputs.forEach { self.session.removeInput($0) }
                self.session.outputs.forEach { self.session.removeOutput($0) }
                guard let d = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: pos),
                      let input = try? AVCaptureDeviceInput(device: d) else {
                    self.session.commitConfiguration()
                    DispatchQueue.main.async { self.status = .unavailable }
                    return
                }
                self.session.sessionPreset = .hd1280x720
                if self.session.canAddInput(input) { self.session.addInput(input) }
                let out = AVCaptureVideoDataOutput()
                out.alwaysDiscardsLateVideoFrames = true
                out.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                out.setSampleBufferDelegate(self, queue: self.queue)
                if self.session.canAddOutput(out) { self.session.addOutput(out) }
                self.session.commitConfiguration()
                if pos == .back, (try? d.lockForConfiguration()) != nil {
                    if d.isFocusModeSupported(.continuousAutoFocus) { d.focusMode = .continuousAutoFocus }
                    if d.isAutoFocusRangeRestrictionSupported { d.autoFocusRangeRestriction = .near }
                    d.unlockForConfiguration()
                }
                self.configuredFor = pos
            }
            self.session.startRunning()
            DispatchQueue.main.async { self.status = .running }
        }
    }

    // MARK: Khung hình → Vision

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard !done, !busy, Date().timeIntervalSince(lastRun) > 0.07,
              let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        busy = true
        lastRun = Date()
        defer { busy = false }
        let t = CACurrentMediaTime()
        let request = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(cvPixelBuffer: pb, orientation: orientation)
        try? handler.perform([request])
        let faces = (request.results ?? []).sorted { $0.boundingBox.width > $1.boundingBox.width }

        switch mode {
        case .selfie: handleSelfie(faces, pb: pb, time: t)
        case .printedPortrait: handlePortrait(faces.first, pb: pb)
        }
    }

    private func handleSelfie(_ faces: [VNFaceObservation], pb: CVPixelBuffer, time: TimeInterval) {
        guard faces.count == 1, let face = faces.first,
              let sample = Self.sample(face, time: time, brightness: Self.brightness(pb)) else {
            publish(tracker.noFace(at: time, multiple: faces.count > 1), face: false)
            return
        }
        guard tracker.isPassed else {
            publish(tracker.feed(sample), face: true)
            return
        }
        // Giai đoạn chụp: gom các khung hình đạt chuẩn trong tối đa 1,5 giây, giữ ảnh có
        // chất lượng khuôn mặt cao nhất (Vision face capture quality: nét, đủ sáng, không che)
        if captureStartedAt == nil { captureStartedAt = time }
        let hint = tracker.captureHint(sample)
        if hint == .none, let img = image(pb) {
            let q = Self.captureQuality(pb, face: face)
            candidates.append((q, img))
            candidates.sort { $0.0 > $1.0 }
            if candidates.count > 3 { candidates.removeLast() }
        }
        let enough = candidates.count >= 4 || (candidates.count >= 1 && time - (captureStartedAt ?? time) > 1.5)
        if candidates.count >= 3 || enough, let best = candidates.first {
            bestQuality = best.0
            finish(best.1, alternates: candidates.dropFirst().map(\.1))
            return
        }
        publish(.adjust(hint == .none ? .holdStill : hint), face: true)
    }

    private func handlePortrait(_ face: VNFaceObservation?, pb: CVPixelBuffer) {
        guard let face, face.boundingBox.width > 0.10 else {
            stableHits = 0
            DispatchQueue.main.async { if self.faceInFrame { self.faceInFrame = false } }
            return
        }
        stableHits += 1
        DispatchQueue.main.async { if !self.faceInFrame { self.faceInFrame = true } }
        if stableHits >= 6, let img = image(pb) { finish(img) }
    }

    private func publish(_ e: LivenessTracker.Event, face: Bool) {
        let passedSoFar = tracker.completed
        DispatchQueue.main.async {
            if self.event != e { self.event = e }
            if self.completed != passedSoFar {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                self.completed = passedSoFar
            }
            if self.faceInFrame != face { self.faceInFrame = face }
        }
    }

    private func finish(_ img: UIImage, alternates: [UIImage] = []) {
        done = true
        stop()
        DispatchQueue.main.async {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            self.alternates = alternates
            self.captured = img
        }
    }

    private func image(_ pb: CVPixelBuffer) -> UIImage? {
        let ci = CIImage(cvPixelBuffer: pb).oriented(orientation)
        guard let cg = ciContext.createCGImage(ci, from: ci.extent) else { return nil }
        return UIImage(cgImage: cg)
    }

    /// Chuyển kết quả Vision thành FaceSample (toạ độ ảnh đã xoay đứng và lật gương như người dùng thấy).
    /// Hướng quay đầu tính từ vị trí mũi so với giữa khuôn mặt: quay sang trái của người dùng
    /// → mũi lệch sang trái màn hình → yaw dương. Cách này không phụ thuộc quy ước dấu của Vision.
    static func sample(_ f: VNFaceObservation, time: TimeInterval, brightness: Double) -> FaceSample? {
        guard let lm = f.landmarks, let nose = lm.noseCrest ?? lm.nose,
              let le = lm.leftEye, let re = lm.rightEye else { return nil }
        let noseX = nose.normalizedPoints.map(\.x).reduce(0, +) / CGFloat(max(nose.pointCount, 1))
        let offset = Double(0.5 - noseX)
        let bb = f.boundingBox
        return FaceSample(yaw: offset * 2.5, leftEye: openness(le), rightEye: openness(re),
                          faceWidth: Double(bb.width), time: time,
                          centerX: Double(bb.midX), centerY: Double(1 - bb.midY),
                          roll: f.roll?.doubleValue ?? 0, pitch: f.pitch?.doubleValue ?? 0,
                          brightness: brightness)
    }

    /// Độ sáng trung bình: lấy mẫu thưa 1/16 điểm ảnh của khung BGRA
    static func brightness(_ pb: CVPixelBuffer) -> Double {
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pb, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(pb) else { return 0.5 }
        let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb), row = CVPixelBufferGetBytesPerRow(pb)
        let p = base.assumingMemoryBound(to: UInt8.self)
        var sum = 0.0, n = 0.0
        for y in stride(from: 0, to: h, by: 16) {
            for x in stride(from: 0, to: w, by: 16) {
                let o = y * row + x * 4
                sum += 0.114 * Double(p[o]) + 0.587 * Double(p[o + 1]) + 0.299 * Double(p[o + 2])
                n += 1
            }
        }
        return n > 0 ? sum / n / 255 : 0.5
    }

    /// Điểm chất lượng ảnh khuôn mặt của Vision (0…1)
    static func captureQuality(_ pb: CVPixelBuffer, face: VNFaceObservation) -> Float {
        let req = VNDetectFaceCaptureQualityRequest()
        req.inputFaceObservations = [face]
        try? VNImageRequestHandler(cvPixelBuffer: pb, orientation: .leftMirrored).perform([req])
        return req.results?.first?.faceCaptureQuality ?? 0
    }

    private static func openness(_ r: VNFaceLandmarkRegion2D) -> Double {
        let p = r.normalizedPoints
        guard let minX = p.map(\.x).min(), let maxX = p.map(\.x).max(),
              let minY = p.map(\.y).min(), let maxY = p.map(\.y).max(), maxX > minX else { return 0 }
        return Double((maxY - minY) / (maxX - minX))
    }
}
