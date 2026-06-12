// services/AssistantService.js
// Asistente conversacional con IA (Groq API — Llama 3.3 70B).
// Variable de entorno: GROQ_API_KEY

import { BUSINESS } from '../config/business.js';
import { PRICING }  from '../config/pricing.js';

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL    = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `
Sos el asistente virtual de Javo Te Cocina, un cocinero profesional de Salta, Argentina.
Tu trabajo es atender consultas, recopilar datos para cotizar eventos y guiar al cliente en el proceso de reserva.

TONO: Claro, cálido y profesional. Español rioplatense. Sin tuteo formal, sin "usted". Tuteo natural ("vos", "te", "tenés").
BREVEDAD: Respuestas cortas. Pedí los datos de a uno o en grupos pequeños para no abrumar.

SERVICIOS QUE OFRECE JAVO:
${BUSINESS.servicios.map(s => `- ${s}`).join('\n')}

ZONA DE COBERTURA: Argentina completa.

DÍAS DE ATENCIÓN: jueves, viernes, sábado y domingo. No hay servicio los lunes, martes ni miércoles.

DURACIÓN TÍPICA: ${BUSINESS.duracionDefaultHs} horas.

PRECIOS:
- Precio mínimo: $${PRICING.minPorPersona.toLocaleString('es-AR')} por persona.
- La cotización es estimada. El precio final se define según los detalles del evento.
- Se requiere una seña del 50% para confirmar la fecha.

DATOS DE PAGO (para la seña):
- Alias: javiermelizalde
- CUIL: 24-43549743-4

DATOS PARA COTIZAR (recopilar en la conversación):
1. Nombre del cliente
2. Tipo de evento (cumpleaños, corporativo, aniversario, casamiento, etc.)
3. Fecha del evento
4. Hora de inicio aproximada
5. Duración estimada
6. Ubicación / salón / zona
7. Cantidad de personas
8. Tipo de servicio deseado
9. Comentarios adicionales
10. Teléfono o email de contacto

FLUJO:
1. Saludo → preguntar tipo de evento, fecha y personas (los 3 datos más importantes).
2. Con esos 3 datos podés calcular una cotización estimada.
3. Luego chequeás disponibilidad en la fecha pedida.
4. Si hay disponibilidad → enviás datos de pago de la seña.
5. Cliente manda comprobante → confirmás recepción y avisás que queda pendiente de revisión manual.
6. NO confirmés la reserva automáticamente. Siempre queda pendiente de validación manual.

DERIVAR A HUMANO cuando:
- El cliente pida hablar con Javo directamente.
- No entiendas la consulta después de 2 intentos.
- Haya algún conflicto o situación especial.
- El comprobante no sea claro.
- Preguntas sobre precios específicos o condiciones no estándar.

NUNCA:
- Inventes disponibilidad que no fue verificada.
- Confirmes precios fijos sin aclarar que son estimados.
- Prometas que la fecha está reservada antes de recibir la seña validada.
- Respondas en otro idioma que no sea español.

Al final de cada respuesta, si corresponde, devolvé también un bloque JSON con la acción a tomar:
\`\`\`action
{ "action": "COLLECT_INFO" | "CALCULATE_QUOTE" | "CHECK_AVAILABILITY" | "SEND_PAYMENT_INFO" | "RECEIVE_PROOF" | "HUMAN_HANDOFF" | "NONE", "data": {} }
\`\`\`
`.trim();

export class AssistantService {
  /**
   * Genera una respuesta del asistente.
   * @param {{ messages: Array<{role, content}>, extraContext?: string }} params
   * @returns {{ reply: string, action: string, data: object }}
   */
  static async respond({ messages, extraContext }) {
    if (!GROQ_KEY) {
      console.warn('[AssistantService] GROQ_API_KEY no configurada.');
      return {
        reply:  'En este momento no puedo procesar tu consulta. Escribinos directamente al +543874105902.',
        action: 'HUMAN_HANDOFF',
        data:   {},
      };
    }

    const systemFinal = extraContext
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO ADICIONAL:\n${extraContext}`
      : SYSTEM_PROMPT;

    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 1024,
          messages:   [
            { role: 'system', content: systemFinal },
            ...messages.slice(-20),
          ],
        }),
      });

      if (!r.ok) {
        const err = await r.text();
        console.error('[AssistantService] Groq error:', err);
        return { reply: FALLBACK_REPLY, action: 'HUMAN_HANDOFF', data: {} };
      }

      const resp   = await r.json();
      const full   = resp.choices?.[0]?.message?.content || '';
      const parsed = parseAction(full);

      return parsed;
    } catch (e) {
      console.error('[AssistantService] Error:', e.message);
      return { reply: FALLBACK_REPLY, action: 'HUMAN_HANDOFF', data: {} };
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

const FALLBACK_REPLY = 'Ocurrió un problema. Escribinos directamente al +543874105902.';

function parseAction(text) {
  const match = text.match(/```action\s*([\s\S]*?)```/);
  let action = 'NONE';
  let data   = {};

  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      action = parsed.action || 'NONE';
      data   = parsed.data   || {};
    } catch { /* ignorar JSON malformado */ }
  }

  const reply = text.replace(/```action[\s\S]*?```/g, '').trim();
  return { reply, action, data };
}
