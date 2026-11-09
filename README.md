# Aegis eKYC UI

The eKYC module UI for **Aegis Bank**, a personal banking project. Bilingual (Vietnamese / English), with light and dark themes.

- **Customer app** (`/app/`): online account opening. 19 screens covering the main flow, results and edge cases.
- **Aegis Compliance** (`/compliance/`): review back-office. Queue, case detail, maker-checker, completed cases, SLA report and threshold settings.
- **UI Kit** (`/`): design system and design documentation.

> All sample data is fictional. Camera, NFC, liveness and verification results are simulated; no backend APIs are connected yet.

## Getting started

```bash
npm install
npm run dev -- --port 5179
npm run build      # builds all 3 pages into dist/
npm run artifact   # builds the UI Kit as a single shareable HTML file
```

| Page | URL |
|---|---|
| Customer app | http://localhost:5179/app/ |
| Customer app – English | http://localhost:5179/app/?lang=en |
| Customer app – ends in "under review" | http://localhost:5179/app/?ketqua=refer |
| Customer app – ends in "rejected" | http://localhost:5179/app/?ketqua=rejected |
| Compliance back-office | http://localhost:5179/compliance/ |
| UI Kit & design docs | http://localhost:5179/ |

Use the **VI | EN** switch in the header to change language; the choice is remembered.

## Features

**Customer app**
- Consent per data scope, with re-consent when the terms change
- ID document capture (front/back) with live alignment, photo check and OCR review
- NFC chip reading, with a manual-review fallback for phones without NFC
- Active liveness check with random challenges
- Results as a bank-style receipt: approved, under review (24-hour timeline) or rejected
- Edge cases: unreadable document (retry counter), resume an unfinished application, more information requested, existing customer, expired ID

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
| **React 18 + TypeScript** | Same component model as the React Native/Expo mobile app used in Aegis. Screen logic and component names carry over, and TypeScript catches errors in types such as `Outcome` and `ReasonCode`. |
| **Tailwind CSS 3.4** | Used only as a mapping layer to CSS tokens (`tailwind.config.js`). Tailwind's default colours aren't used, so re-theming means editing `tokens.css` only. |
| **CSS custom properties** | One token source for the web and, via export, React Native. Light/dark switches through variables, so components don't need to know the current theme. |
| **lucide-react** | Consistent, lightweight, tree-shakeable icons. |
| **Vite** | Fast builds, multi-page dev server, single-file build for sharing. |

To move into the real mobile app: keep the tokens and screen structure, and replace `div`/`button` with `View`/`Pressable` (or use NativeWind to keep the Tailwind classes).

## Project structure

```
app/index.html, compliance/index.html  ← entry pages for the two products
src/
├── entries/                 ← app.tsx (customer app), compliance.tsx (back-office layout)
├── i18n.tsx                 ← VI/EN provider, tr("vi", "en") helper, language switch
├── styles/tokens.css        ← semantic tokens (light/dark), interaction overlay
├── components/ui/index.tsx  ← Button, Badge, Card, Alert, TextField, Checkbox, Tabs, Modal, Stepper, ProgressBar, KV
├── shared/theme.tsx         ← theme hook and toggle
├── mobile/
│   ├── MobileShell.tsx      ← banking screen layout, ID card illustration
│   ├── screens.tsx          ← the 19 customer screens
│   └── MobileFlowPage.tsx   ← screen list, UX notes and Jira traceability (UI Kit)
├── web/
│   ├── data.ts              ← sample cases, SLA rules, reason codes
│   ├── CompliancePage.tsx   ← queue, case detail, decision dialogs, navigation
│   └── pages.tsx            ← completed cases, SLA report, threshold settings
└── ds/DesignSystemPage.tsx  ← design system docs with a live WCAG contrast table
```

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
