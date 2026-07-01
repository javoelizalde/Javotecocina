// api/download_pdf.js
// Descarga segura de PDF. Valida JWT, luego busca compra aprobada por userId o email.
// El email de MercadoPago no tiene ningún rol en esta validación.

const SUPA_URL_FB = 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY_FB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL || SUPA_URL_FB;
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || SUPA_KEY_FB;

  const authHeader = req.headers['authorization'] || '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const { recetario } = req.body || {};

  if (!recetario) return res.status(400).json({ error: 'Falta recetario' });
  if (!userToken) return res.status(401).json({ error: 'No autenticado. Iniciá sesión para descargar.' });

  try {
    // Validar token y obtener userId + email
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${userToken}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' });

    const userData = await userRes.json();
    const emailNorm = (userData.email || '').toLowerCase().trim();
    // userId del JWT (sub claim)
    let userId = null;
    try {
      const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
      userId = payload.sub || null;
    } catch(e) {}

    if (!emailNorm && !userId) return res.status(401).json({ error: 'No se pudo verificar tu identidad.' });

    // ── VERIFICAR COMPRA ──────────────────────────────────────────────────────
    // Buscar por userId primero, luego por email
    let hasAccess = false;

    if (userId) {
      try {
        const r = await fetch(
          `${SUPA_URL}/rest/v1/compras?user_id=eq.${userId}&recetario=eq.${encodeURIComponent(recetario)}&estado=eq.approved&select=id&limit=1`,
          { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${userToken}` } }
        );
        if (r.ok) {
          const rows = await r.json();
          hasAccess = Array.isArray(rows) && rows.length > 0;
        }
      } catch(e) {}
    }

    if (!hasAccess && emailNorm) {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/compras?email=eq.${encodeURIComponent(emailNorm)}&recetario=eq.${encodeURIComponent(recetario)}&estado=eq.approved&select=id&limit=1`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${userToken}` } }
      );
      if (r.ok) {
        const rows = await r.json();
        hasAccess = Array.isArray(rows) && rows.length > 0;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'No tenés acceso a este producto. Verificá tu compra en Mis Compras.' });
    }

    // ── OBTENER PDF ───────────────────────────────────────────────────────────
    // Intentar por id primero; si no encuentra, intentar por slug.
    // compras.recetario puede guardar slug ("a-todo-disco") o id numérico ("3").
    let recRow = null;

    const recByIdRes = await fetch(
      `${SUPA_URL}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo&limit=1`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    if (recByIdRes.ok) {
      const d = await recByIdRes.json();
      if (Array.isArray(d) && d.length > 0) recRow = d[0];
    }

    if (!recRow) {
      const recBySlugRes = await fetch(
        `${SUPA_URL}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo&limit=1`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
      );
      if (recBySlugRes.ok) {
        const d2 = await recBySlugRes.json();
        if (Array.isArray(d2) && d2.length > 0) recRow = d2[0];
      }
    }

    if (!recRow) return res.status(404).json({ error: 'Recetario no encontrado.' });

    const pdfUrl = recRow.pdf_url;
    if (!pdfUrl) {
      return res.status(202).json({
        available: false,
        message: 'Tu compra fue aprobada, pero el archivo todavía no está disponible. Te contactaremos cuando esté listo.'
      });
    }

    // ── FIRMAR SI ESTÁ EN EL BUCKET PRIVADO ───────────────────────────────────
    // Si el pdf_url apunta a Supabase Storage (bucket privado recetarios-pdf),
    // generamos un enlace firmado temporal con la service role key. Así el PDF
    // nunca queda accesible sin una compra verificada. Otros pdf_url (ej. links
    // públicos de Drive) se devuelven tal cual, por compatibilidad.
    let finalUrl = pdfUrl;
    const m = pdfUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/recetarios-pdf\/([^?]+)/);
    if (m) {
      const objectPath = decodeURIComponent(m[1]).split('/').map(encodeURIComponent).join('/');
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SERVICE_KEY) {
        console.error('download_pdf: falta SUPABASE_SERVICE_ROLE_KEY');
        return res.status(500).json({ error: 'Configuración incompleta del servidor. Contactanos.' });
      }
      const signRes = await fetch(`${SUPA_URL}/storage/v1/object/sign/recetarios-pdf/${objectPath}`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 300 })
      });
      if (!signRes.ok) {
        console.error('download_pdf: sign failed', signRes.status, await signRes.text());
        return res.status(500).json({ error: 'No se pudo generar el enlace de descarga. Intentá de nuevo.' });
      }
      const signData = await signRes.json();
      finalUrl = `${SUPA_URL}/storage/v1${signData.signedURL}`;
    }

    return res.status(200).json({ available: true, pdf_url: finalUrl, titulo: recRow.titulo });
  } catch (error) {
    console.error('download_pdf error:', error.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
};
