# Ad Video Generator (Desktop App) — Product & Engineering Specification

**Version:** 1.0  
**Status:** Implementation-ready  
**Platforms:** macOS, Windows only

---

## 1. Product Overview and Scope

### 1.1 Purpose
A desktop application that lets non-technical e-commerce sellers generate short social media ad videos (5–20 seconds) from a single product image. The app uses only Google AI: image analysis, text-based idea generation, and video generation via the Google Nano Banana API. No cloud backend, no user accounts, no project history.

### 1.2 Target User
Non-technical e-commerce seller. Mental model: *“Upload image → pick idea → get video.”*

### 1.3 In Scope
- Single executable per platform (macOS, Windows); no user-installed runtimes.
- Local config only (API key, last output folder, default duration).
- Four screens: Setup → Input → Ideas → Generation.
- Exactly 10 read-only ad ideas per run.
- One video per selected idea; parallel generation; progress and cancel.
- All AI via Google (Vision/Gemini for image + ideas; Nano Banana for video).

### 1.4 Out of Scope
- User accounts, cloud backend, project history, analytics.
- Prompt editing UI, local image/video models, multi-image input.
- SaaS, scalability, Linux.

### 1.5 Architecture Constraint (Non-Negotiable)
- **Single packaged executable** per platform (e.g. one `.exe` on Windows, one `.app` on macOS).
- **No user-installed runtime:** Python, Node.js, package managers, etc. must not be required; any runtime is bundled inside the app.
- **One primary application language** at runtime (e.g. TypeScript in a bundled Electron app, or Rust in Tauri); backend logic is compiled/bundled into the binary.
- **Confirmation:** The architecture satisfies single-language, single-executable, no-runtime-install: one installer or app bundle per OS, with runtime and app code packaged together.

---

## 2. Screen-by-Screen UI Specification

### 2.1 Screen 1: Setup
**When shown:** First launch, or when no valid API key is stored.

| Element | Type | Behavior / Validation |
|--------|------|------------------------|
| **Google API key** | Single-line text input, masked (password-style) | Required. On Save: validate format (non-empty, no leading/trailing spaces). Invalid key → blocking error message; do not persist or proceed. |
| **Save** | Button | Persist key to config; switch to Input screen. If validation fails, show error inline and keep user on Setup. |
| **Skip / Later** | Optional link | Only if key already in config; allows going to Input without re-entering (e.g. “Use existing key”). |

**States:**
- Default: empty or pre-filled from config.
- Loading: disable Save while validating/persisting.
- Error: inline message below input (e.g. “Please enter a valid API key”).

**Validation:** API key must be non-empty after trim. Optionally, first-time validation via a minimal Google API call (e.g. one Vision or Gemini request) to confirm key works; failure = “Invalid API key” and block.

---

### 2.2 Screen 2: Input
**When shown:** After Setup (or when API key already present).

| Element | Type | Behavior / Validation |
|--------|------|------------------------|
| **Product image** | File picker / drop zone | Single image only. Accepted formats: JPEG, PNG, WebP. Max size: e.g. 10 MB. Required for “Generate Ideas”. |
| **Optional idea (text)** | Multi-line plain text, optional | Free-text hint (e.g. “summer sale”, “luxury feel”). Not a prompt; not editable by user as a prompt. |
| **Video duration** | Dropdown or stepper | Values: 5, 10, 15, 20 seconds. Default from config or 10 s. |
| **Output folder** | Folder picker | Required for “Generate Videos”. Last used path from config as default. |
| **Generate Ideas** | Button | Enabled when image is selected and API key valid. Triggers idea generation; navigates to Ideas when done (or on cancel). |

**States:**
- Missing image: “Generate Ideas” disabled; inline hint “Select a product image”.
- Invalid image: clear error (e.g. “Unsupported format or file too large”); disable generation.
- Ready: image + optional text + duration set → “Generate Ideas” enabled.

**Navigation:** After “Generate Ideas” completes → Ideas screen with 10 ideas. Cancel → back to Input (no navigation to Ideas).

---

### 2.3 Screen 3: Ideas
**When shown:** After exactly 10 ideas have been generated from Input screen.

| Element | Type | Behavior / Validation |
|--------|------|------------------------|
| **List of ideas** | List of 10 items | Each item: short concept sentence (read-only). No editing. |
| **Selection** | Checkbox per idea | User can select one or more. At least one must be selected to enable “Generate Videos”. |
| **Generate Videos** | Button | Enabled when ≥1 idea selected. Requires output folder to be set (use value from Input or prompt once). |
| **Back** | Link or button | Return to Input (discard current ideas; user can generate again). |

