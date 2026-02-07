const KIE_FILE_BASE = 'https://kieai.redpandaai.co';
const KIE_API_BASE = 'https://api.kie.ai';
const GEMINI_CHAT_URL = `${KIE_API_BASE}/gemini-2.5-flash/v1/chat/completions`;

function authHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${(apiKey || '').trim()}`,
    'Content-Type': 'application/json',
  };
}

async function uploadImage(apiKey, base64, mimeType, fileName) {
  const ext = (mimeType || '').includes('png') ? 'png' : (mimeType || '').includes('webp') ? 'webp' : 'jpg';
  const name = fileName || `image-${Date.now()}.${ext}`;
  const base64Data = base64.includes('base64,') ? base64 : `data:${mimeType || 'image/jpeg'};base64,${base64}`;
  const res = await fetch(`${KIE_FILE_BASE}/api/file-base64-upload`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      base64Data,
      uploadPath: 'images',
      fileName: name,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid API key.' : err || `Upload failed ${res.status}`);
  }
  const data = await res.json();
  const url = data?.data?.fileUrl || data?.data?.downloadUrl;
  if (!url) throw new Error('No file URL in upload response.');
  return url;
}

async function uploadVideo(apiKey, base64, mimeType, fileName) {
  const ext = (mimeType || '').includes('quicktime') || (mimeType || '').includes('mov') ? 'mov' : 'mp4';
  const name = fileName || `video-${Date.now()}.${ext}`;
  const base64Data = base64.includes('base64,') ? base64 : `data:${mimeType || 'video/mp4'};base64,${base64}`;
  const res = await fetch(`${KIE_FILE_BASE}/api/file-base64-upload`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      base64Data,
      uploadPath: 'videos',
      fileName: name,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid API key.' : err || `Upload failed ${res.status}`);
  }
  const data = await res.json();
  const url = data?.data?.fileUrl || data?.data?.downloadUrl;
  if (!url) throw new Error('No file URL in upload response.');
  return url;
}

/**
 * Gemini 2.5 Flash chat (Kie.ai).
 * Success: OpenAI-style { choices: [{ message: { content } }] }.
 * Errors: Kie-style { code, msg } or HTTP error. We normalize and throw with a clear message.
 */
async function chatCompletion(apiKey, messages, options = {}, signal) {
  const body = {
    messages,
    stream: options.stream ?? false,
    include_thoughts: false,
  };
  if (options.response_format) body.response_format = options.response_format;
  const res = await fetch(GEMINI_CHAT_URL, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    throw new Error(res.ok ? 'Invalid JSON in chat response.' : (raw || `Chat API error ${res.status}`));
  }

  // Kie-style wrapper: { code, msg } with no choices (error or empty)
  if (data && typeof data.code === 'number' && data.code !== 200) {
    const msg = data.msg ?? data.message ?? 'Chat API error.';
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }
  if (data && typeof data.code === 'number' && !data.choices) {
    throw new Error((data.msg ?? data.message) || 'Chat returned no content. Try again or use a different prompt.');
  }
  if (!res.ok) {
    const msg = data?.msg ?? data?.message ?? (raw || `Chat API error ${res.status}`);
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }

  const choice = data?.choices?.[0];
  const msg = choice?.message;
  let content = msg?.content;
  if (content == null && Array.isArray(msg?.parts)) {
    const textPart = msg.parts.find(p => p?.text != null);
    if (textPart) content = textPart.text;
    else if (msg.parts[0]?.text != null) content = msg.parts[0].text;
  }
  if (content == null && msg?.parts?.[0]) {
    content = msg.parts[0].text;
  }
  if (content == null && typeof msg === 'string') {
    content = msg;
  }
  if (content != null && typeof content !== 'string') {
    content = typeof content.text === 'string' ? content.text : String(content);
  }
  if (content == null || content === '') {
    const hint = data?.error?.message ?? data?.message ??
      (Array.isArray(data?.choices) && data?.choices.length === 0 ? 'Empty choices (possible filter or quota).' : null) ??
      (choice && !msg ? 'Choice has no message.' : null);
    throw new Error(hint || 'No content in chat response. Try again or use a different prompt.');
  }
  return content;
}

/** Credits: GET /api/v1/chat/credit (Kie Common API). Response: { code, msg, data } where data = remaining credits. */
async function getCredit(apiKey) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/chat/credit`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${(apiKey || '').trim()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && typeof data.code === 'number' && data.code !== 200)) {
    const msg = data?.msg ?? data?.message ?? `Credit check failed ${res.status}`;
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }
  return data?.data;
}

async function getDownloadUrl(apiKey, fileUrl) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/common/download-url`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ url: fileUrl }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Download URL failed ${res.status}`);
  }
  const data = await res.json();
  return data?.data;
}

async function veoGenerate(apiKey, payload) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/veo/generate`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 200) {
    const msg = data?.msg || (await res.text()) || `Veo generate failed ${res.status}`;
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }
  const taskId = data?.data?.taskId;
  if (!taskId) throw new Error('No taskId in Veo response.');
  return taskId;
}

async function veoRecordInfo(apiKey, taskId) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/veo/record-info?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${(apiKey || '').trim()}` },
  });
  const data = await res.json();
  if (!res.ok || data.code !== 200) {
    const msg = data?.msg || `Record info failed ${res.status}`;
    throw new Error(msg);
  }
  return data?.data;
}

async function veoGet1080pVideo(apiKey, taskId) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/veo/get-1080p-video?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${(apiKey || '').trim()}` },
  });
  const data = await res.json();
  if (!res.ok || data.code !== 200) {
    const msg = data?.msg || `Get 1080P failed ${res.status}`;
    throw new Error(msg);
  }
  const url = data?.data?.resultUrl;
  if (!url) throw new Error('No resultUrl in 1080P response.');
  return url;
}

async function jobsCreateTask(apiKey, { model, input, callBackUrl }) {
  const body = { model, input };
  if (callBackUrl) body.callBackUrl = callBackUrl;
  const res = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.code !== 200) {
    const msg = data?.msg || `Create task failed ${res.status}`;
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }
  const taskId = data?.data?.taskId;
  if (!taskId) throw new Error('No taskId in createTask response.');
  return taskId;
}

/** Market jobs: GET recordInfo?taskId= (docs.kie.ai/market/common/get-task-detail). Response: { code, msg|message, data: { state, resultJson, failMsg } }. */
async function jobsRecordInfo(apiKey, taskId) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${(apiKey || '').trim()}` },
  });
  const data = await res.json();
  if (!res.ok || (data && typeof data.code === 'number' && data.code !== 200)) {
    const msg = data?.msg ?? data?.message ?? `Record info failed ${res.status}`;
    throw new Error(res.status === 401 ? 'Invalid API key.' : msg);
  }
  return data?.data ?? data;
}

module.exports = {
  uploadImage,
  uploadVideo,
  chatCompletion,
  getCredit,
  getDownloadUrl,
  veoGenerate,
  veoRecordInfo,
  veoGet1080pVideo,
  jobsCreateTask,
  jobsRecordInfo,
};
