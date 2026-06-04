// api/record_purchase.js
// Webhook de Mercado Pago + registro manual de compras desde el frontend.
//
// La compra se asocia por userId (Supabase Auth UUID), no por email de MercadoPago.
// El email de MercadoPago (payer_email) se guarda solo como dato de auditoría.
//
// external_reference formato: "recetarioId:::emailRegistrado:::userId"
// Soporta formato viejo: "recetarioId:::emailRegistrado" (sin userId)
// Soporta formato legado: "recetarioId" (solo slug)
//
// VARIABLES DE ENTORNO (Vercel):
//   MP_ACCESS_TOKEN
//   SUPABASE_URL      (opcional, hay fallback)
//   SUPABASE_ANON_KEY (opcional, hay fallback)
//   RESEND_API_KEY    (opcional, para emails)

const SUPA_URL_FB = 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY_FB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

function getSupabase() {
  return {
    url: process.env.SUPABASE_URL || SUPA_URL_FB,
    key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || SUPA_KEY_FB
  };
}

// Parsea external_reference en sus 3 partes:
//   [0] recetario (slug o id)
//   [1] userEmail (email registrado en Javotecocina) — puede estar vacío
//   [2] userId    (UUID de Supabase Auth) — puede no estar (formato viejo)
function parseExtRef(extRef) {
  if (!extRef) return { recetario: null, userEmail: null, userId: null };
  const parts = extRef.split(':::');
  return {
    recetario:  parts[0] || null,
    userEmail:  parts[1] || null,
    userId:     parts[2] || null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const qId    = req.query?.id || req.query?.['data.id'];
  const qType  = req.query?.type;
  const qTopic = req.query?.topic;

  if (qTopic === 'payment' && qId) return procesarIPN(res, qId);
  if (qType  === 'payment' && qId) return procesarIPN(res, qId);

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.type === 'payment' && body.data?.id) return procesarIPN(res, body.data.id);
    const { email, recetario, payment_id, user_id } = body;
    if (!email || !recetario) return res.status(400).json({ error: 'Faltan email y recetario' });
    return registrarCompra(res, {
      userEmail:  email,
      userId:     user_id || null,
      recetario,
      paymentId:  payment_id || null,
      payerEmail: null,
      monto:      null,
      moneda:     'ARS',
      origen:     'frontend'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function procesarIPN(res, paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) { console.error('IPN: MP_ACCESS_TOKEN no configurado'); return res.status(200).end(); }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!mpRes.ok) return res.status(200).end();

    const payment = await mpRes.json();
    console.log(`IPN: payment ${paymentId} status=${payment.status} ext=${payment.external_reference}`);

    if (payment.status !== 'approved') return res.status(200).end();

    const { recetario, userEmail, userId } = parseExtRef(payment.external_reference);

    // payerEmail = email de la cuenta de MercadoPago (puede ser distinto al de la web)
    const payerEmail = payment.payer?.email || null;

    // userEmail es el email registrado en Javotecocina (viene del external_reference).
    // Si por alguna razón no está en el external_reference (formato muy viejo),
    // usamos el payerEmail como fallback —pero solo como último recurso.
    const emailFinal = userEmail || payerEmail;

    if (!emailFinal || !recetario) {
      console.error(`IPN: faltan datos — email=${emailFinal} recetario=${recetario}`);
      return res.status(200).end();
    }

    await registrarCompra(res, {
      userEmail:  emailFinal,
      userId:     userId,
      recetario,
      paymentId:  String(paymentId),
      payerEmail: payerEmail,
      monto:      payment.transaction_amount || null,
      moneda:     payment.currency_id || 'ARS',
      origen:     'webhook'
    });
  } catch (e) {
    console.error('IPN error:', e.message);
    return res.status(200).end();
  }
}

