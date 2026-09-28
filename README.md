# OMMA · Velox Dispatch — asignación de loads por diseño de pozo

App web (escritorio y celular) para que despacho asigne loads de frac sand al ritmo que pide el diseño del pozo. Cada dispatcher palomea los loads conforme los asigna. La app recalcula la cola, el avance y la cobertura de etapas con cada palomita, con cada reporte de etapa del frac crew y con cada export de loads de OMMA que se suba.

Pozo inicial: **Riley Horned Frog 5** (Velox), 105 etapas, 3 arenas:

| Arena | Arenera | Etapas 1–30 | Etapas 31–105 | Prefill |
|---|---|---|---|---|
| 100 Mesh | Iron Oak 115 | 10,000 lb/et | 90,000 lb/et · 14 trucks | 6 loads |
| 40/70 | Iron Oak 115 | — | 169,000 lb/et · 26 trucks | — |
| 20/40 | IronHorse | 111,000 lb/et | 20,000 lb/et · 2 trucks | 30 loads |

Total del pozo: **24,555,000 lb (12,277.5 t) ≈ 492 loads** con los payloads del extracto de OMMA.

## Publicar en Netlify (recomendado: todos ven lo mismo)

1. En [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** y elegir `AlanReyes1999/omma-velox-dispatch-loads`.
2. No hay que llenar nada: `netlify.toml` ya indica la carpeta `public` y la función. Clic en **Deploy**.
3. Compartir con despacho la URL que da Netlify (`https://<nombre>.netlify.app`). Se puede cambiar el nombre en *Site configuration → Change site name*.

El estado compartido (palomitas, reportes de etapa, diseño y loads OMMA) vive en **Netlify Blobs**, que se activa solo con el primer deploy. No hay base de datos que configurar.

> Arrastrar la carpeta a Netlify (*drag & drop*) **no** publica la función: la app abriría en modo local. Usa "Import from Git".

En el celular: abrir la URL y usar **Agregar a pantalla de inicio**. Abre como app, sin barra del navegador.

### Modo local

Si la app se abre sin la función (GitHub Pages o el archivo `index.html` en disco), trabaja en **modo local**: todo se guarda sólo en ese navegador y el indicador de arriba dice "Modo local". Sirve para revisar el plan, no para que varios dispatchers palomeen juntos.

## Cómo se usa

| Vista | Para qué |
|---|---|
| **Centro** | Qué asignar ahora: próximos loads con hora límite, gap vs cadencia, espiral de etapas del pozo, loads en camino y reparto por carrier. |
| **Asignar** | La cola completa por turno (día 06–18, noche 18–06). Se elige el carrier activo y se palomea cada load. Cada palomita guarda carrier, hora e iniciales, y se puede deshacer. |
| **Avance** | Hasta qué etapa alcanza la arena (asignada, entregada estimada u OMMA real) y la etapa real vs plan. Aquí se registra la etapa que reporta el frac crew: toda la cola se re-ancla a esa etapa real. |
| **Plan** | Loads por día, trucks requeridos vs plan y editor del diseño (tramos, lbs por etapa, ritmo, prefill, carriers, horarios). Guardar aplica para todo despacho. |
| **Areneras** | Payload, tiempos de carga, tránsito y locación por arenera, y la carga del export de loads de OMMA (.xls, .xlsx o .csv). |

Filtros globales (arena y carrier) y la unidad (loads, lbs o toneladas) aplican a todas las vistas. Clic en una barra, dona o tarjeta filtra el tablero; clic en la leyenda prende y apaga capas.

## Cómo calcula

- **Loads por arena** = lbs del diseño ÷ payload promedio de su arenera (del export de OMMA), redondeado hacia arriba.
- **En locación**: cada load se necesita cuando el pozo llega a la etapa donde empieza a consumirse su arena, menos el colchón (2 etapas).
- **Hora límite para asignar** = hora en locación − lead time de la arenera (mediana de *Accepted → Delivered*: Iron Oak 7h 21m, IronHorse 5h 45m).
- **Prefill**: los 36 loads se reparten parejo entre el inicio del prefill y el inicio de frac menos el lead time.
- **Estados**: *Vencido* (pasó la hora límite), *Asignar ya* (dentro de la ventana de 2 h), *Programado*, *En camino*, *Llegó est.*, *Entregado* (OMMA, casado con el export).
- **Calendario**: sin reportes usa el inicio de frac y el ritmo del diseño; con el primer reporte de etapa se re-ancla a la etapa real.
- **Trucks requeridos** = loads/día ÷ loads por truck al día (2 para Iron Oak, del plan; 20/40 se estima con el ciclo de IronHorse).

## Supuestos del diseño inicial

Todos se cambian en **Plan → Diseño del pozo** y aplican para todo despacho:

- Prefill: martes 29 sep 14:00. Inicio de frac: miércoles 30 sep 06:00.
- Etapas 1–30 al mismo ritmo que 31–105: 19 etapas/día.
- Colchón en locación: 2 etapas. Ventana "asignar ya": 2 h. Turnos 06:00 y 18:00.
- 40/70 usa el payload promedio de Iron Oak (el extracto no trae loads de 40/70).
- Loads por truck al día de 20/40: estimado con el lead time de IronHorse (sin vueltas consecutivas en el extracto).
- Las entregas OMMA cuentan como arena del pozo desde el 29 sep 00:00. Los 4 loads del extracto (25 y 27 sep) sólo alimentan payload y tiempos.
- Horas del export leídas en hora del centro (UTC−6).
- Carriers 2–4 con nombre genérico; OMMA es el único con loads trackeados.

## Datos y privacidad

- El repositorio es **público**: nunca subas exports crudos. Traen nombres de drivers y POs. El `.gitignore` bloquea `.xls`, `.xlsx` y `.csv`.
- Al subir un export, la app guarda sólo lo que usa el cálculo: número de load y ticket, producto, arenera, millas, truck, peso, tiempos, fechas, pozo y carrier. **No guarda nombres de drivers ni POs.**
- Cualquiera con la URL de Netlify puede ver y palomear. No compartas la URL fuera de despacho.

## Desarrollo

```bash
npm install
npm test            # motor de cálculo, parser, reductor y función (24 pruebas)
npx netlify dev     # app + función en http://localhost:8888
```

```
public/                 sitio estático (index.html, assets/css, assets/js, fuentes, íconos)
  assets/js/engine.js   motor: diseño → slots, cadencia, cobertura, trucks
  assets/js/reducer.js  operaciones compartidas (lo usan el navegador y la función)
  assets/js/parser.js   lectura del export de OMMA (.xls HTML, .xlsx, .csv)
  assets/js/store.js    sincronización con /api/state, cola sin conexión
  assets/js/app.js      interfaz: 5 vistas, gráficas, filtros
netlify/functions/state.mjs   GET/POST /api/state sobre Netlify Blobs con escritura condicional
tests/                  pruebas con node:test
```

MEDS Logistics © 2026 — FILIALES/OMMA
