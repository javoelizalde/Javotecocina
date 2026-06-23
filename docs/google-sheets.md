# Datos vivos desde Google Sheets (métricas + marcas)

La sección **"Quién soy"** de la home lee sus **métricas** y **marcas** desde un Google
Sheet editable, para que Javo pueda actualizarlas sin tocar código. Si el Sheet no está
configurado o no responde, la web usa los valores embebidos en el HTML como fallback
(nunca se rompe).

- Endpoint: [`/api/site_data`](../api/site_data.js) (Vercel function, server-side).
- Front: `loadSiteData()` en `public/index.html` (re-renderiza `#aboutNumbers` y `#aboutBrands`).
- Cache: 5 min en el edge de Vercel + 10 min stale-while-revalidate.

> **Yo (Claude) no pude crear el Sheet real**: este entorno no tiene acceso autorizado a
> Google Drive/Sheets. Abajo está el paso a paso para crearlo en 5 minutos. Las plantillas
> `metricas.csv` y `marcas.csv` (en esta carpeta) ya traen los valores actuales: alcanza con
> importarlas.

---

## 1. Crear el Google Sheet

1. Entrá a [sheets.new](https://sheets.new) y creá un spreadsheet (ej: "Javotecocina — datos web").
2. Creá **dos pestañas** con estos nombres exactos (en minúscula): `metricas` y `marcas`.
3. En cada pestaña, importá el CSV correspondiente de esta carpeta
   (`Archivo → Importar → Subir → metricas.csv`, opción "Reemplazar hoja actual").
   - `metricas` → `docs/google-sheets/metricas.csv`
   - `marcas`   → `docs/google-sheets/marcas.csv`

### Pestaña `metricas`
| columna | qué es |
|---|---|
| `key` | identificador interno (no se muestra) |
| `label` | texto bajo el número (ej: "Eventos realizados") |
| `value` | el número/valor (ej: `30`, `5K`, `83K`) |
| `suffix` | sufijo opcional, se pinta en naranja (ej: `+`) |
| `description` | nota interna, no se muestra |
| `visible` | `si`/`no` — si es `no`, no aparece |
| `order` | orden de aparición (1, 2, 3, 4). Se muestran **máximo 4** |

### Pestaña `marcas`
| columna | qué es |
|---|---|
| `name` | nombre de la marca. **Obligatorio.** Si no hay logo, se muestra como chip de texto |
| `logo_url` | **Opcional.** Logo (PNG/SVG/AVIF). Acepta una ruta del sitio (`/img/logo-x.svg`) o **cualquier URL pública** (ej. un logo subido a Drive público, Imgur, el sitio de la marca, etc.). Si lo dejás vacío, se muestra el `name` como chip |
| `website_url` | opcional — si la cargás, el logo/chip linkea ahí |
| `visible` | `si`/`no` |
| `featured` | opcional, para destacar (reservado para uso futuro) |
| `order` | orden de aparición |

> **Sumar/sacar marcas sin depender de nadie:** la pestaña `marcas` es la **fuente real** una vez configurada — reemplaza por completo a los logos de ejemplo del código. Para **agregar** una marca: nueva fila con el `name` (y un `logo_url` si tenés el logo a mano; si no, queda como chip de texto). Para **sacar** una: borrá la fila o poné `visible = no`. Nunca hace falta tocar código.

---

## 2. Hacer el Sheet legible por API key

1. **Compartir → Acceso general → "Cualquier persona con el enlace" → Lector.**
   (La API key de solo lectura solo funciona con Sheets accesibles públicamente.)
2. Copiá el **ID del Sheet** desde la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`

## 3. Crear la API key de Google Sheets

1. [console.cloud.google.com](https://console.cloud.google.com) → creá/elegí un proyecto.
2. **APIs y servicios → Biblioteca →** activá **Google Sheets API**.
3. **Credenciales → Crear credenciales → Clave de API.**
4. (Recomendado) Restringí la key a **Google Sheets API** y, si querés, por referer/IP.

## 4. Variables de entorno en Vercel

En el proyecto de Vercel → **Settings → Environment Variables**, agregá:

| variable | valor |
|---|---|
| `GOOGLE_SHEETS_ID` | el ID del Sheet del paso 2 |
| `GOOGLE_SHEETS_API_KEY` | la API key del paso 3 |

> Estas mismas variables ya las usa `api/save_lead.js` para exportar leads, así que si
> alguna vez configurás esa parte, reutilizá las mismas (mismo Sheet o distinto, según prefieras).

Redeploy y listo: la home empieza a leer métricas y marcas desde el Sheet.
**Nunca** se exponen credenciales en el frontend: la API key vive solo en la función server-side.

---

## Cómo editar después
- Cambiá un número en `metricas` → se refleja en la web (hasta 5–15 min por el cache).
- Agregá/sacá una marca en `marcas` → idem.
- Poné `visible = no` para ocultar una fila sin borrarla.
- Cambiá `order` para reordenar.

## Si algo falla
- Sin variables de entorno → la web muestra los valores embebidos en el HTML (fallback).
- Sheet caído o mal compartido → idem, no se rompe nada.
- Un logo con URL rota → ese logo se oculta solo (resto sigue).
