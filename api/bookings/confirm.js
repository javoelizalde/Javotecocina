// api/bookings/confirm.js
// Confirma manualmente una reserva (desde el admin).
// POST /api/bookings/confirm
// Requiere JWT de usuario autenticado.

import { BookingService }      from '../../services/BookingService.js';
import { NotificationService } from '../../services/NotificationService.js';
import { CalendarService }     from '../../services/CalendarService.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

const CORS = {
  'Access-Control-Allow-Origin':  'https://javotecocina.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).set(CORS).end();
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación: validar JWT de Supabase
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const user = await userRes.json();

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
