/* OMMA ui-kit v5 — 26/Jul/2026
   Lo que chartkit no cubre: superficie, filtros, crecimiento y navegación.
   Cargar DESPUÉS de chartkit.js. Requiere el bloque v5 de components-cards.css.

   Qué resuelve, en una línea cada uno:
     attachCardGlow  — el brillo que sigue al cursor, sin repintar en cada píxel
     growth          — la pill de variación, coloreada por JUICIO y no por signo
     sparkline       — la mini-serie que da contexto a un KPI sin ocupar una card
     filterMenu      — el filtro compacto con buscador y conteos (adiós muro de chips)
     navRail         — la navegación lateral con estado y colapso
     flipValue       — el aviso visual de que un número se recalculó
*/

/* ==================== 1 · brillo de superficie ====================
   Un solo listener delegado en el contenedor y escritura de variables CSS
   dentro de un rAF. Sin esto, mousemove sobre 12 cards dispara ~700 escrituras
   de estilo por segundo y la página deja de ir a 60fps. */
function attachCardGlow(root, sel){
  const host = (typeof root === 'string') ? document.querySelector(root) : (root || document);
  if(!host || host.__glow) return;
  host.__glow = true;
  const q = sel || '.gcard';
  let pend = null, raf = 0;
  host.addEventListener('mousemove', function(e){
    const c = e.target.closest ? e.target.closest(q) : null;
    if(!c) return;
    pend = {c:c, x:e.clientX};
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      if(!pend) return;
      const r = pend.c.getBoundingClientRect();
      /* v5.2 · una sola variable y sólo horizontal: la sombra EXTERIOR se inclina en
         dirección opuesta al cursor, como si el puntero fuera la fuente de luz.
         ±7px es deliberadamente poco: se percibe, no se ve. */
      const t = (pend.x - r.left) / Math.max(1, r.width);      /* 0 izquierda · 1 derecha */
      pend.c.style.setProperty('--gx', (( .5 - t) * 14).toFixed(1) + 'px');
      pend = null;
    });
  }, {passive:true});
}

/* ==================== 2 · tasa de crecimiento ====================
   growth(actual, previo, {better:'low'|'high', fmt, unit, pp})

   REGLA DEL SISTEMA: `better` es obligatorio en cuanto la métrica no sea
   "más es mejor". Rotación, downtime, costo por milla y días de taller son
   better:'low' — ahí una caída se pinta VERDE aunque el signo sea negativo.
   Colorear por el signo del delta es el error que delata un dashboard genérico.

   pp:true → la diferencia se expresa en puntos porcentuales, no en % relativo
   (de 44% a 30% son −14 pp, no −32%; para un ratio, pp es lo honesto). */
function growth(actual, prev, opt){
  opt = opt || {};
  const better = opt.better || 'high';
  if(prev == null || !isFinite(prev) || prev === 0 || actual == null || !isFinite(actual)){
    return {html:'<span class="gr ghost">sin base</span>', dir:0, pct:null, good:null};
  }
  const diff = actual - prev;
  const pct  = opt.pp ? diff : (diff / Math.abs(prev)) * 100;
  const dir  = diff > 0 ? 1 : diff < 0 ? -1 : 0;
  const flat = Math.abs(pct) < (opt.flatAt == null ? 0.5 : opt.flatAt);
  const good = flat ? null : (better === 'low' ? diff < 0 : diff > 0);
  const cls  = flat ? 'neu' : (good ? 'good' : 'bad');
  const arw  = flat ? '→' : (dir > 0 ? '↑' : '↓');
  const f    = opt.fmt || (v => Math.abs(v).toFixed(1));
  const txt  = f(pct) + (opt.pp ? ' pp' : '%');
  /* v5.2 · la ANIMACIÓN la decide el dato, no el diseño.
       alertAt  → por encima de este deterioro, la pill late en rojo (urgencia real)
       warnAt   → deterioro moderado, late lento en ámbar
       goodAt   → mejora relevante, un solo golpe al entrar
     Sin umbral cruzado la pill se queda quieta, que es el estado normal. */
  const mag = Math.abs(pct);
  let sig = '';
  if(!flat && good === false && opt.alertAt != null && mag >= opt.alertAt) sig = ' sig-alert';
  else if(!flat && good === false && opt.warnAt != null && mag >= opt.warnAt) sig = ' sig-warn';
  else if(!flat && good === true && opt.goodAt != null && mag >= opt.goodAt) sig = ' sig-good';
  return {
    dir:dir, pct:pct, good:good, flat:flat, cls:cls, sig:sig.trim(),
    html:'<span class="gr '+cls+sig+(opt.sm?' sm':'')+'"><span class="arw">'+arw+'</span>'+txt+'</span>',
    /* .bare para meter la variación dentro de una celda de tabla sin la pastilla */
    bare:'<span style="color:'+(flat?'#5A6779':good?'#2E8B5F':'#C25151')+';font-weight:800">'+arw+' '+txt+'</span>'
  };
}

