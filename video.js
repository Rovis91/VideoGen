const fs = require('fs');
const path = require('path');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MIME_MAP = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const POLL_INTERVAL_MS = 10000;
const MODEL = 'veo-3.1-generate-preview';

const DEFAULT_VIDEO_PROMPT_SYSTEM = `You are a video director generating a prompt for a short social media video.

Input:
- One ad idea containing: angle, hook, visualAction, outcome
- A product image will be provided separately
- A target video duration (already decided by the user)

Your task:
Write ONE detailed video generation prompt that expands the idea into a short UGC-style video.

Rules:
- The video must be purely visual (no audio, no voice-over, no on-screen text).
- The product must appear clearly and naturally.
- The video should feel like short-form social content (simple, realistic, engaging).
- Use a simple multi-shot structure (2–4 shots maximum).
- Describe only what is visible and happening.
- Do NOT include camera terminology (no lens types, no camera angles).
- Do NOT include tone labels, emotions as abstract words, or brand language.

Structure the prompt clearly using this order:
1. Brief overall description of the video
2. Shot-by-shot visual breakdown (short sentences)
3. How the product is used or highlighted
4. Final visual outcome

The description must be concrete enough that a video model can generate a complete video from it.

Output ONLY the video generation prompt.
No preamble.
No explanations.
No quotes.
`;

async function ideaToVideoPrompt({ apiKey, ideaConcept, durationSeconds, systemPromptOverride }) {
  const idea = (ideaConcept || '').trim() || 'Short promotional video for the product.';
  const userPrompt = `Ad idea: ${idea}\nVideo duration: ${durationSeconds ?? 8} seconds.\nGenerate the video prompt.`;
  const systemPrompt = (systemPromptOverride && systemPromptOverride.trim()) ? systemPromptOverride.trim() : DEFAULT_VIDEO_PROMPT_SYSTEM;
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey.trim())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid API key.' : err || `API error ${res.status}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) throw new Error('No video prompt from idea step.');
  return text.trim();
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'image/jpeg';
}

function durationToVeo(durationSeconds) {
  const n = Number(durationSeconds) || 8;
  if (n <= 4) return 4;
  if (n <= 6) return 6;
  return 8;
}

async function generateOneVideo({ apiKey, imagePath, videoPrompt, ideaConcept, outputFolder, index, durationSeconds }) {
  const optimizedPrompt = await ideaToVideoPrompt({
    apiKey,
    ideaConcept: ideaConcept || 'Short promotional video for the product.',
    durationSeconds: durationSeconds ?? 8,
    systemPromptOverride: (videoPrompt || '').trim() || undefined,
  });

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const imageBytes = fs.readFileSync(imagePath, { encoding: 'base64' });
  const mimeType = getMimeType(imagePath);

  const prompt = [
    'The attached image is the product image (image produit).',
    'Always refer to this input image as the product image.',
    '',
    optimizedPrompt,
  ].join('\n');

  const config = {
    durationSeconds: durationToVeo(durationSeconds ?? 8),
    aspectRatio: '16:9',
  };

  let operation = await ai.models.generateVideos({
    model: MODEL,
    prompt,
    image: { imageBytes, mimeType },
    config,
  });

  while (!operation.done) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (!operation.response?.generatedVideos?.[0]?.video) {
    throw new Error('Aucune vidéo dans la réponse.');
  }

  let fileName = `ad_${index + 1}.mp4`;
  let downloadPath = path.join(outputFolder, fileName);
  let n = 0;
  while (fs.existsSync(downloadPath)) {
    n++;
    fileName = `ad_${index + 1}_${n}.mp4`;
    downloadPath = path.join(outputFolder, fileName);
  }

  await ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath,
  });

  return { ok: true, path: downloadPath };
}

module.exports = { generateOneVideo };
