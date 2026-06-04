// api/create_preference.js
// Crea preferencia de pago en Mercado Pago Checkout Pro
//
// REQUISITO: En Vercel → Settings → Environment Variables:
//   MP_ACCESS_TOKEN = APP_USR-tu_token_real_de_produccion

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, price, quantity = 1, buyer_email, buyer_name, recetario } = req.body || {};
  if (!title || !price) return res.status(400).json({ error: 'Faltan datos del producto' });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });

  try {
    const emailNorm = (buyer_email || '').toLowerCase().trim();
    const recSlug = recetario || '';

    // external_reference codifica recetario y email del comprador registrado.
    // Formato: "recetario-slug:::email@dominio.com"
    // El webhook parsea esto para usar el email correcto (no el email de la cuenta MP del pagador).
    const externalRef = `${recSlug}:::${emailNorm}`;

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