async function registrarCompra(res, {
  userEmail, userId, recetario, paymentId,
  payerEmail, monto, moneda, origen
}) {
  const { url: SUPA_URL, key: SUPA_KEY } = getSupabase();
  const emailNorm = (userEmail || '').toLowerCase().trim();

  try {
    // ── IDEMPOTENCIA ──────────────────────────────────────────────────────────
    // Verificar si ya existe una compra con este payment_id.
    // Con el UNIQUE INDEX de la migración v2, el INSERT falla con 409 si hay duplicado.
    // Esta pre-verificación permite detectar si hay que reintentar el email.
    if (paymentId) {
      const checkRes = await fetch(
        `${SUPA_URL}/rest/v1/compras?payment_id=eq.${encodeURIComponent(paymentId)}&select=id,email,user_id,email_enviado_at`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (Array.isArray(existing) && existing.length > 0) {
          const row = existing[0];
          console.log(`Compra ya existe: id=${row.id} payment_id=${paymentId}`);
          // Si llegó un userId nuevo y el registro no lo tiene, actualizarlo
          if (userId && !row.user_id) {
            await fetch(`${SUPA_URL}/rest/v1/compras?id=eq.${row.id}`, {
              method: 'PATCH',
              headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, payer_email: payerEmail })
            });
          }
          // Reintentar email si no se envió
          if (!row.email_enviado_at) {
            enviarEmailCompra(SUPA_URL, SUPA_KEY, emailNorm, recetario, paymentId, row.id)
              .catch(e => console.error('Email retry error:', e.message));
          }
          return res.status(200).json({ ok: true, duplicate: true });
        }
      }
    }

    // ── INSERTAR COMPRA ───────────────────────────────────────────────────────
    const payload = {
      email:       emailNorm,           // email de la cuenta de Javotecocina (principal)
      payer_email: payerEmail || null,  // email de la cuenta de MercadoPago (auditoría)
      user_id:     userId    || null,   // UUID de Supabase Auth
      recetario,
      payment_id:  paymentId || null,
      fecha:       new Date().toISOString(),
      estado:      'approved',
      entrega:     'not_delivered',
      monto:       monto  || null,
      moneda:      moneda || 'ARS',
      metadata:    { origen: origen || 'unknown', payerEmail }
    };

    // Intentar insertar con payer_email y user_id (requiere migración v3).
    // Si las columnas no existen aún, caer a inserción básica sin ellas.
    let insertRes = await fetch(`${SUPA_URL}/rest/v1/compras`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    // Si falla por columnas faltantes (42703), insertar sin las columnas nuevas
    if (!insertRes.ok) {
      const errText = await insertRes.text();
      if (insertRes.status === 409) {
        console.log(`Compra ya existía (conflict): payment_id=${paymentId}`);
        return res.status(200).json({ ok: true, duplicate: true });
      }
      if (errText.includes('42703') || errText.includes('column') || errText.includes('schema cache')) {
        console.warn('Columnas nuevas no existen aún, insertando sin payer_email/user_id');
        const basicPayload = {
          email:      emailNorm,
          recetario,
          payment_id: paymentId || null,
          fecha:      new Date().toISOString(),
          estado:     'approved',
          entrega:    'not_delivered',
          monto:      monto  || null,
          moneda:     moneda || 'ARS',
          metadata:   { origen, payerEmail, userId }
        };
        insertRes = await fetch(`${SUPA_URL}/rest/v1/compras`, {
          method: 'POST',
          headers: {
            'apikey': SUPA_KEY,
            'Authorization': `Bearer ${SUPA_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(basicPayload)
        });
        if (!insertRes.ok) {
          const err2 = await insertRes.text();
          console.error('Insert básico error:', err2);
          return res.status(500).json({ error: 'Error guardando compra' });
        }
      } else {
        console.error('Insert error:', errText);
        return res.status(500).json({ error: 'Error guardando compra' });
      }
    }

    const inserted = await insertRes.json();
    const compraId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    console.log(`Compra guardada: id=${compraId} email=${emailNorm} userId=${userId} recetario=${recetario}`);

    // Actualizar entrega a 'delivered'
    if (compraId) {
      await fetch(`${SUPA_URL}/rest/v1/compras?id=eq.${compraId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrega: 'delivered' })
      });
    }

    // Email post-compra (no bloquea)
    enviarEmailCompra(SUPA_URL, SUPA_KEY, emailNorm, recetario, paymentId, compraId)
      .catch(e => console.error('Email post-compra error:', e.message));

    return res.status(200).json({ ok: true, id: compraId });
  } catch (error) {
    console.error('record_purchase error:', error.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

async function enviarEmailCompra(supaUrl, supaKey, email, recetario, paymentId, compraId) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) { console.log('Email omitido: RESEND_API_KEY no configurado'); return; }

  try {
    const recRes = await fetch(
      `${supaUrl}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=titulo,pdf_url&limit=1`,
      { headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` } }
    );
    let rec = null;
    if (recRes.ok) {
      const recData = await recRes.json();
      if (!Array.isArray(recData) || recData.length === 0) {
        // Intentar por slug
        const recRes2 = await fetch(
          `${supaUrl}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=titulo,pdf_url&limit=1`,
          { headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` } }
        );
        if (recRes2.ok) { const d2 = await recRes2.json(); rec = d2[0] || null; }
      } else {
        rec = recData[0];
      }
    }

    const titulo = rec?.titulo || recetario;
    const tienePdf = !!rec?.pdf_url;
    const year = new Date().getFullYear();

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5ede4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede4;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:4px;overflow:hidden;">
<tr><td style="background:#1a120b;padding:28px 40px;text-align:center;">
  <p style="margin:0;font-size:1.4rem;font-weight:900;letter-spacing:.08em;color:#f5ede4;text-transform:uppercase;">JAVOTECOCINA</p>