**States:**
- Loaded: 10 ideas shown; 0 selected → “Generate Videos” disabled.
- 1+ selected → “Generate Videos” enabled (and output folder already chosen on Input).
- If output folder was not set on Input: on “Generate Videos” either open folder picker or use config default.

**No editing:** Ideas are system-generated only; user sees only the concept sentence.

---

### 2.4 Screen 4: Generation
**When shown:** After user clicks “Generate Videos” from Ideas screen.

| Element | Type | Behavior / Validation |
|--------|------|------------------------|
| **Progress per video** | One progress indicator per selected idea | Label: idea index or short concept snippet. State: pending / in progress / done / error. |
| **Cancel** | Button | Cancels all in-flight generations; see Cancellation behavior below. |
| **Open Folder** | Button or link | Enabled when at least one video has been saved. Opens the output folder in OS file manager. No in-app video preview. |

**States:**
- Running: multiple progress bars; some may complete while others run (parallel).
- Partial success: some done, some failed → show which failed; “Open Folder” still opens folder for successful files.
- All done or cancelled: Cancel hidden or disabled; “Open Folder” available if any file was saved.

**Output:** One file per idea; format per Google Nano Banana API (e.g. Nano Banana Pro output format). File names: deterministic (e.g. `ad_1.mp4`, `ad_2.mp4`) or based on idea index; no overwrite without clear rule (e.g. append number if file exists).

---

## 3. End-to-End Flow Descriptions

### 3.1 First-Run Flow
1. Launch app → Setup screen.
2. User pastes Google API key → Save.
3. App validates key (and optionally checks with one API call); if invalid → error, stay on Setup.
4. If valid → save to `~/.adgen/config.json` (or platform equivalent); go to Input.

### 3.2 Happy Path: Image → Ideas → Videos
1. **Input:** User selects image, optionally enters text idea, sets duration and output folder. Clicks “Generate Ideas”.
2. **Idea generation:** App calls Google (Vision/Gemini) to analyze image + optional text; system prompt produces exactly 10 ideas (concept sentence + internal tone/angle); progress/loading on Input or transition. Cancel available.
3. **Ideas:** App shows 10 read-only ideas; user selects one or more; clicks “Generate Videos”.
4. **Video generation:** For each selected idea, app calls Google Nano Banana API; requests run in parallel; progress per video on Generation screen. Cancel stops active calls; completed files are not deleted.
5. **Done:** User clicks “Open Folder” to view files. No in-app preview.

### 3.3 Subsequent Runs
- If config has API key → skip Setup (or show Setup only via “Settings” / “Change API key” if provided).
- Input screen pre-fills: last output folder, default duration from config.

---

## 4. Error and Cancellation Handling

### 4.1 Error Handling
- **Invalid API key:** Shown on Setup. Block navigation to Input until key is valid (and optionally verified with one call).
- **Invalid or missing image:** On Input, disable “Generate Ideas”; show inline error (format/size/missing).
- **API failure during idea generation:** Show error message; do not show Ideas screen with fewer than 10 ideas. Allow retry (e.g. “Generate Ideas” again) or Back to Input.
- **API failure during video generation:** Per-video: mark that slot as “Error” with short message; other videos continue. Successfully generated videos remain saved. No corruption of existing files.
- **Partial failure:** Any successful video is written to disk; “Open Folder” opens folder; failed items clearly indicated in UI.

### 4.2 Cancellation Behavior
- **During idea generation:** Cancel button stops the idea-generation request(s); no transition to Ideas screen; user remains on Input; no partial idea list shown.
- **During video generation:** Cancel stops all in-flight Nano Banana requests; progress bars stop updating; already completed downloads are written to disk and not removed; no file corruption.
- Implementation: use abort/cancel tokens or equivalent for all Google API calls so that on Cancel the client stops waiting and does not fire further requests for the cancelled run.

---

## 5. Configuration and Persistence

### 5.1 Config File
- **Path:** `~/.adgen/config.json` (Windows: `%USERPROFILE%\.adgen\config.json`).
- **Contents (example):**
```json
{
  "googleApiKey": "string",
  "lastOutputFolder": "absolute path string",
  "defaultDurationSeconds": 10
}
```
- **Persistence:** Write on Save (Setup), and when user changes output folder or duration (Input). No encryption.

### 5.2 When to Read/Write
- On startup: read config; if no valid key, show Setup.
- On “Save” (Setup): write `googleApiKey`.
- On folder picker change (Input): write `lastOutputFolder`.
- On duration change (Input): write `defaultDurationSeconds`.

---

## 6. AI Prompting Strategy (System-Only)

