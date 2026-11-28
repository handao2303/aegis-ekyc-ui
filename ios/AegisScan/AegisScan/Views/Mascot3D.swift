import SceneKit
import SwiftUI

/// Động tác của linh vật
enum MascotAction: Hashable {
    case idle, frame, blink, turnLeft, turnRight, capture

    init(_ s: FaceStep) {
        switch s {
        case .frame: self = .frame
        case .challenge(.blink): self = .blink
        case .challenge(.turnLeft): self = .turnLeft
        case .challenge(.turnRight): self = .turnRight
        case .capture: self = .capture
        }
    }
}

/// Linh vật "Khiên Aegis" 3D, dựng hoàn toàn bằng SceneKit (không dùng ảnh ngoài):
/// thân khiên tím bóng, viền vàng kim, mắt to long lanh, má hồng, hai tay nhỏ.
struct Mascot3D: UIViewRepresentable {
    let action: MascotAction

    init(step: FaceStep) { action = MascotAction(step) }
    init(action: MascotAction) { self.action = action }

    func makeCoordinator() -> Rig { Rig() }

    func makeUIView(context: Context) -> SCNView {
        let v = SCNView()
        v.scene = context.coordinator.scene
        v.pointOfView = context.coordinator.camera
        v.backgroundColor = .clear
        v.isOpaque = false
        v.antialiasingMode = .multisampling4X
        v.rendersContinuously = true
        v.preferredFramesPerSecond = 30
        v.isPlaying = true
        v.isUserInteractionEnabled = false
        v.isAccessibilityElement = false
        context.coordinator.play(action)
        return v
    }

    func updateUIView(_ v: SCNView, context: Context) { context.coordinator.play(action) }

    final class Rig {
        let scene = SCNScene()
        let camera = SCNNode()
        private let root = SCNNode()      // nhún nhảy
        private let shield = SCNNode()    // xoay, gật
        private let eyes: [SCNNode]
        private let arms: [SCNNode]
        private let ring: SCNNode
        private let shadow: SCNNode
        private let sparkles: [SCNNode]
        private var current: MascotAction?

        // Bảng màu Aurora
        private static let purple = UIColor(red: 0.80, green: 0.66, blue: 0.99, alpha: 1)   // tím lavender nhạt (#CCA8FC)
        private static let gold = UIColor(red: 0.99, green: 0.85, blue: 0.55, alpha: 1)     // vàng kem (#FCD98C)
        private static let blush = UIColor(red: 1.00, green: 0.72, blue: 0.78, alpha: 1)    // hồng phấn

