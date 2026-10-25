# ⚡ NoteSnap

> **Turn messy college lecture notes into compact revision sheets and active-recall flashcards. 100% client-side, zero backend, works offline.**

NoteSnap is a production-grade Progressive Web App (PWA) designed for students. It extracts core concepts and high-yield sentences using an in-browser extractive summarization engine running inside a Web Worker, computes key term frequency distributions, and turns your notes into instant active-recall cloze flashcards with spaced repetition.

---

## ✨ Features

- **Extractive Summarization Engine (Zero AI API cost & 100% Private)**
  - Runs in a dedicated Web Worker to ensure 60fps UI responsiveness.
  - Sentence splitting with abbreviation protection (e.g. *Dr.*, *Prof.*, *vs.*, *i.e.*, *e.g.*, *etc.*) and decimal handling.
  - TF-IDF scoring combined with semantic feature boosts:
    - Definition boosts (*"is"*, *"refers to"*, *"means"*, *"defined as"*)
    - Numbers, units, percentages, and scientific formulas (*ATP*, *DNA*, *CO2*, equations)
    - ALL-CAPS terms and acronyms
    - Section thesis and heading alignment
    - Penalty for short sentence fragments or run-on sentences
  - Preserves natural chronological order grouped under detected headings.
- **Summary Length Control**
  - Segmented control for **Short (10%)**, **Medium (25%)**, and **Detailed (40%)**.
- **The "Snap" Moment**
  - Visual compression and camera shutter flash choreography using GSAP.
  - Staggered cascade of key sentences and spring-physics keyword chips.
  - Device haptic feedback (`navigator.vibrate`) and synthesized Web Audio sound effects.
- **Active-Recall "Quiz Me" Engine**
  - Auto-generated **Cloze (fill-in-the-blank)** questions by blanking top keywords from key sentences.
  - **3 Study Modes**:
    1. **Flashcards**: Realistic 3D card flip with depth and shadow, plus swipe gestures (Swipe left for Hard/Again, Swipe right for Easy).
    2. **Multiple Choice**: Plausible distractors dynamically drawn from other lecture keywords.
    3. **Type-In Answer**: Autocomplete-free text input with Levenshtein-tolerant validation.
  - **Spaced Repetition (SRS)**: Mark cards *Again*, *Hard*, or *Easy* to automatically adjust intervals and resurface challenging concepts.
  - **Completion Screen**: Confetti celebration, accuracy score ring, and "Study Missed Items" re-queue.
- **Export & Print**
  - Download as `.txt` or `.md`.
  - One-click copy to clipboard with formatting.
  - Clean print stylesheet (`@media print`) for clean paper or PDF revision sheets.
- **Offline Storage & History**
  - All saved sheets and card review stats persist in client-side **IndexedDB** (via `idb`).
  - Reopen, rename, and delete sheets with instant Undo toast support.
- **Full PWA Experience**
  - Web App Manifest with maskable & standard icons.
  - Service worker caching for 100% offline functionality.
  - Web Share Target (share text from external apps straight into NoteSnap).
  - Custom install banner (`beforeinstallprompt`).
  - Update notification toast when a new version is published.
- **Aesthetic & Motion**
  - Dark-first aesthetic with a polished Light theme toggle.
  - Interactive ambient aurora and particle mesh background reacting to pointer and touch.
  - Magnetic buttons, 3D card tilt with cursor glow, and respects `prefers-reduced-motion`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v24)
- npm 9+

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The dev server will start at `http://localhost:5173` with LAN access enabled for mobile testing.

### 3. Run Unit Tests

```bash
npm test
```

Verifies sentence splitting, abbreviation protection, TF-IDF scoring, Cloze generation, and Spaced Repetition algorithms.

### 4. Build for Production & Preview

```bash
npm run build
npm run preview
```

The production preview server will start at `http://localhost:4173`. Service workers and offline precaching are fully active in this mode.

---

## 📱 Testing on Mobile & Offline Mode

1. Connect your phone to the same Wi-Fi network as your computer.
2. In your terminal, look for the Network URL output by `npm run dev` or `npm run preview` (e.g. `http://192.168.x.x:5173` or `:4173`).
3. Open Chrome or Safari on your phone and browse to that URL.
4. Tap the **"Install"** button in the top bar or use the browser menu ("Add to Home Screen").
5. Turn on Airplane Mode on your phone to verify full offline functionality!

---

## 🌐 Deployment Instructions

### Deploy to Netlify
1. Connect your repository to Netlify.
2. Set **Build command**: `npm run build`
3. Set **Publish directory**: `dist`
4. Deploy!

### Deploy to Vercel
1. Run `npx vercel` or link your repository in the Vercel Dashboard.
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`

### Deploy to GitHub Pages
1. In `vite.config.js`, set `base: '/<repository-name>/'` (if not using a custom domain).
2. Run `npm run build`.
3. Deploy the contents of the `dist/` directory to the `gh-pages` branch using GitHub Actions or `npx gh-pages -d dist`.

---

## 🔒 Privacy & Honesty

- **No Data Leaves the Device**: All sentence parsing, scoring, keyword extraction, and card state management happen exclusively on your device.
- **Honest Extraction**: *"Summaries pick the most important sentences from your notes; they don't rewrite them."*
