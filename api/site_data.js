// api/site_data.js
// Lee datos vivos (métricas y marcas) desde un Google Sheet público.
// GET /api/site_data  ->  { ok, metricas:[...], marcas:[...] }
//
// El Sheet debe tener dos pestañas: "metricas" y "marcas" (ver docs/google-sheets.md).
// La API key y el ID viven en variables de entorno (server-side, nunca en el front).
// Si falta configuración o el Sheet no responde, devuelve { ok:false } y el front
// usa el contenido embebido en el HTML como fallback. Nunca rompe el render.

const SHEETS_ID      = process.env.GOOGLE_SHEETS_ID;
const SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

const TRUE_VALS = new Set(['1', 'true', 'sí', 'si', 'x', 'yes', 'y', 'verdadero']);

// Por defecto visible; solo se oculta con un "no/false/0" explícito.
function isVisible(v) {
  if (v === undefined || v === null || String(v).trim() === '') return true;
  return TRUE_VALS.has(String(v).trim().toLowerCase());
}
function isTrue(v) {
  return TRUE_VALS.has(String(v || '').trim().toLowerCase());
}
function toNum(v) {
  const n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? 9999 : n;
}

// [ [headers...], [row...], ... ] -> [ {header: value, ...}, ... ]
function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map(h => String(h || '').trim().toLowerCase());
  return values.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
    return o;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // Cache en el edge de Vercel: 5 min fresco + 10 min stale-while-revalidate.
  // Evita pegarle a Google Sheets en cada visita.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  if (!SHEETS_ID || !SHEETS_API_KEY) {
    return res.status(200).json({ ok: false, reason: 'sheets_not_configured' });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values:batchGet`
      + `?ranges=${encodeURIComponent('metricas')}&ranges=${encodeURIComponent('marcas')}`
      + `&majorDimension=ROWS&key=${SHEETS_API_KEY}`;

    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ ok: false, reason: 'sheets_fetch_failed', status: r.status });

    const data = await r.json();
    const ranges = data.valueRanges || [];
    const getRange = name => {
      const vr = ranges.find(v => (v.range || '').toLowerCase().includes(name));
      return vr && vr.values ? vr.values : [];
    };

    const metricas = rowsToObjects(getRange('metricas'))
      .filter(m => isVisible(m.visible) && m.value !== undefined && m.value !== '')
      .sort((a, b) => toNum(a.order) - toNum(b.order))
      .map(m => ({ key: m.key || '', label: m.label || '', value: m.value || '', suffix: m.suffix || '' }));

    const marcas = rowsToObjects(getRange('marcas'))
      .filter(m => isVisible(m.visible) && (m.name || m.logo_url))
      .sort((a, b) => toNum(a.order) - toNum(b.order))
      .map(m => ({
        name: m.name || '',
        logo_url: m.logo_url || '',
        website_url: m.website_url || '',
        featured: isTrue(m.featured),
      }));

    return res.status(200).json({ ok: true, metricas, marcas });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'exception', error: e.message });
  }
}
