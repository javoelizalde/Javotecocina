// api/bookings/create.js
// Crea una reserva: cotiza → verifica disponibilidad → guarda como pending_payment
// POST /api/bookings/create

import { PricingService }      from '../../services/PricingService.js';
import { AvailabilityService } from '../../services/AvailabilityService.js';
import { BookingService }      from '../../services/BookingService.js';
import { NotificationService } from '../../services/NotificationService.js';
import { MESSAGES }            from '../../config/messages.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).set(CORS).end();
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body inválido' }); }

  const { nombre, telefono, email, tipo_evento, tipo_servicio, fecha, hora_inicio,
          duracion_hs, ubicacion, provincia, personas, comentarios, origen } = body;

  // Validación mínima
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
  if (!fecha)  return res.status(400).json({ error: 'fecha es requerida' });

  // Limpiar reservas provisorias vencidas (oportunístico)
  BookingService.limpiarVencidas().catch(() => {});

  // 1. Cotización
  const cotizacion = PricingService.cotizar({ personas, tipoServicio: tipo_servicio });
  if (cotizacion?.error && personas) {
    return res.status(400).json({ error: cotizacion.error });
  }
  const cotizacionFmt = cotizacion?.error ? null : PricingService.formatear(cotizacion);

  // 2. Disponibilidad
  const disponibilidad = await AvailabilityService.check({ fecha, horaInicio: hora_inicio, duracionHs: duracion_hs });

  if (!disponibilidad.available) {
    return res.status(200).json({
      ok:           false,
      available:    false,
      razon:        disponibilidad.razon,
      alternativas: disponibilidad.alternativas || [],
      cotizacion:   cotizacionFmt,
      message:      MESSAGES.fechaNoDisponible(fecha, disponibilidad.alternativas),
    });
  }

  // 3. Crear reserva provisoria
  let booking;
  try {
    booking = await BookingService.crear({
      nombre, telefono, email, tipo_evento, tipo_servicio,
      fecha, hora_inicio, duracion_hs, ubicacion, provincia,
      personas, comentarios, origen: origen || 'web',
      precio_total: cotizacionFmt?.precioTotal || null,
      senia:        cotizacionFmt?.senia       || null,
      saldo:        cotizacionFmt?.saldo       || null,
    });
  } catch (e) {
    console.error('[bookings/create] BookingService error:', e.message);
    return res.status(500).json({ error: 'Error al crear la reserva' });
  }

  // 4. Notificar al admin
  NotificationService.nuevaReserva(booking).catch(() => {});

  return res.status(200).json({
    ok:        true,
    available: true,
    booking: {
      id:     booking.id,
      estado: booking.estado,
      expires_at: booking.expires_at,
    },
    cotizacion: cotizacionFmt,
    pago: {
      alias: 'javiermelizalde',
      cuil:  '24-43549743-4',
    },
    message: cotizacionFmt
      ? MESSAGES.fechaDisponible(fecha, hora_inicio)
      : `✅ Fecha disponible para el ${fecha}. Completá los datos para cotizar.`,
  });
}
