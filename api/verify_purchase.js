// api/verify_purchase.js
// Verifica si un email tiene acceso a un recetario específico (compra registrada en Supabase)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, recetario } = req.body || {};
  if (!email || !recetario) return res.status(400).json({ error: 'Faltan datos', access: false });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Config error', access: false });

  try {
    const emailNorm = email.toLowerCase().trim();
    const queryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/compras?email=eq.${encodeURIComponent(emailNorm)}&recetario=eq.${encodeURIComponent(recetario)}&select=id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const rows = await queryRes.json();
    const hasAccess = Array.isArray(rows) && rows.length > 0;
    return res.status(200).json({ access: hasAccess });
  } catch (error) {
    console.error('verify_purchase error:', error);
    return res.status(500).json({ error: 'Error interno', access: false });
  }
};
