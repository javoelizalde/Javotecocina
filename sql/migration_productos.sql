-- Migration: tabla de productos físicos
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS productos (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  categoria   TEXT,
  badge       TEXT,
  foto_url    TEXT,
  precio      TEXT,
  activo      BOOLEAN DEFAULT true,
  orden       SMALLINT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_productos" ON productos
  FOR SELECT USING (true);

CREATE POLICY "auth_all_productos" ON productos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_productos_orden ON productos(orden) WHERE activo = true;

-- Datos iniciales (los 5 productos hardcodeados anteriormente)
INSERT INTO productos (nombre, descripcion, categoria, badge, foto_url, orden) VALUES
  ('Cuchillo de Campo Artesanal',
   'Hoja de acero inoxidable, mango de quebracho. Forjado a mano por artesanos del norte.',
   'Cuchillería', 'Artesanal', '/img/p22.jpg', 1),
  ('Tabla de Quebracho',
   'Madera nativa del norte. Resistente, aromática y perfecta para servir y cortar. Cada tabla es única.',
   'Utensilios', NULL, '/img/p23.jpg', 2),
  ('Blend de Especias NOA — Javo',
   'Mezcla exclusiva de pimentón ahumado, ají molido y hierbas andinas. El condimento de Salta en tu cocina.',
   'Especias', 'Exclusivo', '/img/p09.jpg', 3),
  ('Keveri H1 — Black Truffle',
   'Horno multifuncional a carbón. Del 110°C al 500°C: fast grill, slow smoke, pizza a la piedra y mucho más. Acero pintado electrostático.',
   'Equipamiento · Horno a Carbón', 'Destacado', '/img/keveri-h1-black.png', 4),
  ('Keveri H1 — Inox',
   'Versión premium en acero inoxidable completo, interior y exterior. Mayor durabilidad y resistencia para el fuego más exigente.',
   'Equipamiento · Horno a Carbón', NULL, '/img/keveri-h1-inox.jpg', 5);
