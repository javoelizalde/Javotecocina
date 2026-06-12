// config/messages.js
// Plantillas de mensajes del asistente — editá este archivo para cambiar los textos.

import { formatPrecio } from './pricing.js';

export const MESSAGES = {
  bienvenida: (nombre) =>
    nombre
      ? `¡Hola, ${nombre}! Soy el asistente de Javo Te Cocina. ¿En qué puedo ayudarte?`
      : `¡Hola! Soy el asistente de Javo Te Cocina. ¿En qué puedo ayudarte?`,

  pedidoDatos: `Para prepararte una cotización necesito algunos datos: ¿qué tipo de evento es, para cuándo lo tenés pensado y cuántas personas aproximadamente asistirían?`,

  cotizacion: ({ nombre, tipoServicio, fecha, personas, precioTotal, senia, saldo, nota }) =>
    `¡Listo, ${nombre}! Con esos datos, la cotización estimada es:\n\n` +
    `🍖 *Servicio:* ${tipoServicio}\n` +
    `📅 *Fecha:* ${fecha}\n` +
    `👥 *Personas:* ${personas}\n\n` +
    `💰 *Total estimado:* ${formatPrecio(precioTotal)}\n` +
    `🤝 *Seña (50%):* ${formatPrecio(senia)}\n` +
    `📌 *Saldo restante:* ${formatPrecio(saldo)}\n\n` +
    `_${nota}_\n\nAhora chequeo disponibilidad para esa fecha, un momento...`,

  fechaDisponible: (fecha, hora) =>
    `✅ ¡Tenemos disponibilidad para el ${fecha}${hora ? ` a las ${hora}` : ''}!\n\n` +
    `Para reservar la fecha necesitás abonar la seña del 50%. Te paso los datos de pago.`,

  datosPago: () =>
    `🏦 *Datos de transferencia:*\n` +
    `• Alias: *javiermelizalde*\n` +
    `• CUIL: 24-43549743-4\n\n` +
    `Una vez hecha la transferencia, mandame el comprobante por acá y te reservo la fecha.`,

  fechaNoDisponible: (fecha, alternativas) => {
    let msg = `❌ La fecha ${fecha} no tiene disponibilidad.\n\n`;
    if (alternativas?.length) {
      msg += `Estas fechas cercanas están libres:\n`;
      alternativas.forEach(f => { msg += `• ${f}\n`; });
      msg += `\n¿Alguna te viene bien?`;
    } else {
      msg += `¿Tenés alguna otra fecha en mente?`;
    }
    return msg;
  },

  comprobiante_recibido: (nombre) =>
    `¡Gracias, ${nombre}! Recibí el comprobante. Lo dejo pendiente de revisión y en cuanto se valide te confirmo la reserva.`,

  confirmacion: ({ nombre, fecha, hora, tipoServicio, precioTotal, senia, saldo }) =>
    `🎉 *¡Reserva confirmada, ${nombre}!*\n\n` +
    `Tu evento quedó agendado:\n` +
    `📅 *Fecha:* ${fecha}${hora ? ` a las ${hora}` : ''}\n` +
    `🍖 *Servicio:* ${tipoServicio}\n\n` +
    `💰 *Total:* ${formatPrecio(precioTotal)}\n` +
    `✅ *Seña recibida:* ${formatPrecio(senia)}\n` +
    `📌 *Saldo pendiente:* ${formatPrecio(saldo)} _(abonar el día del evento)_\n\n` +
    `¡Muchas gracias! Cualquier consulta escribime.`,

  derivacionHumano:
    `Entendido, voy a pasarte con Javo para que te responda directamente. Se va a comunicar con vos a la brevedad.`,

  rechazoComprobante:
    `El comprobante no pudo verificarse. Por favor revisá que sea legible y volvelo a enviar, o escribinos al +543874105902.`,

  reservaVencida:
    `La reserva provisoria venció sin recibir la seña. Si todavía te interesa, podemos volver a verificar disponibilidad.`,

  errorGenerico:
    `Ocurrió un problema. Escribinos directamente al +543874105902 y te ayudamos.`,
};
