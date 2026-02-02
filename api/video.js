const { generateOneVideo } = require('../video');

function getApiKey(req) {
  const envKey = process.env.GOOGLE_API_KEY;
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
    return res.status(400).json({ error: 'No API key. Set GOOGLE_API_KEY or send apiKey in body.' });
  }

  try {
    const body = req.body || {};
    const { imageBase64, mimeType, videoPrompt, ideaConcept, durationSeconds, index, veoModel } = body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in body.' });
    }
    if (!ideaConcept && ideaConcept !== '') {
      return res.status(400).json({ error: 'Missing ideaConcept in body.' });
    }

    const result = await generateOneVideo({
      apiKey,
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
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
