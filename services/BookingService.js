// services/BookingService.js
import { BUSINESS } from '../config/business.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

async function supaFetch(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      apikey:          SUPA_KEY,
      Authorization:   `Bearer ${SUPA_KEY}`,
      Prefer:          'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

export class BookingService {
  /**
   * Crea una reserva provisoria (pending_payment) con vencimiento.
   */
  static async crear(datos) {
    const expires_at = new Date(
      Date.now() + BUSINESS.reservaVencimientoMinutos * 60 * 1000
    ).toISOString();

    const rows = await supaFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        nombre:        datos.nombre,
        telefono:      datos.telefono      || null,
        email:         datos.email         || null,
        tipo_evento:   datos.tipo_evento   || null,
        tipo_servicio: datos.tipo_servicio || null,
        fecha:         datos.fecha,
        hora_inicio:   datos.hora_inicio   || null,
        duracion_hs:   datos.duracion_hs   || BUSINESS.duracionDefaultHs,
        ubicacion:     datos.ubicacion     || null,
        provincia:     datos.provincia     || null,
        personas:      datos.personas      || null,
        comentarios:   datos.comentarios   || null,
        precio_total:  datos.precio_total  || null,
        senia:         datos.senia         || null,
        saldo:         datos.saldo         || null,
        estado:        'pending_payment',
        origen:        datos.origen        || 'web',
        lead_id:       datos.lead_id       || null,
        conversation_id: datos.conversation_id || null,
        expires_at,
      }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  static async actualizarEstado(id, estado, extra = {}) {
    const rows = await supaFetch(`/bookings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, updated_at: new Date().toISOString(), ...extra }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  static async getById(id) {
    const rows = await supaFetch(`/bookings?id=eq.${id}&select=*`, { method: 'GET', headers: { Prefer: '' } });
    return rows[0] || null;
  }

  static async listar({ estado, limit = 50, offset = 0 } = {}) {
    let path = `/bookings?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (estado) path += `&estado=eq.${estado}`;
    return supaFetch(path, { method: 'GET', headers: { Prefer: '' } });
  }

  /** Cancela reservas provisorias vencidas (llamar desde un cron o al inicio de cada request). */
  static async limpiarVencidas() {
    const now = new Date().toISOString();
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/bookings?estado=eq.pending_payment&expires_at=lt.${now}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey:         SUPA_KEY,
            Authorization:  `Bearer ${SUPA_KEY}`,
          },
          body: JSON.stringify({
            estado:          'cancelled',
            cancelado_motivo: 'Reserva provisoria vencida sin pago',
            cancelado_at:    now,
          }),
        }
      );
    } catch (e) {
      console.error('[BookingService] limpiarVencidas error:', e.message);
    }
  }

  /** Registra recepción de comprobante. */
  static async recibirComprobante(id, comprobiante_url) {
    return this.actualizarEstado(id, 'payment_proof_received', {
      comprobante_url,
      comprobante_recibido_at: new Date().toISOString(),
    });
  }

  /** Confirma la reserva manualmente (desde admin). */
  static async confirmar(id, { confirmado_por, calendar_event_id, calendar_event_url } = {}) {
    return this.actualizarEstado(id, 'confirmed', {
      confirmado_at:     new Date().toISOString(),
      confirmado_por:    confirmado_por || 'admin',
      calendar_event_id: calendar_event_id || null,
      calendar_event_url: calendar_event_url || null,
      expires_at:        null,
    });
  }

  /** Rechaza/cancela una reserva. */
  static async cancelar(id, motivo = '') {
    return this.actualizarEstado(id, 'cancelled', {
      cancelado_at:     new Date().toISOString(),
      cancelado_motivo: motivo,
    });
  }
}
