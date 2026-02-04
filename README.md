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

**Note:** Video generation is async on KIE (2–5+ minutes). On Vercel Pro, `api/video.js` is configured with `maxDuration: 300` (5 minutes).

### Modèles vidéo – entrées requises (doc KIE)

| Modèle | Images (min–max) | Vidéos (min–max) | Types / contraintes |
|--------|------------------|------------------|----------------------|
| **Veo 3.1** (veo3, veo3_fast) | 1–2 | 0 | 1 image = frame unique ; 2 images = 1ère + dernière frame (transition). JPEG/PNG/WEBP, 10 MB. |
| **Sora 2 Pro (Image)** | 1 | 0 | image_urls : 1 image (first frame). JPEG/PNG/WEBP, 10 MB. |
| **Sora 2 Pro (Text)** | 0 | 0 | Prompt uniquement. |
| **Kling 2.6 (Image)** | 1 | 0 | image_urls : 1 image. JPEG/PNG/WEBP, 10 MB. |
| **Kling 2.6 Motion Control** | 1 | 1 | input_urls : 1 image. video_urls : 1 vidéo (3–30 s, 100 MB). MP4/MOV/MKV. |

L’interface vérifie ces exigences : si les fichiers ne correspondent pas au modèle sélectionné, un message d’erreur s’affiche et le bouton « Générer les vidéos » est désactivé.

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
