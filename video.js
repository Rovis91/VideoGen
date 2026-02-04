const kie = require('./lib/kie');

const POLL_INTERVAL_MS = 30000;
const JOBS_POLL_INTERVAL_MS = 15000;
const DEFAULT_MODEL = 'veo3';

const VIDEO_MODELS = {
  veo3: 'Veo 3.1 Quality',
  veo3_fast: 'Veo 3.1 Fast',
  'sora-2-pro-image-to-video': 'Sora 2 Pro (Image)',
  'sora-2-pro-text-to-video': 'Sora 2 Pro (Text)',
  'kling-2.6/image-to-video': 'Kling 2.6 (Image)',
  'kling-2.6/motion-control': 'Kling 2.6 Motion Control',
};

/**
 * Spécification des entrées par modèle (doc KIE).
 * Tableau: modèle | images (min–max) | vidéos (min–max) | types / contraintes
 * -------------------------------------------------------------------------------
 * Veo 3.1 (veo3, veo3_fast) | 0–2 | 0 | imageUrls: 1 = frame unique, 2 = 1ère+dernière frame.
 *   REFERENCE_2_VIDEO (veo3_fast): 1–3 images. Texte seul = 0 image.
 * Sora 2 Pro (Image)              | 1–1 | 0 | image_urls requis, 1 image (first frame). JPEG/PNG/WEBP, 10 MB.
 * Sora 2 Pro (Text)               | 0–0 | 0 | Prompt uniquement.
 * Kling 2.6 (Image)              | 1–1 | 0 | image_urls requis, 1 image. JPEG/PNG/WEBP, 10 MB.
 * Kling 2.6 Motion Control       | 1–1 | 1–1 | input_urls: 1 image. video_urls: 1 vidéo (3–30 s, 100 MB). MP4/MOV/MKV.
 */
const MODEL_INPUTS = {
  veo3: { image: true, video: false, imageMin: 1, imageMax: 2, videoMin: 0, videoMax: 0 },
  veo3_fast: { image: true, video: false, imageMin: 1, imageMax: 2, videoMin: 0, videoMax: 0 },
  'sora-2-pro-image-to-video': { image: true, video: false, imageMin: 1, imageMax: 1, videoMin: 0, videoMax: 0 },
  'sora-2-pro-text-to-video': { image: false, video: false, imageMin: 0, imageMax: 0, videoMin: 0, videoMax: 0 },
  'kling-2.6/image-to-video': { image: true, video: false, imageMin: 1, imageMax: 1, videoMin: 0, videoMax: 0 },
  'kling-2.6/motion-control': { image: true, video: true, imageMin: 1, imageMax: 1, videoMin: 1, videoMax: 1 },
};

const VEO_MODEL_IDS = new Set(['veo3', 'veo3_fast']);
function isVeoModel(model) {
  return model && VEO_MODEL_IDS.has(model);
}

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

function parseResultUrls(resultUrls) {
  if (!resultUrls) return null;
  const urls = typeof resultUrls === 'string' ? (() => { try { return JSON.parse(resultUrls); } catch { return resultUrls; } })() : resultUrls;
  const first = Array.isArray(urls) ? urls[0] : urls;
  return first || null;
}

async function runVeoFlow(apiKey, { prompt, imageUrl, model, taskId, index }) {
  let data;
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    data = await kie.veoRecordInfo(apiKey, taskId);
    if (data.successFlag === 1) break;
    if (data.successFlag === 2 || data.successFlag === 3) {
      throw new Error(data.failMsg || data.msg || 'Video generation failed.');
    }
  }
  let videoUrl = parseResultUrls(data.response?.resultUrls ?? data.resultUrls);
  if (!videoUrl) {
    const poll1080IntervalMs = 25000;
    const poll1080MaxAttempts = 12;
    for (let attempt = 0; attempt < poll1080MaxAttempts; attempt++) {
      try {
        videoUrl = await kie.veoGet1080pVideo(apiKey, taskId);
        break;
      } catch (e) {
        if (attempt === poll1080MaxAttempts - 1) throw e;
        await new Promise((r) => setTimeout(r, poll1080IntervalMs));
      }
    }
  }
  if (!videoUrl) throw new Error('Aucune vidéo dans la réponse.');
  return videoUrl;
}

