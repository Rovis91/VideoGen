# Ad Video Generator (Desktop App) — TODO & LOG

**Purpose:** Living execution checklist for development, validation, rollback, and debugging.  
**Reference:** `docs/AD_VIDEO_GENERATOR_SPEC.md`  
**Target:** Zero to working executable on macOS and Windows.

---

## 1. Header

- **Product:** Ad Video Generator (Desktop App)
- **Platforms:** macOS, Windows only
- **Constraint:** Single packaged executable per platform; no user-installed runtime (Python, Node, etc.).

---

## 2. Global Assumptions & Constraints (Validated Later)

| # | Assumption / Constraint | Validation Checkpoint |
|---|-------------------------|------------------------|
| A1 | One primary language at runtime; runtime bundled in app | Phase 2, Build & Run Verification |
| A2 | Google APIs only: Vision/Gemini for image + ideas; Nano Banana (or official Google video API) for video | Phase 6, 7 |
| A3 | Config path: `~/.adgen/config.json` (Windows: `%USERPROFILE%\.adgen\config.json`) | Phase 10 |
| A4 | Exactly 10 ideas per run; read-only in UI | Phase 6 |
| A5 | Four screens only: Setup, Input, Ideas, Generation | Phase 3, 4 |
| A6 | User never installs Python, Node, or any runtime | Build & Run Verification, Ready to Code Gate |

---

## 3. Master TODO Checklist

### Phase 1: Environment & Tooling Choice

- [x] 1.1 Choose packaging stack (Electron or Tauri) and document choice
- [x] 1.2 Verify chosen stack produces one executable/bundle per platform with runtime bundled
- [x] 1.3 Create minimal project scaffold (no UI yet)
- [x] 1.4 Confirm build command runs and produces runnable artifact on current OS
- [x] **STOP & VERIFY:** Scaffold builds; artifact runs on dev machine; no separate runtime install required for developer run

---

### Phase 2: Single-Language / Single-Executable Strategy Validation

- [x] 2.1 Document the single “application language” (e.g. TypeScript in Electron, or Rust in Tauri)
- [x] 2.2 Confirm all app logic (API client, config, cancellation) lives in that stack; no out-of-process Python/Node script invoked by user
- [ ] 2.3 Run packaged app (dev or first package) and confirm single process / single binary (or single app bundle)
- [ ] **STOP & VERIFY:** One primary language; one executable/bundle; runtime is inside the package

---

### Phase 3: Minimal UI Bootstrapping

- [x] 3.1 Implement app window (correct size, title, close/minimize)
- [x] 3.2 Implement navigation placeholder for four screens (Setup, Input, Ideas, Generation); no behavior yet
- [x] 3.3 Wire “screen” switching (e.g. Setup → Input after dummy Save)
- [x] **STOP & VERIFY:** App opens; user can see four screen placeholders and switch between them

---

### Phase 4: Setup Screen & Google API Authentication

- [x] 4.1 Setup screen: API key input (masked), Save button
- [x] 4.2 Validate API key non-empty after trim; show inline error and block on invalid
- [x] 4.3 On Save: persist key to config file; create `~/.adgen` (or equivalent) if missing
- [ ] 4.4 Optional: one lightweight Google API call to verify key; on failure show “Invalid API key” and do not persist
- [x] 4.5 On success: navigate to Input screen
- [x] 4.6 If config already has key: allow skip/later or go straight to Input (per spec)
- [x] **STOP & VERIFY:** First run shows Setup; valid key saves and moves to Input; invalid key blocks with message

---

### Phase 5: Input Screen & Image Input Validation

- [x] 5.1 Input screen: image picker / drop zone (single image)
- [x] 5.2 Accept only JPEG, PNG, WebP; enforce max size (e.g. 10 MB); show error for invalid format/size
- [x] 5.3 Optional text idea: multi-line plain text input
- [x] 5.4 Video duration: dropdown or stepper (5, 10, 15, 20 s); default from config or 10
- [x] 5.5 Output folder picker; persist last path to config when changed
- [x] 5.6 “Generate Ideas” enabled only when image selected and valid; disabled + hint when image missing
- [x] **STOP & VERIFY:** Image required for Generate Ideas; invalid image shows error and disables generation; duration and folder persist

