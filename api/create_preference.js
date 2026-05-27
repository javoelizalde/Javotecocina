// api/create_preference.js
// Función serverless para Mercado Pago Checkout Pro
// Se despliega automáticamente en Vercel como /api/create_preference
//
// REQUISITO: En Vercel → Settings → Environment Variables:
//   MP_ACCESS_TOKEN = APP_USR-tu_token_real_de_produccion

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, price, quantity = 1, buyer_email, buyer_name } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Faltan datos del producto' });

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });

  try {
    const preference = {
      items: [{ title, unit_price: Number(price), quantity: Number(quantity), currency_id: 'ARS' }],
      payer: { email: buyer_email || '', name: buyer_name || '' },
      back_urls: {
        success: 'https://javotecocina.com?pago=exitoso',
        failure: 'https://javotecocina.com?pago=fallido',
        pending: 'https://javotecocina.com?pago=pendiente'
      },
      auto_return: 'approved',
      statement_descriptor: 'JAVOTECOCINA',
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });

    const data = await response.json();
    if (!data.id) return res.status(500).json({ error: 'Error MP', detail: data });

    const isSandbox = accessToken.startsWith('TEST-');
    return res.status(200).json({
      preference_id: data.id,
      init_point: isSandbox ? data.sandbox_init_point : data.init_point
    });
  } catch (error) {
    console.error('Error MP:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}
