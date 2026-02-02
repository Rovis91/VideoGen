const kie = require('./lib/kie');

const POLL_INTERVAL_MS = 30000;
const DEFAULT_MODEL = 'veo3';
const VEO_MODELS = {
  veo3: 'Veo 3.1 Quality',
  veo3_fast: 'Veo 3.1 Fast',
};

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
  const fullText = systemPrompt + '\n\n' + userPrompt;
  const messages = [{ role: 'user', content: fullText }];
  const content = await kie.chatCompletion(apiKey, messages, { stream: false });
  if (!content || !content.trim()) throw new Error('No video prompt from idea step.');
  return content.trim();
}

async function generateOneVideo({ apiKey, imageBase64, mimeType, videoPrompt, ideaConcept, index, durationSeconds, veoModel }) {
  const optimizedPrompt = await ideaToVideoPrompt({
    apiKey,
    ideaConcept: ideaConcept || 'Short promotional video for the product.',
    durationSeconds: durationSeconds ?? 8,
    systemPromptOverride: (videoPrompt || '').trim() || undefined,
  });

  const imageUrl = await kie.uploadImage(apiKey, imageBase64, mimeType, `product-${Date.now()}.jpg`);

  const prompt = [
    'The attached image is the product image (image produit).',
    'Always refer to this input image as the product image.',
    '',
    optimizedPrompt,
  ].join('\n');

  const model = (veoModel && VEO_MODELS[veoModel]) ? veoModel : DEFAULT_MODEL;
  const taskId = await kie.veoGenerate(apiKey, {
    prompt,
    imageUrls: [imageUrl],
    model,
    aspect_ratio: '16:9',
    generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
  });

  let data;
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    data = await kie.veoRecordInfo(apiKey, taskId);
    if (data.successFlag === 1) break;
    if (data.successFlag === 2 || data.successFlag === 3) {
      throw new Error(data.failMsg || data.msg || 'Video generation failed.');
    }
  }

  const resultUrls = data.resultUrls;
  if (!resultUrls) throw new Error('Aucune vidéo dans la réponse.');
  const urls = typeof resultUrls === 'string' ? JSON.parse(resultUrls) : resultUrls;
  const videoUrl = Array.isArray(urls) ? urls[0] : urls;
  if (!videoUrl) throw new Error('No video URL in result.');

  let downloadUrl = videoUrl;
  try {
    downloadUrl = await kie.getDownloadUrl(apiKey, videoUrl);
  } catch (_) {}

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const fileName = `ad_${(index ?? 0) + 1}.mp4`;
  return { ok: true, buffer, filename: fileName };
}

module.exports = { generateOneVideo, VEO_MODELS, DEFAULT_MODEL };
