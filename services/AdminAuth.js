// services/AdminAuth.js
// Guard de administración: valida el JWT de Supabase y que el email esté en la allowlist.
// Lo usan los endpoints del panel que se saltean RLS (api/bookings/*).

const SUPA_URL = process.env.SUPABASE_URL || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

// Emails habilitados para operar el panel. Configurable por env (coma-separado); fallback al admin conocido.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'javoelizalde2001@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Devuelve el usuario de Supabase si el token es válido y su email está en la allowlist; si no, null.
export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  let user;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    user = await r.json();
  } catch {
    return null;
  }

  const email = (user?.email || '').toLowerCase();
  if (!email || !ADMIN_EMAILS.includes(email)) return null;
  return user;
}
