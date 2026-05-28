// api/record_purchase.js
// Registra una compra de recetario en Supabase tras pago aprobado de MercadoPago
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, recetario, payment_id } = req.body || {};
  if (!email || !recetario) return res.status(400).json({ error: 'Faltan datos' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase no configurado' });

  try {
    // Verificar si ya existe (evitar duplicados por mismo payment_id)
    if (payment_id) {
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/compras?payment_id=eq.${encodeURIComponent(payment_id)}&select=id`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const existing = await checkRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
    }

    // Insertar compra
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/compras`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        recetario,
        payment_id: payment_id || null,
        fecha: new Date().toISOString()
      })
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Supabase insert error:', err);
      return res.status(500).json({ error: 'Error guardando compra' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('record_purchase error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
