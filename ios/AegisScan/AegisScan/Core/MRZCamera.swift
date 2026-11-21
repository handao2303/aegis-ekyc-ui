import AVFoundation
import SwiftUI
import Vision

/// Camera sau + Apple Vision: đọc dòng MRZ ngay trên máy, không gửi ảnh đi đâu.
/// Chốt kết quả khi 2 khung hình liên tiếp cho cùng một MRZ hợp lệ (đủ chữ số kiểm tra).
final class MRZCamera: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    enum Status: Equatable { case idle, starting, running, denied, unavailable }

    @Published var status: Status = .idle
    @Published var detected: MRZData?
    @Published var seesText = false
    @Published var torchOn = false

    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "aegis.mrz.camera")
    private var device: AVCaptureDevice?
    private var kind: DocumentKind = .cccd
    private var lastKey: String?
    private var hits = 0
    private var lastRun = Date.distantPast
    private var busy = false
    private var configured = false

    func start(kind: DocumentKind) {
        self.kind = kind
        detected = nil
        lastKey = nil
        hits = 0
        #if targetEnvironment(simulator)
        status = .unavailable
        return
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
        setTorch(false)
        queue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    func toggleTorch() { setTorch(!torchOn) }

    private func setTorch(_ on: Bool) {
        guard let d = device, d.hasTorch else { return }
        try? d.lockForConfiguration()
        d.torchMode = on ? .on : .off
        d.unlockForConfiguration()
        DispatchQueue.main.async { self.torchOn = on }
    }

    private func configureAndRun() {
        status = .starting
        queue.async {
            if !self.configured {
                guard let d = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                      let input = try? AVCaptureDeviceInput(device: d) else {
                    DispatchQueue.main.async { self.status = .unavailable }
                    return
                }
                self.device = d
                self.session.beginConfiguration()
                self.session.sessionPreset = .hd1920x1080
                if self.session.canAddInput(input) { self.session.addInput(input) }
                let out = AVCaptureVideoDataOutput()
                out.alwaysDiscardsLateVideoFrames = true
                out.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
                out.setSampleBufferDelegate(self, queue: self.queue)
                if self.session.canAddOutput(out) { self.session.addOutput(out) }
                self.session.commitConfiguration()
                if (try? d.lockForConfiguration()) != nil {
                    if d.isFocusModeSupported(.continuousAutoFocus) { d.focusMode = .continuousAutoFocus }
                    if d.isAutoFocusRangeRestrictionSupported { d.autoFocusRangeRestriction = .near }
                    d.unlockForConfiguration()
                }
                self.configured = true
            }
            self.session.startRunning()
            DispatchQueue.main.async { self.status = .running }
        }
    }

    // MARK: Khung hình → Vision

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard !busy, Date().timeIntervalSince(lastRun) > 0.25,
              let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        busy = true
        lastRun = Date()
        let request = VNRecognizeTextRequest { [weak self] req, _ in
            self?.handle(req.results as? [VNRecognizedTextObservation] ?? [])
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.02
        let handler = VNImageRequestHandler(cvPixelBuffer: pb, orientation: .right)
        try? handler.perform([request])
        busy = false
    }

    private func handle(_ obs: [VNRecognizedTextObservation]) {
        // Sắp từ trên xuống (toạ độ Vision gốc ở dưới-trái)
        let lines = obs.sorted { $0.boundingBox.midY > $1.boundingBox.midY }
            .compactMap { $0.topCandidates(1).first?.string }
        let looksLikeMRZ = lines.contains { MRZParser.clean($0).filter { $0 == "<" }.count >= 3 }
        DispatchQueue.main.async { if self.seesText != looksLikeMRZ { self.seesText = looksLikeMRZ } }
        guard let mrz = MRZParser.find(in: lines, prefer: kind) else { return }
        if mrz.mrzKey == lastKey { hits += 1 } else { lastKey = mrz.mrzKey; hits = 1 }
        if hits >= 2 {
            stop()
            DispatchQueue.main.async {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                self.detected = mrz
            }
        }
    }
}

/// Lớp xem trước camera
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var preview: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }

    func makeUIView(context: Context) -> PreviewView {
        let v = PreviewView()
        v.preview.session = session
        v.preview.videoGravity = .resizeAspectFill
        v.backgroundColor = .black
        return v
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}
}
