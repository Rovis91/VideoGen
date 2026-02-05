const CONFIG_KEY = 'adgen_config';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Keep ideas request body under Vercel 4.5 MB limit (base64 ~1.37× file size + JSON). */
export const IDEAS_MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'];

let ideasAbortController = null;

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveConfig(data) {
  const current = getConfig();
  const next = { ...current, ...data };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return Promise.resolve();
}

export function openImageFile(multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      document.body.removeChild(input);
      resolve(multiple ? files : (files[0] || null));
    };
    document.body.appendChild(input);
    input.click();
  });
}

export function openVideoFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,.mp4,.mov';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      resolve(file || null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export function openOutputFolder() {
  return Promise.resolve(null);
}

export function validateImage(file) {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: 'Not a file.' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Unsupported format. Use JPEG, PNG, or WebP.' };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: 'File too large (max 10 MB).' };
  }
  return { ok: true };
}

export function validateVideo(file) {
  if (!file || !(file instanceof File)) {
    return { ok: false, error: 'Not a file.' };
  }
  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !file.name?.match(/\.(mp4|mov|mkv)$/i)) {
    return { ok: false, error: 'Use MP4, MOV or MKV (max 100 MB).' };
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return { ok: false, error: 'File too large (max 100 MB).' };
  }
  return { ok: true };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function generateIdeas(opts) {
  ideasAbortController = new AbortController();
  const { imageBase64, mimeType, optionalText, durationSeconds, ideaPrompt, apiKey } = opts;
  const body = {
    imageBase64,
    mimeType: mimeType || 'image/jpeg',
    optionalText: optionalText || '',
    durationSeconds: durationSeconds ?? 10,
    ideaPrompt: ideaPrompt || undefined,
    apiKey: apiKey || undefined,
  };
  const res = await fetch(`${getBaseUrl()}/api/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ideasAbortController.signal,
  });
  ideasAbortController = null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    let msg = data?.error || `API error ${res.status}`;
    if (res.status === 404) msg = 'API non disponible en local. Lancez "vercel dev" pour tester.';
    if (res.status === 413) msg = 'Image or data too large (host limit 4.5 MB). Use an image under 3 MB or shorten the custom prompt.';
    throw new Error(msg);
  }
  const data = await res.json();
  return data.ideas;
}

export function cancelGenerateIdeas() {
  if (ideasAbortController) {
    ideasAbortController.abort();
    ideasAbortController = null;
  }
}

export function openFolder() {
  // No-op in web; use per-video download links instead.
}

const POLL_INTERVAL_MS = 15000;
const POLL_MAX_ATTEMPTS = 60;

function apiError(res, data) {
  const msg = res.status === 404
    ? 'API non disponible en local. Lancez "vercel dev" pour tester.'
    : (data?.error || `API error ${res.status}`);
  return new Error(msg);
}

export async function generateVideo(opts) {
  const { imageBase64, mimeType, imageBase64List, imageMimeTypes, videoBase64, videoMimeType, videoPrompt, ideaConcept, durationSeconds, index, apiKey, veoModel } = opts;
  const baseUrl = getBaseUrl();
  const key = (apiKey || '').trim();

  const body = {
    imageBase64: imageBase64 || undefined,
    mimeType: mimeType || 'image/jpeg',
    imageBase64List: imageBase64List?.length ? imageBase64List : undefined,
    imageMimeTypes: imageMimeTypes?.length ? imageMimeTypes : undefined,
    videoBase64: videoBase64 || undefined,
    videoMimeType: videoMimeType || undefined,
    videoPrompt: videoPrompt || '',
    ideaConcept: ideaConcept || '',
    durationSeconds: durationSeconds ?? 8,
    index: index ?? 0,
    apiKey: key || undefined,
    veoModel: veoModel || undefined,
  };

  const startRes = await fetch(`${baseUrl}/api/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!startRes.ok) {
    const data = await startRes.json().catch(() => ({}));
    throw apiError(startRes, data);
  }
  const { taskId, provider } = await startRes.json();
  if (!taskId || !provider) {
    throw new Error('Invalid start response: missing taskId or provider.');
  }

  const params = new URLSearchParams({ taskId, provider });
  if (key) params.set('apiKey', key);

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    const statusRes = await fetch(`${baseUrl}/api/video?${params.toString()}`);
    if (!statusRes.ok) {
      const data = await statusRes.json().catch(() => ({}));
      throw apiError(statusRes, data);
    }
    const statusData = await statusRes.json();
    if (statusData.status === 'success') {
      const downloadParams = new URLSearchParams({ taskId, provider, index: String(index ?? 0) });
      if (key) downloadParams.set('apiKey', key);
      const downloadRes = await fetch(`${baseUrl}/api/video/download?${downloadParams.toString()}`);
      if (!downloadRes.ok) {
        const data = await downloadRes.json().catch(() => ({}));
        throw apiError(downloadRes, data);
      }
      const blob = await downloadRes.blob();
      const disposition = downloadRes.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `ad_${(index ?? 0) + 1}.mp4`;
      const url = URL.createObjectURL(blob);
      return { ok: true, url, filename };
    }
    if (statusData.status === 'fail') {
      throw new Error(statusData.error || 'Video generation failed.');
    }
  }

  throw new Error('Video generation timed out. Try again later.');
}

export async function testApiKey(apiKey) {
  const res = await fetch(`${getBaseUrl()}/api/test-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: (apiKey || '').trim() }),
  });
  if (res.status === 404) {
    return {
      ok: false,
      error: 'API non disponible en local. Lancez "vercel dev" (au lieu de "npm run dev") pour tester la clé.',
    };
  }
  const data = await res.json().catch(() => ({ ok: false, error: 'Erreur réseau.' }));
  return data;
}

export { fileToBase64 };
