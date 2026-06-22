// api/bookings/list.js
// GET /api/bookings/list — lista reservas (requiere JWT de admin)

import { verifyAdmin } from '../../services/AdminAuth.js';

const SUPA_URL = process.env.SUPABASE_URL  || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  'https://javotecocina.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).set(CORS).end();
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación + autorización: debe ser un admin de la allowlist
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado. Iniciá sesión con la cuenta de administrador.' });
  const auth = req.headers.authorization;

  const estado = req.query.estado || null;
  const limit  = Math.min(parseInt(req.query.limit  || '100'), 200);
  const offset = parseInt(req.query.offset || '0');

  let qs = `order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (estado) qs += `&estado=eq.${encodeURIComponent(estado)}`;

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/bookings?${qs}`, {
      headers: {
        apikey:        SUPA_KEY,
        Authorization: auth,          // pasa el JWT del admin
        'Content-Type': 'application/json',
      },
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[bookings/list] Supabase error:', err);
      return res.status(r.status).json({ error: err });
    }

    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error('[bookings/list] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
