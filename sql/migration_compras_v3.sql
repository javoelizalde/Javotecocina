-- Migration v3: user_id + payer_email en tabla compras
-- La compra se asocia al userId de Supabase Auth, no al email de MercadoPago.
-- Ejecutar en Supabase → SQL Editor

-- 1. Agregar columnas
ALTER TABLE compras ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS payer_email TEXT;

-- 2. Para registros existentes: preservar el email actual como payer_email
--    (antes el sistema guardaba el email de MP como email principal)
UPDATE compras
SET payer_email = email
WHERE payer_email IS NULL
  AND metadata->>'payer_email' IS NULL;

-- 3. Para registros con backfill en metadata: usar el payer_email del metadata
UPDATE compras
SET payer_email = metadata->>'payer_email'
WHERE metadata->>'payer_email' IS NOT NULL
  AND payer_email IS NULL;

-- 4. Para registros con user_id en metadata (backfill Agustín): migrar al campo real
UPDATE compras
SET user_id = (metadata->>'user_id')::uuid
WHERE metadata->>'user_id' IS NOT NULL
  AND user_id IS NULL;

-- 5. Índice en user_id para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_compras_user_id
  ON compras(user_id) WHERE user_id IS NOT NULL;

-- 6. Verificar resultado
SELECT id, email, payer_email, user_id, recetario, estado
FROM compras
ORDER BY fecha DESC;
