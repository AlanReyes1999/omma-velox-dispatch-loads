# OMMA · Velox Dispatch — asignación de loads por diseño de pozo

App (escritorio y celular, instalable) para que despacho asigne loads de frac sand en el orden que pide el diseño del pozo. La cola es una sola secuencia numerada: cada palomita cuenta el load como arena en locación y la barra de arriba lo suma, general o por arena. La app recalcula todo con cada palomita, con cada reporte de etapa del frac crew y con cada export de loads de OMMA que se suba.

Pozo inicial: **Riley Horned Frog 5** (Velox), 105 etapas, 3 arenas:

| Arena | Arenera | Etapas 1–30 | Etapas 31–105 | Prefill |
|---|---|---|---|---|
| 100 Mesh | Iron Oak 115 | 10,000 lb/et | 90,000 lb/et · 14 trucks | 6 loads |
| 40/70 | Iron Oak 115 | — | 169,000 lb/et · 26 trucks | — |
| 20/40 | IronHorse | 111,000 lb/et | 20,000 lb/et · 2 trucks | 30 loads |

Total del pozo: **24,555,000 lb (12,277.5 t) ≈ 492 loads** con los payloads del extracto de OMMA.

Punto de partida (28 sep 2026): prefill del 23 sep al 28 sep 03:00, inicio del pozo 28 sep 06:00 y **37 loads ya asignados** (30 de 20/40, 6 de 100 Mesh y 1 de 40/70). Lo que sigue es el **#37: 20/40 · 031 para la etapa 14**.

## Publicar en Netlify (recomendado: todos ven lo mismo)

