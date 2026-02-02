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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with OK.' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(200).json({
        ok: false,
        error: response.status === 401 ? 'Clé API invalide.' : err || `Erreur ${response.status}`,
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message || 'Erreur réseau.' });
  }
};