        init() {
            scene.background.contents = UIColor.clear
            scene.rootNode.addChildNode(root)
            root.addChildNode(shield)

            // Viền vàng kim (khiên lớn phía sau)
            let rim = SCNNode(geometry: Self.shieldShape(scale: 1.0, depth: 0.34, chamfer: 0.12))
            rim.geometry?.firstMaterial = Self.mat(Self.gold, rough: 0.38, metal: 0.25)
            shield.addChildNode(rim)

            // Thân khiên tím bóng, nhô ra phía trước
            let body = SCNNode(geometry: Self.shieldShape(scale: 0.84, depth: 0.44, chamfer: 0.16))
            let bm = Self.mat(Self.purple, rough: 0.42)
            bm.clearCoat.contents = 0.6
            bm.clearCoatRoughness.contents = 0.08
            body.geometry?.firstMaterial = bm
            body.position = SCNVector3(0, 0.02, 0.06)
            shield.addChildNode(body)

            // Vệt sáng bóng: cung mềm dọc mép trên trái
            let shine = Self.glow(UIColor(white: 1, alpha: 0.42))
            for i in 0...40 {
                let t = Float(i) / 40
                let ang = Float.pi * (0.58 + 0.30 * t)
                let bead = SCNNode(geometry: SCNSphere(radius: CGFloat(0.05 - 0.025 * abs(t - 0.5) * 2)))
                bead.geometry?.firstMaterial = shine
                bead.position = SCNVector3(0.70 * cos(ang), 0.18 + 0.78 * sin(ang), 0.31)
                shield.addChildNode(bead)
            }

            // Mắt: tròng trắng + con ngươi đen + 2 đốm sáng
            let front: Float = 0.30
            var eyeNodes: [SCNNode] = []
            for x: Float in [-0.34, 0.34] {
                let eye = SCNNode()
                eye.position = SCNVector3(x, 0.26, front)
                let white = SCNNode(geometry: SCNSphere(radius: 0.21))
                white.geometry?.firstMaterial = Self.mat(.white, rough: 0.2)
                white.scale = SCNVector3(0.92, 1.12, 0.35)
                eye.addChildNode(white)
                let pupil = SCNNode(geometry: SCNSphere(radius: 0.15))
                pupil.geometry?.firstMaterial = Self.mat(UIColor(red: 0.29, green: 0.17, blue: 0.43, alpha: 1), rough: 0.1)
                pupil.scale = SCNVector3(0.9, 1.1, 0.35)
                pupil.position = SCNVector3(0, -0.02, 0.04)
                eye.addChildNode(pupil)
                for (gx, gy, r) in [(Float(0.05), Float(0.06), CGFloat(0.055)), (-0.05, -0.07, 0.025)] {
                    let g = SCNNode(geometry: SCNSphere(radius: r))
                    g.geometry?.firstMaterial = Self.glow(.white)
                    g.position = SCNVector3(gx, gy, 0.10)
                    eye.addChildNode(g)
                }
                shield.addChildNode(eye)
                eyeNodes.append(eye)
            }
            eyes = eyeNodes

            // Má hồng
            for x: Float in [-0.56, 0.56] {
                let c = SCNNode(geometry: SCNSphere(radius: 0.13))
                c.geometry?.firstMaterial = Self.mat(Self.blush.withAlphaComponent(0.85), rough: 0.9)
                c.position = SCNVector3(x, -0.02, front - 0.02)
                c.scale = SCNVector3(1.35, 0.75, 0.25)
                shield.addChildNode(c)
            }

            // Miệng cười: chuỗi hạt theo cung tròn
            let smile = SCNNode()
            let lip = Self.mat(UIColor(red: 0.42, green: 0.25, blue: 0.58, alpha: 1), rough: 0.4)
            for i in 0...18 {
                let a = Float.pi * (1.20 + 0.60 * Float(i) / 18)
                let bead = SCNNode(geometry: SCNSphere(radius: 0.032))
                bead.geometry?.firstMaterial = lip
                bead.position = SCNVector3(0.17 * cos(a), 0.17 * sin(a), 0)
                smile.addChildNode(bead)
            }
            smile.position = SCNVector3(0, 0.02, front)
            shield.addChildNode(smile)

            // Hai tay nhỏ vàng kim
            var armNodes: [SCNNode] = []
            for side: Float in [-1, 1] {
                let pivot = SCNNode()
                pivot.position = SCNVector3(side * 1.0, -0.05, 0.05)
                let arm = SCNNode(geometry: SCNCapsule(capRadius: 0.11, height: 0.5))
                arm.geometry?.firstMaterial = Self.mat(Self.gold, rough: 0.38, metal: 0.25)
                arm.position = SCNVector3(side * 0.16, -0.16, 0)
                arm.eulerAngles.z = side * 0.6
                pivot.addChildNode(arm)
                shield.addChildNode(pivot)
                armNodes.append(pivot)
            }
            arms = armNodes

            // Vòng oval (bước 1)
            ring = SCNNode(geometry: SCNTorus(ringRadius: 1.62, pipeRadius: 0.045))
            ring.geometry?.firstMaterial = Self.glow(Self.gold)
            ring.eulerAngles.x = .pi / 2
            ring.scale = SCNVector3(1, 1, 1)
            ring.position = SCNVector3(0, 0.05, 0.4)
            ring.opacity = 0
            root.addChildNode(ring)

            // Bóng mềm dưới chân
            shadow = SCNNode(geometry: SCNPlane(width: 1.6, height: 1.6))
            let sm = SCNMaterial()
            sm.lightingModel = .constant
            sm.diffuse.contents = Self.radialShadow()
            sm.writesToDepthBuffer = false
            shadow.geometry?.firstMaterial = sm
            shadow.eulerAngles.x = -.pi / 2
            shadow.position = SCNVector3(0, -1.62, 0)
            shadow.scale = SCNVector3(1, 0.35, 1)
            scene.rootNode.addChildNode(shadow)

            // Lấp lánh (bước chụp)
            var sp: [SCNNode] = []
            for (x, y, s) in [(Float(-1.25), Float(0.95), Float(1.0)), (1.2, 1.15, 0.8), (1.35, -0.2, 0.6)] {
                let n = Self.sparkle()
                n.position = SCNVector3(x, y, 0.5)
                n.scale = SCNVector3(0, 0, 0)
                n.opacity = CGFloat(s)
                root.addChildNode(n)
                sp.append(n)
            }
            sparkles = sp

            // Ánh sáng studio mềm + viền sáng phía sau
            func light(_ type: SCNLight.LightType, _ i: CGFloat, _ c: UIColor = .white, _ e: SCNVector3 = SCNVector3Zero) {
                let n = SCNNode(); n.light = SCNLight(); n.light!.type = type
                n.light!.intensity = i; n.light!.color = c; n.eulerAngles = e
                scene.rootNode.addChildNode(n)
            }
            light(.directional, 800, .white, SCNVector3(-0.7, -0.45, 0))
            light(.directional, 380, UIColor(red: 1, green: 0.86, blue: 0.95, alpha: 1), SCNVector3(-0.15, 0.9, 0))
            light(.directional, 600, UIColor(red: 0.85, green: 0.8, blue: 1, alpha: 1), SCNVector3(0.4, .pi, 0))
            light(.ambient, 620, UIColor(red: 0.97, green: 0.95, blue: 1, alpha: 1))

            camera.camera = SCNCamera()
            camera.camera!.fieldOfView = 30
            camera.position = SCNVector3(0, -0.15, 8.6)
            scene.rootNode.addChildNode(camera)
        }

