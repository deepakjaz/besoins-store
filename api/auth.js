import crypto from 'crypto';

// Server-side rolling memory map to track failed login counts by IP
const bruteForceIpTracker = new Map();

export default async function handler(req, res) {
  // CORS block protection checks
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-node';
  const currentTimeStamp = Date.now();
  
  // 1. IP-Based Rate Limiting Gate
  if (bruteForceIpTracker.has(clientIp)) {
    const log = bruteForceIpTracker.get(clientIp);
    // If client failed 5+ times, enforce a hard 15-minute lockout cool-down window
    if (log.count >= 5 && (currentTimeStamp - log.lastAttemptDate) < 15 * 60 * 1000) {
      const remainingTime = Math.ceil((15 * 60 * 1000 - (currentTimeStamp - log.lastAttemptDate)) / 1000);
      return res.status(429).json({ 
        success: false, 
        message: `Too many failed attempts. Brute-force block active. Try again in ${remainingTime} seconds.` 
      });
    }
    // Automatically reset record tracking bounds if the 15-minute window has passed safely
    if ((currentTimeStamp - log.lastAttemptDate) >= 15 * 60 * 1000) {
      bruteForceIpTracker.delete(clientIp);
    }
  }

  const { pin } = req.body;
  
  // 2. Read PIN from Environment Variable (Fallback to emergency seed strictly if unassigned)
  const masterSecretSystemPin = process.env.OWNER_GATEWAY_PIN || '1156';

  if (!pin || pin !== masterSecretSystemPin) {
    // Increment brute force counter logic variables
    const activeLog = bruteForceIpTracker.get(clientIp) || { count: 0 };
    bruteForceIpTracker.set(clientIp, {
      count: activeLog.count + 1,
      lastAttemptDate: currentTimeStamp
    });

    return res.status(401).json({ 
      success: false, 
      message: `Invalid access PIN credential signatures. Attempt ${activeLog.count + 1}/5 before IP lockout.` 
    });
  }

  // 3. Success: Clear tracking logs entirely for this clean IP
  bruteForceIpTracker.delete(clientIp);

  // 4. Generate short-lived secure session token signed with a hidden server secret timestamp key
  const expirationEpochTime = currentTimeStamp + (4 * 60 * 60 * 1000); // Token strictly bounds valid lifecycle limits to 4 Hours
  const rawTokenPayloadString = `besoins_session:${expirationEpochTime}`;
  
  // Create an encrypted token signature so devtools cannot fake or forge timestamps
  const serverSignatureSecret = process.env.JSONBIN_MASTER_KEY || 'besoins_local_fallback_salt';
  const hmacSignatureHash = crypto.createHmac('sha256', serverSignatureSecret).update(rawTokenPayloadString).digest('hex');
  const secureSignedSessionToken = Buffer.from(`${rawTokenPayloadString}.${hmacSignatureHash}`).toString('base64');

  return res.status(200).json({ 
    success: true, 
    token: secureSignedSessionToken 
  });
}
