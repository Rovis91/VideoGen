const CONFIG_KEY = 'adgen_config';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

export function openImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
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
    throw new Error(data.error || `API error ${res.status}`);
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

export async function generateVideo(opts) {
  const { imageBase64, mimeType, videoPrompt, ideaConcept, durationSeconds, index, apiKey } = opts;
  const body = {
    imageBase64,
    mimeType: mimeType || 'image/jpeg',
    videoPrompt: videoPrompt || '',
    ideaConcept: ideaConcept || '',
    durationSeconds: durationSeconds ?? 8,
    index: index ?? 0,
    apiKey: apiKey || undefined,
  };
  const res = await fetch(`${getBaseUrl()}/api/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition && disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `ad_${(opts.index ?? 0) + 1}.mp4`;
  const url = URL.createObjectURL(blob);
  return { ok: true, url, filename };
}

export async function testApiKey(apiKey) {
  const res = await fetch(`${getBaseUrl()}/api/test-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: (apiKey || '').trim() }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Erreur réseau.' }));
  return data;
}

export { fileToBase64 };
