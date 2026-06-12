-- migration_bookings.sql
-- Sistema de reservas y conversaciones para Javotecocina
-- Ejecutar en Supabase → SQL Editor → Run

-- ── RESERVAS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              BIGSERIAL PRIMARY KEY,

  -- Contacto
  nombre          TEXT NOT NULL,
  telefono        TEXT,
  email           TEXT,

  -- Evento
  tipo_evento     TEXT,
  tipo_servicio   TEXT,
  fecha           DATE NOT NULL,
  hora_inicio     TIME,
  duracion_hs     NUMERIC DEFAULT 5,
  ubicacion       TEXT,
  provincia       TEXT,
  personas        INTEGER,
  comentarios     TEXT,

  -- Precios
  precio_total    NUMERIC,
  senia           NUMERIC,
  saldo           NUMERIC,
  moneda          TEXT DEFAULT 'ARS',

  -- Estado del flujo
  -- new | collecting_info | quoted | checking_availability |
  -- available | unavailable | pending_payment |
  -- payment_proof_received | confirmed | cancelled | human_handoff
  estado          TEXT DEFAULT 'new',

  -- Comprobante de pago
  comprobante_url         TEXT,
  comprobante_recibido_at TIMESTAMPTZ,

  -- Calendario
  calendar_event_id  TEXT,
  calendar_event_url TEXT,

  -- Referencias
  lead_id         BIGINT REFERENCES leads(id) ON DELETE SET NULL,

  -- Gestión interna
  origen          TEXT DEFAULT 'web',
  notas           TEXT,

  -- Timestamps de estado
  expires_at      TIMESTAMPTZ,
  confirmado_at   TIMESTAMPTZ,
  confirmado_por  TEXT,
  cancelado_at    TIMESTAMPTZ,
  cancelado_motivo TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONVERSACIONES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              BIGSERIAL PRIMARY KEY,
  canal           TEXT DEFAULT 'web',      -- web | whatsapp | email
  telefono        TEXT,
  email           TEXT,
  nombre          TEXT,
  estado          TEXT DEFAULT 'new',
  booking_id      BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
  datos           JSONB DEFAULT '{}',
  ultimo_mensaje_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FK cruzada
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL;

-- ── MENSAJES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  rol             TEXT NOT NULL,           -- user | assistant | system
  contenido       TEXT,
  tipo            TEXT DEFAULT 'text',     -- text | image | document
  archivo_url     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_fecha        ON bookings(fecha);
CREATE INDEX IF NOT EXISTS idx_bookings_estado       ON bookings(estado);
CREATE INDEX IF NOT EXISTS idx_bookings_telefono     ON bookings(telefono);
CREATE INDEX IF NOT EXISTS idx_bookings_email        ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_bookings_conversation ON bookings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expires
  ON bookings(expires_at) WHERE estado = 'pending_payment';

CREATE INDEX IF NOT EXISTS idx_conversations_telefono ON conversations(telefono);
CREATE INDEX IF NOT EXISTS idx_conversations_estado   ON conversations(estado);
CREATE INDEX IF NOT EXISTS idx_conversations_booking  ON conversations(booking_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created      ON messages(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_bookings"      ON bookings      FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "auth_all_bookings"         ON bookings      FOR ALL    TO authenticated USING (true);
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "auth_all_conversations"    ON conversations FOR ALL    TO authenticated USING (true);
CREATE POLICY "anon_insert_messages"      ON messages      FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "auth_all_messages"         ON messages      FOR ALL    TO authenticated USING (true);

-- ── TRIGGERS updated_at ───────────────────────────────────────────────────
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
