-- Migration: tabla de experiencias (portfolio)
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS experiencias (
  id          BIGSERIAL PRIMARY KEY,
  titulo      TEXT NOT NULL,
  categoria   TEXT DEFAULT 'general',
  descripcion TEXT,
  imagen_url  TEXT,
  destacada   BOOLEAN DEFAULT false,
  activo      BOOLEAN DEFAULT true,
  orden       SMALLINT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE experiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_experiencias" ON experiencias
  FOR SELECT USING (true);

CREATE POLICY "auth_all_experiencias" ON experiencias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_experiencias_orden ON experiencias(orden) WHERE activo = true;

-- Datos iniciales (los 8 items hardcodeados del portfolio)
-- destacada=true → ocupa 2 columnas en desktop (featured item)
INSERT INTO experiencias (titulo, categoria, imagen_url, destacada, orden) VALUES
  ('Experiencias de Marca',    'marcas',    '/img/p32.jpg', true,  1),
  ('Asado & Parrilla',         'parrilla',  '/img/p27.jpg', false, 2),
  ('Eventos Propios',          'eventos',   '/img/p14.jpg', false, 3),
  ('Keveri & Fuego',           'contenido', '/img/p02.jpg', false, 4),
  ('Corporativos & Team Building', 'eventos', '/img/p24.jpg', false, 5),
  ('Cocina a Domicilio',       'parrilla',  '/img/p09.jpg', false, 6),
  ('A Todo Disco',             'contenido', '/img/p33.jpg', false, 7),
  ('Sabores Salteños',         'contenido', '/img/p28.jpg', false, 8);