### 6.1 Principles
- All prompts are **system-level**; user never sees or edits them.
- Prompts are **deterministic, structured, machine-formatted** (no free-form user-authored prompts).
- CPA, tone, pacing, and marketing angle are encoded in system prompts only.

### 6.2 Image Analysis + Idea Generation
- **Input:** Product image (bytes or URL) + optional user text (plain hint only).
- **Model:** Google Vision or Gemini Vision for image; Google text model for idea generation (or single Gemini call with image + text).
- **System prompt (conceptual):** Instruct the model to (1) describe the product and context from the image, (2) incorporate the optional user hint as a theme only, (3) output exactly 10 ad ideas. Each idea: one short concept sentence for the user; internally can include tone and marketing angle for the video step. Output format: structured (e.g. JSON array of `{ "concept": "...", "tone": "...", "angle": "..." }`); only `concept` is shown in the UI.
- **Structured output:** Parse response into 10 ideas; validate count; if fewer than 10, treat as error and retry or show error (no partial list).

### 6.3 Video Generation (Nano Banana)
- **Input per video:** Selected idea (concept + internal tone/angle), product image, duration (5/10/15/20 s).
- **API:** Google Nano Banana (or official Google video-generation API name). Request format must follow the API’s documented schema (e.g. image URL or base64, text description, duration, output format).
- **System-side “prompt”:** Build the video request from the idea’s concept and internal fields; user never edits this. Output format: Nano Banana Pro (or API’s designated format); save as file (e.g. MP4) to the chosen output folder.
- **Clarification for implementers:** If the actual Google video API name or schema differs from “Nano Banana” / “Nano Banana Pro”, replace these with the official API and response format; the rest of this spec (one idea → one request, parallel calls, cancel, save to disk) remains unchanged.

---

## 7. Technical Implementation Notes

### 7.1 Single-Executable, No User Runtime
- **Options:** (1) **Electron:** App code in TypeScript/JavaScript; Node and Chromium bundled in the app; ship one installer per platform. (2) **Tauri:** Rust core + web frontend; single binary + system WebView. Both satisfy “no user-installed runtime” and “single packaged executable”.
- **Recommendation:** Choose one stack (e.g. Tauri for smaller binary, or Electron for maximum UI parity with web). All logic (API client, config, cancellation) lives in the app; no separate Python/Node process required by the user.

### 7.2 Google APIs
- **Auth:** API key only (no OAuth). Send as query param or header per Google API docs.
- **Image analysis / ideas:** Gemini API (e.g. `gemini-1.5-flash` or Vision) with image + structured output for 10 ideas.
- **Video:** Use the official Google video-generation API (documented as Nano Banana or actual name); one request per idea; response = video file or URL to download; save to disk in the chosen folder.

### 7.3 Parallel Video Generation
- Trigger one async request per selected idea; cap concurrency if needed (e.g. 3–5 in parallel) to avoid rate limits. Update progress per request (start → progress if API supports it → done/error). Cancel = abort all pending and in-flight requests.

### 7.4 File Naming
- Example: `ad_1.mp4`, `ad_2.mp4`, … by selection order. If file exists, use `ad_1_1.mp4` or similar to avoid overwrite; document rule in code.

---

## 8. User Stories and Acceptance Criteria (Summary)

| ID | Story | Acceptance |
|----|-------|------------|
| US-1 | Generate ideas from image | Valid image + API key → “Generate Ideas” → exactly 10 ideas shown; read-only, not editable. |
| US-2 | Generate videos from selected ideas | ≥1 idea selected → “Generate Videos” → one video per idea, parallel, progress per video. |
| US-3 | Cancel generation | During idea or video generation → “Cancel” → all active generations stop safely; no corrupt files. |

---

## 9. Success Criteria Checklist

- [ ] Runs on macOS and Windows as a single executable (or app bundle).
- [ ] No runtime installation required by the user (everything bundled).
- [ ] Non-technical user can complete: paste API key → upload image → pick idea(s) → get video(s).
- [ ] Videos produced using Google APIs only (Nano Banana / official video API).
- [ ] No prompt editing or technical setup beyond API key.
- [ ] Config stored locally; cancellation and errors behave as specified; no in-app video preview, only “Open Folder”.

---

## 10. Clarifications for Implementers

- **Google video API name:** If “Nano Banana” / “Nano Banana Pro” is a placeholder, substitute the real Google video API and its request/response schema; the flow (one request per idea, parallel, save to disk) stays the same.
- **API key validation:** Spec allows a single lightweight Google call on Save to verify the key; optional but recommended for better UX.
- **Config path:** Use `~` / `%USERPROFILE%` and ensure `.adgen` directory is created if missing.

This document is self-contained and implementation-ready for a small dev team or an AI coding agent.