/* ==================== 3 · sparkline ====================
   sparkline(values, {w,h,area,head,id}) → string SVG.
   Serie plana → línea centrada, no división por cero. */
function sparkline(vals, opt){
  opt = opt || {};
  const v = (vals || []).filter(x => x != null && isFinite(x));
  if(v.length < 2) return '';
  /* viewBox cercano a la caja real (~200×34): con preserveAspectRatio="none" un
     viewBox cuadrado convierte el punto de cabeza en una elipse aplastada. */
  const w = opt.w || 240, h = opt.h || 34, p = 3;
  const mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), rg = (mx - mn) || 1;
  const flat = (mx === mn);
  const X = i => p + i * (w - p*2) / (v.length - 1);
  const Y = k => flat ? h/2 : (h - p) - ((k - mn) / rg) * (h - p*2);
  const d = 'M' + v.map((k,i) => X(i).toFixed(2)+','+Y(k).toFixed(2)).join(' L');
  const gid = 'sg' + (opt.id || ('x'+v.length+'_'+Math.round(mx)));
  const last = v[v.length-1];
  return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'
    + '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="var(--a)" stop-opacity=".26"/>'
    + '<stop offset="1" stop-color="var(--a)" stop-opacity="0"/></linearGradient></defs>'
    + (opt.area === false ? '' :
       '<path class="ar" d="'+d+' L'+X(v.length-1).toFixed(2)+','+h+' L'+X(0).toFixed(2)+','+h+' Z" fill="url(#'+gid+')"/>')
    + '<path class="ln" vector-effect="non-scaling-stroke" d="'+d+'"/>'
    + (opt.head === false ? '' :
       '<circle class="hd" cx="'+X(v.length-1).toFixed(2)
       + '" cy="'+Y(last).toFixed(2)+'" r="2.2"/>')
    + '</svg>';
}
/* barras en miniatura: mejor que la línea cuando los periodos son pocos y discretos */
function sparkbars(vals, opt){
  opt = opt || {};
  const v = (vals || []).map(Number);
  if(!v.length) return '';
  const mx = Math.max.apply(null, v.concat([1]));
  const hot = opt.highlight == null ? v.length - 1 : opt.highlight;
  return '<div class="sparkbars">' + v.map(function(k,i){
    return '<i class="'+(i===hot?'on':'')+'" style="--s:'+Math.max(.06,k/mx).toFixed(3)
         + ';animation-delay:'+(i*26)+'ms"></i>';
  }).join('') + '</div>';
}

/* ==================== 4 · KPI card con crecimiento ====================
   kpiCard({label, value, unit, icon, accent, series, prev, better, foot, lead, drill})
   Devuelve el HTML completo. La anatomía es fija a propósito: si cada KPI
   inventa su composición, la fila deja de leerse de un vistazo. */
