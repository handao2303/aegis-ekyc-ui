# Aegis eKYC UI

The eKYC module UI for **Aegis Bank**, a personal banking project. Bilingual (Vietnamese / English), with light and dark themes.

**BA case study:** [handao2303.github.io/aegis-ekyc-ui/case-study/](https://handao2303.github.io/aegis-ekyc-ui/case-study/) – the problem, approach, key artifacts and results in a 2-minute read.

- **Customer app** (`/app/`): online account opening (20 screens: main flow, results, edge cases, privacy) plus 3 credit card limit screens (LIM-M1 → M3).
- **Aegis Compliance** (`/compliance/`): review back-office. Queue, case detail, maker-checker, completed cases, SLA report and threshold settings.
- **Aegis Reconciliation** (`/reconciliation/`): matching dashboard, no-code rules with segregation-of-duties checks, exceptions with AI root-cause suggestions and data lineage, GL entries with zero-touch vs maker-checker posting (REC-01 → 06).
- **Aegis Credit Limit** (`/credit-limit/`): live ISO 8583 authorization monitor, card limit profiles with optimistic locking and Smart Fallback, Temporary Limit Boost, fraud monitor with SMS/App delivery status (LIM-W1 → W4).
- **UI Kit** (`/`): design system and design documentation.
- **Aegis Scan – native iOS app** ([`ios/AegisScan`](ios/AegisScan/README.md)): scans the MRZ of a chip ID card (CCCD) or e-passport with the camera and reads the chip over NFC (photo, identity data, integrity checks). Install it on your iPhone with Xcode.

**Live demo:** [handao2303.github.io/aegis-ekyc-ui](https://handao2303.github.io/aegis-ekyc-ui/) · [Customer app](https://handao2303.github.io/aegis-ekyc-ui/app/) · [Compliance](https://handao2303.github.io/aegis-ekyc-ui/compliance/) · [Reconciliation](https://handao2303.github.io/aegis-ekyc-ui/reconciliation/) · [Credit limit](https://handao2303.github.io/aegis-ekyc-ui/credit-limit/)

> All sample data is fictional. Camera, NFC, liveness and verification results are simulated. The eKYC module runs against a sample backend (`server/`, `npm run dev:all`); the GitHub Pages build is a demo without a backend.

## Documentation

Requirements, business rules, diagrams and test packs for the eKYC Completion epic live in [`docs/`](docs/README.md) (Vietnamese): 25 documents and 47 Mermaid diagrams, grouped by module. Start with the [solution overview](docs/00-overview/A01-solution-overview.md): system context, containers, end-to-end sequence, decision tree and screen maps. Module docs: [reconciliation](docs/02-reconciliation/R01-reconciliation-flow.md), [credit limit](docs/03-credit-limit/L01-credit-limit-flow.md), [iOS document scan](docs/01-ekyc/1.3-ui/A02-ios-document-scan.md).

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5179
npm run build      # static export into out/
npm run start      # serve out/ locally
```

| Page | Local | Live |
|---|---|---|
| UI Kit & design docs | http://localhost:5179/ | [open](https://handao2303.github.io/aegis-ekyc-ui/) |
| Customer app | http://localhost:5179/app/ | [open](https://handao2303.github.io/aegis-ekyc-ui/app/) |
| Customer app – English | http://localhost:5179/app/?lang=en | [open](https://handao2303.github.io/aegis-ekyc-ui/app/?lang=en) |
| Customer app – ends in "under review" | http://localhost:5179/app/?ketqua=refer | [open](https://handao2303.github.io/aegis-ekyc-ui/app/?ketqua=refer) |
| Customer app – ends in "rejected" | http://localhost:5179/app/?ketqua=rejected | [open](https://handao2303.github.io/aegis-ekyc-ui/app/?ketqua=rejected) |
| Customer app – my card (LIM-M1) | http://localhost:5179/app/?screen=cardHome | [open](https://handao2303.github.io/aegis-ekyc-ui/app/?screen=cardHome) |
| Compliance back-office | http://localhost:5179/compliance/ | [open](https://handao2303.github.io/aegis-ekyc-ui/compliance/) |
| Reconciliation | http://localhost:5179/reconciliation/ | [open](https://handao2303.github.io/aegis-ekyc-ui/reconciliation/) |
| Credit limit | http://localhost:5179/credit-limit/ | [open](https://handao2303.github.io/aegis-ekyc-ui/credit-limit/) |

Use the **VI | EN** switch in the header to change language; the choice is remembered. A `?lang=` parameter in the URL takes priority, so shared links open in the intended language.

## Run with the backend (module 1 – eKYC)

The eKYC flow and the Compliance queue now run against a real backend, [`server/`](server/README.md) (Node 23, no dependencies, SQLite locally).

```bash
npm run dev:all    # ekyc-service on :8787 + web on :5179
```

- The web app detects the backend automatically on `localhost` or a LAN IP (`?api=<url>` to point elsewhere, `?api=off` for the offline demo). GitHub Pages has no backend, so it stays in demo mode.
- Customer app `/app/`: pick a test profile **TD-01 → TD-13** (C17 §4) on the first screen; the result (STP / REFER / REJECTED, duplicate, expired ID…) comes from the backend.
- Compliance `/compliance/`: switch user in the left menu (Officer, second Officer, Team lead, CS) to try maker-checker, two-person threshold changes and masked views.
- Backend tests: `npm run test:server`.
- On an iPhone on the same Wi-Fi: open `http://<Mac IP>:5179/app/`. The camera needs HTTPS, so over plain HTTP the capture screens fall back to sample images; the rest of the flow works.

## Test on iPhone

1. Open **https://handao2303.github.io/aegis-ekyc-ui/app/** in Safari on the iPhone.
2. Tap **Share → Add to Home Screen**.
3. Launch **Aegis** from the home screen: it runs full screen like a native app, with its own icon and safe-area padding for the Dynamic Island and home indicator. Safari asks for camera permission at the ID capture step.

The customer app is a PWA (`src/app/manifest.ts`, Apple web-app meta tags in `src/app/app/page.tsx`).

## Deployment

The site is hosted on GitHub Pages from the `gh-pages` branch.

```bash
npm run deploy     # next build with BASE_PATH=/aegis-ekyc-ui, then push out/ to gh-pages
```

All three pages are static HTML that hydrate in the browser, so no server is needed.

## Features

**Customer app**
- Consent per data scope, with re-consent when the terms change
- ID document capture (front/back) with the real rear camera, photo check and OCR review
- NFC chip reading, with a manual-review fallback for phones without NFC
- Active liveness check with the front camera and timed challenges; selfie is shown next to the ID photo while verifying
- Results as a bank-style receipt: approved, under review (24-hour timeline) or rejected
- Edge cases: unreadable document (retry counter), resume an unfinished application, more information requested, existing customer, expired ID

**Card limit (customer)**
- My card: available vs total limit, utilisation meter, on-hold amount, Smart Fallback toggle to the linked account, recent transactions
- Temporary Limit Boost offer: new limit, time-boxed validity, automatic return, fee; must acknowledge before accepting; live countdown once active
- Boost lock notice: push-style alert, unusual transactions to confirm, "Yes, it was me" or "Not me – lock my card"

**Compliance back-office**
- Review queue with SLA status (on track / due soon / breached), risk score, filters and search
- Case detail: OCR vs chip comparison, face-match scores and source, risk screening (Compliance only), device signals, case history
- Approve, reject (reason required) or request more information (max 2 times; SLA pauses meanwhile)
- Maker-checker for PEP, sanctions and high-risk cases
- Masked personal data; viewing the full name is logged
- Completed cases, SLA report (7-day chart, top referral reasons) and threshold settings that require a second approver

## Why this stack

| Choice | Reason |
|---|---|
| **Next.js 14 (App Router)** | File-based routes for the three products (`/`, `/app/`, `/compliance/`), per-page metadata, self-hosted Be Vietnam Pro via `next/font` (Vietnamese subset, no layout shift), and static export for free hosting on GitHub Pages. The Compliance back-office can later move to server components and API routes without changing the UI code. |
| **React 18 + TypeScript** | Same component model as the React Native/Expo mobile app used in Aegis. Screen logic and component names carry over, and TypeScript catches errors in types such as `Outcome` and `ReasonCode`. |
| **Tailwind CSS 3.4** | Used only as a mapping layer to CSS tokens (`tailwind.config.js`). Tailwind's default colours aren't used, so re-theming means editing `tokens.css` only. |
| **CSS custom properties** | One token source for the web and, via export, React Native. Light/dark switches through variables, so components don't need to know the current theme. |
| **lucide-react** | Consistent, lightweight, tree-shakeable icons. |

To move into the real mobile app: keep the tokens and screen structure, and replace `div`/`button` with `View`/`Pressable` (or use NativeWind to keep the Tailwind classes).

## Project structure

```
next.config.mjs              ← static export, base path for GitHub Pages
src/
├── app/                     ← Next.js routes
│   ├── layout.tsx           ← <html>, font, metadata, global CSS
│   ├── page.tsx             ← /            UI Kit
│   ├── app/page.tsx         ← /app/        customer app
│   ├── compliance/page.tsx  ← /compliance/ back-office
│   └── ClientOnly.tsx       ← loads the views in the browser only (they read URL and localStorage on start)
├── views/                   ← UiKit.tsx, CustomerApp.tsx, ComplianceApp.tsx (page shells)
├── i18n.tsx                 ← VI/EN provider, tr("vi", "en") helper, language switch
├── styles/tokens.css        ← semantic tokens (light/dark), interaction overlay
├── components/ui/index.tsx  ← Button, Badge, Card, Alert, TextField, Checkbox, Tabs, Modal, Stepper, ProgressBar, KV
├── shared/theme.tsx         ← theme hook and toggle
├── mobile/
│   ├── MobileShell.tsx      ← banking screen layout, ID card illustration
│   ├── screens.tsx          ← the 19 customer screens
│   └── MobileFlowPage.tsx   ← screen list, UX notes and Jira traceability (UI Kit)
├── ops/
│   ├── kit.tsx              ← dashboard shell, KPI cards, tables, SVG charts
│   ├── Reconciliation.tsx   ← REC-01 → 06 and data lineage
│   └── CreditLimit.tsx      ← LIM-W1 → W4 and card list
├── web/
│   ├── data.ts              ← sample cases, SLA rules, reason codes
│   ├── CompliancePage.tsx   ← queue, case detail, decision dialogs, navigation
│   └── pages.tsx            ← completed cases, SLA report, threshold settings
└── ds/DesignSystemPage.tsx  ← design system docs with a live WCAG contrast table
```

## Customer app skin ("Aurora")

The customer app uses its own skin, scoped by the `skin-aurora` class in `tokens.css`: white screens, large left-aligned titles, a purple-to-amber gradient for accents and pill buttons, and the Lexend typeface (geometric like Outfit, with full Vietnamese diacritics). Only token values change; components are shared with the navy Compliance back-office.

Two gradients keep contrast honest: `--grad-brand` (bright) is decorative only, while `--grad-action` is darker so white button labels stay at WCAG AA in the middle of the button.

## Operations dashboards (Reconciliation, Credit limit)

Both share `src/ops/kit.tsx`: a light grey sidebar with a module switcher and ⌘K search, a white workspace, KPI cards with a gradient footer for the headline metric, dependency-free SVG line charts with hover tooltips, pill status tags and gradient progress meters, all on the Aurora tokens. Business rules are enforced in the UI and labelled with their IDs (for example `RULE-REC-05` blocks approving your own rule or GL entry, `RULE-REC-04` routes entries over 50 million ₫ to a checker, `BR-LIM-02` shows a version conflict on concurrent limit updates). Sample data is fictional and PANs are always masked.

## Real camera

On `/app/` the ID capture uses the rear camera and the liveness step uses the front camera (`src/mobile/camera.tsx`, `getUserMedia`). Photos are kept in memory for the session only, shown back on the review, details and verifying screens, and never uploaded. If the camera is missing or permission is denied, the screen says so and falls back to a sample image so the flow can continue. NFC and the liveness challenges remain simulated: Safari on iPhone has no Web NFC, and head movement is not analysed yet.

## Design system principles

1. **Tokens are named by purpose** (up to 4 words): `action-primary-subtle-text`, `status-warning-subtle-bg`…
2. **Transparent overlays for hover/press** (`.interactive`), so no extra colour per state.
3. **WCAG 2.1 AA** in both themes, checked live on the Design System page.
4. **Dark mode elevation** uses progressively lighter surfaces instead of shadows.
5. **Never colour alone**: every status also has text and an icon.

## Jira traceability

| UI area | Ticket |
|---|---|
| Main mobile flow | SCRUM-17/18/19/39/46/47 |
| Compliance queue & case detail | SCRUM-21/48 |
| Existing customer, expired ID | SCRUM-73, SCRUM-74 |
| Resume application | SCRUM-75 |
| Request more information | SCRUM-76 |
| Customer notifications, queue SLA | SCRUM-77, SCRUM-78 |
| Maker-checker, audit of PII views | SCRUM-79 |
| Chip vs printed-photo match source; OCR-only never auto-approved | SCRUM-80 |

All names, ID numbers and account numbers in this project are fictional.
