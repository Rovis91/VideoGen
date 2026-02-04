const { getVideoJobResult } = require('../../video');

function getApiKey(req) {
  const envKey = process.env.KIE_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  const q = req.query || {};
  const key = (q.apiKey || '').trim();
  if (key) return key;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'No API key. Send apiKey in query.' });
  }
  const { taskId, provider, index } = req.query || {};
  if (!taskId || !provider) {
    return res.status(400).json({ error: 'Missing taskId and provider in query.' });
  }
  if (provider !== 'veo' && provider !== 'jobs') {
    return res.status(400).json({ error: 'provider must be "veo" or "jobs".' });
  }

  try {
    const idx = typeof index !== 'undefined' ? parseInt(index, 10) : 0;
    const result = await getVideoJobResult(apiKey, taskId, provider, isNaN(idx) ? 0 : idx);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.buffer);
  } catch (e) {
    const message = e.message || 'Download failed.';
    const status = message.includes('not ready') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
};