function kpiCard(c){
  const g = (c.prev != null) ? growth(c.rawValue != null ? c.rawValue : parseFloat(String(c.value).replace(/[^\d.-]/g,'')),
                                      c.prev, {better:c.better, pp:c.pp,
                                               alertAt:c.alertAt, warnAt:c.warnAt, goodAt:c.goodAt}) : null;
  const sp = c.series && c.series.length > 1
    ? (c.sparkStyle === 'bars' ? sparkbars(c.series, {highlight:c.highlight}) : sparkline(c.series, {id:c.id}))
    : '';
  return '<div class="gcard kpi5 '+(c.accent||'a-teal')+(c.lead?' lead':'')+(c.drill?' kpi-drill':'')+'"'
    + (c.id ? ' data-kpi="'+c.id+'"' : '') + ' style="--i:'+(c.i||0)+'">'
    + '<div class="k-top">'
    +   '<div class="k-ic">'+(c.icon||'')+'</div>'
    +   (g ? g.html : (c.badge || ''))
    + '</div>'
    + '<div class="k-lbl">'+c.label+'</div>'
    + '<div class="k-val"><span>'+c.value+'</span>'+(c.unit?'<small>'+c.unit+'</small>':'')+'</div>'
    + (sp ? '<div class="k-spark">'+sp+'</div>' : '')
    + (c.foot ? '<div class="k-foot">'+c.foot+'</div>' : '')
    + (c.note ? subNote(c.note) : '')
    + '</div>';
}

/* ==================== 5 · filtro compacto ====================
   filterMenu({mount, key, label, items, counts, colors, getSel, setSel, onChange, align})

   Contrato de estado idéntico al de chartkit: 'all' | Set. Así el mismo botón
   convive con cross-filter desde una gráfica sin sincronización extra — al abrir
   se re-deriva la selección del estado, nunca al revés.

   Decisiones que importan:
     · el conteo por opción se calcula SIN el filtro de esta dimensión (rowsF(key)),
       igual que Power BI: si no, al elegir un valor todos los demás muestran 0
     · las acciones son Todas/Ninguna/Invertir — invertir es el atajo real cuando
       hay 15 valores y sobran 2
     · el filtro se aplica AL INSTANTE, no al cerrar: el popover no tapa el tablero */
