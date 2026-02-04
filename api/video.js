const { generateOneVideo, MODEL_INPUTS } = require('../video');

function getApiKey(req) {
  const envKey = process.env.KIE_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  const body = req.body || {};
  const key = (body.apiKey || '').trim();
  if (key) return key;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = getApiKey(req);
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

    const result = await generateOneVideo({
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

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.buffer);
  } catch (e) {
    const message = e.message || 'Failed to generate video.';
    const status = message.includes('API key') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
};
