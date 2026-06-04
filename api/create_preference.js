// api/create_preference.js
// Crea preferencia de pago en Mercado Pago Checkout Pro.
//
// external_reference usa el formato: "recetarioId:::emailRegistrado:::userId"
// Esto permite que el webhook identifique al comprador por userId,
// independientemente del email que use en MercadoPago.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, price, quantity = 1, buyer_email, buyer_name, recetario, user_id } = req.body || {};
  if (!title || !price) return res.status(400).json({ error: 'Faltan datos del producto' });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });

  try {
    const emailNorm = (buyer_email || '').toLowerCase().trim();
    const recId = recetario || '';
    const userId = user_id || '';

    // external_reference codifica los 3 datos que el webhook necesita:
    // [0] recetario slug/id
    // [1] email registrado en Javotecocina (no el email de MercadoPago)
    // [2] userId de Supabase Auth (identificador principal)
    //
    // Si userId está presente, el webhook lo usa como fuente de verdad.
    // Si no está, cae a email como fallback.
    const externalRef = `${recId}:::${emailNorm}:::${userId}`;

    const preference = {
      items: [{
        title,
        unit_price: Number(price),
        quantity: Number(quantity),
        currency_id: 'ARS'
      }],
      payer: {
        email: emailNorm || undefined,
        name: buyer_name || undefined
      },
      back_urls: {
        success: 'https://javotecocina.com/compra-exitosa',
        failure: 'https://javotecocina.com/compra-fallida',
        pending: 'https://javotecocina.com/compra-pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://javotecocina.com/api/record_purchase',
      statement_descriptor: 'JAVOTECOCINA',
      external_reference: externalRef,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    if (!data.id) {
      console.error('MP preference error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Error MP', detail: data });
    }

    const isSandbox = accessToken.startsWith('TEST-');
    return res.status(200).json({
      preference_id: data.id,
      init_point: isSandbox ? data.sandbox_init_point : data.init_point
    });
  } catch (error) {
    console.error('create_preference error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