---

### Phase 6: Idea Generation (Exactly 10 Ideas)

- [x] 6.1 Call Google (Vision/Gemini) with image + optional user text; use system prompt only (no user-editable prompt)
- [x] 6.2 Parse response into exactly 10 ideas (concept sentence for UI; internal tone/angle for video step)
- [x] 6.3 If API returns fewer than 10: treat as error; do not show Ideas screen with partial list; allow retry
- [x] 6.4 On success: navigate to Ideas screen and render 10 read-only items
- [x] 6.5 Ideas are read-only; no edit UI
- [x] **STOP & VERIFY:** Exactly 10 ideas shown after successful generation; user cannot edit ideas; partial response = error + no navigation to Ideas

---

### Phase 7: Video Generation (Parallel Jobs)

- [ ] 7.1 Ideas screen: checkbox per idea; “Generate Videos” enabled when ≥1 selected
- [ ] 7.2 On “Generate Videos”: ensure output folder is set (from Input or config); one async request per selected idea
- [ ] 7.3 Call Google Nano Banana (or official Google video API) per idea: image + idea concept/tone/angle + duration
- [ ] 7.4 Run requests in parallel (with optional concurrency cap, e.g. 3–5)
- [ ] 7.5 Save each response to disk in chosen folder; deterministic file naming (e.g. ad_1.mp4); avoid overwrite (e.g. append number if exists)
- [ ] 7.6 Navigate to Generation screen when generation starts
- [ ] **STOP & VERIFY:** One video per selected idea; parallel execution; files saved to chosen folder; no local GPU/models

---

### Phase 8: Progress Tracking

- [ ] 8.1 Generation screen: one progress indicator per selected idea (label: idea index or short concept)
- [ ] 8.2 States per item: pending / in progress / done / error
- [ ] 8.3 Update UI as each job completes or fails
- [ ] 8.4 “Open Folder” button: enabled when at least one video saved; opens OS file manager to output folder
- [ ] 8.5 No in-app video preview (spec)
- [ ] **STOP & VERIFY:** Progress visible per video; Open Folder works; no preview in app

---

### Phase 9: Cancellation Logic

- [ ] 9.1 Idea generation: Cancel button stops API call(s); user remains on Input; no partial idea list
- [ ] 9.2 Video generation: Cancel stops all in-flight requests (abort/cancel tokens or equivalent)
- [ ] 9.3 On cancel: progress stops; already-saved files are not deleted or corrupted
- [ ] **STOP & VERIFY:** Cancel during ideas stops cleanly; cancel during videos stops all jobs; completed files remain valid

---

### Phase 10: Error Handling

- [ ] 10.1 Invalid API key: block on Setup; inline error; do not persist
- [ ] 10.2 Invalid/missing image: disable Generate Ideas; inline error message
- [ ] 10.3 Idea generation API failure: show error; no Ideas screen with &lt;10 ideas; allow retry or Back
- [ ] 10.4 Video generation API failure: per-video error state; other videos continue; successful files remain saved
- [ ] 10.5 Partial failure: “Open Folder” still opens folder; failed items clearly indicated in UI
- [ ] **STOP & VERIFY:** All error paths behave per spec; no corrupt state; partial success handled

---

### Phase 11: Config Persistence

- [ ] 11.1 Read config on startup; if no valid key, show Setup
- [ ] 11.2 Write `googleApiKey` on Setup Save
- [ ] 11.3 Write `lastOutputFolder` when user changes folder on Input
- [ ] 11.4 Write `defaultDurationSeconds` when user changes duration on Input
- [ ] 11.5 Config path correct for macOS and Windows
- [ ] **STOP & VERIFY:** Config survives restart; key, folder, duration persist; no encryption (per spec)

---

### Phase 12: Packaging & Distribution

- [ ] 12.1 Package for current OS (macOS or Windows) as single executable or app bundle
- [ ] 12.2 Package for the other OS (e.g. cross-compile or build on second OS/CI)
- [ ] 12.3 Verify packaged app runs without terminal (double-click launch)
- [ ] 12.4 Verify on clean machine (or clean VM): no prior install of Python, Node, or runtime; app runs from package only
- [ ] **STOP & VERIFY:** One deliverable per platform; runs without terminal; runs on machine without user-installed runtimes

