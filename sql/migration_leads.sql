-- migration_leads.sql
-- Sistema unificado de leads para javotecocina.com
-- Ejecutar en Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL PRIMARY KEY,
  tipo_consulta   TEXT NOT NULL,        -- evento | campana | producto | recetario | otra
  estado          TEXT DEFAULT 'nuevo', -- nuevo | contactado | cotizado | en_negociacion | ganado | perdido | descartado

  -- Contacto
  nombre          TEXT,
  email           TEXT,
  whatsapp        TEXT,

  -- Datos específicos del formulario (todos los campos del wizard)
  datos           JSONB DEFAULT '{}',

  -- Tracking de origen
  origen          TEXT DEFAULT 'web',   -- web | whatsapp | instagram | tiktok | admin
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  pagina_origen   TEXT,

  -- Gestión interna
  notas           TEXT,
  responsable     TEXT,
  resumen         TEXT,                 -- resumen automático generado

  -- Consentimiento LGPD/privacidad
  consentimiento  BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda y filtrado rápido
CREATE INDEX IF NOT EXISTS idx_leads_tipo      ON leads(tipo_consulta);
CREATE INDEX IF NOT EXISTS idx_leads_estado    ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp  ON leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads(created_at DESC);

-- RLS: anon puede insertar, authenticated puede todo
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_leads"
  ON leads FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_select_leads"
  ON leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_update_leads"
  ON leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_delete_leads"
  ON leads FOR DELETE TO authenticated USING (true);

-- Función para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vista para el dashboard (conteos por estado)
CREATE OR REPLACE VIEW leads_summary AS
SELECT
  tipo_consulta,
  estado,
  COUNT(*) as total,
  MAX(created_at) as ultimo_ingreso
FROM leads
GROUP BY tipo_consulta, estado
ORDER BY tipo_consulta, estado;
