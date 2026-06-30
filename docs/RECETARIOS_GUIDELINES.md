# Guía editorial de recetarios — Javotecocina

Estándar **obligatorio** para todos los recetarios actuales y futuros. Cada recetario es un **producto digital pago**: tiene que justificar la compra con técnica, criterio y voz propia. Si un texto podría aparecer en cualquier blog gratis, no está listo.

Antes de cerrar cualquier recetario, la pregunta final es una sola: **"¿Yo pagaría por esto?"**. Si la respuesta es no, falta trabajo.

---

## 1. Tono editorial

- Cocinero de verdad explicándote al lado del fuego, no manual ni chef de TV.
- Experto pero sin soberbia. Rioplatense / del norte argentino, en primera persona ("yo hago", "mi viejo me enseñó").
- Claro, directo, humano. Explica el **porqué** de cada decisión, no solo el qué.
- Honesto: si algo es simple, se dice; el valor se aporta desde la técnica, no desde el verso.
- Referencia de voz lograda (prólogos de Fierros, Keveri y Lo Fresco del Norte): personal, con anécdota real, sin exagerar.

## 2. Reglas anti-IA (prohibido)

No usar nunca:
- "Guía definitiva", "el recetario definitivo", "la guía que estabas esperando".
- "Como un verdadero maestro", "convertite en experto", "llevá tu cocina al siguiente nivel".
- "Explosión de sabores", "deleitará tu paladar", "irresistible", "único", "delicioso", "perfecto", "increíble".
- "Para cualquier ocasión", "sorprendé a todos", "una experiencia".
- Adjetivos inflados, promesas vagas, frases que aplican a cualquier plato.

Señales de que un texto suena a IA y hay que reescribirlo:
- Dice mucho y explica poco.
- Pasos genéricos ("cociná hasta que esté listo").
- Consejos obvios sin criterio.
- Estructuras repetidas, relleno, cero detalle concreto.

## 3. No inventar (regla más importante)

No inventar tiempos, temperaturas, cantidades, técnicas, ingredientes, anécdotas, datos ni resultados.
Si falta info real, **no completar con suposiciones**. Usar este formato y frenar:

```
[PREGUNTA PARA JAVIER]
Necesito saber: <pregunta concreta>
Motivo: <por qué hace falta>
Dónde impacta: <receta / sección / copy>
```

El copy comercial puede reescribirse libremente **siempre que solo resuma contenido que ya existe en el libro** (no agrega técnica nueva).

## 4. Estructura de una receta

Los recetarios usan estos componentes HTML (mantener):
`r-note` (bajada con criterio) · `r-meta` (Tiempo / Porciones / Fuego / Dificultad) · `col-ing` (ingredientes con `ing-glabel` para subgrupos) · `col-pasos` (`paso` numerados, cada uno con **negrita de acción + el porqué**) · `tip` ("🔥 El consejo de Javo").

Cada receta paga debería cubrir, cuando aplique:
- Bajada con valor real (por qué funciona / qué la hace distinta), no decorativa.
- Cómo elegir el ingrediente/corte y qué mirar.
- Preparación previa (limpieza, reposo, marinada, mise en place).
- Cuándo y con qué salar.
- Manejo del fuego (intensidad, directo/indirecto, altura, una sola vuelta vs mover).
- Tiempos realistas según grosor/peso + **señales** (visuales, sonoras, táctiles).
- Punto recomendado y reposo final.
- Cómo cortar y servir.
- **Errores comunes y cómo corregirlos.**
- **Variantes / acompañamiento.**
- Conservación / recalentado si aplica.
- Seguridad alimentaria cuando corresponda (ej. ahumado en frío, crudos de río).

No toda receta lleva todo, pero **ninguna paga puede ser solo ingredientes + pasos mínimos**.

## 5. Estructura de un recetario

