-- Migration v2: Estado, entrega y seguridad en tabla compras
-- Ejecutar en Supabase → SQL Editor

-- 1. Agregar columnas de estado, entrega y tracking de email
ALTER TABLE compras ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'approved';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS entrega TEXT DEFAULT 'not_delivered';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS email_enviado_at TIMESTAMPTZ;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS email_error TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS monto NUMERIC;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'ARS';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Marcar compras existentes sin estado como approved (ya fueron registradas manualmente)
UPDATE compras SET estado = 'approved' WHERE estado IS NULL;
UPDATE compras SET entrega = 'not_delivered' WHERE entrega IS NULL;

-- 2. Índice único en payment_id para garantizar idempotencia
DROP INDEX IF EXISTS idx_compras_payment_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_payment_id_unique
  ON compras(payment_id) WHERE payment_id IS NOT NULL;

-- 3. Mantener SELECT abierto para que el backend (anon key) pueda consultar compras.
-- El control de acceso real lo hace verify_purchase.js validando el JWT del usuario.
-- La policy original se mantiene: USING (true)
-- (Opcional futuro: migrar a USING (lower(auth.jwt() ->> 'email') = lower(email))
--  cuando se configure SUPABASE_SERVICE_ROLE_KEY en el backend.)

-- 4. Policy de UPDATE para que el backend pueda actualizar estado/entrega/email_enviado_at
DROP POLICY IF EXISTS "update_compras_backend" ON compras;
CREATE POLICY "update_compras_backend" ON compras
  FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Verificar resultado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'compras'
ORDER BY ordinal_position;
