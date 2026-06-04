// api/migrate_v2.js — ENDPOINT TEMPORAL para migración de base de datos
// Ejecuta los ALTER TABLE necesarios en la tabla compras.
// ELIMINAR ESTE ARCHIVO después de confirmar que la migración funcionó.
// Solo acepta GET con ?secret=RUN_MIGRATION para evitar ejecución accidental.

const SUPA_URL_FALLBACK = 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SERVICE_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkyOTA2MCwiZXhwIjoyMDk1NTA1MDYwfQ.OF1TLCAPc5iKdJKGz9ycpsPWGIceeCic1Cs890yqHa4';

module.exports = async function handler(req, res) {
  if (req.query.secret !== 'RUN_MIGRATION') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const SUPA_URL = process.env.SUPABASE_URL || SUPA_URL_FALLBACK;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SERVICE_KEY_FALLBACK;

  const results = [];

  // Intentar via el endpoint SQL de Supabase (si está disponible en este proyecto)
  const sqlStatements = [
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'approved'",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS entrega TEXT DEFAULT 'not_delivered'",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS email_enviado_at TIMESTAMPTZ",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS email_error TEXT",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS monto NUMERIC",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'ARS'",
    "ALTER TABLE compras ADD COLUMN IF NOT EXISTS metadata JSONB",
    "UPDATE compras SET estado = 'approved' WHERE estado IS NULL",
    "UPDATE compras SET entrega = 'not_delivered' WHERE entrega IS NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_payment_id_unique ON compras(payment_id) WHERE payment_id IS NOT NULL",
    "DROP POLICY IF EXISTS update_compras_backend ON compras",
    "CREATE POLICY update_compras_backend ON compras FOR UPDATE USING (true) WITH CHECK (true)"
  ];

  // Supabase expone /pg/query para SQL directo con service_role (disponible en algunos planes)
  const pgEndpoint = `${SUPA_URL}/pg/query`;

  for (const sql of sqlStatements) {
    try {
      const r = await fetch(pgEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY
        },
        body: JSON.stringify({ query: sql })
      });
      const text = await r.text();
      results.push({ sql: sql.slice(0, 60) + '...', status: r.status, response: text.slice(0, 100) });
    } catch (e) {
      results.push({ sql: sql.slice(0, 60) + '...', error: e.message });
    }
  }

  // Verificar resultado final
  try {
    const checkRes = await fetch(
      `${SUPA_URL}/rest/v1/compras?limit=1&select=id,estado,entrega,monto`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    const checkText = await checkRes.text();
    results.push({ check: 'SELECT estado,entrega,monto', status: checkRes.status, response: checkText.slice(0, 200) });
  } catch (e) {
    results.push({ check: 'verification_error', error: e.message });
  }

  return res.status(200).json({ results });
};