</td></tr>
<tr><td style="padding:36px 40px 28px;">
  <p style="margin:0 0 6px;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C84B11;">¡Compra aprobada!</p>
  <h1 style="margin:0 0 18px;font-size:1.4rem;font-weight:800;color:#1a120b;">${titulo}</h1>
  <p style="margin:0 0 20px;font-size:.9rem;color:#555;line-height:1.6;">
    ¡Gracias por tu compra! Tu recetario <strong>${titulo}</strong> ya está disponible en tu cuenta.
  </p>
  ${tienePdf
    ? `<p style="margin:0 0 14px;font-size:.88rem;color:#555;line-height:1.6;">Accedé al PDF desde la sección <strong>Mis Compras</strong> en la web.</p>`
    : `<p style="margin:0 0 14px;font-size:.88rem;color:#E8730A;line-height:1.6;">Tu compra fue acreditada. El archivo estará disponible en breve.</p>`
  }
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="https://javotecocina.com/" style="display:inline-block;background:#C84B11;color:#fff;text-decoration:none;padding:13px 32px;border-radius:3px;font-size:.88rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Ir a Mis Compras →</a>
  </td></tr></table>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
  <p style="margin:0;font-size:.76rem;color:#aaa;line-height:1.5;">
    Número de pago: <code style="background:#f5ede4;padding:1px 5px;border-radius:2px;">${paymentId || 'N/A'}</code>
  </p>
</td></tr>
<tr><td style="background:#1a120b;padding:16px 40px;text-align:center;">
  <p style="margin:0;font-size:.72rem;color:rgba(245,237,228,.4);">© ${year} Javotecocina · javotecocina.com</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Javotecocina <recetarios@javotecocina.com>',
        to: [email],
        subject: `Tu recetario "${titulo}" ya está disponible`,
        html
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', emailRes.status, err.slice(0, 200));
      if (compraId) await patchCompra(supaUrl, supaKey, compraId, { email_error: `${emailRes.status}: ${err.slice(0,150)}` });
      return;
    }

    if (compraId) await patchCompra(supaUrl, supaKey, compraId, { email_enviado_at: new Date().toISOString() });
    console.log(`Email enviado a ${email} para recetario ${recetario}`);
  } catch(e) {
    console.error('enviarEmailCompra error:', e.message);
  }
}

async function patchCompra(supaUrl, supaKey, id, data) {
  await fetch(`${supaUrl}/rest/v1/compras?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}
