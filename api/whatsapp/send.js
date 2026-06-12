// api/whatsapp/send.js
// Envía mensajes salientes por WhatsApp Business API.
// POST /api/whatsapp/send  (uso interno desde otros endpoints)
//
// Variables de entorno:
//   WHATSAPP_ACCESS_TOKEN
//   WHATSAPP_PHONE_ID

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID     = process.env.WHATSAPP_PHONE_ID;
const API_BASE     = `https://graph.facebook.com/v19.0`;

export class WhatsAppService {
  static isConfigured() {
    return !!(ACCESS_TOKEN && PHONE_ID);
  }

  /**
   * Envía un mensaje de texto simple.
   * @param {string} to   — número destino con código de país, sin +  (ej: "543874105902")
   * @param {string} text — texto del mensaje (soporta *negrita* y _cursiva_ de WA)
   */
  static async sendText(to, text) {
    if (!this.isConfigured()) {
      console.warn('[WhatsApp] No configurado — mensaje no enviado a', to);
      return null;
    }

    const r = await fetch(`${API_BASE}/${PHONE_ID}/messages`, {
      method:  'POST',
      headers: {
        Authorization:   `Bearer ${ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:    'text',
        text:    { body: text, preview_url: false },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[WhatsApp] sendText error:', err);
      throw new Error(`WhatsApp API error: ${err}`);
    }

    return r.json();
  }

  /**
   * Envía un template aprobado por Meta.
   * (Necesario para iniciar conversación — primeras 24hs fuera de ventana)
   */
  static async sendTemplate(to, templateName, languageCode = 'es_AR', components = []) {
    if (!this.isConfigured()) return null;

    const r = await fetch(`${API_BASE}/${PHONE_ID}/messages`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type:     'template',
        template: { name: templateName, language: { code: languageCode }, components },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[WhatsApp] sendTemplate error:', err);
      throw new Error(`WhatsApp API error: ${err}`);
    }

    return r.json();
  }

  /**
   * Descarga un archivo multimedia (comprobante de pago, etc.)
   * @param {string} mediaId — ID del media object de Meta
   */
  static async downloadMedia(mediaId) {
    if (!this.isConfigured()) return null;

    // 1. Obtener URL de descarga
    const metaRes = await fetch(`${API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!metaRes.ok) throw new Error(`Media meta error: ${await metaRes.text()}`);
    const { url } = await metaRes.json();

    // 2. Descargar el archivo
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!fileRes.ok) throw new Error(`Media download error: ${await fileRes.text()}`);

    const buffer      = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    return { buffer: Buffer.from(buffer), contentType };
  }
}

// ── Endpoint HTTP (uso opcional, principalmente se usa como módulo) ────────

const CORS = {
  'Access-Control-Allow-Origin':  'https://javotecocina.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).set(CORS).end();
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Body inválido' }); }

  const { to, text } = body;
  if (!to || !text) return res.status(400).json({ error: 'to y text son requeridos' });

  if (!WhatsAppService.isConfigured()) {
    return res.status(503).json({
      error: 'WhatsApp no configurado. Configurá WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_ID en Vercel.',
    });
  }

  try {
    const result = await WhatsAppService.sendText(to, text);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
