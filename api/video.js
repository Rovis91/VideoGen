const { startVideoJob, getVideoJobStatus, MODEL_INPUTS } = require('../video');

function getApiKey(req, fromBody = false) {
  const envKey = process.env.KIE_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  if (fromBody && req.body) {
    const key = (req.body.apiKey || '').trim();
    if (key) return key;
  }
  const q = req.query || {};
  const key = (q.apiKey || '').trim();
  if (key) return key;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'No API key. Send apiKey in query.' });
    }
    const { taskId, provider } = req.query || {};
    if (!taskId || !provider) {
      return res.status(400).json({ error: 'Missing taskId and provider in query.' });
    }
    if (provider !== 'veo' && provider !== 'jobs') {
      return res.status(400).json({ error: 'provider must be "veo" or "jobs".' });
    }
    try {
      const result = await getVideoJobStatus(apiKey, taskId, provider);
      return res.status(200).json(result);
    } catch (e) {
      const message = e.message || 'Status check failed.';
      return res.status(500).json({ error: message });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = getApiKey(req, true);
  if (!apiKey) {
    return res.status(400).json({ error: 'No API key. Set KIE_API_KEY or send apiKey in body.' });
  }

  try {
    const body = req.body || {};
    const { imageBase64, mimeType, imageBase64List, imageMimeTypes, videoBase64, videoMimeType, videoPrompt, ideaConcept, durationSeconds, index, veoModel } = body;
    const model = (veoModel && MODEL_INPUTS[veoModel]) ? veoModel : 'veo3';
    const inputs = MODEL_INPUTS[model] || MODEL_INPUTS.veo3;

    const imageCount = Array.isArray(imageBase64List) && imageBase64List.length > 0 ? imageBase64List.length : (imageBase64 ? 1 : 0);
    if (inputs.imageMin > 0 && imageCount === 0) {
      return res.status(400).json({ error: 'This model requires at least one image. Send imageBase64 or imageBase64List.' });
    }
    if (inputs.imageMax > 0 && imageCount > inputs.imageMax) {
      return res.status(400).json({ error: `This model accepts at most ${inputs.imageMax} image(s).` });
    }
    if (inputs.videoMin > 0 && !videoBase64) {
      return res.status(400).json({ error: 'This model requires a reference video. Send videoBase64.' });
    }
    if (!ideaConcept && ideaConcept !== '') {
      return res.status(400).json({ error: 'Missing ideaConcept in body.' });
    }

    const result = await startVideoJob({
      apiKey,
      imageBase64: imageBase64 || undefined,
      mimeType: mimeType || 'image/jpeg',
      imageBase64List: Array.isArray(imageBase64List) && imageBase64List.length > 0 ? imageBase64List : undefined,
      imageMimeTypes: Array.isArray(imageMimeTypes) ? imageMimeTypes : undefined,
      videoBase64: videoBase64 || undefined,
      videoMimeType: videoMimeType || undefined,
      videoPrompt: videoPrompt || '',
      ideaConcept: ideaConcept || '',
      index: index ?? 0,
      durationSeconds: durationSeconds ?? 8,
      veoModel: veoModel || undefined,
    });

    return res.status(200).json({ taskId: result.taskId, provider: result.provider });
  } catch (e) {
    const message = e.message || 'Failed to start video job.';
    const status = message.includes('API key') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
};
