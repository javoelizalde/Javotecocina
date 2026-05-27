-- setup_supabase.sql
-- Pegá esto en Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS consultas (
  id              BIGSERIAL PRIMARY KEY,
  tipo_consulta   TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  telefono        TEXT,
  email           TEXT,
  tipo_evento     TEXT,
  personas        TEXT,
  fecha           TEXT,
  tipo_contenido  TEXT,
  producto        TEXT,
  mensaje         TEXT,
  fecha_consulta  TIMESTAMPTZ DEFAULT NOW(),
  atendido        BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pedidos (
  id               BIGSERIAL PRIMARY KEY,
  producto         TEXT NOT NULL,
  precio           TEXT,
  nombre           TEXT,
  email            TEXT,
  telefono         TEXT,
  direccion        TEXT,
  metodo_pago      TEXT,
  estado           TEXT DEFAULT 'pendiente',
  mp_preference_id TEXT,
  fecha            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id    BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_consultas" ON consultas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_pedidos"   ON pedidos   FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_waitlist"  ON waitlist  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_select_consultas" ON consultas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_pedidos"   ON pedidos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_waitlist"  ON waitlist  FOR SELECT TO authenticated USING (true);
