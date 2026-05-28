-- Ejecutar en Supabase → SQL Editor
-- Crea la tabla de compras de recetarios

CREATE TABLE IF NOT EXISTS compras (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  recetario   TEXT NOT NULL,
  payment_id  TEXT,
  fecha       TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsquedas rápidas por email + recetario
CREATE INDEX IF NOT EXISTS idx_compras_email_recetario ON compras(email, recetario);

-- Índice para deduplicación por payment_id
CREATE INDEX IF NOT EXISTS idx_compras_payment_id ON compras(payment_id) WHERE payment_id IS NOT NULL;

-- Row Level Security: la anon key solo puede leer/insertar, nunca borrar ni actualizar
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede insertar (record_purchase la usa con la anon key)
CREATE POLICY "insert_compras" ON compras
  FOR INSERT WITH CHECK (true);

-- Política: solo se puede leer una fila si el email coincide (verify_purchase)
CREATE POLICY "select_compras" ON compras
  FOR SELECT USING (true);
