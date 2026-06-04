// api/verify_purchase.js
// Verifica si el usuario autenticado tiene acceso a un recetario.
// Prioriza userId para la búsqueda (robusto ante email mismatch con MP).
// Fallback a email si no hay userId o si la compra fue creada antes de la migración v3.

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

  const { email: bodyEmail, recetario } = req.body || {};
  const authHeader = req.headers['authorization'] || '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!recetario) return res.status(400).json({ error: 'Falta recetario', access: false });

  let emailNorm = null;
  let userId = null;

  // Validar JWT y obtener userId + email del usuario autenticado
  if (userToken && userToken !== SUPA_KEY) {
    try {
      // Decodificar JWT para extraer userId (sin llamada a red)
      const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
      userId = payload.sub || null;

      // Validar token con Supabase para obtener email verificado
      const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${userToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        emailNorm = (userData.email || '').toLowerCase().trim();
      }
    } catch (e) {
      console.error('verify_purchase: error validando token:', e.message);
    }
  }

  // Fallback a email del body (compatibilidad con llamadas sin token)
  if (!emailNorm && bodyEmail) emailNorm = bodyEmail.toLowerCase().trim();
  if (!emailNorm && !userId) return res.status(401).json({ error: 'No autenticado', access: false });

  try {
    // ── BUSCAR COMPRA ─────────────────────────────────────────────────────────
    // Estrategia de búsqueda en orden de confiabilidad:
    // 1. Por userId + recetario (más confiable, no depende del email)
    // 2. Por email + recetario  (fallback para registros sin userId)
    let compra = null;
    const queryAuth = (userToken && userToken !== SUPA_KEY) ? userToken : SUPA_KEY;

    if (userId) {
      // Intentar búsqueda por user_id (requiere columna de migración v3)
      try {
        const r = await fetch(
          `${SUPA_URL}/rest/v1/compras?user_id=eq.${userId}&recetario=eq.${encodeURIComponent(recetario)}&select=id,estado,entrega,fecha&limit=1`,
          { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${queryAuth}` } }
        );
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows.length > 0) compra = rows[0];
        }
      } catch(e) { /* columna user_id puede no existir aún */ }
    }

    // Fallback por email si no encontró por userId
    if (!compra && emailNorm) {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/compras?email=eq.${encodeURIComponent(emailNorm)}&recetario=eq.${encodeURIComponent(recetario)}&select=id,estado,entrega,fecha&limit=1`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${queryAuth}` } }
      );
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) compra = rows[0];
      }
    }

    if (!compra) {
      return res.status(200).json({ access: false, pdf_url: null, titulo: null, foto_url: null, estado: null });
    }

    const hasAccess = !compra.estado || compra.estado === 'approved';

    // ── OBTENER DATOS DEL RECETARIO ───────────────────────────────────────────
    let pdfUrl = null, titulo = null, fotoUrl = null;
    try {
      // Intentar por ID numérico primero (más confiable en este proyecto)
      const byId = await fetch(
        `${SUPA_URL}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo,foto_url&limit=1`,
        { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
      );
      if (byId.ok) {
        const d = await byId.json();
        if (Array.isArray(d) && d.length > 0) {
          pdfUrl  = hasAccess ? (d[0].pdf_url || null) : null;
          titulo  = d[0].titulo || null;
          fotoUrl = d[0].foto_url || null;
        }
      }
      // Si no encontró por ID, intentar por slug (para compatibilidad futura)
      if (!titulo) {
        const bySlug = await fetch(
          `${SUPA_URL}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo,foto_url&limit=1`,
          { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
        );
        if (bySlug.ok) {
          const d2 = await bySlug.json();
          if (Array.isArray(d2) && d2.length > 0) {
            pdfUrl  = hasAccess ? (d2[0].pdf_url || null) : null;
            titulo  = d2[0].titulo || null;
            fotoUrl = d2[0].foto_url || null;
          }
        }
      }
    } catch (e) {
      console.error('verify_purchase: error obteniendo recetario:', e.message);
    }

    return res.status(200).json({
      access:   hasAccess,
      pdf_url:  pdfUrl,
      titulo,
      foto_url: fotoUrl,
      estado:   compra.estado || 'approved',
      entrega:  compra.entrega || 'not_delivered',
      fecha:    compra.fecha || null
    });
  } catch (error) {
    console.error('verify_purchase error:', error.message);
    return res.status(500).json({ error: 'Error interno', access: false });
  }
};
