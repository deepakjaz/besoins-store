import crypto from 'crypto';

// Global Token Validator Helper Function
function isSessionSignatureValid(token) {
  if (!token) return false;
  try {
    const decodedRawString = Buffer.from(token, 'base64').toString('utf8');
    const [payload, incomingHash] = decodedRawString.split('.');
    if (!payload || !incomingHash) return false;

    // Verify cryptographic tamper seals
    const serverSignatureSecret = process.env.JSONBIN_MASTER_KEY || 'besoins_local_fallback_salt';
    const computedCheckHash = crypto.createHmac('sha256', serverSignatureSecret).update(payload).digest('hex');
    if (computedCheckHash !== incomingHash) return false; // Seal broken! Rejection returned.

    // Evaluate explicit time window expiration boundaries
    const [marker, expirationEpochString] = payload.split(':');
    const targetExpirationTime = parseInt(expirationEpochString, 10);
    
    if (Date.now() > targetExpirationTime) {
      return false; // Token expired! Rejection returned.
    }
    return true; // Token completely safe and authorized.
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  const targetJsonBinBoxUrl = 'https://api.jsonbin.io/v3/b/6a5a0fc0f5f4af5e299c00dd';
  const hiddenSecretApiKey = process.env.JSONBIN_MASTER_KEY;

  // READ OPERATIONAL GRID ROUTE (Public View Access Allowed)
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${targetJsonBinBoxUrl}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': hiddenSecretApiKey }
      });
      const data = await response.json();
      const cleanArrayRecordsOutput = data.record.products || data.record || [];
      return res.status(200).json(cleanArrayRecordsOutput);
    } catch (err) {
      return res.status(500).json({ message: 'Error establishing core collection data connections.' });
    }
  }

  // WRITE OPERATIONAL MUTATION ROUTE (Strict Token Validation Applied)
  if (req.method === 'PUT') {
    const clientPassedAuthHeaderToken = req.headers['x-besoins-auth'];

    // Enforce strict token verification checks before pushing data writes to the cloud box
    if (!isSessionSignatureValid(clientPassedAuthHeaderToken)) {
      return res.status(403).json({ 
        message: 'Transaction unauthorized. Session token expired or signature validation tampered.' 
      });
    }

    try {
      const cloudSyncWriteResponse = await fetch(targetJsonBinBoxUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': hiddenSecretApiKey
        },
        body: JSON.stringify({ products: req.body.products })
      });

      if (!cloudSyncWriteResponse.ok) throw new Error();
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ message: 'Cloud database matrix synchronization state error.' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
