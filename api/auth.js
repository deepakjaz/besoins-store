// In-memory failed attempt tracker for IP rate-limiting
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 15 * 60 * 1000; // 15 minutes lockout

export default async function handler(req, res) {
  // Set CORS headers for security
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Extract client IP address
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();

  // Rate Limiting Check
  const ipData = failedAttempts.get(clientIp) || { count: 0, lockoutUntil: 0 };

  if (ipData.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((ipData.lockoutUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${remainingSeconds} seconds.`
    });
  }

  const { pin } = req.body || {};
  const masterPin = process.env.OWNER_GATEWAY_PIN || '1156';

  if (pin && pin === masterPin) {
    // Reset rate-limiting counter on success
    failedAttempts.delete(clientIp);

    // Generate session token tied to current operational state
    const sessionToken = Buffer.from(`besoins_session_${Date.now()}_${Math.random()}`).toString('base64');

    return res.status(200).json({
      success: true,
      token: sessionToken,
      message: 'Gateway access granted.'
    });
  } else {
    // Increment failed attempts
    ipData.count += 1;
    if (ipData.count >= MAX_FAILED_ATTEMPTS) {
      ipData.lockoutUntil = now + LOCKOUT_PERIOD_MS;
    }
    failedAttempts.set(clientIp, ipData);

    return res.status(401).json({
      success: false,
      message: `Invalid credentials. (${MAX_FAILED_ATTEMPTS - ipData.count} attempts remaining before lockout)`
    });
  }
}
