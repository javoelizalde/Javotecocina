// api/record_purchase.js
// Registra una compra de recetario en Supabase.
// Acepta:
//   A) POST directo desde el frontend con { email, recetario, payment_id }
//   B) Notificación IPN de Mercado Pago con { type: 'payment', data: { id: '...' } }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // MP IPN: soporta dos formatos:
  //   Formato viejo: GET ?id=PAYMENT_ID&topic=payment
  //   Formato nuevo: POST { type: 'payment', data: { id: 'PAYMENT_ID' } }
  //                  o GET ?type=payment&id=PAYMENT_ID
  const queryId = req.query?.id || req.query?.['data.id'];
  const queryType = req.query?.type;
  const queryTopic = req.query?.topic;

  // Detectar IPN formato viejo: ?topic=payment&id=X
  if (queryTopic === 'payment' && queryId) {
    return await procesarIPN(req, res, queryId);
  }
  // Detectar IPN formato nuevo: ?type=payment&id=X
  if (queryType === 'payment' && queryId) {
    return await procesarIPN(req, res, queryId);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    // IPN en body
    if (body.type === 'payment' && body.data?.id) {
      return await procesarIPN(req, res, body.data.id);
    }
    // Llamada directa del frontend
    const { email, recetario, payment_id } = body;
    if (!email || !recetario) return res.status(400).json({ error: 'Faltan datos' });
    return await registrarCompra(res, email, recetario, payment_id || null);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function procesarIPN(req, res, paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(200).end(); // siempre 200 a MP

  try {
    // Obtener datos del pago desde MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!mpRes.ok) return res.status(200).end();
    const payment = await mpRes.json();

    if (payment.status !== 'approved') return res.status(200).end();

    const email = payment.payer?.email;
    const recetario = payment.external_reference;
    if (!email || !recetario) return res.status(200).end();

    await registrarCompra(res, email, recetario, String(paymentId));
  } catch (e) {
    console.error('IPN error:', e);
    return res.status(200).end(); // siempre 200 a MP para evitar reintentos infinitos
  }
}

async function registrarCompra(res, email, recetario, payment_id) {

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