async function runJobsFlow(apiKey, taskId) {
  let data;
  while (true) {
    await new Promise((r) => setTimeout(r, JOBS_POLL_INTERVAL_MS));
    data = await kie.jobsRecordInfo(apiKey, taskId);
    if (data.state === 'success') break;
    if (data.state === 'fail') {
      throw new Error(data.failMsg || data.failCode || 'Video generation failed.');
    }
  }
  const resultJson = data.resultJson;
  if (!resultJson) throw new Error('Aucune vidéo dans la réponse.');
  const parsed = typeof resultJson === 'string' ? (() => { try { return JSON.parse(resultJson); } catch { return null; } })() : resultJson;
  const videoUrl = parseResultUrls(parsed?.resultUrls);
  if (!videoUrl) throw new Error('Aucune vidéo dans la réponse.');
  return videoUrl;
}

const PROVIDER_VEO = 'veo';
const PROVIDER_JOBS = 'jobs';

/**
 * Start a video job only (no waiting). Returns taskId and provider for later status/poll.
 */
async function startVideoJob({ apiKey, imageBase64, mimeType, imageBase64List, imageMimeTypes, videoBase64, videoMimeType, videoPrompt, ideaConcept, index, durationSeconds, veoModel }) {
  const optimizedPrompt = await ideaToVideoPrompt({
    apiKey,
    ideaConcept: ideaConcept || 'Short promotional video for the product.',
    durationSeconds: durationSeconds ?? 8,
    systemPromptOverride: (videoPrompt || '').trim() || undefined,
  });

  const model = (veoModel && VIDEO_MODELS[veoModel]) ? veoModel : DEFAULT_MODEL;
  const inputs = MODEL_INPUTS[model] || MODEL_INPUTS[DEFAULT_MODEL];
  const imageInputs = normalizeImageInputs(imageBase64, mimeType, imageBase64List, imageMimeTypes);

  if (inputs.imageMin > 0 && imageInputs.length < inputs.imageMin) throw new Error(`This model requires at least ${inputs.imageMin} image(s).`);
  if (inputs.imageMax > 0 && imageInputs.length > inputs.imageMax) throw new Error(`This model accepts at most ${inputs.imageMax} image(s).`);

  let taskId;

  if (isVeoModel(model)) {
    if (imageInputs.length === 0) throw new Error('This model requires an image.');
    const imageUrls = await Promise.all(imageInputs.map((img, i) => kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}-${i}.jpg`)));
    const prompt = [
      imageUrls.length === 2 ? 'The two attached images are the first and last frame. Generate a transition between them.' : 'The attached image is the product image (image produit). Always refer to this input image as the product image.',
      '',
      optimizedPrompt,
    ].join('\n');
    taskId = await kie.veoGenerate(apiKey, {
      prompt,
      imageUrls,
      model,
      aspect_ratio: '16:9',
      generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
    });
    return { taskId, provider: PROVIDER_VEO };
  }

  if (model === 'sora-2-pro-image-to-video') {
    if (imageInputs.length === 0) throw new Error('This model requires an image.');
    if (imageInputs.length > 1) throw new Error('This model accepts only one image.');
    const img = imageInputs[0];
    const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}.jpg`);
    taskId = await kie.jobsCreateTask(apiKey, {
      model: 'sora-2-pro-image-to-video',
      input: {
        prompt: optimizedPrompt,
        image_urls: [imageUrl],
        aspect_ratio: 'landscape',
        n_frames: (durationSeconds ?? 8) >= 12 ? '15' : '10',
        size: 'standard',
        remove_watermark: true,
      },
    });
  } else if (model === 'sora-2-pro-text-to-video') {
    taskId = await kie.jobsCreateTask(apiKey, {
      model: 'sora-2-pro-text-to-video',
      input: {
        prompt: optimizedPrompt,
        aspect_ratio: 'landscape',
        n_frames: (durationSeconds ?? 8) >= 12 ? '15' : '10',
        size: 'high',
        remove_watermark: true,
      },
    });
  } else if (model === 'kling-2.6/image-to-video') {
    if (imageInputs.length === 0) throw new Error('This model requires an image.');
    if (imageInputs.length > 1) throw new Error('This model accepts only one image.');
    const img = imageInputs[0];
    const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}.jpg`);
    taskId = await kie.jobsCreateTask(apiKey, {
      model: 'kling-2.6/image-to-video',
      input: {
        prompt: optimizedPrompt,
        image_urls: [imageUrl],
        sound: false,
        duration: (durationSeconds ?? 8) >= 8 ? '10' : '5',
      },
    });
  } else if (model === 'kling-2.6/motion-control') {
    if (imageInputs.length === 0) throw new Error('Motion Control requires an image (reference).');
    if (imageInputs.length > 1) throw new Error('Motion Control accepts only one image.');
    if (!inputs.video || !videoBase64) throw new Error('Motion Control requires a reference video.');
    const img = imageInputs[0];
    const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `ref-${Date.now()}.jpg`);
    const refVideoUrl = await kie.uploadVideo(apiKey, videoBase64, videoMimeType || 'video/mp4', `ref-${Date.now()}.mp4`);
    taskId = await kie.jobsCreateTask(apiKey, {
      model: 'kling-2.6/motion-control',
      input: {
        prompt: optimizedPrompt || 'The character moves naturally.',
        input_urls: [imageUrl],
        video_urls: [refVideoUrl],
        character_orientation: 'video',
        mode: '720p',
      },
    });
  } else {
    throw new Error(`Unknown video model: ${model}`);
  }
  return { taskId, provider: PROVIDER_JOBS };
}

/**
 * Get current job status (one shot, no polling). status: 'pending' | 'success' | 'fail'.
 * When success, videoUrl is set for use by getVideoJobResult.
 */
async function getVideoJobStatus(apiKey, taskId, provider) {
  if (provider === PROVIDER_VEO) {
    const data = await kie.veoRecordInfo(apiKey, taskId);
    if (data.successFlag === 1) {
      let videoUrl = parseResultUrls(data.response?.resultUrls ?? data.resultUrls);
      if (!videoUrl) {
        try {
          videoUrl = await kie.veoGet1080pVideo(apiKey, taskId);
        } catch (_) {}
      }
      return { status: 'success', videoUrl: videoUrl || null };
    }
    if (data.successFlag === 2 || data.successFlag === 3) {
      return { status: 'fail', error: data.failMsg || data.msg || 'Video generation failed.' };
    }
    return { status: 'pending' };
  }
  if (provider === PROVIDER_JOBS) {
    const data = await kie.jobsRecordInfo(apiKey, taskId);
    if (data.state === 'success') {
      const resultJson = data.resultJson;
      const parsed = typeof resultJson === 'string' ? (() => { try { return JSON.parse(resultJson); } catch { return null; } })() : resultJson;
      const videoUrl = parseResultUrls(parsed?.resultUrls);
      return { status: 'success', videoUrl: videoUrl || null };
    }
    if (data.state === 'fail') {
      return { status: 'fail', error: data.failMsg || data.failCode || 'Video generation failed.' };
    }
    return { status: 'pending' };
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Fetch the video buffer once job is success. Uses getVideoJobStatus then download.
 */
async function getVideoJobResult(apiKey, taskId, provider, index = 0) {
  const { status, videoUrl, error } = await getVideoJobStatus(apiKey, taskId, provider);
  if (status === 'fail') throw new Error(error || 'Video generation failed.');
  if (status === 'pending' || !videoUrl) throw new Error('Video not ready yet.');
  let downloadUrl = videoUrl;
  try {
    downloadUrl = await kie.getDownloadUrl(apiKey, videoUrl);
  } catch (_) {}
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = `ad_${index + 1}.mp4`;
  return { buffer, filename: fileName };
}

function normalizeImageInputs(imageBase64, mimeType, imageBase64List, imageMimeTypes) {
  if (Array.isArray(imageBase64List) && imageBase64List.length > 0) {
    const types = Array.isArray(imageMimeTypes) ? imageMimeTypes : [];
    return imageBase64List.map((base64, i) => ({ base64, mimeType: types[i] || 'image/jpeg' }));
  }
  if (imageBase64) {
    return [{ base64: imageBase64, mimeType: mimeType || 'image/jpeg' }];
  }
  return [];
}

async function generateOneVideo({ apiKey, imageBase64, mimeType, imageBase64List, imageMimeTypes, videoBase64, videoMimeType, videoPrompt, ideaConcept, index, durationSeconds, veoModel }) {
  const optimizedPrompt = await ideaToVideoPrompt({
    apiKey,
    ideaConcept: ideaConcept || 'Short promotional video for the product.',
    durationSeconds: durationSeconds ?? 8,
    systemPromptOverride: (videoPrompt || '').trim() || undefined,
  });

  const model = (veoModel && VIDEO_MODELS[veoModel]) ? veoModel : DEFAULT_MODEL;
  const inputs = MODEL_INPUTS[model] || MODEL_INPUTS[DEFAULT_MODEL];
  const imageInputs = normalizeImageInputs(imageBase64, mimeType, imageBase64List, imageMimeTypes);

  if (inputs.imageMin > 0 && imageInputs.length < inputs.imageMin) throw new Error(`This model requires at least ${inputs.imageMin} image(s).`);
  if (inputs.imageMax > 0 && imageInputs.length > inputs.imageMax) throw new Error(`This model accepts at most ${inputs.imageMax} image(s).`);

  let taskId;
  let videoUrl;

  if (isVeoModel(model)) {
    if (imageInputs.length === 0) throw new Error('This model requires an image.');
    const imageUrls = await Promise.all(imageInputs.map((img, i) => kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}-${i}.jpg`)));
    const prompt = [
      imageUrls.length === 2 ? 'The two attached images are the first and last frame. Generate a transition between them.' : 'The attached image is the product image (image produit). Always refer to this input image as the product image.',
      '',
      optimizedPrompt,
    ].join('\n');
    taskId = await kie.veoGenerate(apiKey, {
      prompt,
      imageUrls,
      model,
      aspect_ratio: '16:9',
      generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
    });
    videoUrl = await runVeoFlow(apiKey, { prompt, imageUrl: imageUrls[0], model, taskId, index });
  } else {
    if (model === 'sora-2-pro-image-to-video') {
      if (imageInputs.length === 0) throw new Error('This model requires an image.');
      if (imageInputs.length > 1) throw new Error('This model accepts only one image.');
      const img = imageInputs[0];
      const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}.jpg`);
      taskId = await kie.jobsCreateTask(apiKey, {
        model: 'sora-2-pro-image-to-video',
        input: {
          prompt: optimizedPrompt,
          image_urls: [imageUrl],
          aspect_ratio: 'landscape',
          n_frames: (durationSeconds ?? 8) >= 12 ? '15' : '10',
          size: 'standard',
          remove_watermark: true,
        },
      });
    } else if (model === 'sora-2-pro-text-to-video') {
      taskId = await kie.jobsCreateTask(apiKey, {
        model: 'sora-2-pro-text-to-video',
        input: {
          prompt: optimizedPrompt,
          aspect_ratio: 'landscape',
          n_frames: (durationSeconds ?? 8) >= 12 ? '15' : '10',
          size: 'high',
          remove_watermark: true,
        },
      });
    } else if (model === 'kling-2.6/image-to-video') {
      if (imageInputs.length === 0) throw new Error('This model requires an image.');
      if (imageInputs.length > 1) throw new Error('This model accepts only one image.');
      const img = imageInputs[0];
      const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `product-${Date.now()}.jpg`);
      taskId = await kie.jobsCreateTask(apiKey, {
        model: 'kling-2.6/image-to-video',
        input: {
          prompt: optimizedPrompt,
          image_urls: [imageUrl],
          sound: false,
          duration: (durationSeconds ?? 8) >= 8 ? '10' : '5',
        },
      });
    } else if (model === 'kling-2.6/motion-control') {
      if (imageInputs.length === 0) throw new Error('Motion Control requires an image (reference).');
      if (imageInputs.length > 1) throw new Error('Motion Control accepts only one image.');
      if (!inputs.video || !videoBase64) throw new Error('Motion Control requires a reference video.');
      const img = imageInputs[0];
      const imageUrl = await kie.uploadImage(apiKey, img.base64, img.mimeType, `ref-${Date.now()}.jpg`);
      const refVideoUrl = await kie.uploadVideo(apiKey, videoBase64, videoMimeType || 'video/mp4', `ref-${Date.now()}.mp4`);
      taskId = await kie.jobsCreateTask(apiKey, {
        model: 'kling-2.6/motion-control',
        input: {
          prompt: optimizedPrompt || 'The character moves naturally.',
          input_urls: [imageUrl],
          video_urls: [refVideoUrl],
          character_orientation: 'video',
          mode: '720p',
        },
      });
    } else {
      throw new Error(`Unknown video model: ${model}`);
    }
    videoUrl = await runJobsFlow(apiKey, taskId);
  }

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

module.exports = {
  generateOneVideo,
  startVideoJob,
  getVideoJobStatus,
  getVideoJobResult,
  VIDEO_MODELS,
  MODEL_INPUTS,
  VEO_MODEL_IDS,
  DEFAULT_MODEL,
  PROVIDER_VEO,
  PROVIDER_JOBS,
};
