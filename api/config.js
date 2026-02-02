module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const hasEnvKey = !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim());
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ hasEnvKey });
};
