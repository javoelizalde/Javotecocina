// services/CalendarService.js
// Integración con Google Calendar.
// Variables de entorno necesarias:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID

const CLIENT_ID      = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET  = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN  = process.env.GOOGLE_REFRESH_TOKEN;
const CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID || 'primary';

export class CalendarService {
  static isConfigured() {
    return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
  }

  /** Obtiene un access token usando el refresh token. */
  static async _getAccessToken() {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });
    if (!r.ok) throw new Error(`Google OAuth error: ${await r.text()}`);
    const data = await r.json();
    return data.access_token;
  }

  /**
   * Crea un evento en Google Calendar.
   * @param {Object} booking
   * @returns {{ event_id: string, event_url: string }}
   */
  static async crearEvento(booking) {
    if (!this.isConfigured()) {
      console.warn('[CalendarService] Google Calendar no configurado — credenciales faltantes.');
      return null;
    }

    const token = await this._getAccessToken();

    const [y, m, d] = booking.fecha.split('-').map(Number);
    const [hh, mm]  = (booking.hora_inicio || '20:00').split(':').map(Number);

    const start = new Date(y, m - 1, d, hh, mm);
    const end   = new Date(start.getTime() + (booking.duracion_hs || 5) * 60 * 60 * 1000);

    const event = {
      summary:     `🍖 ${booking.tipo_servicio || 'Evento'} — ${booking.nombre}`,
      description: buildDescription(booking),
      location:    [booking.ubicacion, booking.provincia].filter(Boolean).join(', ') || undefined,
      start: { dateTime: start.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
      end:   { dateTime: end.toISOString(),   timeZone: 'America/Argentina/Buenos_Aires' },
      colorId: '6', // naranja
    };

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(event),
      }
    );

    if (!r.ok) throw new Error(`Google Calendar create error: ${await r.text()}`);

    const ev = await r.json();
    return { event_id: ev.id, event_url: ev.htmlLink };
  }

  /** Elimina un evento (al cancelar una reserva confirmada). */
  static async eliminarEvento(eventId) {
    if (!this.isConfigured() || !eventId) return;
    try {
      const token = await this._getAccessToken();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error('[CalendarService] eliminarEvento error:', e.message);
    }
  }
}

function buildDescription(b) {
  const lines = [
    `Reserva #${b.id}`,
    `Cliente: ${b.nombre}`,
    b.telefono ? `Teléfono: ${b.telefono}` : null,
    b.email    ? `Email: ${b.email}`        : null,
    `Personas: ${b.personas || '—'}`,
    b.tipo_evento ? `Tipo evento: ${b.tipo_evento}` : null,
    b.comentarios ? `Comentarios: ${b.comentarios}` : null,
    ``,
    `Precio total: ${fmtARS(b.precio_total)}`,
    `Seña pagada: ${fmtARS(b.senia)}`,
    `Saldo pendiente: ${fmtARS(b.saldo)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function fmtARS(monto) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto || 0);
}
