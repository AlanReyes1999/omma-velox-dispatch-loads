# OMMA · Velox Dispatch — load assignment by well design

App (desktop and phone, installable) for dispatch to assign frac sand loads in the order the well design needs them. The queue is a single numbered sequence where the load number is the order of assignment: the loads already assigned are #1–#37 and **#38 is next**. Each check mark counts the load as sand on location, and the bar on top adds it up, overall or by sand. The app recalculates everything with every check mark, every stage report from the frac crew, every stage stats PDF and every OMMA loads export that gets uploaded.

Starting well: **Riley Horned Frog 5** (Velox), 105 stages, 3 sands:

| Sand | Mine | PO | Stages 1–30 | Stages 31–105 | Prefill |
|---|---|---|---|---|---|
| 100 Mesh | Iron Oak 115 | SPA00021226 | 10,000 lb/stg | 90,000 lb/stg · 14 trucks | 6 loads |
| 40/70 | Iron Oak 115 | SPA00021227 | — | 169,000 lb/stg · 26 trucks | — |
| 20/40 | IronHorse | PO-24918 | 111,000 lb/stg | 20,000 lb/stg · 2 trucks | 30 loads |

Well total: **24,555,000 lb (12,277.5 tons) ≈ 492 loads** with the payloads from the OMMA extract.

