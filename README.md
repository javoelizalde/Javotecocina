# javotecocina.com

Sitio web completo de Javo Te Cocina — cocinero apasionado de Salta, Argentina.

---

## Estructura del repositorio

```
javotecocina/
├── public/
│   ├── index.html          ← el sitio entero
│   └── img/                ← tus 35 fotos (p01.jpg – p35.jpg)
├── api/
│   └── create_preference.js ← función de Mercado Pago (Vercel serverless)
├── vercel.json             ← configuración de Vercel
├── setup_supabase.sql      ← crea las tablas en Supabase
└── README.md
```

---

## NEXT STEPS — en orden

### 1. Crear el repositorio en GitHub (5 min)

1. Andá a https://github.com/new
2. Repository name: `javotecocina`
3. Visibility: **Private** (recomendado)
4. NO marques "Add a README" — ya tenemos uno
5. Click **Create repository**
6. GitHub te muestra comandos. Desde tu computadora:

```bash
# Si no tenés Git, descargá desde https://git-scm.com
git init
git add .
git commit -m "primer commit — javotecocina.com"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/javotecocina.git
git push -u origin main
```

> **Alternativa sin terminal:** Usá GitHub Desktop (https://desktop.github.com)
> → File → Add Local Repository → elegí la carpeta → Publish repository

---

### 2. Conectar Vercel con GitHub (10 min)

1. Andá a https://vercel.com → **Sign up with GitHub**
2. Click **Add New → Project**
3. Buscá `javotecocina` en la lista → **Import**
4. Framework Preset: **Other**
5. Root Directory: dejar vacío (usa la raíz)
6. Click **Deploy**
7. En 2 minutos tenés `javotecocina.vercel.app` funcionando ✓

---

### 3. Agregar tu dominio javotecocina.com (15 min)

En Vercel → tu proyecto → **Settings → Domains**:
1. Escribí `javotecocina.com` → Add
2. Vercel te da dos registros DNS para copiar:
   - Un registro **A**: `76.76.21.21`
   - Un registro **CNAME**: `cname.vercel-dns.com`
3. Andá al panel de tu registrador de dominio (GoDaddy, NIC.ar, Namecheap, etc.)
4. DNS → agregar esos dos registros
5. En 5-30 minutos el dominio apunta a tu sitio ✓

---

### 4. Variables de entorno en Vercel (después de configurar cada servicio)

Vercel → tu proyecto → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `MP_ACCESS_TOKEN` | Tu token de Mercado Pago (empieza con `APP_USR-`) |

Después de agregar → **Redeploy** para que tome efecto.

---

### 5. EmailJS — mails automáticos (15 min)

1. https://emailjs.com → crear cuenta gratis
2. **Email Services → Add New Service → Gmail** → conectá `javoelizalde2001@gmail.com`
   → te da un **Service ID** (ej: `service_abc123`)
3. **Email Templates → Create New**:
   - Subject: `{{subject}}`
   - Body: `{{message}}`
   - To: `{{to_email}}`
   → te da un **Template ID** (ej: `template_xyz789`)
4. **Account → API Keys** → copiá la **Public Key**
5. Abrí `public/index.html`, buscá el bloque `CONFIG` arriba del todo y reemplazá los tres valores

---

### 6. CallMeBot — WhatsApp automático (5 min)

1. En WhatsApp, guardá el número **+34 644 71 47 88** como contacto
2. Mandá el mensaje exacto: `I allow callmebot to send me messages`
3. En unos minutos te responden con tu **apikey** (ej: `1234567`)
4. En `index.html`, CONFIG → reemplazá `CALLMEBOT_APIKEY`

---

### 7. Supabase — base de datos (20 min)

1. https://supabase.com → crear cuenta gratis
2. **New Project** → nombre: `javotecocina` → región: South America (São Paulo)
3. Esperá 2-3 minutos que se cree
4. **SQL Editor → New Query** → pegá todo el contenido de `setup_supabase.sql` → **Run**
5. **Settings → API** → copiá:
   - **Project URL** → `SUPABASE_URL` en CONFIG
   - **anon public key** → `SUPABASE_ANON_KEY` en CONFIG

Para ver tus consultas: Supabase → **Table Editor** → tabla `consultas`

---

### 8. Mercado Pago — pagos reales (30 min)

1. https://mercadopago.com.ar/developers → **Crear aplicación**
2. Nombre: `javotecocina`
3. **Credenciales de producción** → copiá el **Access Token** (`APP_USR-...`)
4. En Vercel → Settings → Environment Variables → `MP_ACCESS_TOKEN` = tu token
5. **Redeploy** → ¡listo! Los botones de compra redirigen al checkout real de MP

**Para probar primero:** usá el token de TEST (`TEST-...`) y las tarjetas de prueba:
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/test-integration

---

## Cómo actualizar el sitio después

```bash
# Hacé tus cambios en los archivos
git add .
git commit -m "descripción del cambio"
git push
```
Vercel detecta el push y redespliega automáticamente en ~1 minuto. ✓

---

## Cómo cambiar fotos

- Las fotos están en `public/img/` con nombres `p01.jpg` a `p35.jpg`
- Para reemplazar: subí tu foto nueva con el mismo nombre
- Para agregar: subí con nombre nuevo (ej: `p36.jpg`) y usá ese src en el HTML

## Cómo agregar un video de YouTube

En el HTML, reemplazá una `<img>` por:
```html
<iframe src="https://www.youtube.com/embed/ID_DEL_VIDEO"
  width="100%" height="400" frameborder="0" allowfullscreen></iframe>
```
El ID es lo que va después de `?v=` en la URL de YouTube.

---

## Contacto & soporte

- Email: javoelizalde2001@gmail.com
- WhatsApp: +543874105902
