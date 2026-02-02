const kie = require('../lib/kie');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const key = (body.apiKey || '').trim();
  if (!key) {
    return res.status(200).json({ ok: false, error: 'Clé vide.' });
  }

  try {
    await kie.getCredit(key);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e.message || 'Clé API invalide.',
    });
  }
};
