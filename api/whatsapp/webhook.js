// api/whatsapp/webhook.js
// Webhook para mensajes entrantes de WhatsApp Business API (Meta Cloud API).
// GET  /api/whatsapp/webhook → verificación del webhook (Meta lo llama al configurarlo)
// POST /api/whatsapp/webhook → mensajes entrantes
//
// Variables de entorno necesarias cuando esté el número:
//   WHATSAPP_VERIFY_TOKEN   — string que vos elegís, se configura en Meta Developers
//   WHATSAPP_ACCESS_TOKEN   — token de acceso de Meta
//   WHATSAPP_PHONE_ID       — Phone Number ID del panel de Meta
//   ANTHROPIC_API_KEY       — para el asistente IA
//
// TODO: descomentar y completar cuando esté activo el número de WhatsApp Business.

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'jtc_webhook_verify';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  // ── Verificación del webhook (GET) ────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WA webhook] Verificado correctamente');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verificación fallida' });
  }

  // ── Mensajes entrantes (POST) ─────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(200).end(); } // Siempre 200 a Meta aunque haya error

    // Meta espera respuesta 200 inmediata; procesamos asincrónicamente
    res.status(200).end();

    try {
      await processIncoming(body);
    } catch (e) {
      console.error('[WA webhook] processIncoming error:', e.message);
    }
    return;
  }

  return res.status(405).end();
}

async function processIncoming(body) {
  // Estructura del payload de Meta Cloud API
  const entry    = body.entry?.[0];
  const changes  = entry?.changes?.[0];
  const value    = changes?.value;
  const messages = value?.messages;

  if (!messages?.length) return; // Sin mensajes (puede ser status update)

  for (const msg of messages) {
    const from = msg.from; // Número del cliente (sin +)
    const type = msg.type; // text | image | document | audio | etc.

    console.log(`[WA webhook] Mensaje de ${from} tipo ${type}`);

    if (type === 'text') {
      const texto = msg.text?.body || '';
      await handleTextMessage(from, texto);
    } else if (type === 'image' || type === 'document') {
      await handleMediaMessage(from, msg);
    }
    // Otros tipos (audio, video, sticker) → ignorar o derivar a humano
  }
}

async function handleTextMessage(from, texto) {
  // TODO: implementar flujo completo cuando esté el número activo
  // 1. Cargar/crear conversación en Supabase
  // 2. Guardar mensaje en tabla messages
  // 3. Llamar a AssistantService.respond({ messages: historial })
  // 4. Según action del asistente: cotizar, verificar disponibilidad, etc.
  // 5. Responder con WhatsAppService.send()
  console.log(`[WA webhook] TODO handleTextMessage from=${from} texto="${texto}"`);
}

async function handleMediaMessage(from, msg) {
  // TODO: cuando llegue un comprobante de pago
  // 1. Descargar el archivo via WhatsApp Media API
  // 2. Subir a Supabase Storage
  // 3. Actualizar booking con comprobante_url
  // 4. Notificar al admin
  // 5. Responder al cliente confirmando recepción
  console.log(`[WA webhook] TODO handleMediaMessage from=${from} type=${msg.type}`);
}
