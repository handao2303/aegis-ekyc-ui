# Aegis Scan (iOS)

Native iPhone app that reads a **Vietnamese chip ID card (CCCD)** or an **e-passport**:

1. **Scan the MRZ** with the rear camera (Apple Vision, on-device). TD1 for ID cards (3 × 30), TD3 for passports (2 × 44), with check-digit validation and OCR clean-up. Manual entry is available.
2. **Read the chip over NFC** (ICAO 9303: PACE with BAC fallback) using [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) 3.0.1 (MIT): DG1 (MRZ data), DG2 (face photo), SOD, DG14, plus DG13 for CCCD (Vietnam-specific fields) or DG11 for passports.
3. **Face check**, guided by a 3D shield mascot that acts out each step. The front camera first checks the pose: face centred in the circle, right distance, enough light, one person only, head level. Then comes an active liveness test: a blink plus a random head turn. The turn must be held for 2 frames and followed by facing forward again. The limit is 30 seconds, and the test restarts if the face is lost or jumps. Finally the app keeps the 3 sharpest frontal, eyes-open frames, using Vision face capture quality. Faces are levelled by the eye line before they are compared with the chip photo (DG2). With no chip photo (no-NFC build), you can photograph the portrait printed on the front of the document; that source can never auto-match, so the best outcome is "Needs review" (C11 RULE-EKYC-14).
4. **Show the result**: chip photo, identity data, biometric outcome (match ≥ 80% · review 60–79% · no match < 60%), and security checks (access method, data integrity against SOD hashes, CSCA signature, Chip Authentication).

Everything runs on the device. Nothing is stored or uploaded.

## Install on your iPhone

Requirements: a Mac with Xcode, an iPhone 7 or later (iOS 16+), a USB cable.

1. Open `ios/AegisScan/AegisScan.xcodeproj` in Xcode.
2. **Xcode › Settings › Accounts** → add your Apple ID.
3. Select the **AegisScan** target → **Signing & Capabilities** → choose your Team. If the bundle ID is taken, change `com.handao2303.aegisscan` to something unique.
4. Pick a scheme:
   | Scheme | Account | What works |
   |---|---|---|
   | **AegisScan** | Paid Apple Developer Program | MRZ camera **and** NFC chip reading |
   | **AegisScan-NoNFC** | Free Apple ID (Personal Team) | MRZ camera, manual entry, sample result. NFC is off because free teams can't use the NFC Tag Reading capability |
5. Connect the iPhone, select it as the run destination, press **Run** (⌘R).
6. First run on the phone: **Settings › General › VPN & Device Management** → trust your developer certificate. Also turn on **Developer Mode** if iOS asks (Settings › Privacy & Security › Developer Mode).

## Reading tips

- **CCCD**: scan the **back** (3 lines of `<<<` characters). For NFC, place the back of the card against the top of the iPhone's back, near the camera, and hold still for 5–10 seconds.
- **Passport**: scan the photo page (2 lines at the bottom). The chip is usually in the back cover.
- Remove thick or metal cases. If the chip rejects the MRZ, re-check the document number, date of birth and expiry date.

## What is not production-ready yet

- **CSCA signature**: needs a master list of country signing certificates (`PassportReader(masterListURL:)`). Without it, the app shows "Not checked". Banks also verify CCCD chips through the national system (C06); see `docs/01-ekyc/1.2-compliance-legal/C11-biometric-source.md`.
- **DG13 labels** follow the commonly used layout and must be checked against the official specification.
- **Liveness and face match are a prototype.** They run on Apple Vision on the device. Apple Vision has no dedicated face-recognition model, so the match compares generic image feature prints of the two face crops. The thresholds are not calibrated on real data and there is no certified presentation-attack detection (ISO/IEC 30107-3 / iBeta). A bank needs a certified eKYC vendor for this step (C14).

## Develop

```bash
brew install xcodegen          # project is generated from project.yml
cd ios/AegisScan && xcodegen generate
xcodebuild test -project AegisScan.xcodeproj -scheme AegisScan \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' CODE_SIGNING_ALLOWED=NO
```

The Simulator has no camera or NFC: use manual entry ("Fill in sample data") and "View a sample result" to walk through the UI.

| Path | Purpose |
|---|---|
| `AegisScan/Core/MRZ.swift` | TD1/TD3 parser, check digits, OCR clean-up, BAC key |
| `AegisScan/Core/MRZCamera.swift` | AVFoundation + Vision live MRZ scanning |
| `AegisScan/Core/ChipReader.swift` | NFC read, result model, DG13 decoder, error messages |
| `AegisScan/Core/Liveness.swift` | Liveness challenges and state machine (pure logic) |
| `AegisScan/Core/FaceCamera.swift` | Front/back camera + Vision face landmarks, auto-capture |
| `AegisScan/Core/FaceMatch.swift` | Face crop, feature-print similarity, match/review/no-match decision |
| `AegisScan/Views/Mascot3D.swift` | 3D shield mascot (SceneKit) and its animations |
| `AegisScan/Views/` | SwiftUI screens (Aurora theme, VI/EN) |
| `AegisScanTests/MRZTests.swift` | Unit tests with ICAO 9303 sample MRZs |
| `AegisScanTests/FaceTests.swift` | Liveness state machine, pose hints and decision thresholds |
| `AegisScanTests/MascotRenderTests.swift` | Renders mascot poses to PNG (`TEST_RUNNER_MASCOT_OUT=<dir>`) |