---

## 4. Validation Gates

| Gate | Condition | Blocking? |
|------|-----------|-----------|
| V1 | Scaffold builds and runs | Yes |
| V2 | Single executable/bundle; runtime bundled | Yes |
| V3 | All four screens present and navigable | Yes |
| V4 | API key saved and validated; invalid key blocked | Yes |
| V5 | Image validation and Generate Ideas enable/disable correct | Yes |
| V6 | Exactly 10 ideas; read-only; no partial list on API failure | Yes |
| V7 | One video per idea; parallel; saved to disk | Yes |
| V8 | Progress and Open Folder work; cancel stops cleanly | Yes |
| V9 | Config persists; errors handled per spec | Yes |
| V10 | Packaged app runs without terminal on clean machine | Yes |

---

## 5. Build & Run Verification Checklist

- [ ] **B1** App builds from clean clone (or documented setup) with single build command
- [ ] **B2** App runs in dev mode without user-installed Python/Node (runtime is bundled or provided by tooling)
- [ ] **B3** User does NOT need to install Python, Node, or any runtime to run the packaged app
- [ ] **B4** App launches on clean machine (no dev tools, no runtimes) using only the packaged artifact
- [ ] **B5** Executable runs without opening a terminal/console window (double-click launch)
- [ ] **B6** macOS: single .app (or single executable); Windows: single .exe (or installer that produces one exe)

---

## 6. Known Risks & Watchpoints

| Risk | Mitigation |
|------|------------|
| Google video API name/schema differs from “Nano Banana” | Use official Google video API docs; adapt request/response in Phase 7 |
| Rate limits on parallel video requests | Cap concurrency (e.g. 3–5); surface rate-limit errors in UI |
| Config path differs by OS | Use `~` / `%USERPROFILE%` and document; test on both platforms |
| Cancellation not supported by API | Best-effort abort on client; document limitation if API does not support cancel |
| Large bundle size (e.g. Electron) | Accept per spec or consider Tauri for smaller binary |

---

## 7. Development Log (Chronological, Append-Only)

Use the template below for each log entry. Append new entries at the end of this section.

### Log Entry Template

```
---
**Date:** YYYY-MM-DD
**Step reference:** Phase X / Gate Vn / Build Bn
**Outcome:** pass | fail | blocked
**Notes:** What was done; what failed; what was observed.
**Decision:** continue | rollback | refactor
---
```

### Log Entries

```
---
**Date:** 2026-02-01
**Step reference:** Phase 1–6
**Outcome:** pass
**Notes:** Electron scaffold created (main.js, preload.js, index.html, renderer.js). Config at ~/.adgen/config.json. Setup screen: API key masked, Save, persist, navigate to Input. Input: image picker, validate type/size (10 MB), optional idea text, duration 5/10/15/20, output folder; Generate Ideas enabled when image valid. Idea generation via Gemini 2.0 Flash REST (ideas.js), exactly 10 ideas, read-only list; Back cancels idea generation. Video generation: placeholder only (Nano Banana not wired). Open Folder opens system file manager.
**Decision:** continue
---
```

---

## 8. Rollback & Recovery Notes

- **Rollback trigger:** Validation gate failed; build broken; runtime regression.
- **Actions:** Revert last commit or last phase; re-run STOP & VERIFY for that phase; document in Development Log with Decision: rollback.
- **Recovery:** Fix cause; re-validate from last passing gate; log Decision: continue or refactor.
- **Checkpoint strategy:** Tag or branch at each completed phase for safe rollback points.

---

## 9. “Ready to Code” Final Gate

Before starting implementation, confirm:

- [ ] **G1** Specification read (`docs/AD_VIDEO_GENERATOR_SPEC.md`)
- [ ] **G2** TODO phases 1–12 and validation gates 1–10 understood
- [ ] **G3** Tooling choice (Phase 1) decided; scaffold can be created
- [ ] **G4** Google API key (test) available for Phase 4 and 6–7
- [ ] **G5** Development log and rollback process agreed (append log, use checkboxes)

When G1–G5 are checked, proceed to Phase 1. Update checkboxes and log as you go.
