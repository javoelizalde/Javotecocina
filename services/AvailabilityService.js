// services/AvailabilityService.js
import { BUSINESS, esDiaLaboral, formatFecha, NOMBRES_DIAS } from '../config/business.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://nudthkwuzhxflwirzmqd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZHRoa3d1emh4Zmx3aXJ6bXFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjkwNjAsImV4cCI6MjA5NTUwNTA2MH0.XW6BJ4NPam-KdwbSwR4giRAS03aH23G3it-8pwSWrZw';

const ESTADOS_ACTIVOS = ['confirmed', 'pending_payment', 'payment_proof_received'];

export class AvailabilityService {
  /**
   * @param {{ fecha: string, horaInicio?: string, duracionHs?: number }} params
   * @returns {{ available: boolean, razon?: string, alternativas?: string[] }}
   */
  static async check({ fecha, horaInicio, duracionHs = BUSINESS.duracionDefaultHs }) {
    if (!fecha) return { available: false, razon: 'Fecha no especificada.' };

    const conflicto = await this._conflictoBD(fecha, horaInicio, duracionHs);
    if (conflicto) {
      return {
        available:    false,
        razon:        'Ya hay un evento reservado en esa fecha y horario.',
        alternativas: await this._sugerirAlternativas(fecha),
      };
    }

    return { available: true };
  }

  static async _conflictoBD(fecha, horaInicio, duracionHs) {
    try {
      const estadosQ = ESTADOS_ACTIVOS.map(e => `"${e}"`).join(',');
      const r = await fetch(
        `${SUPA_URL}/rest/v1/bookings?fecha=eq.${fecha}&estado=in.(${estadosQ})&select=id,hora_inicio,duracion_hs`,
        { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
      );
      if (!r.ok) return false;
      const reservas = await r.json();
      if (!reservas.length) return false;
      if (!horaInicio) return true; // Sin hora definida, cualquier reserva ese día es conflicto

      const [hN, mN] = horaInicio.split(':').map(Number);
      const startN   = hN * 60 + mN;
      const endN     = startN + (duracionHs * 60);

      return reservas.some(rv => {
        if (!rv.hora_inicio) return true;
        const [h, m] = rv.hora_inicio.split(':').map(Number);
        const start  = h * 60 + m;
        const end    = start + ((rv.duracion_hs || BUSINESS.duracionDefaultHs) * 60);
        return startN < end && endN > start;
      });
    } catch {
      return false;
    }
  }

  static async _sugerirAlternativas(fechaBase) {
    const alternativas = [];
    const d = new Date(fechaBase + 'T12:00:00');
    let intentos = 0;

    while (alternativas.length < 3 && intentos < 21) {
      d.setDate(d.getDate() + 1);
      intentos++;
      const fechaStr = d.toISOString().split('T')[0];
      const conflicto = await this._conflictoBD(fechaStr, null, BUSINESS.duracionDefaultHs);
      if (!conflicto) alternativas.push(formatFecha(fechaStr));
    }

    return alternativas;
  }
}
