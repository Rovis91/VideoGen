const { generateIdeas } = require('../ideas');

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
    const { imageBase64, mimeType, optionalText, durationSeconds, ideaPrompt } = body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in body.' });
    }

    const ideas = await generateIdeas({
      apiKey,
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      optionalText: optionalText || '',
      durationSeconds: durationSeconds ?? 10,
      ideaPrompt: ideaPrompt || undefined,
      signal: req.signal,
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ ideas });
  } catch (e) {
    const message = e.message || 'Failed to generate ideas.';
    const status = message.includes('API key') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
};
