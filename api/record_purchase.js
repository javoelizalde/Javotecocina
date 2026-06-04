// api/record_purchase.js
// Webhook de Mercado Pago + registro manual de compras desde el frontend.
//
// Acepta:
//   A) IPN de MP: POST { type:'payment', data:{id:'...'} }  o  GET ?topic=payment&id=X
//   B) Llamada directa del frontend: POST { email, recetario, payment_id }
//
// VARIABLES DE ENTORNO (Vercel → Settings → Environment Variables):
//   MP_ACCESS_TOKEN   = APP_USR-...
//   SUPABASE_URL      = https://xxxx.supabase.co
//   SUPABASE_ANON_KEY = eyJ...
//   RESEND_API_KEY    = re_... (opcional, para emails)

// Credenciales Supabase con fallback hardcodeado (mismo valor que el frontend).
// Esto garantiza que el webhook funcione aunque las env vars no estén configuradas en Vercel.
const SUPA_URL_FALLBACK = 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

function getSupabase() {
  return {
    url: process.env.SUPABASE_URL || SUPA_URL_FALLBACK,
    key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || SUPA_KEY_FALLBACK
  };
}

// Parsea external_reference que puede tener dos formatos:
//   Formato nuevo: "recetario-slug:::email@dominio.com"
//   Formato viejo: "recetario-slug"  (sin email)
function parseExternalRef(extRef) {
  if (!extRef) return { recetario: null, buyerEmail: null };
  const parts = extRef.split(':::');
  return {
    recetario: parts[0] || null,
    buyerEmail: parts[1] || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const queryId    = req.query?.id || req.query?.['data.id'];
  const queryType  = req.query?.type;
  const queryTopic = req.query?.topic;

  // IPN formato viejo: GET ?topic=payment&id=X
  if (queryTopic === 'payment' && queryId) {
    return procesarIPN(res, queryId);
  }
  // IPN formato nuevo: GET ?type=payment&id=X
  if (queryType === 'payment' && queryId) {
    return procesarIPN(res, queryId);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    // IPN en body: POST { type:'payment', data:{ id:'...' } }
    if (body.type === 'payment' && body.data?.id) {
      return procesarIPN(res, body.data.id);
    }
    // Llamada directa del frontend (backup al webhook)
    const { email, recetario, payment_id } = body;
    if (!email || !recetario) {
      return res.status(400).json({ error: 'Faltan datos: email y recetario son requeridos' });
    }
    return registrarCompra(res, email, recetario, payment_id || null, null, null, 'frontend');
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function procesarIPN(res, paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('IPN: MP_ACCESS_TOKEN no configurado');
    return res.status(200).end(); // siempre 200 a MP
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!mpRes.ok) {
      console.error(`IPN: MP devolvió ${mpRes.status} para payment ${paymentId}`);
      return res.status(200).end();
    }

    const payment = await mpRes.json();
    console.log(`IPN: payment ${paymentId} status=${payment.status} ext_ref=${payment.external_reference}`);

    if (payment.status !== 'approved') {
      return res.status(200).end();
    }

    const { recetario, buyerEmail } = parseExternalRef(payment.external_reference);

    // Usar el email del comprador registrado en Javotecocina (desde external_reference).
    // Si el external_reference es formato viejo (sin email), usar el email del pagador en MP.
    const email = buyerEmail || payment.payer?.email;

    if (!email || !recetario) {
      console.error(`IPN: faltan datos — email=${email} recetario=${recetario}`);
      return res.status(200).end();
    }

    const monto  = payment.transaction_amount || null;
    const moneda = payment.currency_id || 'ARS';

    await registrarCompra(res, email, recetario, String(paymentId), monto, moneda, 'webhook');
  } catch (e) {
    console.error('IPN error:', e.message);
    return res.status(200).end(); // siempre 200 para evitar reintentos infinitos
  }
}

async function registrarCompra(res, email, recetario, payment_id, monto, moneda, origen) {
  const { url: SUPA_URL, key: SUPA_KEY } = getSupabase();
  const emailNorm = email.toLowerCase().trim();

  try {
    // Idempotencia: si ya existe una compra aprobada con este payment_id, no duplicar.
    if (payment_id) {
      const checkRes = await fetch(
        `${SUPA_URL}/rest/v1/compras?payment_id=eq.${encodeURIComponent(payment_id)}&select=id,email_enviado_at`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (Array.isArray(existing) && existing.length > 0) {
          console.log(`Compra duplicada ignorada: payment_id=${payment_id}`);
          // Si la compra existe pero el email no fue enviado aún, intentar enviarlo.
          const row = existing[0];
          if (!row.email_enviado_at) {
            await enviarEmailCompra(SUPA_URL, SUPA_KEY, emailNorm, recetario, payment_id, row.id);
          }
          return res.status(200).json({ ok: true, duplicate: true });
        }
      }
    }

    // Insertar la compra aprobada
    const payload = {
      email: emailNorm,
      recetario,
      payment_id: payment_id || null,
      fecha: new Date().toISOString(),
      estado: 'approved',
      entrega: 'not_delivered',
      monto: monto || null,
      moneda: moneda || 'ARS',
      metadata: { origen: origen || 'unknown' }
    };

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/compras`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      // Conflict por payment_id único → ya estaba insertado, no es error real
      if (insertRes.status === 409) {
        console.log(`Compra ya existía (conflict): payment_id=${payment_id}`);
        return res.status(200).json({ ok: true, duplicate: true });
      }
      console.error('Supabase insert error:', err);
      return res.status(500).json({ error: 'Error guardando compra', detail: err });
    }

    const inserted = await insertRes.json();
    const compraId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

    console.log(`Compra guardada: id=${compraId} email=${emailNorm} recetario=${recetario}`);

    // Actualizar entrega a 'delivered' (el acceso al PDF queda disponible inmediatamente)
    if (compraId) {
      await fetch(`${SUPA_URL}/rest/v1/compras?id=eq.${compraId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entrega: 'delivered' })
      });
    }

    // Enviar email post-compra (no bloquea la respuesta si falla)
    enviarEmailCompra(SUPA_URL, SUPA_KEY, emailNorm, recetario, payment_id, compraId)
      .catch(e => console.error('Email post-compra error (no crítico):', e.message));

    return res.status(200).json({ ok: true, id: compraId });
  } catch (error) {
    console.error('record_purchase error:', error.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

async function enviarEmailCompra(supaUrl, supaKey, email, recetario, paymentId, compraId) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log('Email omitido: RESEND_API_KEY no configurado');
    return;
  }

  try {
    // Obtener datos del recetario para el email
    const recRes = await fetch(
      `${supaUrl}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=titulo,foto_url,pdf_url&limit=1`,
      { headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` } }
    );
    const recData = recRes.ok ? await recRes.json() : [];
    const rec = Array.isArray(recData) && recData.length > 0 ? recData[0] : null;
    const titulo = rec?.titulo || recetario;
    const tienePdf = !!rec?.pdf_url;

    const accessUrl = 'https://javotecocina.com/';
    const year = new Date().getFullYear();

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu recetario ya está disponible</title>
</head>
<body style="margin:0;padding:0;background:#f5ede4;font-family:'Barlow',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede4;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:#1a120b;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:1.5rem;font-weight:900;letter-spacing:.08em;color:#f5ede4;text-transform:uppercase;">JAVOTECOCINA</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:.85rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C84B11;">¡Compra aprobada!</p>
          <h1 style="margin:0 0 20px;font-size:1.5rem;font-weight:800;color:#1a120b;line-height:1.2;">${titulo}</h1>
          <p style="margin:0 0 24px;font-size:.95rem;color:#555;line-height:1.6;">
            ¡Gracias por tu compra! Tu recetario <strong>${titulo}</strong> ya está disponible en tu cuenta.
          </p>
          ${tienePdf
            ? `<p style="margin:0 0 16px;font-size:.9rem;color:#555;line-height:1.6;">
                Podés acceder y descargar tu PDF desde la sección <strong>Mis Compras</strong> en la web.
               </p>`
            : `<p style="margin:0 0 16px;font-size:.9rem;color:#E8730A;line-height:1.6;">
                Tu compra fue acreditada correctamente. El archivo estará disponible en breve.
                Te avisaremos cuando esté listo.
               </p>`
          }
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td align="center">
              <a href="${accessUrl}" style="display:inline-block;background:#C84B11;color:#fff;text-decoration:none;padding:14px 36px;border-radius:3px;font-size:.9rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">
                Ir a Mis Compras →
              </a>
            </td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;font-size:.8rem;color:#999;line-height:1.5;">
            Si tenés algún problema para acceder a tu producto, respondé este email o escribinos por WhatsApp.<br>
            Número de pago: <code style="background:#f5ede4;padding:2px 6px;border-radius:2px;">${paymentId || 'N/A'}</code>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#1a120b;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:.75rem;color:rgba(245,237,228,.4);">© ${year} Javotecocina · javotecocina.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Javotecocina <recetarios@javotecocina.com>',
        to: [email],
        subject: `Tu recetario "${titulo}" ya está disponible — Javotecocina`,
        html: htmlBody
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', emailRes.status, errText);
      // Guardar el error en la BD pero no romper el flujo
      if (compraId) {
        await fetch(`${supaUrl}/rest/v1/compras?id=eq.${compraId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supaKey,
            'Authorization': `Bearer ${supaKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email_error: `${emailRes.status}: ${errText.slice(0, 200)}` })
        });
      }
      return;
    }

    // Marcar email como enviado
    if (compraId) {
      await fetch(`${supaUrl}/rest/v1/compras?id=eq.${compraId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supaKey,
          'Authorization': `Bearer ${supaKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email_enviado_at: new Date().toISOString() })
      });
    }

    console.log(`Email enviado a ${email} para recetario ${recetario}`);
  } catch (e) {
    console.error('enviarEmailCompra error:', e.message);
  }
}
