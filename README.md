# Ad Video Generator (Web)

Generate short ad videos (5–20s) from a single product image using Google AI.  
Deploy as a web app on Vercel.

## Setup

1. **Clone and install:**

```powershell
npm install
```

2. **Run locally:**

```powershell
npm run dev
```

Then open http://localhost:5173. For a production build:

```powershell
npm run build
npm run preview
```

## Deploy on Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. (Optional) Set **Environment variable** `GOOGLE_API_KEY` in the Vercel dashboard. If set, the app uses this key and users do not need to enter one. If not set, users must paste their own Google API key in the Configuration screen.
3. Deploy. The frontend is served from the Vite build; API routes live under `/api` (ideas, video, config, test-key).

**Note:** Video generation can take 1–3+ minutes. On Vercel Pro, `api/video.js` is configured with `maxDuration: 300` (5 minutes). On Hobby plan the function may timeout; use Pro or reduce concurrency.

## First run

1. On **Configuration**: paste your **Google API key** (or rely on the server key if `GOOGLE_API_KEY` is set) and click Save.
2. On **Entrée**: select a **product image** (JPEG/PNG/WebP, max 10 MB), optional text idea, and duration.
3. Click **Générer les idées** → 10 ideas appear. Select one or more → **Générer les vidéos**.
4. When each video is ready, use the **Télécharger** link to save it (no output folder; download per video).

## Config (browser)

Stored in `localStorage` under key `adgen_config`. Contains: `googleApiKey`, `ideaGenerationPrompt`, `videoGenerationPrompt`, `defaultDurationSeconds`. Reset buttons restore the default prompts.

## Spec and TODO

- Product and engineering spec: `docs/AD_VIDEO_GENERATOR_SPEC.md`
- Implementation checklist: `TODO.md`
