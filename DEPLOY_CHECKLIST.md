# Checklist de deploy — Entrega digital post-compra

## 1. Base de datos: ejecutar migración

Abrí **Supabase → SQL Editor** y ejecutá el contenido de `sql/migration_compras_v2.sql`.

Esto agrega a la tabla `compras`:
- `estado` (pending / approved / rejected)
- `entrega` (not_delivered / delivered)
- `email_enviado_at`
- `email_error`
- `monto`, `moneda`
- `metadata`
- Índice único en `payment_id` (idempotencia garantizada a nivel BD)
- Policy de UPDATE para que el backend pueda actualizar filas

---

## 2. Variables de entorno en Vercel

Ve a **Vercel → tu proyecto → Settings → Environment Variables** y verificá que existan:

| Variable            | Requerida | Descripción                                              |
|---------------------|-----------|----------------------------------------------------------|
| `MP_ACCESS_TOKEN`   | ✅ Sí     | Token de MercadoPago producción (`APP_USR-...`)          |
| `SUPABASE_URL`      | Opcional  | `https://nudthkwuzhxflwirzmqd.supabase.co` (hay fallback)|
| `SUPABASE_ANON_KEY` | Opcional  | La anon key de Supabase (hay fallback hardcodeado)       |
| `RESEND_API_KEY`    | Para email| Token de Resend (`re_...`). Sin esto, no se envían emails|

> Si `SUPABASE_URL` y `SUPABASE_ANON_KEY` no están configuradas, el backend usa los
> valores hardcodeados (igual que el frontend). Esto es seguro porque son credenciales
> públicas de Supabase (anon key).

---

## 3. Configurar Resend para emails (opcional pero recomendado)

1. Crear cuenta en [resend.com](https://resend.com)
2. Verificar el dominio `javotecocina.com` (agregar registros DNS que Resend indica)
3. Copiar el API Key (`re_...`) y agregarlo en Vercel como `RESEND_API_KEY`
4. El `from` del email está configurado como `recetarios@javotecocina.com`

> Sin `RESEND_API_KEY`, las compras se guardan correctamente pero no se envían emails.
> El error se logea en los logs de Vercel pero no rompe la compra.

---

## 4. Configurar notificaciones IPN en MercadoPago

La `notification_url` ya está configurada en `create_preference.js`:
```
https://javotecocina.com/api/record_purchase
```

Si usás el panel de MP para configurar webhooks/IPN adicionales, apuntá a esa URL.

---

## 5. Flujo completo tras el deploy

1. Usuario hace click en "Comprar" en un recetario
2. Si no está logueado → modal de login/registro
3. Se crea preferencia en MP con `external_reference = "slug:::email@registrado.com"`
4. Usuario paga en MercadoPago
5. **Webhook (principal)**: MP notifica a `/api/record_purchase` → guarda compra con `estado=approved`
6. **Redirect (backup)**: Usuario llega a `/compra-exitosa` → también intenta guardar la compra
7. Usuario vuelve al home → banner "¡Pago aprobado! Ver mis compras →"
8. Usuario abre "Mis compras" → ve el recetario comprado con badge "Aprobado"
9. Hace click "Descargar PDF" → valida compra via `/api/download_pdf` → abre el PDF
10. Usuario recibe email con confirmación y link a "Mis compras"

---

## 6. Casos manejados

| Caso                              | Comportamiento                                               |
|-----------------------------------|--------------------------------------------------------------|
| Webhook duplicado                 | Idempotente: UNIQUE INDEX en payment_id evita duplicados     |
| Email duplicado                   | Se chequea `email_enviado_at` antes de enviar                |
| Usuario cierra pestaña al pagar   | Webhook de MP guarda la compra igual                         |
| Email MP ≠ email Javotecocina     | Se usa el email de `external_reference` (el registrado)      |
| PDF no cargado aún                | Mensaje claro: "PDF próximamente disponible"                  |
| Pago pendiente/rechazado          | No libera PDF, muestra estado en "Mis compras"               |
| Usuario vuelve días después       | La compra persiste en Supabase, sigue visible en Mis Compras |
| Usuario no comprador intenta bajar| `/api/download_pdf` devuelve 403                             |

---

## 7. Archivos modificados en este deploy

| Archivo                          | Cambio                                                        |
|----------------------------------|---------------------------------------------------------------|
| `api/create_preference.js`       | `external_reference` ahora incluye email del comprador       |
| `api/record_purchase.js`         | Reescrito: fix email, Supabase fallback, emails, idempotencia|
| `api/verify_purchase.js`         | Devuelve `foto_url`, `estado`, `entrega`; valida JWT          |
| `api/download_pdf.js`            | **NUEVO**: descarga segura con validación de compra          |
| `public/compra-exitosa.html`     | UX mejorada, parsea external_reference, mejor feedback       |
| `public/index.html`              | Mis Compras con estados, skeleton loader, descarga segura    |
| `sql/migration_compras_v2.sql`   | **NUEVO**: migración de columnas y policies                  |