        func play(_ a: MascotAction) {
            guard a != current else { return }
            current = a
            reset()

            // Nhún nhẹ + bóng co giãn theo
            let up = SCNAction.moveBy(x: 0, y: 0.09, z: 0, duration: 0.8); up.timingMode = .easeInEaseOut
            let down = SCNAction.moveBy(x: 0, y: -0.09, z: 0, duration: 0.8); down.timingMode = .easeInEaseOut
            root.runAction(.repeatForever(.sequence([up, down])))
            let s1 = SCNAction.scale(to: 0.85, duration: 0.8); s1.timingMode = .easeInEaseOut
            let s2 = SCNAction.scale(to: 1.0, duration: 0.8); s2.timingMode = .easeInEaseOut
            shadow.runAction(.repeatForever(.sequence([s1, s2])))

            switch a {
            case .idle:
                wave(arm: 1)
                blink(every: 2.4)
            case .frame:
                ring.opacity = 1
                let p1 = SCNAction.scale(to: 1.07, duration: 0.7), p2 = SCNAction.scale(to: 0.97, duration: 0.7)
                p1.timingMode = .easeInEaseOut; p2.timingMode = .easeInEaseOut
                ring.runAction(.repeatForever(.sequence([p1, p2])))
                let l = SCNAction.rotateTo(x: 0, y: 0.2, z: 0.06, duration: 0.9, usesShortestUnitArc: true)
                let r = SCNAction.rotateTo(x: 0, y: -0.2, z: -0.06, duration: 0.9, usesShortestUnitArc: true)
                l.timingMode = .easeInEaseOut; r.timingMode = .easeInEaseOut
                shield.runAction(.repeatForever(.sequence([l, r])))
                blink(every: 2.6)
            case .blink:
                blink(every: 1.1, slow: true)
                armsUp(0.25)
            case .turnLeft, .turnRight:
                // Như soi gương: "trái của bạn" = linh vật quay sang trái màn hình
                let y: CGFloat = a == .turnLeft ? -0.8 : 0.8
                let t = SCNAction.sequence([.wait(duration: 0.3),
                                            .rotateTo(x: 0, y: y, z: 0, duration: 0.55, usesShortestUnitArc: true),
                                            .wait(duration: 0.7),
                                            .rotateTo(x: 0, y: 0, z: 0, duration: 0.45, usesShortestUnitArc: true)])
                t.timingMode = .easeInEaseOut
                shield.runAction(.repeatForever(t))
                blink(every: 3)
            case .capture:
                let nod = SCNAction.sequence([.rotateTo(x: 0.14, y: 0, z: 0, duration: 0.25, usesShortestUnitArc: true),
                                              .rotateTo(x: 0, y: 0, z: 0, duration: 0.3, usesShortestUnitArc: true),
                                              .wait(duration: 1.0)])
                shield.runAction(.repeatForever(nod))
                armsUp(1.1)
                for (i, s) in sparkles.enumerated() {
                    let pop = SCNAction.sequence([.wait(duration: 0.25 * Double(i)),
                                                  .scale(to: 1.2, duration: 0.25), .scale(to: 0.0, duration: 0.35), .wait(duration: 0.8)])
                    let spin = SCNAction.rotateBy(x: 0, y: 0, z: .pi, duration: 1.6)
                    s.runAction(.repeatForever(.group([pop, spin])))
                }
            }
        }

