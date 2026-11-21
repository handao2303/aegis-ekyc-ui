# Aegis Scan (iOS)

Native iPhone app that reads a **Vietnamese chip ID card (CCCD)** or an **e-passport**:

1. **Scan the MRZ** with the rear camera (Apple Vision, on-device). TD1 for ID cards (3 × 30), TD3 for passports (2 × 44), with check-digit validation and OCR clean-up. Manual entry is available.
2. **Read the chip over NFC** (ICAO 9303: PACE with BAC fallback) using [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) 3.0.1 (MIT): DG1 (MRZ data), DG2 (face photo), SOD, DG14, plus DG13 for CCCD (Vietnam-specific fields) or DG11 for passports.
3. **Show the result**: chip photo, identity data, and security checks (access method, data integrity against SOD hashes, CSCA signature, Chip Authentication).

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

- **CSCA signature**: needs a master list of country signing certificates (`PassportReader(masterListURL:)`). Without it, the app shows "Not checked". Banks also verify CCCD chips through the national system (C06); see `docs/02-compliance/C11-biometric-source.md`.
- **DG13 labels** follow the commonly used layout and must be checked against the official specification.
- **No liveness / face match** yet: compare a selfie with the DG2 photo in the next step.

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
| `AegisScan/Views/` | SwiftUI screens (Aurora theme, VI/EN) |
| `AegisScanTests/MRZTests.swift` | Unit tests with ICAO 9303 sample MRZs |
