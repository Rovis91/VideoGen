# Ad Video Generator (Web)

Generate short ad videos (5–20s) from a single product image using **KIE AI** (ideas: Gemini 2.5 Flash; video: Veo 3.1).  
Deploy as a web app on Vercel.

## Setup

1. **Clone and install:**

```powershell
npm install
```

2. **Run locally:**

- **Frontend seul** (pas d’API) : `npm run dev` → http://localhost:5173
- **Frontend + API** (test de clé, idées, vidéos) : `vercel dev` → l’app et les routes `/api` sont servies localement

Pour tester la clé API ou générer des idées/vidéos en local, utilisez `vercel dev`. Avec `npm run dev`, les routes `/api` n’existent pas → erreur 404.

Pour un build de production :

```powershell
npm run build
npm run preview
```

## Deploy on Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. (Optional) Set **Environment variable** `KIE_API_KEY` in the Vercel dashboard (get your key at [kie.ai/api-key](https://kie.ai/api-key)). If set, the app uses this key and users do not need to enter one. If not set, users must paste their KIE API key in the Configuration screen.
3. Deploy. The frontend is served from the Vite build; API routes live under `/api` (ideas, video, config, test-key).

**Note:** Video generation is async on KIE (2–5+ minutes). On Vercel Pro, `api/video.js` is configured with `maxDuration: 300` (5 minutes). KIE Veo models: **veo3** (Quality) and **veo3_fast** (Fast).

## First run

1. On **Configuration**: paste your **KIE API key** ([kie.ai/api-key](https://kie.ai/api-key)) and click Save.
2. On **Entrée**: select a **product image** (JPEG/PNG/WebP, max 10 MB), optional text idea, duration, and Veo model (Quality / Fast).
3. Click **Générer les idées** → 10 ideas appear (KIE Gemini 2.5 Flash). Select one or more → **Générer les vidéos** (KIE Veo 3.1).
4. When each video is ready, use the **Télécharger** link to save it (no output folder; download per video).

## Config (browser)

Stored in `localStorage` under key `adgen_config`. Contains: `googleApiKey` (used for KIE key), `ideaGenerationPrompt`, `videoGenerationPrompt`, `defaultDurationSeconds`, `veoModel` (veo3 / veo3_fast). Reset buttons restore the default prompts.

## Spec and TODO

- Product and engineering spec: `docs/AD_VIDEO_GENERATOR_SPEC.md`
- Implementation checklist: `TODO.md`
