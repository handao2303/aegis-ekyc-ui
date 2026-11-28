import XCTest
@testable import AegisScan

final class LivenessTests: XCTestCase {
    /// Mẫu chuẩn: đúng tâm, đúng cỡ, đủ sáng, nhìn thẳng, mắt mở
    private func s(yaw: Double = 0, eyes: Double = 0.30, width: Double = 0.45, t: TimeInterval,
                   x: Double = FaceTarget.centerX, y: Double = FaceTarget.centerY,
                   roll: Double = 0, light: Double = 0.5) -> FaceSample {
        FaceSample(yaw: yaw, leftEye: eyes, rightEye: eyes, faceWidth: width, time: t,
                   centerX: x, centerY: y, roll: roll, pitch: 0, brightness: light)
    }

    func testRandomChallengesAlwaysIncludeBlinkAndOneTurn() {
        var g = SystemRandomNumberGenerator()
        for _ in 0..<50 {
            let c = Challenge.random(using: &g)
            XCTAssertEqual(c.count, 2)
            XCTAssertTrue(c.contains(.blink))
            XCTAssertEqual(c.filter { $0 == .turnLeft || $0 == .turnRight }.count, 1)
        }
    }

    func testBlinkThenTurnLeftNeedsReturnToCenter() {
        var tr = LivenessTracker(challenges: [.blink, .turnLeft])
        XCTAssertEqual(tr.feed(s(t: 0)), .inProgress(.blink, .none))
        XCTAssertEqual(tr.feed(s(eyes: 0.10, t: 0.1)), .inProgress(.blink, .none))   // nhắm
        XCTAssertEqual(tr.feed(s(eyes: 0.29, t: 0.2)), .challengeDone(.blink))       // mở lại
        XCTAssertEqual(tr.feed(s(yaw: -0.5, t: 0.3)), .inProgress(.turnLeft, .none)) // sai hướng
        XCTAssertEqual(tr.feed(s(yaw: 0.5, t: 0.4)), .inProgress(.turnLeft, .none))  // mới 1 khung
        XCTAssertEqual(tr.feed(s(yaw: 0.5, t: 0.5)), .inProgress(.turnLeft, .returnToCenter))
        XCTAssertEqual(tr.feed(s(yaw: 0.2, t: 0.6)), .inProgress(.turnLeft, .returnToCenter))
        XCTAssertEqual(tr.feed(s(yaw: 0.0, t: 0.7)), .passed)                        // đã nhìn thẳng lại
        XCTAssertEqual(tr.completed, [.blink, .turnLeft])
    }

    func testSingleTurnFrameIsNotEnough() {
        var tr = LivenessTracker(challenges: [.turnRight, .blink])
        _ = tr.feed(s(t: 0))
        XCTAssertEqual(tr.feed(s(yaw: -0.5, t: 0.1)), .inProgress(.turnRight, .none))
        XCTAssertEqual(tr.feed(s(yaw: 0, t: 0.2)), .inProgress(.turnRight, .none))   // giật đầu 1 khung: không tính
        XCTAssertTrue(tr.completed.isEmpty)
    }

    func testStaticPhotoNeverPasses() {
        var tr = LivenessTracker(challenges: [.blink, .turnRight])
        for i in 0..<200 { XCTAssertNotEqual(tr.feed(s(t: Double(i) * 0.1)), .passed) }
        XCTAssertFalse(tr.isPassed)
    }