        /// Tư thế tĩnh – dùng để chụp ảnh kiểm tra trong test
        func previewPose(_ a: MascotAction) {
            play(a)
            reset()
            switch a {
            case .blink: eyes.forEach { $0.scale = SCNVector3(1, 0.12, 1) }
            case .turnLeft: shield.eulerAngles.y = -0.8
            case .turnRight: shield.eulerAngles.y = 0.8
            case .frame: ring.opacity = 1
            case .capture:
                sparkles.forEach { $0.scale = SCNVector3(1, 1, 1) }
                arms.forEach { $0.eulerAngles.z = $0.position.x > 0 ? 1.1 : -1.1 }
            case .idle: arms[1].eulerAngles.z = 1.6
            }
        }

        private func reset() {
            ([root, shield, ring, shadow] + sparkles + arms + eyes).forEach { $0.removeAllActions() }
            root.position = SCNVector3Zero
            shield.eulerAngles = SCNVector3Zero
            eyes.forEach { $0.scale = SCNVector3(1, 1, 1) }
            arms.forEach { $0.eulerAngles = SCNVector3Zero }
            sparkles.forEach { $0.scale = SCNVector3(0, 0, 0) }
            ring.opacity = 0
            shadow.scale = SCNVector3(1, 0.35, 1)
        }

        private func blink(every: TimeInterval, slow: Bool = false) {
            let d = slow ? 0.15 : 0.08
            let close = SCNAction.customAction(duration: d) { n, t in n.scale = SCNVector3(1, Float(1 - 0.9 * t / d), 1) }
            let open = SCNAction.customAction(duration: d) { n, t in n.scale = SCNVector3(1, Float(0.1 + 0.9 * t / d), 1) }
            let cycle = SCNAction.sequence([.wait(duration: every), close, .wait(duration: slow ? 0.2 : 0.04), open])
            eyes.forEach { $0.runAction(.repeatForever(cycle)) }
        }

        private func wave(arm i: Int) {
            let side: CGFloat = i == 0 ? -1 : 1
            let upA = SCNAction.rotateTo(x: 0, y: 0, z: side * 1.6, duration: 0.3, usesShortestUnitArc: true)
            let w1 = SCNAction.rotateTo(x: 0, y: 0, z: side * 1.25, duration: 0.18, usesShortestUnitArc: true)
            let w2 = SCNAction.rotateTo(x: 0, y: 0, z: side * 1.6, duration: 0.18, usesShortestUnitArc: true)
            let downA = SCNAction.rotateTo(x: 0, y: 0, z: 0, duration: 0.35, usesShortestUnitArc: true)
            arms[i].runAction(.repeatForever(.sequence([upA, w1, w2, w1, w2, downA, .wait(duration: 1.4)])))
        }

