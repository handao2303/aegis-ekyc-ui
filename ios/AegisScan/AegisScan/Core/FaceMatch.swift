import CoreImage
import UIKit
import Vision

/// Nguồn ảnh đối chiếu (C11 RULE-EKYC-14)
enum ReferenceSource: String {
    /// Ảnh DG2 đọc từ chip – nguồn chuẩn
    case chipDG2
    /// Ảnh in trên mặt trước giấy tờ – dễ làm giả, quyết định tối đa REFER
    case printedPortrait
    /// Ảnh mẫu (bản không có NFC, chỉ để xem giao diện)
    case sample
}

/// Kết quả bước khuôn mặt, chỉ nằm trong bộ nhớ
struct BiometricResult {
    enum Outcome: Equatable { case match, review, noMatch, livenessFailed }

    var selfie: UIImage?
    var reference: UIImage?
    var source: ReferenceSource
    var challenges: [Challenge]
    var livenessPassed: Bool
    /// 0…1, nil khi không so được (không thấy mặt trong một trong hai ảnh)
    var similarity: Double?
    /// Chất lượng ảnh selfie theo Vision (0…1)
    var quality: Double? = nil
    var outcome: Outcome
}

/// So khớp khuôn mặt trên máy bằng Apple Vision.
///
/// ⚠️ Bản demo: Vision không có mô hình nhận diện khuôn mặt chuyên dụng. Ở đây cắt vùng mặt
/// của hai ảnh rồi so "feature print" (đặc trưng ảnh tổng quát). Ngưỡng chưa được hiệu chỉnh
/// trên bộ dữ liệu thật, không thay được nhà cung cấp eKYC đã chứng nhận (ISO/IEC 30107-3, iBeta).
enum FaceMatcher {
    /// Ngưỡng quyết định trên điểm tương đồng 0…1 (giống vùng biên của SCRUM-43)
    static let matchAt = 0.80
    static let reviewAt = 0.60

    static func decide(similarity: Double?, livenessPassed: Bool, source: ReferenceSource) -> BiometricResult.Outcome {
        guard livenessPassed else { return .livenessFailed }
        guard let s = similarity else { return .review }
        let raw: BiometricResult.Outcome = s >= matchAt ? .match : (s >= reviewAt ? .review : .noMatch)
        // C11: không có ảnh chip thì không bao giờ được tự động khớp
        if source != .chipDG2, raw == .match { return .review }
        return raw
    }

    /// Đổi khoảng cách feature print thành điểm 0…1.
    /// Revision 2 (iOS 17+) trả vector đã chuẩn hoá, khoảng cách ~0…2; revision 1 chưa chuẩn hoá, ~0…40.
    static func similarity(distance: Double, revision: Int) -> Double {
        let scale = revision >= 2 ? 1.1 : 22.0
        return min(1, max(0, 1 - distance / scale))
    }

    /// So nhiều ảnh selfie (tốt nhất trước) với ảnh đối chiếu, lấy điểm cao nhất. Chạy ở luồng nền.
    static func compare(_ selfies: [UIImage], _ reference: UIImage) -> Double? {
        guard let ref = faceCrop(reference), let pr = featurePrint(ref) else { return nil }
        var best: Double?
        for s in selfies.prefix(3) {
            guard let c = faceCrop(s), let ps = featurePrint(c) else { continue }
            var d: Float = 0
            guard (try? ps.computeDistance(&d, to: pr)) != nil else { continue }
            let sim = similarity(distance: Double(d), revision: ps.requestRevision)
            best = max(best ?? 0, sim)
        }
        return best
    }

    static func compare(_ a: UIImage, _ b: UIImage) -> Double? { compare([a], b) }

    /// Chuẩn hoá khuôn mặt trước khi so:
    /// 1. tìm mặt lớn nhất và hai mắt, 2. xoay cho đường nối hai mắt nằm ngang,
    /// 3. cắt vuông quanh mặt (nới 30%), 4. đưa về ảnh xám 256 × 256 để giảm khác biệt màu / ánh sáng.
    static func faceCrop(_ image: UIImage) -> CGImage? {
        guard let cg = image.cgImage else { return nil }
        let req = VNDetectFaceLandmarksRequest()
        try? VNImageRequestHandler(cgImage: cg, orientation: .init(image.imageOrientation)).perform([req])
        guard let face = (req.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) else { return nil }
        let W = CGFloat(cg.width), H = CGFloat(cg.height)
        let bb = face.boundingBox
        // Toạ độ CoreImage: gốc dưới trái, cùng hệ với Vision
        let center = CGPoint(x: bb.midX * W, y: bb.midY * H)
        var angle: CGFloat = 0
        if let le = face.landmarks?.leftEye, let re = face.landmarks?.rightEye {
            func mid(_ r: VNFaceLandmarkRegion2D) -> CGPoint {
                let pts = r.pointsInImage(imageSize: CGSize(width: W, height: H))
                return CGPoint(x: pts.map(\.x).reduce(0, +) / CGFloat(max(pts.count, 1)),
                               y: pts.map(\.y).reduce(0, +) / CGFloat(max(pts.count, 1)))
            }
            let a = mid(le), b = mid(re)
            let (l, r) = a.x < b.x ? (a, b) : (b, a)
            angle = atan2(r.y - l.y, r.x - l.x)
            if abs(angle) > 0.6 { angle = 0 }           // điểm mốc bất thường → không xoay
        }
        let level = CIImage(cgImage: cg)
            .transformed(by: CGAffineTransform(translationX: -center.x, y: -center.y)
                .concatenating(CGAffineTransform(rotationAngle: -angle))
                .concatenating(CGAffineTransform(translationX: center.x, y: center.y)))
        let side = max(bb.width * W, bb.height * H) * 1.3
        let rect = CGRect(x: center.x - side / 2, y: center.y - side / 2, width: side, height: side)
        guard let crop = ciContext.createCGImage(level.cropped(to: rect), from: rect) else { return nil }
        return grayscale(crop, size: 256)
    }

    private static let ciContext = CIContext()

    private static func featurePrint(_ cg: CGImage) -> VNFeaturePrintObservation? {
        let req = VNGenerateImageFeaturePrintRequest()
        try? VNImageRequestHandler(cgImage: cg).perform([req])
        return req.results?.first as? VNFeaturePrintObservation
    }

    private static func grayscale(_ cg: CGImage, size: Int) -> CGImage? {
        guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: size, height: size))
        return ctx.makeImage()
    }
}

extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