Starting point (Sep 28, 2026): prefill from Sep 23 6:00 PM to Sep 28 3:00 AM, well start Sep 28 6:00 AM and **37 loads already assigned** (30 × 20/40, 6 × 100 Mesh and one 40/70 that went out early by mistake, which is #37). Next up: **#38 · 20/40 · 031 for stage 14** (PO-24918).

**Final counts:** at **80% of loads assigned** (load #394 of 492) the well enters final counts and load assignments have to be confirmed with the frac crew. The Assign tab marks the 80% line on the bar and in the queue; the load that reaches 80% asks for that confirmation first (with the dispatcher's initials) and logs who confirmed and when, for all dispatch to see. Checking off OMMA deliveries in Progress asks the same way, and if assigned loads fall back below the line, crossing it again asks again (Undo does not). The percentage is editable in Plan.

## Publish on Netlify (recommended: everyone sees the same thing)

1. At [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project → GitHub** and pick `AlanReyes1999/omma-velox-dispatch-loads`.
2. Nothing to fill in: `netlify.toml` already sets the `public` folder and the function. Click **Deploy**.
3. Share the Netlify URL (`https://<name>.netlify.app`) with dispatch. The name can be changed in *Site configuration → Change site name*.

The shared state (check marks, stage reports, design and OMMA loads) lives in **Netlify Blobs**, which turns on by itself with the first deploy. There is no database to set up.

> Dragging the folder into Netlify (*drag & drop*) does **not** publish the function: the app would open in local mode. Use "Import from Git".

A site that was already running the previous version updates itself on the next deploy. The shared state decides how: if nobody has worked since its last starting point it loads this one whole (the same 37 loads); if someone has, it only updates what changed in the design (prefill start, POs, final counts rule) and **keeps every check mark**. A PO someone already typed in Plan is left as they set it. An older state with work asks a person to confirm before replacing anything.

## Install as an app

Once it is on Netlify, the app installs like any other app and opens straight into the assignment queue:

- **Windows or Mac (Chrome or Edge):** **Install app** button at the top right, or the install icon in the address bar. It lands in the Start menu / Launchpad and opens in its own window.
- **Android (Chrome):** **Install app** button, or menu → **Install app**. It lands in the app drawer.
- **iPhone / iPad (Safari):** **Share → Add to Home Screen**.

Once installed it opens instantly and keeps opening with no signal (anything checked off offline is sent when the network is back). Updates arrive on their own with every Netlify deploy.

### Local mode

If the app opens without the function (GitHub Pages, or the `index.html` file from disk), it works in **local mode**: everything is saved in that browser only and the indicator at the top says "Local mode". It is good for reviewing the plan, not for several dispatchers checking loads off together.

## How to use it

| View | What for |
|---|---|
| **Command** | What to assign now: next loads, gap vs cadence, the well's stage spiral, loads en route and the split by sand. |
| **Assign** | The full queue in the order loads have to be assigned, numbered 1–492, with no days or hours. Columns: #, load, mine, PO, stage, running total on location, status (scheduled / assigned / overdue) and carrier (optional). |
| **Progress** | How far the sand covers (assigned, estimated delivered or actual OMMA) and the actual stage vs plan. The stage the frac crew reports is logged here: the whole queue re-anchors to it. |
| **Plan** | Loads per day, trucks required vs plan, drivers needed per shift, day, hour and stage with their turn rate, the frac crew's stage stats PDF (lbs per sand and stage times, actual vs design) and the design editor (segments, lbs per stage, pace, prefill, POs, final counts %, driver hours per shift, carriers, schedule). Saving applies to all dispatch. |
| **Mines** | Payload, load, transit and on-location times per mine, the PO of each sand, and the upload of the OMMA loads export (.xls, .xlsx or .csv). |

Global filters (sand and carrier) and the unit (loads, lbs or tons) apply to every view. Clicking a bar, doughnut slice or card filters the board; clicking a legend item toggles that layer.

### Assign tab

- **One click on the check box** assigns the load and adds it to the sand-on-location bar; clicking again removes it. Every action has **Undo** in the notice, and **Ctrl/⌘ + Z** undoes the last one.
- **Shift + click** a check box assigns every load from the next one up to that load, in queue order (one confirmation, one undo).
- **Click a row** for its detail: mine, PO, stage, running total, how far that sand covers, who assigned it and when, plus its actions (assign, assign up to here, remove).
- The loads already assigned **fold** at the top of the queue ("37 assigned loads hidden · Show") so the list starts at the next load. Loads assigned during the session stay in view.
- The bar switches between **Overall** and **By sand**; clicking a sand filters the queue and hovering shows its numbers and PO.
- Keyboard: **N** next load · **Space / Enter** check · **↑ ↓** move between loads · **I** detail · **/** search · **?** shortcuts.

### Stage stats PDF (Plan)

The frac crew's STATISTICS sheet, exported as PDF, goes in **Plan → Stage stats from the frac crew** (drag it or tap to choose it).

- The app reads each stage's start and end and the lbs of each sand from the note on its "Used Pounds" cell (`110,000 lbs - 20/40`, `11,000 lbs - 100 mesh`).
- Before anything changes, the preview shows what it read and what would change: loads needed per sand, lbs per stage and pace for the stages left, the next load's assign-by time and the well's end. It lists every stage as read (lbs per sand and where they came from) and anything worth checking: a note that falls short of its total, a total that does not match its sands, a stage far over or under its design, a stage with no end time, a sand outside the design or another well in the title.
- Notes are read as the crew writes them: `110,000 lbs - 20/40`, `20/40: 110,000`, `20-40`, `2040`, `100 mesh`, `100M`. A stage label ("Stage 12") is never read as lbs. A note that falls well short of its total gets the missing lbs in the sands it does not name, like the design; a stage with no note gets its total split like the design. Both are flagged in the preview.
- **Apply and recalculate** applies it for all dispatch; the notice has **Undo**. Each new PDF updates the stages it carries; **Replace all** keeps only the new file's stages. **Clear stage stats** goes back to the design.
- Two charts compare actual vs design: sand per stage, with a running total vs the design, and stage time (transition + pumping) against the design. Clicking a stage opens its detail.

## How it calculates

- **Loads per sand** = design lbs ÷ average payload of its mine (from the OMMA export), rounded up.
- **On location**: each load is needed when the well reaches the stage where its sand starts being pumped, minus the buffer (2 stages).
- **Queue order and load number**: assigned loads first, in the order the shared state received them (so a dispatcher's clock or an offline phone never renumbers what everyone already saw); then pending loads by assign-by time (on-location time − mine lead time, the median *Accepted → Delivered*: Iron Oak 7h 21m, IronHorse 5h 45m). That is why Iron Oak moves ahead of IronHorse for the same stage. A load assigned out of order takes the next number and the pending ones shift by one. The queue shows no times: only the order and the number.
- **Running total**: sand on location if assigned up to that load (overall, and of its own sand). The bar on top adds up what is actually assigned and says how far it covers. In loads the bar and its % count loads; in lbs or tons they weigh them.
- **Final counts**: the load number that reaches the set share of loads (80% → #394 of 492).
- **Prefill**: the 36 prefill loads are spread evenly between the prefill start and end.
- **Queue statuses**: *Scheduled*, *Assigned* and *Overdue* (the stage already needed it and it is still unassigned).
- **PO**: the one set in Plan; if empty, the one from the latest OMMA export for that sand.
- **Calendar**: with no reports it uses the frac start and the design pace; from the first stage report or stats PDF on it re-anchors to the actual stage, and every known stage end pins it. The stats PDF wins over a report of the same stage.
- **Stage stats (design + actual)**: a pumped stage counts what the crew pumped of each sand; a stage whose note is missing has its total split like the design. The stages left in each design segment (block) take, per sand, a weighted average of the design and that block's pumped stages, (2 × design + 2 × last + Σ the others) ÷ (2 + 2 + the others): the design and the block's last pumped stage count double, every other pumped stage once. The design anchors the forecast while there are few stages, the last stage brings in what the crew is doing now, and as the block fills up its own average takes over, so the total converges on the sand the well takes. Stages 31–105 keep their design until they start. Stage time works the same way, end to end (transition + pumping), and sets the pace of the stages left. Loads needed, their order, trucks and drivers all follow.
- **Trucks required** = loads/day ÷ loads per truck per day (2 for Iron Oak, from the plan; 20/40 is estimated with the IronHorse cycle).
- **Drivers and turn rate**: a driver works one 12 h shift a day that can stretch to 14 h (both editable in Plan), and a load keeps a driver for its full load time, assigned → delivered at its mine (the same time the queue uses). Any driver can take any trip, so a shift needs its loads' driver-hours ÷ 14 h, rounded up. A load counts in the shift where it is half done. Drivers per day = day shift + night shift; turn rate = loads per driver per day. By hour: drivers on a load. By stage: loads and driver-hours per stage, the drivers that hold each segment's pace and, with a driver plan per segment (the client's 20 per shift for stages 31–105), the gap and the pace that plan holds.

## Starting design assumptions

All of them change in **Plan → Well design** and apply to all dispatch:

- Prefill: Sep 23 6:00 PM to Sep 28 3:00 AM. Well start: Sep 28 6:00 AM.
- Stages 1–30 at the same pace as 31–105: 19 stages/day.
- Buffer on location: 2 stages. "Assign now" window: 2 h. Shifts at 6:00 AM and 6:00 PM.
- Final counts at 80% of loads assigned.
- 40/70 uses the Iron Oak average payload (the extract has no 40/70 loads).
- 20/40 loads per truck per day: estimated with the IronHorse lead time (no back-to-back trips in the extract).
- OMMA deliveries count as well sand from the prefill start (Sep 23 6:00 PM): the 4 loads in the extract (Sep 24–27) are part of the prefill.
- Export times read in Central time (UTC−6).
- Carriers 2–4 have generic names; OMMA is the only one with tracked loads.

## Data and privacy

- The repository is **public**: never upload raw exports, they carry driver names. `.gitignore` blocks `.xls`, `.xlsx` and `.csv`. The POs of this well are part of the starting design (`public/assets/js/seed.js`).
- When an export is uploaded, the app keeps only what the calculation and the queue use: load and ticket number, PO, product, mine, miles, truck, weight, times, dates, well and carrier. **It never keeps driver names.**
- From the stage stats PDF it keeps only the stage number, its start and end, and the lbs of each sand. The PDF itself is not stored, and `.gitignore` blocks `.pdf`.
- Anyone with the Netlify URL can view and check loads off. Do not share the URL outside dispatch.

## Development

```bash
npm install
npm test            # engine, parsers, reducer and function (51 tests)
npx netlify dev     # app + function at http://localhost:8888
```

```
public/                 static site (index.html, assets/css, assets/js, fonts, icons, sw.js for offline use)
  assets/js/engine.js   engine: design → slots, cadence, coverage, trucks, drivers, final counts
  assets/js/reducer.js  shared operations (used by the browser and by the function)
  assets/js/parser.js   OMMA export reader (.xls HTML, .xlsx, .csv)
  assets/js/stagestats.js  frac crew stage stats PDF reader (positioned text → stages, lbs per sand)
  assets/js/vendor/     Chart.js, SheetJS and pdf.js 6.3.289 legacy build (Mozilla, Apache-2.0), the last two loaded only when a file is chosen
  assets/js/store.js    sync with /api/state, offline queue
  assets/js/seed.js     starting design, starting check marks and the revision patch
  assets/js/app.js      interface: 5 views, charts, filters, queue interactions
netlify/functions/state.mjs   GET/POST /api/state on Netlify Blobs with conditional writes
tests/                  node:test suites
```

When icons, fonts or libraries change in `public/assets`, bump `CACHE` in `public/sw.js` so installed apps reload them. The comments inside the OMMA brand-kit files (`chartkit.js`, `ui-kit.js`, `components-cards.css`, `motion.css`, `tokens-pastel.css`) stay as they come from the design system.

MEDS Logistics © 2026 — FILIALES/OMMA
