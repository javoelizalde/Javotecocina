// api/bookings/reject.js
// Rechaza/cancela una reserva (desde el admin).
// POST /api/bookings/reject
// Requiere JWT de usuario autenticado.

import { BookingService }  from '../../services/BookingService.js';
import { CalendarService } from '../../services/CalendarService.js';
import { verifyAdmin }     from '../../services/AdminAuth.js';

const CORS = {
  'Access-Control-Allow-Origin':  'https://javotecocina.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).set(CORS).end();
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación + autorización: debe ser un admin de la allowlist
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado. Iniciá sesión con la cuenta de administrador.' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body inválido' }); }

  const { booking_id, motivo } = body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id requerido' });

  const booking = await BookingService.getById(booking_id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

  // Si estaba confirmada y tenía evento en calendario, eliminarlo
  if (booking.estado === 'confirmed' && booking.calendar_event_id) {
    CalendarService.eliminarEvento(booking.calendar_event_id).catch(() => {});
  }

  const cancelled = await BookingService.cancelar(booking_id, motivo || 'Rechazado por el admin');

  return res.status(200).json({ ok: true, booking: cancelled });
}
