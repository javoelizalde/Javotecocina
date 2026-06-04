// api/verify_purchase.js
// Verifica si un email tiene acceso a un recetario específico (compra registrada en Supabase)
// Devuelve { access: bool, pdf_url: string|null, titulo: string|null }
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, recetario } = req.body || {};
  if (!email || !recetario) return res.status(400).json({ error: 'Faltan datos', access: false });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Config error', access: false });

  try {
    const emailNorm = email.toLowerCase().trim();

    // Verificar compra
    const queryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/compras?email=eq.${encodeURIComponent(emailNorm)}&recetario=eq.${encodeURIComponent(recetario)}&select=id,recetario&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const rows = await queryRes.json();
    const hasAccess = Array.isArray(rows) && rows.length > 0;

    if (!hasAccess) {
      return res.status(200).json({ access: false, pdf_url: null, titulo: null });
    }

    // Buscar pdf_url en la tabla recetarios (por slug o por id)
    let pdfUrl = null;
    let titulo = null;
    try {
      // Intentar por slug primero
      const recRes = await fetch(
        `${SUPABASE_URL}/rest/v1/recetarios?slug=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const recData = await recRes.json();
      if (Array.isArray(recData) && recData.length > 0) {
        pdfUrl = recData[0].pdf_url || null;
        titulo = recData[0].titulo || null;
      } else {
        // Intentar por id (por si recetario es un número)
        const recResById = await fetch(
          `${SUPABASE_URL}/rest/v1/recetarios?id=eq.${encodeURIComponent(recetario)}&select=pdf_url,titulo&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        );
        const recDataById = await recResById.json();
        if (Array.isArray(recDataById) && recDataById.length > 0) {
          pdfUrl = recDataById[0].pdf_url || null;
          titulo = recDataById[0].titulo || null;
        }
      }
    } catch (e) {
      console.error('Error fetching recetario pdf_url:', e);
    }

    return res.status(200).json({ access: true, pdf_url: pdfUrl, titulo });
  } catch (error) {
    console.error('verify_purchase error:', error);
    return res.status(500).json({ error: 'Error interno', access: false });
  }
};