        private func armsUp(_ angle: CGFloat) {
            for a in arms {
                let side: CGFloat = a.position.x > 0 ? 1 : -1
                let u = SCNAction.rotateTo(x: 0, y: 0, z: side * angle, duration: 0.35, usesShortestUnitArc: true)
                let d = SCNAction.rotateTo(x: 0, y: 0, z: side * angle * 0.6, duration: 0.35, usesShortestUnitArc: true)
                u.timingMode = .easeInEaseOut; d.timingMode = .easeInEaseOut
                a.runAction(.repeatForever(.sequence([u, d])))
            }
        }

        // MARK: Hình khối

        /// Khiên kiểu "heater": cạnh trên bo tròn, hai bên cong xuống thành mũi nhọn
        private static func shieldShape(scale k: CGFloat, depth: CGFloat, chamfer: CGFloat) -> SCNShape {
            let p = UIBezierPath()
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * k, y: y * k) }
            p.move(to: pt(-0.80, 1.12))
            p.addQuadCurve(to: pt(0.80, 1.12), controlPoint: pt(0, 1.30))
            p.addQuadCurve(to: pt(1.08, 0.84), controlPoint: pt(1.08, 1.12))
            p.addLine(to: pt(1.08, 0.25))
            p.addCurve(to: pt(0, -1.42), controlPoint1: pt(1.08, -0.55), controlPoint2: pt(0.50, -1.05))
            p.addCurve(to: pt(-1.08, 0.25), controlPoint1: pt(-0.50, -1.05), controlPoint2: pt(-1.08, -0.55))
            p.addLine(to: pt(-1.08, 0.84))
            p.addQuadCurve(to: pt(-0.80, 1.12), controlPoint: pt(-1.08, 1.12))
            p.close()
            p.flatness = 0.004
            let s = SCNShape(path: p, extrusionDepth: depth)
            s.chamferRadius = chamfer
            s.chamferMode = .both
            return s
        }

        private static func sparkle() -> SCNNode {
            let p = UIBezierPath()
            let r: CGFloat = 0.22, q: CGFloat = 0.06
            p.move(to: CGPoint(x: 0, y: r))
            p.addQuadCurve(to: CGPoint(x: r, y: 0), controlPoint: CGPoint(x: q, y: q))
            p.addQuadCurve(to: CGPoint(x: 0, y: -r), controlPoint: CGPoint(x: q, y: -q))
            p.addQuadCurve(to: CGPoint(x: -r, y: 0), controlPoint: CGPoint(x: -q, y: -q))
            p.addQuadCurve(to: CGPoint(x: 0, y: r), controlPoint: CGPoint(x: -q, y: q))
            p.close()
            p.flatness = 0.004
            let s = SCNShape(path: p, extrusionDepth: 0.06)
            s.chamferRadius = 0.02
            s.firstMaterial = glow(gold)
            return SCNNode(geometry: s)
        }

        private static func radialShadow() -> UIImage {
            let size = CGSize(width: 128, height: 128)
            return UIGraphicsImageRenderer(size: size).image { ctx in
                let colors = [UIColor(red: 0.55, green: 0.42, blue: 0.70, alpha: 0.22).cgColor, UIColor.clear.cgColor] as CFArray
                let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
                ctx.cgContext.drawRadialGradient(g, startCenter: CGPoint(x: 64, y: 64), startRadius: 0,
                                                 endCenter: CGPoint(x: 64, y: 64), endRadius: 64, options: [])
            }
        }

        private static func mat(_ c: UIColor, rough: CGFloat, metal: CGFloat = 0) -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .physicallyBased
            m.diffuse.contents = c
            m.roughness.contents = rough
            m.metalness.contents = metal
            return m
        }

        private static func glow(_ c: UIColor) -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .constant
            m.diffuse.contents = c
            m.blendMode = .alpha
            return m
        }
    }
}