1. En [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** y elegir `AlanReyes1999/omma-velox-dispatch-loads`.
2. No hay que llenar nada: `netlify.toml` ya indica la carpeta `public` y la función. Clic en **Deploy**.
3. Compartir con despacho la URL que da Netlify (`https://<nombre>.netlify.app`). Se puede cambiar el nombre en *Site configuration → Change site name*.

El estado compartido (palomitas, reportes de etapa, diseño y loads OMMA) vive en **Netlify Blobs**, que se activa solo con el primer deploy. No hay base de datos que configurar.

> Arrastrar la carpeta a Netlify (*drag & drop*) **no** publica la función: la app abriría en modo local. Usa "Import from Git".

## Instalar como app

Ya publicada en Netlify, la app se instala como cualquier aplicación y abre directo en la cola de asignación:

- **Windows o Mac (Chrome o Edge):** botón **Instalar app** arriba a la derecha, o el ícono de instalar en la barra de direcciones. Queda en el menú de inicio / Launchpad y abre en su propia ventana.
- **Android (Chrome):** botón **Instalar app** o menú → **Instalar app**. Queda en el cajón de apps.
- **iPhone / iPad (Safari):** **Compartir → Agregar a pantalla de inicio**.

Una vez instalada abre al instante y sigue abriendo sin señal (lo que se palomee sin red se envía al volver). Las actualizaciones llegan solas al publicar en Netlify.

### Modo local

Si la app se abre sin la función (GitHub Pages o el archivo `index.html` en disco), trabaja en **modo local**: todo se guarda sólo en ese navegador y el indicador de arriba dice "Modo local". Sirve para revisar el plan, no para que varios dispatchers palomeen juntos.

## Cómo se usa

| Vista | Para qué |
|---|---|
| **Centro** | Qué asignar ahora: próximos loads con hora límite, gap vs cadencia, espiral de etapas del pozo, loads en camino y reparto por carrier. |
| **Asignar** | La cola completa en el orden en que hay que asignar, numerada del 1 al 492, sin días ni horas. Columnas: #, load, arenera, PO, etapa, suma en locación, estado (programado / asignado / vencido) y carrier (opcional). Un clic en la casilla asigna el load y lo suma a la barra de arena en locación (general o por arena); se puede deshacer. |
| **Avance** | Hasta qué etapa alcanza la arena (asignada, entregada estimada u OMMA real) y la etapa real vs plan. Aquí se registra la etapa que reporta el frac crew: toda la cola se re-ancla a esa etapa real. |
| **Plan** | Loads por día, trucks requeridos vs plan y editor del diseño (tramos, lbs por etapa, ritmo, prefill, carriers, horarios). Guardar aplica para todo despacho. |
| **Areneras** | Payload, tiempos de carga, tránsito y locación por arenera, y la carga del export de loads de OMMA (.xls, .xlsx o .csv). |

Filtros globales (arena y carrier) y la unidad (loads, lbs o toneladas) aplican a todas las vistas. Clic en una barra, dona o tarjeta filtra el tablero; clic en la leyenda prende y apaga capas.

## Cómo calcula

- **Loads por arena** = lbs del diseño ÷ payload promedio de su arenera (del export de OMMA), redondeado hacia arriba.
- **En locación**: cada load se necesita cuando el pozo llega a la etapa donde empieza a consumirse su arena, menos el colchón (2 etapas).
- **Orden de la cola** = hora en locación − lead time de la arenera (mediana de *Accepted → Delivered*: Iron Oak 7h 21m, IronHorse 5h 45m). Por eso Iron Oak se adelanta a IronHorse para la misma etapa. La cola no muestra horas: sólo el orden y el número.
- **Suma en locación**: arena acumulada al asignar hasta ese load (total y de su arena). La barra de arriba suma lo asignado de verdad y dice hasta qué etapa alcanza.
- **Prefill**: los 36 loads se reparten parejo entre el inicio y el fin del prefill.
- **Estados en la cola**: *Programado*, *Asignado* y *Vencido* (la etapa ya lo necesitaba y sigue sin asignar).
- **PO**: el que se capture en Plan; si está vacío, el del export de OMMA más reciente de esa arena.
- **Calendario**: sin reportes usa el inicio de frac y el ritmo del diseño; con el primer reporte de etapa se re-ancla a la etapa real.
- **Trucks requeridos** = loads/día ÷ loads por truck al día (2 para Iron Oak, del plan; 20/40 se estima con el ciclo de IronHorse).

## Supuestos del diseño inicial

Todos se cambian en **Plan → Diseño del pozo** y aplican para todo despacho:

- Prefill: del 23 sep (00:00, sin hora dada) al 28 sep 03:00. Inicio del pozo: 28 sep 06:00.
- Etapas 1–30 al mismo ritmo que 31–105: 19 etapas/día.
- Colchón en locación: 2 etapas. Ventana "asignar ya": 2 h. Turnos 06:00 y 18:00.
- 40/70 usa el payload promedio de Iron Oak (el extracto no trae loads de 40/70).
- Loads por truck al día de 20/40: estimado con el lead time de IronHorse (sin vueltas consecutivas en el extracto).
- Las entregas OMMA cuentan como arena del pozo desde el inicio del prefill (23 sep): los 4 loads del extracto (25 y 27 sep) son parte del prefill.
- PO de 40/70: no viene en el extracto; se captura en Plan.
- Horas del export leídas en hora del centro (UTC−6).
- Carriers 2–4 con nombre genérico; OMMA es el único con loads trackeados.

## Datos y privacidad

- El repositorio es **público**: nunca subas exports crudos. Traen nombres de drivers y POs. El `.gitignore` bloquea `.xls`, `.xlsx` y `.csv`.
- Al subir un export, la app guarda sólo lo que usa el cálculo y la cola: número de load y ticket, PO, producto, arenera, millas, truck, peso, tiempos, fechas, pozo y carrier. **No guarda nombres de drivers.**
- Cualquiera con la URL de Netlify puede ver y palomear. No compartas la URL fuera de despacho.

## Desarrollo

```bash
npm install
npm test            # motor de cálculo, parser, reductor y función (27 pruebas)
npx netlify dev     # app + función en http://localhost:8888
```

```
public/                 sitio estático (index.html, assets/css, assets/js, fuentes, íconos, sw.js para uso sin señal)
  assets/js/engine.js   motor: diseño → slots, cadencia, cobertura, trucks
  assets/js/reducer.js  operaciones compartidas (lo usan el navegador y la función)
  assets/js/parser.js   lectura del export de OMMA (.xls HTML, .xlsx, .csv)
  assets/js/store.js    sincronización con /api/state, cola sin conexión
  assets/js/app.js      interfaz: 5 vistas, gráficas, filtros
netlify/functions/state.mjs   GET/POST /api/state sobre Netlify Blobs con escritura condicional
tests/                  pruebas con node:test
```

Al cambiar íconos, fuentes o librerías en `public/assets`, sube la versión `CACHE` en `public/sw.js` para que las apps instaladas los recarguen.

MEDS Logistics © 2026 — FILIALES/OMMA
