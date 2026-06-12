// config/pricing.js
// Reglas de precio de Javotecocina — editá este archivo para actualizar precios.

export const PRICING = {
  // Precio mínimo por persona por evento (ARS)
  minPorPersona: 35_000,

  // Porcentaje de seña requerida (0.5 = 50%)
  seniaPorcentaje: 0.5,

  // Seña mínima absoluta independientemente del cálculo
  seniaMinima: 50_000,

  nota: 'El precio es una cotización estimada basada en el mínimo por persona. El precio final se define según los detalles específicos del evento.',

  condiciones: [
    'La fecha queda reservada únicamente al recibirse y validarse la seña del 50%.',
    'El saldo se abona el día del evento, antes del inicio del servicio.',
    'La cotización tiene validez de 48 horas.',
    'Precios en pesos argentinos (ARS).',
  ],
};

/**
 * Calcula la cotización estimada de un evento.
 * @param {{ personas: number, tipoServicio?: string, duracionHs?: number }} params
 * @returns {{ personas, tipoServicio, precioTotal, senia, saldo, moneda, nota, condiciones } | { error: string }}
 */
export function calcularCotizacion({ personas, tipoServicio, duracionHs } = {}) {
  const n = parseInt(personas, 10);
  if (!n || n < 1) return { error: 'Se necesita la cantidad de personas para cotizar.' };

  const precioTotal = n * PRICING.minPorPersona;
  const senia       = Math.max(precioTotal * PRICING.seniaPorcentaje, PRICING.seniaMinima);
  const saldo       = precioTotal - senia;

  return {
    personas:     n,
    tipoServicio: tipoServicio || 'No especificado',
    duracionHs:   duracionHs  || 5,
    precioTotal,
    senia,
    saldo,
    moneda:     'ARS',
    nota:       PRICING.nota,
    condiciones: PRICING.condiciones,
  };
}

export function formatPrecio(monto, moneda = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: moneda, minimumFractionDigits: 0,
  }).format(monto);
}
