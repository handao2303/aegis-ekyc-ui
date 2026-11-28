import SceneKit
import XCTest
@testable import AegisScan

/// Kết xuất linh vật 3D ra ảnh PNG để xem nhanh (không kiểm tra điểm ảnh)
final class MascotRenderTests: XCTestCase {
    func testRenderSnapshots() throws {
        let out = ProcessInfo.processInfo.environment["MASCOT_OUT"] ?? NSTemporaryDirectory()
        for (name, a) in [("idle", MascotAction.idle), ("frame", .frame), ("blink", .blink), ("left", .turnLeft), ("capture", .capture)] {
            let rig = Mascot3D.Rig()
            rig.previewPose(a)
            let r = SCNRenderer(device: MTLCreateSystemDefaultDevice(), options: nil)
            r.scene = rig.scene
            r.pointOfView = rig.camera
            let img = r.snapshot(atTime: 0, with: CGSize(width: 360, height: 360), antialiasingMode: .multisampling4X)
            try XCTUnwrap(img.pngData()).write(to: URL(fileURLWithPath: out).appendingPathComponent("mascot-\(name).png"))
        }
    }
}