    func testPositionHints() {
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0)), .none)
        XCTAssertEqual(LivenessTracker.positionHint(s(width: 0.2, t: 0)), .tooFar)
        XCTAssertEqual(LivenessTracker.positionHint(s(width: 0.8, t: 0)), .tooClose)
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0, light: 0.1)), .tooDark)
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0, x: 0.7)), .moveLeft)
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0, x: 0.3)), .moveRight)
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0, y: 0.6)), .moveUp)
        XCTAssertEqual(LivenessTracker.positionHint(s(t: 0, y: 0.25)), .moveDown)
    }

    func testChallengesWaitUntilPositioned() {
        var tr = LivenessTracker(challenges: [.blink, .turnRight])
        XCTAssertEqual(tr.feed(s(width: 0.2, t: 0)), .adjust(.tooFar))
        XCTAssertEqual(tr.feed(s(t: 0.1, roll: 0.5)), .adjust(.straightenHead))
        XCTAssertTrue(tr.completed.isEmpty)
    }

    func testMultipleFacesResets() {
        var tr = LivenessTracker(challenges: [.turnRight, .blink])
        _ = tr.feed(s(yaw: -0.5, t: 0)); _ = tr.feed(s(yaw: -0.5, t: 0.1)); _ = tr.feed(s(t: 0.2))
        XCTAssertEqual(tr.completed, [.turnRight])
        XCTAssertEqual(tr.noFace(at: 0.3, multiple: true), .adjust(.multipleFaces))
        XCTAssertEqual(tr.completed, [])
    }

    func testSuddenJumpResets() {
        var tr = LivenessTracker(challenges: [.turnRight, .blink])
        _ = tr.feed(s(yaw: -0.5, t: 0)); _ = tr.feed(s(yaw: -0.5, t: 0.1)); _ = tr.feed(s(t: 0.2))
        XCTAssertEqual(tr.completed, [.turnRight])
        _ = tr.feed(s(t: 0.3, x: 0.56))          // dịch nhẹ: vẫn giữ
        XCTAssertEqual(tr.completed, [.turnRight])
        _ = tr.feed(s(width: 0.69, t: 0.4))         // mặt to đột ngột: nghi đổi người
        XCTAssertEqual(tr.completed, [])
    }

    func testTimeout() {
        var tr = LivenessTracker(challenges: [.blink, .turnRight])
        _ = tr.feed(s(t: 0))
        XCTAssertEqual(tr.feed(s(t: LivenessTracker.timeout + 1)), .timedOut)
    }

    func testLosingFaceResetsProgress() {
        var tr = LivenessTracker(challenges: [.turnRight, .blink])
        _ = tr.feed(s(yaw: -0.5, t: 0)); _ = tr.feed(s(yaw: -0.5, t: 0.1)); _ = tr.feed(s(t: 0.2))
        _ = tr.noFace(at: 0.6)
        XCTAssertEqual(tr.completed, [.turnRight])               // mất mặt ngắn: giữ tiến độ
        _ = tr.noFace(at: 3.0)
        XCTAssertEqual(tr.completed, [])                         // mất mặt lâu: làm lại
    }

    func testCaptureHint() {
        var tr = LivenessTracker(challenges: [.blink])
        _ = tr.feed(s(t: 0))
        XCTAssertEqual(tr.captureHint(s(t: 1)), .none)
        XCTAssertEqual(tr.captureHint(s(yaw: 0.3, t: 1)), .lookStraight)
        XCTAssertEqual(tr.captureHint(s(eyes: 0.1, t: 1)), .openEyes)
        XCTAssertEqual(tr.captureHint(s(t: 1, roll: 0.4)), .straightenHead)
    }
}

final class FaceDecisionTests: XCTestCase {
    func testThresholds() {
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.85, livenessPassed: true, source: .chipDG2), .match)
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.80, livenessPassed: true, source: .chipDG2), .match)
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.70, livenessPassed: true, source: .chipDG2), .review)
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.40, livenessPassed: true, source: .chipDG2), .noMatch)
    }

    func testPrintedPortraitNeverAutoMatches() {
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.99, livenessPassed: true, source: .printedPortrait), .review)
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.30, livenessPassed: true, source: .printedPortrait), .noMatch)
    }

    func testLivenessFailureWins() {
        XCTAssertEqual(FaceMatcher.decide(similarity: 0.99, livenessPassed: false, source: .chipDG2), .livenessFailed)
    }

    func testNoFaceFoundIsReview() {
        XCTAssertEqual(FaceMatcher.decide(similarity: nil, livenessPassed: true, source: .chipDG2), .review)
    }

    func testSimilarityScaleIsClamped() {
        XCTAssertEqual(FaceMatcher.similarity(distance: 0, revision: 2), 1)
        XCTAssertEqual(FaceMatcher.similarity(distance: 5, revision: 2), 0)
        XCTAssertEqual(FaceMatcher.similarity(distance: 11, revision: 1), 0.5, accuracy: 0.001)
    }
}
