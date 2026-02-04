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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid API key.' : err || `Chat API error ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (content == null) throw new Error('No content in chat response.');
  return content;
}

async function getCredit(apiKey) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/chat/credit`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${(apiKey || '').trim()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(res.status === 401 ? 'Invalid API key.' : (err.msg || err.message) || `Credit check failed ${res.status}`);
  }
  const data = await res.json();
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

async function jobsRecordInfo(apiKey, taskId) {
  const res = await fetch(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
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
