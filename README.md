<h1 align="center">AI Fantasy Draft Helper</h1>
<p align="center"><strong>Your unfair advantage for 2025 fantasy drafts – tier-aware, strategy-first, multi‑AI powered.</strong></p>
<p align="center">
   <a href="https://github.com/BigSlikTobi/T4L_fantasy_draft"><img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Project Status" /></a>
   <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
   <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI-8A2BE2?style=flat-square" alt="AI Providers" />
   <img src="https://img.shields.io/badge/Speed-Fast%20Mode%20✓-teal?style=flat-square" alt="Fast Mode" />
   <img src="https://img.shields.io/badge/Tech-React%20%7C%20TypeScript%20%7C%20Vite-black?style=flat-square" alt="Stack" />
</p>

---

## � Table of Contents
1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [How It Works](#-how-it-works)
4. [Player Rankings JSON Format](#-player-rankings-json-format)
5. [Run on Web / Locally](#-run-on-web)
6. [Sleeper Integration](#-sleeper-integration)
7. [API Keys & Privacy](#-api-keys--privacy)
8. [Simulation / Validation](#-simulation--validation-fast-mode)
9. [Core Roster Enforcement](#-core-roster-enforcement)
10. [Fast Mode Algorithm](#-fast-mode-algorithm-summary)
11. [Build & Deploy](#-build--deploy)
12. [Troubleshooting](#-troubleshooting)
13. [Roadmap](#-roadmap-ideas)
14. [License](#-license)
15. [Contributing](#-contributing)

---

## �🚀 Overview
This app acts as both a live Draft Assistant and a fully automated Mock Draft simulator. It ingests your custom tiered rankings (including K & DST in late tiers), applies strategic heuristics plus LLM reasoning (Google Gemini or OpenAI GPT), and produces fast, explainable picks. A tuned fast-mode algorithm + late-round roster logic guarantees you leave your draft with a structurally sound roster.

---

## ✅ Key Features
| Category | Highlights |
|----------|------------|
| AI Integration | Toggle between **Google Gemini** and **OpenAI GPT** at setup |
| Strategy Engine | Two-step flow: (1) Strategy generation → (2) Specific player recommendation |
| Fast Mock Mode | 8–10× faster simulation using deterministic tier + positional need scoring + lightweight prompts (or no prompts) |
| Late-Round Intelligence | Enforces completion of: QB, RB, RB, WR, WR, TE, Flex (RB/WR), DST, K within 16 picks |
| K & DST Handling | Explicit deprioritization until roster size ≥ 12 or must-fill phase; guarantees both are drafted late (K ~ Tier 16, DST ~ Tier 17) |
| Essential Roster Tracking | Live status pills show filled vs pending core slots & remaining essential needs |
| Player Blocking | Instantly remove players from future AI consideration & mocks |
| Tier-Based Rankings | Your uploaded JSON defines the board; lower tier number = higher value |
| API Key In-App Entry | No env vars required; keys never stored server-side |
| Visual Feedback | Animated fast-mode pick flow, highlighting, pulsing phases |
| Simulation Harness | Script to repeatedly test pick timing & validate late K/DST logic |
| Sleeper Integration | Link your Sleeper account to auto‑prefill: league size, draft slot, scoring, format, total rounds |

---

## 🧠 How It Works
1. You upload a JSON ranking list with tiers (including Kickers in Tier 16 & Defenses in Tier 17).
2. In Assistant Mode:
   - You request a strategy → AI summarizes optimal directional approach (value pocket, structural need, tier cliffs).
   - You confirm → AI recommends a single player that fits strategy + roster context.
3. In Mock Mode:
   - Opposition picks are either AI-selected (normal) or algorithmic (fast mode).
   - The fast algorithm scores players by: base tier + positional priority + unmet essential bonuses.
   - K/DST suppressed until late; forced if essential slots equal remaining picks.
4. Status pills update live: essential needs, roster progress, remaining obligatory slots.

---

## 📦 Player Rankings JSON Format
Upload a single JSON array. Each object must contain:
`rank`, `name`, `team`, `position`, `tier`.

Valid positions: `QB`, `RB`, `WR`, `TE`, `K`, `DST`.

Kickers should reside in **Tier 16** and Defenses in **Tier 17** (as per current late-round heuristics). Example (truncated):

```json
[
  { "rank": 1, "name": "Justin Jefferson", "team": "MIN", "position": "WR", "tier": 1 },
  { "rank": 7, "name": "Bijan Robinson", "team": "ATL", "position": "RB", "tier": 1 },
  { "rank": 28, "name": "Mark Andrews", "team": "BAL", "position": "TE", "tier": 3 },
  { "rank": 150, "name": "Top Kicker 1", "team": "KC", "position": "K", "tier": 16 },
  { "rank": 165, "name": "Elite Defense 1", "team": "NYJ", "position": "DST", "tier": 17 }
]
```

Minimum validation rules:
* Non-empty array
* All required keys present
* Positions must be from the supported list
* Tiers numeric, ascending meaning higher value when lower

---
## 🔥 Run on Web
Tackle4Loss Fantasy Draft is available at *[tackle4loss_fantasy_helper](https://tackleforloss01.firebaseapp.com/)*

## 🖥️ Run Locally
Prerequisite: Node.js (LTS 18+ recommended).

```
npm install
npm run dev
```
Open the printed URL (default: http://localhost:5173).

Setup Screen Steps:
1. Choose Draft Mode (Assistant or Mock)
2. (Optional) Enable Fast Mode for mocks
3. Select AI provider (Gemini / OpenAI)
4. Paste API key for chosen provider
5. (Optional) Enable Sleeper and fetch leagues/drafts to auto‑prefill settings
6. Configure or confirm league size, pick slot, format (Snake / Linear), rounds (if not auto‑filled)
6. Upload rankings JSON
7. Start Draft

### 🛌 Sleeper Integration
The app can pull live draft configuration from Sleeper public endpoints—no auth token required.

1. Tick “Link Sleeper Account”.
2. Enter your Sleeper username → Fetch.
3. Select a 2025 league (NFL only for now).
4. Pick a listed draft (pre_draft, draft, or complete states supported).

Once a draft is chosen we call:

```
GET https://api.sleeper.app/v1/draft/{draft_id}
```

We extract:
* `draft_order` → maps `user_id` to draft slot (your pick position).
* `settings.rounds` → total rounds (used as total roster slots instead of the previous hardcoded 16).
* `settings.teams` / league `total_rosters` → league size.
* `metadata.scoring_type` (ppr | half_ppr | standard) → maps to in‑app scoring format.
* `type` → snake vs linear.

These fields then auto-populate `DraftSettings` (`leagueSize`, `pickPosition`, `scoringFormat`, `draftFormat`, `totalRounds`). You can override any value manually afterwards.

If `rounds` is absent we fall back to the default (16). Roster & essential need calculations are fully dynamic off `totalRounds`.

Sync Button: During an Assistant draft with Sleeper enabled, use “My Turn (Sync Sleeper)” to align the local state once your actual pick comes up (future enhancement may poll automatically).

Planned future Sleeper enhancements:
* Live pick ingestion (websocket or periodic fetch of `/draft/{id}/picks`).
* Auto-advance local draft board.
* Multi-league season memory.

---

## 🔐 API Keys & Privacy
* Keys are entered client-side and used only for outbound API calls.
* No persistence beyond session.
* You may rotate keys anytime via provider dashboards.

Providers:
* Gemini: https://ai.google.dev/  
   *You can create a Gemini API key for FREE in **Google AI Studio**: https://aistudio.google.com/*
* OpenAI: https://platform.openai.com/api-keys

---

## 🧪 Simulation / Validation (Fast Mode)
We include a harness to statistically confirm late K/DST behavior:

```
npm install # (if not already)
npx ts-node --esm scripts/simulateFastMock.ts
```
Outputs average roster slot when your tracked team drafts K & DST and flags early selections. Adjust tier distribution or heuristics in `fastMockService.ts` if needed.

---

## 🤖 Core Roster Enforcement
The system guarantees these slots within the configured total rounds (default 16):

```
QB, RB, RB, WR, WR, TE, (Flex RB/WR), DST, K
```
Dynamic logic:
* Tracks essential unmet needs each pick
* If remaining picks == remaining essential slots → forced essential selection
* K/DST only scored positively once roster size ≥ 12 unless forced
* Final two (or proportional final ~12%) slots: guaranteed fill if still missing

---

## ⚡ Fast Mode Algorithm (Summary)
Score = TierScore − (PositionPriority * weight) − EssentialBonus
* PositionPriority escalates early RB/WR depth, safeguards early QB/TE, suppresses K/DST
* EssentialBonus accelerates filling missing core slots
* Forced branch triggers if must-fill scenario detected

---

## 🛠️ Build & Deploy
Production build:
```
npm run build
```
Output directory: `dist`

Deploying on Render (Static Site):
* Build Command: `npm run build`
* Publish Directory: `dist`
* No server env vars required (keys entered in-app)

### Firebase Hosting
1. Install CLI (global optional): `npm i -g firebase-tools`
2. Authenticate: `npx firebase login`
3. Set your project id in `.firebaserc` (`YOUR_FIREBASE_PROJECT_ID`)
4. Deploy:
```
npm run deploy
```
Hosting config lives in `firebase.json` (long-cache static assets, no-cache HTML).

---

## 🐞 Troubleshooting
| Issue | Fix |
|-------|-----|
| AI returns player not on board | Ensure JSON names exactly match; refresh & re-upload |
| K/DST picked too early | Verify tiers (K=16, DST=17) & rerun simulation harness |
| No strategy modal appears | Check console for API key / quota errors |
| Simulation script import error | Use `npx ts-node --esm scripts/simulateFastMock.ts` |

---

## 🗺️ Roadmap (Ideas)
* Custom roster templates (2QB / Superflex)
* Bye week balancing signals
* Value over replacement (VOR) integration
* Export draft recap & strategy rationale
* Multi-board comparison (consensus vs custom tiers)

---

## 📄 License
Licensed under the **MIT License**. See `LICENSE` for details.

---

## 🙌 Contributing
Open to suggestions—feel free to fork and submit PRs adding roster formats, heuristics, or UI polish.

---

Happy drafting & may the tiers be ever in your favor.