function filterMenu(cfg){
  const $ = s => document.querySelector(s);
  const mount = (typeof cfg.mount === 'string') ? $(cfg.mount) : cfg.mount;
  if(!mount) return null;
  const key = cfg.key, items = cfg.items.slice();
  const sel = () => { const s = cfg.getSel(); return (s === 'all' || !s) ? null : s; };
  let open = false, cur = -1, filt = items.slice();

  mount.classList.add('fmenu');
  mount.innerHTML =
    '<button class="fmenu-btn" type="button" aria-haspopup="listbox" aria-expanded="false">'
    + '<span class="fk">'+cfg.label+'</span><span class="fv">Todas</span>'
    + '<span class="cnt" hidden>0</span>'
    + '<svg class="cv" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button>'
    + '<div class="fmenu-pop'+(cfg.align === 'right' ? ' right' : '')+'" role="listbox">'
    +   '<input class="fmenu-src" type="text" placeholder="Buscar '+cfg.label.toLowerCase()+'…" spellcheck="false">'
    +   '<div class="fmenu-acts"><button data-a="all">Todas</button><button data-a="none">Ninguna</button><button data-a="inv">Invertir</button></div>'
    +   '<div class="fmenu-list"></div>'
    + '</div>';

  const btn = mount.querySelector('.fmenu-btn'), pop = mount.querySelector('.fmenu-pop'),
        src = mount.querySelector('.fmenu-src'), list = mount.querySelector('.fmenu-list'),
        fv  = mount.querySelector('.fv'), cnt = mount.querySelector('.cnt');

  function counts(){ return (typeof cfg.counts === 'function') ? (cfg.counts() || {}) : (cfg.counts || {}); }

  function paintList(){
    const s = sel(), C = counts();
    const mx = Math.max.apply(null, items.map(v => C[v] || 0).concat([1]));
    if(!filt.length){ list.innerHTML = '<div class="fmenu-empty">Sin coincidencias</div>'; return; }
    list.innerHTML = filt.map(function(v,i){
      const on = s ? (s.has(v) || s.has(String(v))) : true;
      const n = C[v] || 0;
      const col = cfg.colors && cfg.colors[v];
      return '<div class="fopt'+(on?' sel':'')+(i===cur?' cur':'')+'" data-v="'+String(v).replace(/"/g,'&quot;')+'" role="option" tabindex="-1">'
        + '<span class="bx"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
        + (col ? '<span class="dot" style="background:'+col+'"></span>' : '')
        + '<span class="tx" title="'+String(v).replace(/"/g,'&quot;')+'">'+v+'</span>'
        + '<span class="mini"><i style="transform:scaleX('+(n/mx).toFixed(3)+')"></i></span>'
        + '<span class="n">'+n+'</span></div>';
    }).join('');
  }

  function paintBtn(){
    const s = sel();
    if(!s || s.size === 0 || s.size === items.length){
      fv.textContent = 'Todas'; cnt.hidden = true; btn.classList.remove('dirty');
    }else if(s.size === 1){
      const v = Array.from(s)[0];
      fv.textContent = String(v).length > 18 ? String(v).slice(0,17)+'…' : v;
      cnt.hidden = true; btn.classList.add('dirty');
    }else{
      fv.textContent = 'Varias'; cnt.hidden = false; cnt.textContent = s.size; btn.classList.add('dirty');
    }
  }

  function commit(next){
    /* seleccionar todo equivale a 'all': el estado limpio no es un Set lleno */
    cfg.setSel((!next || next.size === 0 || next.size === items.length) ? 'all' : next);
    /* el menú es ciudadano de primera del contrato de chartkit: repinta la barra de
       filtros activos y sincroniza unas chips de la misma dimensión si existieran.
       Sin esto el tablero queda filtrado sin ninguna señal persistente de que lo está. */
    if(typeof syncChips === 'function') try{ syncChips(key) }catch(e){}
    if(typeof renderFilterBar === 'function') try{ renderFilterBar() }catch(e){}
    paintBtn(); paintList();
    if(cfg.onChange) cfg.onChange();
  }
  function toggle(v){
    const s = sel(); let next;
    if(!s){ next = new Set([v]); }                    /* del "todas" al valor único: el clic más común */
    else { next = new Set(s); next.has(v) ? next.delete(v) : next.add(v); }
    commit(next);
  }

  mount.querySelectorAll('.fmenu-acts button').forEach(function(b){
    b.addEventListener('click', function(){
      const a = b.dataset.a, s = sel();
      if(a === 'all') commit(null);
      else if(a === 'none') commit(new Set([items[0]]));   /* vaciar del todo deja el tablero mudo */
      else commit(new Set(items.filter(v => !(s ? s.has(v) : true))));
    });
  });
  list.addEventListener('click', function(e){
    const o = e.target.closest('.fopt'); if(o) toggle(o.dataset.v);
  });
  src.addEventListener('input', function(){
    const q = src.value.trim().toLowerCase();
    filt = q ? items.filter(v => String(v).toLowerCase().indexOf(q) >= 0) : items.slice();
    cur = filt.length ? 0 : -1; paintList();
  });
  src.addEventListener('keydown', function(e){
    if(e.key === 'ArrowDown'){ cur = Math.min(filt.length-1, cur+1); paintList(); e.preventDefault(); }
    else if(e.key === 'ArrowUp'){ cur = Math.max(0, cur-1); paintList(); e.preventDefault(); }
    else if(e.key === 'Enter' && filt[cur] != null){ toggle(filt[cur]); e.preventDefault(); }
    else if(e.key === 'Escape'){ close(); btn.focus(); }
  });

  function openPop(){
    document.querySelectorAll('.fmenu-pop.show').forEach(function(p){
      if(p !== pop){ p.classList.remove('show'); const b = p.parentNode.querySelector('.fmenu-btn'); if(b) b.classList.remove('on'); }
    });
    open = true; pop.classList.add('show'); btn.classList.add('on'); btn.setAttribute('aria-expanded','true');
    filt = items.slice(); src.value = ''; cur = -1;
    paintList();
    /* el foco al buscador sólo con teclado o listas largas: en móvil abre el teclado y tapa todo */
    if(items.length > 8 && !('ontouchstart' in window)) setTimeout(() => src.focus(), 40);
  }
  function close(){ open = false; pop.classList.remove('show'); btn.classList.remove('on'); btn.setAttribute('aria-expanded','false'); }
  btn.addEventListener('click', function(e){ e.stopPropagation(); open ? close() : openPop(); });
  pop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', function(){ if(open) close(); });

  paintBtn();
  /* sync(): lo llama el render global para que el botón refleje un cross-filter
     disparado desde una gráfica. Es la contraparte de syncChips() de chartkit. */
  return {sync:function(){ paintBtn(); if(open) paintList(); }, close:close, el:mount};
}

/* ==================== 6 · navegación lateral ==================== */
function navRail(cfg){
  const host = (typeof cfg.mount === 'string') ? document.querySelector(cfg.mount) : cfg.mount;
  if(!host) return null;
  host.classList.add('sidenav');
  host.innerHTML =
    '<div class="brand">'+(cfg.logo||'')+'<span class="bt">'+(cfg.title||'')+'</span></div>'
    + cfg.groups.map(function(g){
        return (g.label ? '<div class="navgrp">'+g.label+'</div>' : '')
          + g.items.map(function(it){
              return '<div class="nv'+(it.active?' on':'')+'" data-nav="'+it.key+'" tabindex="0" role="button">'
                + '<span class="ic">'+(it.icon||'')+'</span><span class="tx">'+it.label+'</span>'
                + (it.badge != null ? '<span class="bdg">'+it.badge+'</span>' : '')+'</div>';
            }).join('');
      }).join('')
    + '<div class="foot">'+(cfg.foot||'')+'</div>';
  function go(k){
    host.querySelectorAll('.nv').forEach(n => n.classList.toggle('on', n.dataset.nav === k));
    if(cfg.onNav) cfg.onNav(k);
  }
  host.addEventListener('click', function(e){ const n = e.target.closest('.nv'); if(n) go(n.dataset.nav); });
  host.addEventListener('keydown', function(e){
    const n = e.target.closest('.nv'); if(n && (e.key === 'Enter' || e.key === ' ')){ go(n.dataset.nav); e.preventDefault(); }
  });
  return {go:go, mini:function(on){ host.classList.toggle('mini', on !== false); },
          badge:function(k,v){ const b = host.querySelector('[data-nav="'+k+'"] .bdg'); if(b) b.textContent = v; }};
}

/* ==================== 7 · aviso de recálculo ====================
   El flip se re-dispara quitando la clase y forzando reflow. Sin el reflow
   el navegador colapsa quitar+poner en un solo frame y la animación no corre. */
function flipValue(el){
  if(!el) return;
  el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
}

/* ==================== 8 · utilidades de serie ====================
   Series por periodo listas para el sparkline y para el comparativo del KPI. */
function seriesBy(rows, periods, keyFn, measure){
  return periods.map(function(p){
    const s = rows.filter(r => keyFn(r) === p);
    return measure ? measure(s) : s.length;
  });
}
/* prevWindow(serie, n) → [ventana actual, ventana anterior] promediadas.
   Es la base honesta de un "vs periodo anterior": compara ventanas del MISMO
   largo. Comparar 4 semanas contra 12 y llamarlo variación es hacer trampa. */
function prevWindow(serie, n){
  n = n || 4;
  const a = serie.slice(-n), b = serie.slice(-n*2, -n);
  const avg = x => x.length ? x.reduce((p,q) => p+q, 0) / x.length : null;
  return [avg(a), avg(b)];
}

/* ==================== 9 · PULSO VIVO ====================
   La tira de señal animada. Nació en el tablero CUIDA 24 como un electro; aquí la
   FORMA cambia con el dominio, porque una señal que no dice nada del negocio es
   decoración. La onda es periódica en 100 unidades y se pinta dos veces seguidas:
   el grupo se desplaza exactamente -100 y el bucle es invisible.

   livePulse({shape, speed, height, label})
     vitals  — electro. Alertas, command center, cualquier cosa que "está viva".
     cycle   — un ciclo de acarreo: espera · carga · tránsito · descarga · retorno vacío.
     burst   — ráfagas de entrega: varios loads seguidos y una pausa. Producción diaria.
     wave    — flujo suave. Financiero, ingreso, caja.
     steps   — acumulado que escala. Avance contra plan.
     fleet   — dientes de sierra desiguales: unidades entrando y saliendo de taller. */
const LP_SHAPES = {
  vitals:'M0,28 L16,28 L20,25 L24,31 L28,7 L32,36 L36,25 L40,28 L58,28 L62,26.5 L66,29.5 L70,28 L100,28',
  cycle: 'M0,32 L7,32 L15,11 L45,11 L53,32 L60,32 L68,14 L86,14 L92,32 L100,32',
  burst: 'M0,33 L8,33 L11,15 L14,33 L19,33 L22,12 L25,33 L30,33 L33,18 L36,33 L58,33 L61,14 L64,33 L69,33 L72,20 L75,33 L100,33',
  fleet: 'M0,30 L10,30 L14,18 L22,18 L26,30 L38,30 L42,9 L56,9 L60,30 L66,30 L70,22 L78,22 L82,30 L100,30'
};
function _lpPath(shape){
  if(LP_SHAPES[shape]) return LP_SHAPES[shape];
  if(shape === 'steps'){
    let d='M0,34', y=34;
    for(let i=1;i<=5;i++){ const x=i*20; y=34-i*5.2; d+=' L'+(x-20)+','+(y+5.2)+' L'+(x-20)+','+y+' L'+x+','+y; }
    return d+' L100,34';
  }
  /* wave por defecto: seno muestreado, periodo exacto de 100 para que el bucle cierre */
  let d='';
  for(let x=0;x<=100;x+=4){
    const y = 22 - Math.sin(x/100*Math.PI*2)*9;
    d += (x?' L':'M') + x + ',' + y.toFixed(2);
  }
  return d;
}
function livePulse(cfg){
  cfg = cfg || {};
  const d = _lpPath(cfg.shape || 'wave');
  const sp = (cfg.speed || 5) + 's';
  return '<div class="lp-wrap"'+(cfg.label?' data-lp="'+cfg.label+'"':'')+'>'
    + '<svg class="lp" viewBox="0 0 200 40" preserveAspectRatio="none">'
    +   '<g class="lp-scroll" style="--sp:'+sp+'">'
    +     '<path d="'+d+'"/><path d="'+d+'" transform="translate(100,0)"/>'
    +   '</g></svg>'
    + '<span class="lp-head"></span></div>';
}

/* ==================== 10 · PUNTO LATENTE EN UNA GRÁFICA ====================
   El anillo que late sobre el último punto de una serie: "el dato sigue llegando".

   Se pinta en HTML sobre el canvas, NO dentro de Chart.js. Motivo: un pulso continuo
   dentro del canvas obliga a repintar la gráfica entera a 60fps; en HTML lo mueve el
   compositor y cuesta cero. Se reposiciona una vez por render, no por frame. */
function attachLivePoint(chart, opts){
  if(!chart) return;
  opts = opts || {};
  const box = chart.canvas.parentElement;
  if(!box) return;
  if(getComputedStyle(box).position === 'static') box.style.position = 'relative';
  const id = 'lpt-' + chart.canvas.id;
  let el = box.querySelector('#'+CSS.escape(id));
  if(!el){ el = document.createElement('span'); el.id = id; el.className = 'lpt'; box.appendChild(el); }
  const place = function(){
    try{
      const di = opts.datasetIndex == null ? 0 : opts.datasetIndex;
      const meta = chart.getDatasetMeta(di);
      if(!meta || !meta.data || !meta.data.length){ el.style.display='none'; return; }
      let i = meta.data.length - 1;
      const ds = chart.data.datasets[di];
      while(i >= 0 && (ds.data[i] == null || (typeof ds.data[i] === 'object' && ds.data[i].y == null))) i--;
      if(i < 0){ el.style.display='none'; return; }
      const p = meta.data[i];
      el.style.display = 'block';
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      el.style.setProperty('--c', opts.color || (typeof ds.borderColor === 'string' ? ds.borderColor : '#1E6B7A'));
    }catch(e){ el.style.display='none'; }
  };
  requestAnimationFrame(place);
  chart.$livePoint = place;
  return el;
}


/* ==================== 11 · SUB-NOTA Y CONTRATO DE INTERACCIÓN (v5.2) ====================
   subNote({read, act, kind})
     read — la LECTURA ya interpretada, en una frase. No repite el título.
     kind — 'filter' | 'detail' | 'read'. Define color, icono y si hay acción.
     act  — el texto de la acción; si se omite, se usa el estándar del kind.

   POR QUÉ EL CONTRATO. Un tablero donde TODO filtra es tan confuso como uno donde
   nada filtra: el usuario prueba, algo se mueve, y ya no sabe qué está viendo.
   La regla que hace que se entienda sin probar:

     · Gráfica de una DIMENSIÓN (filial, motivo, cohorte, carrier, semana)
         → clic FILTRA. Es intuitivo: elegir una categoría es acotar el universo.
     · Gráfica de una MEDIDA o distribución (scatter, histograma, serie, gauge, well)
         → clic ABRE DETALLE. Filtrar por "los que duraron 47 días" no significa nada.
     · Gráfica de contexto o referencia (bandas, comparativas contra campo)
         → SOLO LECTURA. Sin cursor de mano, sin promesa que no se cumple.

   Si una gráfica no encaja limpio en una de las tres, se deja en 'read'. */
const SN_ICON = {
  filter:'<path d="M3 4h18l-7 8v6l-4 2v-8Z"/>',
  detail:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  read:  '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>'
};
const SN_ACT = {filter:'clic filtra →', detail:'clic abre detalle →', read:''};
function subNote(cfg){
  if(typeof cfg === 'string') cfg = {read:cfg, kind:'read'};
  const k = cfg.kind || 'read';
  return '<div class="subnote '+k+'">'
    + '<span class="ic"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+SN_ICON[k]+'</svg></span>'
    + '<span class="tx">'+cfg.read+'</span>'
    + (k === 'read' ? '' : '<span class="act">'+(cfg.act || SN_ACT[k])+'</span>')
    + '</div>';
}
/* Coloca la sub-nota bajo el canvas y marca la card para que el cursor sea coherente. */
function chartNote(canvasId, cfg){
  const cv = document.getElementById(canvasId); if(!cv) return;
  const card = cv.closest('.gcard') || cv.parentElement.parentElement; if(!card) return;
  const k = (typeof cfg === 'string') ? 'read' : (cfg.kind || 'read');
  let el = card.querySelector(':scope > .subnote');
  if(!el){ el = document.createElement('div'); card.appendChild(el); }
  el.outerHTML = subNote(cfg);
  card.classList.toggle('act-none', k === 'read');
}

/* ==================== 12 · SEÑAL POR UMBRAL ====================
   sigClass(valor, {alert, warn, better}) → '' | 'sig-alert' | 'sig-warn'
   El único lugar donde se decide si algo se anima. Si el llamador no pasa umbrales,
   devuelve cadena vacía: sin umbral declarado no hay urgencia que mostrar. */
function sigClass(v, o){
  o = o || {};
  if(v == null || !isFinite(v)) return '';
  const low = (o.better || 'high') === 'low';
  const cross = (t) => t == null ? false : (low ? v >= t : v <= t);
  if(cross(o.alert)) return 'sig-alert';
  if(cross(o.warn))  return 'sig-warn';
  return '';
}
/* El punto latente sólo late si su última muestra cruzó el umbral. Si no, queda quieto. */
function livePointState(chart, on){
  if(!chart || !chart.canvas) return;
  const el = chart.canvas.parentElement && chart.canvas.parentElement.querySelector('.lpt');
  if(el) el.classList.toggle('calm', !on);
}
