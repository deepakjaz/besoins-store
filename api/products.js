export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const JSONBIN_ENDPOINT = 'https://api.jsonbin.io/v3/b/6a5a0fc0f5f4af5e299c00dd';
  const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;

  // GET: Fetch product catalog (Public read allowed for customer catalog)
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${JSONBIN_ENDPOINT}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': MASTER_KEY
        }
      });

      if (!response.ok) throw new Error(`JSONBin error: ${response.statusText}`);

      const data = await response.json();
      const products = data.record.products || data.record || [];

      return res.status(200).json({ products });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT: Save/Update products (Requires session token validation)
  if (req.method === 'PUT') {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Session token required for write actions.' });
    }

    try {
      const { products } = req.body || {};
      if (!Array.isArray(products)) {
        return res.status(400).json({ success: false, message: 'Invalid payload: products array expected.' });
      }

      const response = await fetch(JSONBIN_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': MASTER_KEY
        },
        body: JSON.stringify({ products })
      });

      if (!response.ok) throw new Error(`JSONBin write error: ${response.statusText}`);

      return res.status(200).json({ success: true, message: 'Products synchronized successfully.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
