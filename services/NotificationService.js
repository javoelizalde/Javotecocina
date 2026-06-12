// services/NotificationService.js
// Notificaciones al admin y al cliente.
// Hoy usa Resend (email). Cuando esté el número de WA → agregar canal whatsapp acá.

import { formatPrecio } from '../config/pricing.js';
import { formatFecha }  from '../config/business.js';

const RESEND_KEY  = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'javoelizalde2001@gmail.com';
const FROM_EMAIL  = 'Javotecocina <reservas@javotecocina.com>';

export class NotificationService {
  /** Notifica al admin cuando entra una nueva reserva. */
  static async nuevaReserva(booking) {
    return this._email({
      to:      ADMIN_EMAIL,
      subject: `🔥 Nueva reserva — ${booking.nombre} · ${formatFechaCorta(booking.fecha)}`,
      html:    tplAdminReserva(booking),
    });
  }

  /** Notifica al admin cuando llega un comprobante de pago. */
  static async comprobanteRecibido(booking) {
    return this._email({
      to:      ADMIN_EMAIL,
      subject: `💰 Comprobante recibido — ${booking.nombre} · Reserva #${booking.id}`,
      html:    tplAdminComprobante(booking),
    });
  }

  /** Envía confirmación al cliente por email. */
  static async confirmacionCliente(booking) {
    if (!booking.email) return;
    return this._email({
      to:      booking.email,
      subject: `✅ Reserva confirmada — ${formatFechaCorta(booking.fecha)} · Javo Te Cocina`,
      html:    tplClienteConfirmacion(booking),
    });
  }

  static async _email({ to, subject, html }) {
    if (!RESEND_KEY) {
      console.warn('[Notification] RESEND_API_KEY no configurada — email omitido:', subject);
      return;
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      });
      if (!r.ok) console.error('[Notification] Resend error:', await r.text());
    } catch (e) {
      console.error('[Notification] Email error:', e.message);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return '—';
  const [y, m, d] = fechaStr.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`;
}

function ars(monto) { return formatPrecio(monto || 0); }

function row(label, value) {
  return `<tr>
    <td style="padding:6px 0;color:#888;width:140px;vertical-align:top">${label}</td>
    <td style="padding:6px 0;font-weight:500">${value || '—'}</td>
  </tr>`;
}

// ── Templates ─────────────────────────────────────────────────────────────

function tplAdminReserva(b) {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:2rem;border:1px solid #eee">
    <h2 style="color:#C84B11;margin:0 0 1.5rem">🔥 Nueva reserva recibida</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('Nombre',      b.nombre)}
      ${row('Teléfono',    b.telefono)}
      ${row('Email',       b.email)}
      ${row('Tipo evento', b.tipo_evento)}
      ${row('Servicio',    b.tipo_servicio)}
      ${row('Fecha',       `<strong>${formatFechaCorta(b.fecha)}</strong>`)}
      ${row('Hora',        b.hora_inicio)}
      ${row('Personas',    b.personas)}
      ${row('Ubicación',   b.ubicacion)}
      ${row('Total',       `<strong style="color:#C84B11">${ars(b.precio_total)}</strong>`)}
      ${row('Seña (50%)',  ars(b.senia))}
    </table>
    <p style="margin-top:1rem;color:#999;font-size:.82rem">Reserva #${b.id} · ${b.estado}</p>
    <a href="https://javotecocina.com/admin" style="display:inline-block;margin-top:1rem;background:#C84B11;color:#fff;padding:.65rem 1.4rem;border-radius:4px;text-decoration:none;font-weight:600">
      Ver en el admin →
    </a>
  </div>`;
}

function tplAdminComprobante(b) {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:2rem;border:1px solid #eee">
    <h2 style="color:#27AE60;margin:0 0 1rem">💰 Comprobante de pago recibido</h2>
    <p><strong>${b.nombre}</strong> envió un comprobante para la reserva del <strong>${formatFechaCorta(b.fecha)}</strong> (Reserva #${b.id}).</p>
    ${b.comprobante_url ? `<p><a href="${b.comprobante_url}" target="_blank" style="color:#C84B11">Ver comprobante →</a></p>` : ''}
    <p style="color:#666;font-size:.9rem">Revisá el comprobante y confirmá o rechazá la reserva desde el panel.</p>
    <a href="https://javotecocina.com/admin" style="display:inline-block;margin-top:1rem;background:#C84B11;color:#fff;padding:.65rem 1.4rem;border-radius:4px;text-decoration:none;font-weight:600">
      Revisar en el admin →
    </a>
  </div>`;
}

function tplClienteConfirmacion(b) {
  return `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#1A120B;padding:2rem;color:#F5EDE4">
    <h1 style="color:#E8730A;font-size:1.5rem;margin:0 0 1rem">🎉 ¡Reserva confirmada!</h1>
    <p style="margin:0 0 1.5rem">Hola <strong>${b.nombre}</strong>, tu evento quedó agendado.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:rgba(245,237,228,.55);width:140px">Fecha</td><td style="padding:6px 0;font-weight:600">${formatFechaCorta(b.fecha)}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(245,237,228,.55)">Servicio</td><td style="padding:6px 0">${b.tipo_servicio || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(245,237,228,.55)">Seña pagada</td><td style="padding:6px 0;color:#27AE60">${ars(b.senia)}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(245,237,228,.55)">Saldo pendiente</td><td style="padding:6px 0">${ars(b.saldo)}<br><small style="color:rgba(245,237,228,.35)">abonar el día del evento</small></td></tr>
    </table>
    <p style="margin-top:1.5rem;color:rgba(245,237,228,.4);font-size:.82rem">Ante cualquier consulta escribinos al +543874105902.</p>
  </div>`;
}
