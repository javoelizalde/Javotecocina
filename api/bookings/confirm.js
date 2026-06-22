// api/bookings/confirm.js
// Confirma manualmente una reserva (desde el admin).
// POST /api/bookings/confirm
// Requiere JWT de usuario autenticado.

import { BookingService }      from '../../services/BookingService.js';
import { NotificationService } from '../../services/NotificationService.js';
import { CalendarService }     from '../../services/CalendarService.js';
import { verifyAdmin }         from '../../services/AdminAuth.js';

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
  const user = await verifyAdmin(req);
  if (!user) return res.status(401).json({ error: 'No autorizado. Iniciá sesión con la cuenta de administrador.' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body inválido' }); }

  const { booking_id } = body;
  if (!booking_id) return res.status(400).json({ error: 'booking_id requerido' });

  const booking = await BookingService.getById(booking_id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

  if (booking.estado === 'confirmed') {
    return res.status(409).json({ error: 'La reserva ya está confirmada' });
  }

  // Crear evento en Google Calendar
  let calendarResult = null;
  try {
    calendarResult = await CalendarService.crearEvento(booking);
  } catch (e) {
    console.error('[bookings/confirm] Calendar error:', e.message);
    // No bloqueamos la confirmación si el calendario falla
  }

  // Confirmar reserva
  const confirmed = await BookingService.confirmar(booking_id, {
    confirmado_por:    user.email || 'admin',
    calendar_event_id: calendarResult?.event_id  || null,
    calendar_event_url: calendarResult?.event_url || null,
  });

  // Notificar al cliente por email
  NotificationService.confirmacionCliente(confirmed).catch(() => {});

  return res.status(200).json({
    ok:      true,
    booking: confirmed,
    calendar: calendarResult,
  });
}
