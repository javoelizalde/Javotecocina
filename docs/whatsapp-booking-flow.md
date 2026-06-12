# Sistema de reservas y atención por WhatsApp — Javotecocina

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `RESEND_API_KEY` | Recomendada | Notificaciones por email al admin y al cliente |
| `ADMIN_EMAIL` | Opcional | Email donde llegan las notificaciones (default: javoelizalde2001@gmail.com) |
| `ANTHROPIC_API_KEY` | Para IA | Asistente conversacional (claude-haiku) |
| `WHATSAPP_VERIFY_TOKEN` | Para WA | String que vos elegís, se configura en Meta Developers |
| `WHATSAPP_ACCESS_TOKEN` | Para WA | Token de acceso de Meta Cloud API |
| `WHATSAPP_PHONE_ID` | Para WA | Phone Number ID del panel de Meta |
| `GOOGLE_CLIENT_ID` | Para calendario | Google Cloud Console → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | Para calendario | Google Cloud Console → OAuth 2.0 |
| `GOOGLE_REFRESH_TOKEN` | Para calendario | Script de autorización (ver sección Google Calendar) |
| `GOOGLE_CALENDAR_ID` | Para calendario | ID del calendario (o "primary") |

---

## Cómo configurar WhatsApp Business API

> **Prerequisito:** necesitás un número de teléfono que NO esté activo en WhatsApp normal o Business App. Una SIM prepaga nueva alcanza.

1. Crear cuenta en [Meta for Developers](https://developers.facebook.com)
2. Crear una app de tipo "Business"
3. Agregar el producto "WhatsApp"
4. Registrar el número de teléfono (recibirás un SMS o llamada para verificar)
5. En el panel de WhatsApp → Configuration → Webhook:
   - URL: `https://javotecocina.com/api/whatsapp/webhook`
   - Verify Token: el valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscribir a: `messages`
6. Copiar `Phone Number ID` y `Access Token` a las variables de entorno de Vercel
7. Para producción: generar un token permanente (System User Token) en Meta Business Suite

---

## Cómo configurar Google Calendar

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un proyecto o usar uno existente
3. Habilitar la API: "Google Calendar API"
4. Crear credenciales: OAuth 2.0 → Desktop App
5. Descargar el JSON de credenciales
6. Ejecutar este script una sola vez para obtener el refresh_token:

```bash
node scripts/google-auth.js
```

_(crear `scripts/google-auth.js` con el flujo OAuth2 de Google — sigue el prompt en la terminal)_

7. Copiar `client_id`, `client_secret` y `refresh_token` a Vercel
8. En Google Calendar → Settings del calendario → copiar el Calendar ID

---

## Cómo editar precios

Editá `config/pricing.js`:

```js
export const PRICING = {
  minPorPersona: 35_000,     // precio mínimo por persona (ARS)
  seniaPorcentaje: 0.5,      // 50% de seña
  seniaMinima: 50_000,       // seña mínima absoluta
  // ...
};
```

Para agregar lógica por tipo de servicio, editá la función `calcularCotizacion()` en el mismo archivo.

---

## Cómo revisar y confirmar comprobantes

1. Abrí el admin en `javotecocina.com/admin`
2. Ir a la sección **Reservas**
3. Las reservas con comprobante recibido aparecen con el badge `COMPROBANTE RECIBIDO`
4. Click en la reserva → ver el comprobante → hacer clic en **Confirmar** o **Rechazar**
5. Al confirmar: se crea el evento en Google Calendar y se envía email de confirmación al cliente

---

## Flujo completo de una reserva

```
Cliente llena /cotizar o escribe por WhatsApp
  ↓
POST /api/bookings/create
  ↓ cotiza (precio estimado)
  ↓ verifica disponibilidad
  ↓ crea reserva con estado: pending_payment
  ↓ envía email al admin
  ↓
Admin/cliente manda comprobante
  ↓
Booking actualiza a: payment_proof_received
  ↓ envía email al admin para revisión
  ↓
Admin confirma desde panel
  ↓
POST /api/bookings/confirm
  ↓ estado: confirmed
  ↓ crea evento en Google Calendar
  ↓ envía email de confirmación al cliente
```

---

## Estados de una reserva

| Estado | Descripción |
|---|---|
| `new` | Reserva recién creada |
| `pending_payment` | Esperando seña (tiene tiempo de expiración) |
| `payment_proof_received` | Comprobante recibido, pendiente de revisión |
| `confirmed` | Confirmada manualmente por el admin |
| `cancelled` | Cancelada o rechazada |
| `human_handoff` | Derivada a atención manual |

---

## Cómo probar el flujo localmente

```bash
# Instalar dependencias (si hay alguna)
npm install

# Levantar servidor local
npx vercel dev

# Crear una reserva de prueba
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test Cliente",
    "telefono": "1122334455",
    "tipo_evento": "cumpleaños",
    "tipo_servicio": "Asado / Parrilla",
    "fecha": "2026-08-15",
    "hora_inicio": "20:00",
    "personas": 50,
    "ubicacion": "Palermo, CABA"
  }'
```

---

## Archivos del sistema

```
config/
  pricing.js       ← reglas de precio (editables)
  messages.js      ← plantillas de mensajes (editables)
  business.js      ← datos del negocio (días, servicios, etc.)

services/
  PricingService.js       ← calcula cotizaciones
  AvailabilityService.js  ← verifica disponibilidad
  BookingService.js       ← CRUD de reservas
  NotificationService.js  ← emails (Resend)
  CalendarService.js      ← Google Calendar
  AssistantService.js     ← IA conversacional (Claude)

api/
  bookings/
    create.js    ← POST /api/bookings/create
    confirm.js   ← POST /api/bookings/confirm  (requiere auth)
    reject.js    ← POST /api/bookings/reject   (requiere auth)
  whatsapp/
    webhook.js   ← GET+POST /api/whatsapp/webhook
    send.js      ← POST /api/whatsapp/send

sql/
  migration_bookings.sql  ← ejecutar en Supabase SQL Editor
```
