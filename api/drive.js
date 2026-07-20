export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Validate session header for write operations
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Session token required for Drive operations.' });
  }

  const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!GOOGLE_APPS_SCRIPT_URL) {
    return res.status(500).json({ success: false, message: 'Server configuration error: Google Apps Script URL missing.' });
  }

  try {
    const payload = req.body || {};

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    return res.status(200).json(responseData);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
