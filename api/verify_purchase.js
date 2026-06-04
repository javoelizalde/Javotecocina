// api/verify_purchase.js
// Verifica si un usuario tiene acceso a un recetario.
// Acepta auth via token JWT de Supabase (header Authorization) o por email directo (legacy).
// Devuelve { access, pdf_url, titulo, foto_url, estado, entrega }

const SUPA_URL_FALLBACK = 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://javotecocina.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL || SUPA_URL_FALLBACK;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || SUPA_KEY_FALLBACK;

  const { email: bodyEmail, recetario } = req.body || {};
  const authHeader = req.headers['authorization'] || '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!recetario) return res.status(400).json({ error: 'Falta recetario', access: false });

  let emailNorm = null;

  // Si hay token JWT, validarlo con Supabase y obtener el email autenticado
  if (userToken && userToken !== SUPABASE_KEY) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        emailNorm = (userData.email || '').toLowerCase().trim();
      }
    } catch (e) {
      console.error('verify_purchase: error validando token:', e.message);
    }
  }

  // Fallback: usar email del body (para compatibilidad con llamadas sin token)
  if (!emailNorm && bodyEmail) {
    emailNorm = bodyEmail.toLowerCase().trim();
  }

  if (!emailNorm) return res.status(401).json({ error: 'No autenticado', access: false });

  try {
    // Buscar compra del usuario para este recetario.
    // Usar el JWT del usuario (si está disponible) para que sea compatible
    // con RLS futuras que filtren por email del token.
    const queryAuth = (userToken && userToken !== SUPABASE_KEY) ? userToken : SUPABASE_KEY;
    const queryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/compras?email=eq.${encodeURIComponent(emailNorm)}&recetario=eq.${encodeURIComponent(recetario)}&select=id,estado,entrega,fecha&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${queryAuth}`
        }
      }
    );

    const rows = await queryRes.json();
    const compra = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!compra) {
      return res.status(200).json({ access: false, pdf_url: null, titulo: null, foto_url: null, estado: null });
    }

    // Solo dar acceso al PDF si el pago está aprobado
    const hasAccess = compra.estado === 'approved' || compra.estado === null;

    // Obtener datos del recetario (pdf_url, titulo, foto_url)
    let pdfUrl = null, titulo = null, fotoUrl = null;
    try {
      const recRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo,foto_url&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const recData = await recRes.json();
      if (Array.isArray(recData) && recData.length > 0) {
        pdfUrl  = hasAccess ? (recData[0].pdf_url || null) : null;
        titulo  = recData[0].titulo || null;
        fotoUrl = recData[0].foto_url || null;
      } else {
        // Fallback: buscar por id si el slug no matchea
        const recResById = await fetch(
          `${SUPABASE_URL}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo,foto_url&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const recDataById = await recResById.json();
        if (Array.isArray(recDataById) && recDataById.length > 0) {
          pdfUrl  = hasAccess ? (recDataById[0].pdf_url || null) : null;
          titulo  = recDataById[0].titulo || null;
          fotoUrl = recDataById[0].foto_url || null;
        }
      }
    } catch (e) {
      console.error('verify_purchase: error obteniendo recetario:', e.message);
    }

    return res.status(200).json({
      access: hasAccess,
      pdf_url: pdfUrl,
      titulo,
      foto_url: fotoUrl,
      estado: compra.estado || 'approved',
      entrega: compra.entrega || 'not_delivered',
      fecha: compra.fecha || null
    });
  } catch (error) {
    console.error('verify_purchase error:', error.message);
    return res.status(500).json({ error: 'Error interno', access: false });
  }
};
