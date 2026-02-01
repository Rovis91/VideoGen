# Ad Video Generator (Desktop App)

Generate short ad videos (5–20s) from a single product image using Google AI.  
**Platforms:** macOS, Windows.

## Run (development)

- **Requires:** Node.js and npm (for building only; end users do not install these).
- Install and start:

```powershell
cd c:\Users\antoi\Documents\Netechoppe\VideoGen
npm install
npm start
```

## Package (executables for Windows and Mac)

The project uses **Electron Forge** to build installers and portable builds.

1. **Install dependencies** (includes Forge and makers):

```powershell
cd c:\Users\antoi\Documents\Netechoppe\VideoGen
npm install
```

2. **Build executables:**

```powershell
npm run make
```

This runs `vite build` (so the renderer is up to date), then packages the app and runs the makers. Output goes to `out/`:

- **Windows:**  
  - `out/ad-video-generator-win32-x64/` — unpacked app (run `ad-video-generator.exe`).  
  - `out/make/squirrel.windows/x64/` — Squirrel installer (`.exe`).  
  - `out/make/zip/win32/x64/` — portable ZIP.
- **macOS:**  
  - **One-file for users:** `out/make/dmg/` — **.dmg** disk image. User downloads this single file, opens it, then drags “Ad Video Generator” to Applications (or runs it from the DMG).  
  - The app: `out/Ad Video Generator-darwin-arm64/Ad Video Generator.app` (Apple Silicon) or `…-x64/…` (Intel).  
  - Optional: `out/make/zip/darwin/` — ZIP of the .app.

**Getting the macOS build without a Mac:**  
macOS .app and .dmg can only be built on macOS. The repo includes a **GitHub Actions** workflow that builds both Windows and macOS when you push. To get the macOS one-file for users: (1) Push this project to a GitHub repo. (2) Open the repo → **Actions** → workflow **"Build (Windows + macOS)"**. (3) Run it (on push to `main`/`master` it runs automatically; or use **Run workflow**). (4) When it finishes, download the **ad-video-generator-darwin** artifact — it contains `out/make/dmg/` (the .dmg for users) and the .app folder.

**Building locally:** On Windows, `npm run make` produces only Windows executables. On a Mac, `npm run make` produces only the macOS .dmg and .app.

**Why can't I build macOS on Windows?**  
Apple’s toolchain and code signing only run on macOS; there is no supported way to cross-compile a macOS Electron app on Windows. Your options from a Windows PC are: **(1) GitHub Actions** (free for this repo: push to GitHub, run the workflow, download the macOS artifact); **(2) rent a cloud Mac** (e.g. [MacinCloud](https://www.macincloud.com/), [MacStadium](https://www.macstadium.com/)) and run `npm run make` there via RDP/SSH; **(3) use a real Mac** (your own or a friend’s).

End users run the packaged app; they do not need Node.js or any other runtime.

## First run

1. Paste your **Google API key** on the Setup screen and click Save.
2. On Input: select a **product image** (JPEG/PNG/WebP, max 10 MB), optional text idea, duration, and **output folder**.
3. Click **Generate Ideas** → exactly 10 ideas appear (read-only).
4. Select one or more ideas → **Generate Videos** (video generation is placeholder until Nano Banana API is wired).

## Config

Stored at `~/.adgen/config.json` (Windows: `%USERPROFILE%\.adgen\config.json`).  
Contains: `googleApiKey`, `lastOutputFolder`, `defaultDurationSeconds`.

## Spec and TODO

- Product and engineering spec: `docs/AD_VIDEO_GENERATOR_SPEC.md`
- Implementation checklist and log: `TODO.md`
