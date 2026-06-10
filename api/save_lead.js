// api/save_lead.js
// Guarda un lead en Supabase y opcionalmente en Google Sheets
// POST /api/save_lead

const SUPA_URL = process.env.SUPABASE_URL || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

// Google Sheets (opcional — configurar variables de entorno)
const SHEETS_ID       = process.env.GOOGLE_SHEETS_ID;       // ID del spreadsheet
const SHEETS_API_KEY  = process.env.GOOGLE_SHEETS_API_KEY;  // API key con permisos de escritura
const SHEETS_RANGE    = process.env.GOOGLE_SHEETS_RANGE || 'Leads!A:Z';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generarResumen(tipo, datos) {
  try {
    if (tipo === 'evento') {
      const personas = datos.personas || 'N/A';
      const ciudad   = datos.ciudad   || 'N/A';
      const tipoEv   = datos.tipo_evento || 'evento';
      const fecha    = datos.fecha ? ` para el ${datos.fecha}` : '';
      const formato  = Array.isArray(datos.formato_cocina) ? datos.formato_cocina.join(', ') : (datos.formato_cocina || '');
      const presup   = datos.presupuesto && datos.presupuesto !== 'Prefiero no informarlo' ? `. Presupuesto: ${datos.presupuesto}` : '. Presupuesto no informado';
      return `Lead de ${tipoEv.toLowerCase()}${fecha}, ${personas} personas en ${ciudad}${formato ? `, formato: ${formato}` : ''}${presup}. Contactar por WhatsApp.`;
    }
    if (tipo === 'campana') {
      const marca    = datos.marca    || 'N/A';
      const producto = datos.producto_campana || 'N/A';
      const plats    = Array.isArray(datos.plataformas) ? datos.plataformas.join('+') : (datos.plataformas || '');
      return `Campaña de ${marca} para "${producto}" en ${plats}. Objetivo: ${datos.objetivo || 'no especificado'}.`;
    }
    if (tipo === 'producto') {
      return `Consulta de producto: ${datos.producto_interes || 'N/A'} desde ${datos.ubicacion || 'N/A'}. Envío: ${datos.necesita_envio || 'no especificado'}.`;
    }
    if (tipo === 'recetario') {
      return `Consulta sobre recetario ${datos.recetario_interes || 'N/A'}. Ya compró: ${datos.ya_compro || 'no especificado'}.`;
    }
    return datos.mensaje ? datos.mensaje.slice(0, 200) : 'Consulta general.';
  } catch {
    return 'Lead recibido desde el formulario web.';
  }
}

async function appendToSheets(lead) {
  if (!SHEETS_ID || !SHEETS_API_KEY) return;
  try {
    // Usamos Google Sheets API v4 (append)
    const row = [
      lead.id,
      new Date(lead.created_at).toLocaleString('es-AR'),
      lead.tipo_consulta,
      lead.estado,
      lead.nombre || '',
      lead.email  || '',
      lead.whatsapp || '',
      lead.resumen  || '',
      lead.origen   || 'web',
      lead.utm_source || '',
      lead.utm_medium || '',
      lead.utm_campaign || '',
      JSON.stringify(lead.datos || {}),
    ];
    const body = { values: [row], majorDimension: 'ROWS' };
    const url  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(SHEETS_RANGE)}:append?valueInputOption=USER_ENTERED&key=${SHEETS_API_KEY}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // No interrumpimos el flujo si Google Sheets falla
    console.error('[save_lead] Google Sheets error:', e.message);
  }
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const {
    tipo_consulta, nombre, email, whatsapp,
    datos = {}, origen = 'web',
    utm_source, utm_medium, utm_campaign, pagina_origen,
    consentimiento = false,
  } = body;

  // Validación mínima
  if (!tipo_consulta) {
    return res.status(400).json({ error: 'tipo_consulta es requerido' });
  }

  const resumen = generarResumen(tipo_consulta, { ...datos, nombre, email });

  const payload = {
    tipo_consulta,
    nombre: nombre || null,
    email:  email  || null,
    whatsapp: whatsapp || null,
    datos,
    origen,
    utm_source:    utm_source    || null,
    utm_medium:    utm_medium    || null,
    utm_campaign:  utm_campaign  || null,
    pagina_origen: pagina_origen || null,
    consentimiento: Boolean(consentimiento),
    resumen,
    estado: 'nuevo',
  };

  // Guardar en Supabase
  let savedLead = null;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/leads`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[save_lead] Supabase error:', err);
      // Guardamos igual pero sin ID de referencia
    } else {
      const rows = await r.json();
      savedLead = Array.isArray(rows) ? rows[0] : rows;
    }
  } catch (e) {
    console.error('[save_lead] Supabase fetch error:', e.message);
  }

  // Intentar Google Sheets (no bloquea la respuesta)
  if (savedLead) {
    appendToSheets(savedLead).catch(() => {});
  }

  return res.status(200).json({
    ok: true,
    id: savedLead?.id || null,
    resumen,
    message: 'Consulta recibida correctamente',
  });
}
