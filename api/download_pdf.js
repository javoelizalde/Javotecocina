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
    const recRes = await fetch(
      `${SUPA_URL}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo&limit=1`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    if (!recRes.ok) return res.status(404).json({ error: 'Recetario no encontrado.' });

    const recData = await recRes.json();
    if (!Array.isArray(recData) || recData.length === 0) return res.status(404).json({ error: 'Recetario no encontrado.' });

    const pdfUrl = recData[0].pdf_url;
    if (!pdfUrl) {
      return res.status(202).json({
        available: false,
        message: 'Tu compra fue aprobada, pero el archivo todavía no está disponible. Te contactaremos cuando esté listo.'
      });
    }

    return res.status(200).json({ available: true, pdf_url: pdfUrl, titulo: recData[0].titulo });
  } catch (error) {
    console.error('download_pdf error:', error.message);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
};