1. **Portada** + dedicatoria.
2. **Prólogo**: qué es, para quién, qué problema resuelve, qué se aprende. Con voz propia.
3. **Índice** con subtítulo que promete concreto.
4. **Técnica base** (1-3 páginas): los conceptos que se repiten (curado del disco, fuego/tiro/temperatura del Keveri, el ácido y el frío, etc.). Esto es lo que diferencia al producto de recetas sueltas.
5. **Recetas** agrupadas por categoría.
6. **Cierre de valor**: "La mesa de…" (salsas, guarniciones, cómo armar la comida), anexos.

## 6. Checklist de calidad antes de publicar

- [ ] ¿Suena humano y experto, sin frases de IA?
- [ ] ¿Cada receta enseña, ordena o mejora algo (técnica/criterio/error/variante)?
- [ ] ¿Las recetas simples están justificadas con técnica o consejos?
- [ ] ¿No inventa datos? ¿Las dudas quedaron como `[PREGUNTA PARA JAVIER]`?
- [ ] ¿Tiene técnica base propia del tema?
- [ ] ¿El copy comercial vende sin exagerar y coincide con el contenido real (cantidad de recetas, tema, técnica)?
- [ ] ¿El comprador entiende qué recibe y para quién es?
- [ ] ¿Tono consistente en todo el libro?
- [ ] ¿Respeta preferencias de marca? (ver §9)
- [ ] ¿Yo pagaría por esto?

## 7. Copy comercial (cards, descripción, paywall, includes)

Debe explicar, sin verso:
- Qué aprende / resuelve la persona.
- Para quién es y qué nivel necesita.
- Qué trae (cantidad real de recetas + técnica base + extras).
- Qué lo diferencia de recetas gratis sueltas.

Reglas:
- La **cantidad de recetas del copy tiene que coincidir** con el índice del libro.
- Nada de claims que el libro no sostiene.
- Concreto > grandilocuente.

**Mal:** "La guía definitiva para dominar la parrilla — recetas únicas e irresistibles."
**Mejor:** "14 recetas de parrilla con la técnica real del norte: del fuego al corte. Cómo elegir cada corte, manejar la brasa, leer el punto y cortar. Más una guía de leña, brasas y temperaturas."

## 8. Recetas simples

Permitidas, pero **nunca pobres**. Una receta de pocos ingredientes aporta valor desde: selección del ingrediente, punto exacto, manejo del fuego, cuándo salar, reposo, textura buscada, errores comunes, cómo cortar/servir, variantes y qué NO hacer.

**Mal:** "Salá el vacío y cocinalo a la parrilla hasta que esté listo."
**Mejor:** ver la receta de Vacío en `fierros.html` (fuego suave, tapa de grasa arriba, leer el punto en la grasa, cortar contra la fibra) — ese es el piso.

## 9. Preferencias de marca (verificadas con Javier)

- **Canela y comino: nunca como ingrediente base.** Solo opcionales, marcados "para quien guste". Si una receta tradicional los pediría, ofrecerlos al final, no en el condimento base. (Confirmar siempre con Javier antes de usarlos como protagonistas.)
- **Keveri = horno a carbón con tapa** (brasa, tiro, inercia térmica). NUNCA "a gas" ni "peruano".
- Sal: en general entrefina; salmuera/sal gruesa para cocciones largas. Confirmar por receta.

## 10. Cuándo preguntar a Javier

Antes de afirmar como definitivo: tiempos/temperaturas exactos, cantidades, técnicas concretas, puntos de cocción, experiencias en primera persona, claims comerciales fuertes, recetas o ingredientes nuevos, o cualquier cosa que dependa de su método real.

## 11. Estándar mínimo para que un recetario sea vendible

1. Concepto claro y razón de existir.
2. Técnica base propia del tema.
3. Todas las recetas con profundidad (no listas mínimas).
4. Voz propia, cero IA genérica.
5. Sin datos inventados; dudas marcadas.
6. Copy comercial honesto y consistente con el libro.
7. Fotos reales (no placeholders) antes de publicar a la venta.
8. Paywall in-file presente si se vende como PDF.

Si algún punto no se cumple, el recetario **no está listo para venderse**.
