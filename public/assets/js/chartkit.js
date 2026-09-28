/* OMMA chartkit v3 — Chart.js 4.4.1
   Motion DCC · plugins · modelo semántico + cross-filter · recetario por tipo
   · tooltip de 3 capas · tarjeta HTML flotante · blindaje anti-canvas-en-blanco.
   Sistemas: A Panel frío (PJS+Manrope+JetBrains) · B Panel cálido (PJS+Space Grotesk) · C Editorial.
   Cargar DESPUÉS de chart.umd.min.js. Ver SKILL.md §5. */

/* ==================== tokens ==================== */
const OMMA={ink:'#1B2538',ink2:'#4F5B6E',mut:'#8893A6',faint:'#B6BDC0',line:'#E5E9F0',grid:'#EEF2F6',paper:'#FAFBFC',
  teal:'#1E6B7A',tealSoft:'#B8DDE3',tealBg:'#ECF4F6',mint:'#7DCFB6',mintSoft:'#D4EFE6',
  coral:'#F08080',coralSoft:'#FBD9D9',amber:'#F4B860',amberSoft:'#FCE8C8',
  lavender:'#9D8FCB',lavenderSoft:'#E2DCF1',sky:'#6BAED6',skySoft:'#D0E5F2',
  success:'#4CAF7D',warning:'#E6A23C',danger:'#D9534F',
  /* derivados oscuros: texto sobre pastel (nunca pastel sobre pastel) */
  mintD:'#3F9E7F',amberD:'#C88B3D',amberD2:'#A06B22',coralD:'#C25151',coralD2:'#A23A36',
  lavenderD:'#7062A8',skyD:'#3F7BA8',greenD:'#2E8B5F',tealHover:'#185863',navy:'#15384A',navy2:'#0F2A38',
  brick:'#C94F4F',gold:'#C99A17',green:'#2F9E63',orange:'#DE7A36',tealE:'#2E8FA0',purple:'#8C63AC',
  /* panel cálido JE */
  char:'#2A2A34',lime:'#8FB01E',limeBright:'#B0D028',limeD:'#74921A',limeP:'#EDF4D2',violet:'#7E72C0',
  cat:['#1E6B7A','#F4B860','#9D8FCB','#F08080','#7DCFB6','#6BAED6','#8C63AC','#94A3B2']};
const CARRIER_COLORS={'MAXCARGO - COMPANY':'#1E6B7A','MAXCARGO':'#1E6B7A','JE':'#F4B860','MASIV':'#9D8FCB','MEDRANOS':'#F08080','RENTROL':'#7DCFB6'};
/* Colores literales de Excel — SOLO en tablas que replican un reporte que la operación ya conoce */
const XLS={red:'#C00000',orange:'#F6B26B',yellow:'#FFD966',yellowSoft:'#FFE599',redSoft:'#E06666'};

/* ==================== helpers de color ==================== */
function oA(hex,a){if(typeof hex!=='string')return hex;
  if(hex[0]!=='#'){const m=hex.match(/rgba?\(([^)]+)\)/);if(!m)return hex;
    const p=m[1].split(',').map(function(x){return x.trim()});return 'rgba('+p[0]+','+p[1]+','+p[2]+','+a+')';}
  const h=hex.replace('#','');return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+a+')';}
function oGrad(ctx,area,hex,a1,a2){try{const g=ctx.createLinearGradient(0,area.top,0,area.bottom);
  g.addColorStop(0,oA(hex,a1));g.addColorStop(1,oA(hex,a2==null?0:a2));return g;}catch(e){return oA(hex,a1);}}
/* Gradiente radial para arcos de doughnut: claro al centro, sólido al borde */
function oRadial(ctx,cx,cy,r0,r1,hex){try{const g=ctx.createRadialGradient(cx,cy,r0,cx,cy,r1);
  g.addColorStop(0,lighten(hex,35));g.addColorStop(1,hex);return g;}catch(e){return hex;}}
function lighten(hex,p){const h=hex.replace('#','');const f=function(c){return Math.max(0,Math.min(255,c+Math.round(2.55*p)))};
  const r=f(parseInt(h.slice(0,2),16)),g=f(parseInt(h.slice(2,4),16)),b=f(parseInt(h.slice(4,6),16));
  return '#'+[r,g,b].map(function(x){return x.toString(16).padStart(2,'0')}).join('');}
function darken(hex,p){return lighten(hex,-p)}

/* ==================== defaults globales (fluidez DCC) ==================== */
Chart.defaults.font.family="'Plus Jakarta Sans','Inter',-apple-system,'Segoe UI',sans-serif";
Chart.defaults.font.size=11.5;
Chart.defaults.color=OMMA.ink2;
Chart.defaults.borderColor=OMMA.line;
Chart.defaults.maintainAspectRatio=false;
Chart.defaults.responsive=true;
Chart.defaults.interaction.mode='index';
Chart.defaults.interaction.intersect=false;
Chart.defaults.animation={duration:550,easing:'easeOutQuart'};
Chart.defaults.animations={colors:{duration:220,easing:'easeOutQuad'},numbers:{duration:500,easing:'easeOutQuart'},x:{duration:400},y:{duration:400}};
Chart.defaults.transitions={active:{animation:{duration:180}},resize:{animation:{duration:0}},show:{animation:{duration:350}},hide:{animation:{duration:200}}};
Chart.defaults.resizeDelay=60;
Chart.defaults.elements.bar.borderRadius=6;
Chart.defaults.elements.bar.borderSkipped=false;
Chart.defaults.elements.line.tension=0.35;
Chart.defaults.elements.line.borderWidth=2.5;
Chart.defaults.elements.line.fill=false;
Chart.defaults.elements.point.radius=0;
Chart.defaults.elements.point.hoverRadius=6;
Chart.defaults.elements.point.hitRadius=14;   /* zona de detección amplia: la línea es fácil de apuntar */
Chart.defaults.elements.point.hoverBorderWidth=2;
Chart.defaults.elements.point.hoverBorderColor='#fff';
Chart.defaults.elements.arc.borderWidth=3;
Chart.defaults.elements.arc.borderColor='#fff';
Chart.defaults.elements.arc.hoverOffset=6;

/* Tooltip premium — SIEMPRE Object.assign, nunca asignación directa */
Object.assign(Chart.defaults.plugins.tooltip,{enabled:true,
  backgroundColor:'rgba(15,42,56,0.97)',titleColor:'#7DCFB6',
  titleFont:{size:12.5,weight:'800'},titleMarginBottom:8,
  bodyColor:'#FFFFFF',bodyFont:{size:11.5,weight:'500'},bodySpacing:5,
  footerColor:'#B6BDC0',footerFont:{size:10,weight:'600'},
  padding:{top:10,bottom:10,left:13,right:14},cornerRadius:10,
  displayColors:true,boxWidth:9,boxHeight:9,boxPadding:5,
  borderColor:'rgba(125,207,182,0.25)',borderWidth:1,caretSize:6,caretPadding:8,usePointStyle:true});
Object.assign(Chart.defaults.plugins.legend,{display:false}); /* legend custom HTML clickeable cuando haga falta */

/* ==================== ejes estándar ==================== */
const gX={grid:{display:false},border:{display:false},ticks:{color:OMMA.mut,font:{size:10},maxRotation:0,autoSkipPadding:8}};
const gY={grid:{color:OMMA.grid},border:{display:false},ticks:{color:OMMA.mut,font:{size:10}},beginAtZero:true};
/* Eje Y con callback de formato: gYf(fmt.money) */
function gYf(f,opts){return Object.assign({},gY,{ticks:Object.assign({},gY.ticks,{callback:f})},opts||{})}
/* Eje derecho: sin grid, color propio */
function gY1(f,color,title){return{position:'right',grid:{display:false},border:{display:false},
  ticks:{color:color||OMMA.mut,font:{size:10},callback:f},
  title:title?{display:true,text:title,color:color||OMMA.mut,font:{size:9.5,weight:'800'}}:undefined};}
/* Resalta una línea de meta DENTRO del grid, sin plugin de anotación */
function gYtarget(target,f){return Object.assign({},gY,{
  ticks:Object.assign({},gY.ticks,{callback:f}),
  grid:{color:function(c){return c.tick.value===target?'rgba(46,158,107,.5)':OMMA.grid},
        lineWidth:function(c){return c.tick.value===target?2:1}}});}

/* ==================== plugins ==================== */
/* paintMark — única señal fiable de "el chart existe pero NUNCA se pintó" (§6.2) */
const PaintMarkPlugin={id:'paintMark',afterRender(chart){chart.$painted=true;}};

/* Crosshair con SNAP AL ÍNDICE. Sin snap vibra entre puntos y repinta en cada píxel.
   args.changed=true — NUNCA chart.draw(). Se apaga por chart con plugins:{crosshair:false}. */
const CrosshairPlugin={id:'crosshair',
  afterEvent(chart,args){
    if(chart.options.plugins&&chart.options.plugins.crosshair===false){chart._crossX=null;return;}
    const e=args.event;const prev=chart._crossX;
    if(e.type==='mouseout'||args.inChartArea===false){chart._crossX=null;}
    else if(e.type==='mousemove'){
      let x=e.x;
      const act=chart.tooltip&&chart.tooltip._active;
      if(act&&act.length&&act[0].element&&act[0].element.x!=null)x=act[0].element.x;  /* snap */
      chart._crossX=x;}
    if(prev!==chart._crossX)args.changed=true;},
  afterDatasetsDraw(chart){if(chart._crossX==null)return;
    if(['doughnut','pie','radar','polarArea'].includes(chart.config.type))return;
    const x=chart._crossX,a=chart.chartArea;if(!a||x<a.left||x>a.right)return;const ctx=chart.ctx;
    ctx.save();ctx.strokeStyle='rgba(30,107,122,0.35)';ctx.setLineDash([3,3]);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,a.top);ctx.lineTo(x,a.bottom);ctx.stroke();ctx.restore();}};

/* Doughnut center ADAPTATIVO: reduce el font hasta que cabe en el hueco y trunca el label.
   Un center label desbordado es el error más visible de un doughnut. */
const DoughnutCenterPlugin={id:'doughnutCenter',
  afterDraw(chart,args,opts){if(!['doughnut','pie'].includes(chart.config.type))return;
    const o=opts||(chart.options.plugins&&chart.options.plugins.doughnutCenter)||{};
    if(!o.text&&!o.value)return;
    const m=chart.getDatasetMeta(0);if(!m||!m.data.length)return;
    const el=m.data[0];const cx=el.x,cy=el.y;const ir=el.innerRadius||46;const maxW=ir*1.7;
    const ctx=chart.ctx;const fam=o.family||"'Manrope','Inter',sans-serif";
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    let fs=Math.min(o.maxSize||24,Math.max(11,ir*0.42));
    const val=String(o.value==null?'':o.value);
    if(val){ctx.font='800 '+fs+"px "+fam;
      while(fs>9&&ctx.measureText(val).width>maxW){fs-=1;ctx.font='800 '+fs+"px "+fam;}
      ctx.fillStyle=o.valueColor||OMMA.ink;ctx.fillText(val,cx,cy-fs*0.32);}
    if(o.text){const ls=Math.max(7,Math.min(11,ir*0.16));
      ctx.font='700 '+ls+"px "+fam;ctx.fillStyle=o.textColor||OMMA.mut;
      let lb=String(o.text).toUpperCase();
      while(lb.length>4&&ctx.measureText(lb).width>maxW){lb=lb.slice(0,-2);}
      ctx.fillText(lb,cx,cy+fs*0.62);}
    ctx.restore();}};

/* HoverDim declarativo: guarda el índice activo; el color lo resuelve la scriptable dim().
   Cero re-render manual, cero mutación de datasets. */
const HoverDimPlugin={id:'hoverdim',
  afterEvent(chart,args){const ac=chart.getActiveElements();const i=(ac&&ac.length)?ac[0].index:-1;
    if(chart._dim!==i){chart._dim=i;args.changed=true;}}};

Chart.register(PaintMarkPlugin,CrosshairPlugin,DoughnutCenterPlugin,HoverDimPlugin);

/* dim(colors) → backgroundColor scriptable: el no-hover baja a alpha .25 */
function dim(colors,alpha){alpha=alpha==null?.25:alpha;
  return function(ctx){const i=ctx.dataIndex,d=ctx.chart._dim;
    const b=Array.isArray(colors)?colors[i%colors.length]:colors;
    return (d==null||d<0||d===i)?b:oA(b,alpha);};}
/* dimc(hex) → versión "contexto": semana/serie no seleccionada */
function dimc(hex){return oA(hex,.2)}

/* attachHoverDim — alternativa imperativa para barras simples y doughnuts */
function attachHoverDim(ch){ch._hoverDim=true;const prevHover=ch.options.onHover;const base=[];ch.data.datasets.forEach(function(d,i){base[i]=Array.isArray(d.backgroundColor)?d.backgroundColor.slice():null});
  ch.options.onHover=function(e,els){const idx=els.length?els[0].index:null;
    ch.data.datasets.forEach(function(d,i){if(base[i])d.backgroundColor=base[i].map(function(c,j){return idx==null||j===idx?c:oA(c,.25)})});
    if(e.native)e.native.target.style.cursor=els.length?'pointer':'default';
    if(prevHover)try{prevHover(e,els,ch)}catch(_){}
    ch.update('none');};
  const cv=ch.canvas;if(cv._dimLeave)cv.removeEventListener('mouseleave',cv._dimLeave); /* sin esto se apilan listeners de charts destruidos */
  cv._dimLeave=function(){ch.data.datasets.forEach(function(d,i){if(base[i])d.backgroundColor=base[i].slice()});try{ch.update('none')}catch(e){}};
  cv.addEventListener('mouseleave',cv._dimLeave);}

/* ==================== registry + mkChart blindado (§6.2) ==================== */
const CHZ={};
function mkChart(id,cfg){
  const el=document.getElementById(id);if(!el)return null;
  /* Resolver por CANVAS, no solo por registro: si una creación previa falló a medias,
     Chart.getChart aún lo conoce y sin destruirlo el canvas queda "in use" para siempre. */
  const ex=(Chart.getChart)?Chart.getChart(el):null;
  if(ex){try{ex.stop&&ex.stop()}catch(e){}try{ex.destroy()}catch(e){}}
  if(CHZ[id]&&CHZ[id]!==ex){try{CHZ[id].stop&&CHZ[id].stop()}catch(e){}try{CHZ[id].destroy()}catch(e){}}
  delete CHZ[id];
  cfg.options=cfg.options||{};
  const t=cfg.type,isPie=(t==='doughnut'||t==='pie'),isHoriz=cfg.options.indexAxis==='y',
        isScat=(t==='scatter'||t==='bubble');
  /* interacción correcta por tipo — el 'index' global no sirve en pie, scatter ni barra horizontal */
  if(isPie)cfg.options.interaction=Object.assign({mode:'nearest',intersect:true},cfg.options.interaction||{});
  else if(isScat)cfg.options.interaction=Object.assign({mode:'nearest',intersect:false},cfg.options.interaction||{});
  else if(isHoriz)cfg.options.interaction=Object.assign({mode:'index',intersect:false,axis:'y'},cfg.options.interaction||{});
  /* cursor pointer cuando hay algo clicable */
  const uh=cfg.options.onHover;
  cfg.options.onHover=function(e,els,ch){try{ch.canvas.style.cursor=(els&&els.length)?'pointer':'default'}catch(_){}
    if(uh)uh(e,els,ch);};
  let c=null;
  try{c=new Chart(el.getContext('2d'),cfg);}
  catch(e){console.error('[chartkit] fallo al crear',id,e);
    try{const z=Chart.getChart&&Chart.getChart(el);if(z)z.destroy();}catch(_){}}
  if(c){c.$born=Date.now();CHZ[id]=c;}
  return c;}
/* destroyPage('ov') destruye todos los charts cuyo id empieza por 'ov_' — convención pestaña_grafica */
function destroyPage(prefix){Object.keys(CHZ).forEach(function(k){if(k.indexOf(prefix+'_')===0){
  try{CHZ[k].destroy()}catch(e){}delete CHZ[k];}});}

/* ==================== formatters (contrato único: ejes = tooltips = tablas = KPIs) ==================== */
const fmt={
  int:n=>Intl.NumberFormat('en-US').format(Math.trunc(n||0)),
  num:n=>Intl.NumberFormat('en-US',{minimumFractionDigits:0,maximumFractionDigits:4}).format(n||0),
  num1:n=>Intl.NumberFormat('en-US',{minimumFractionDigits:1,maximumFractionDigits:4}).format(n||0),
  num2:n=>Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}).format(n||0),
  money:n=>'$'+Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0),
  money0:n=>'$'+Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n||0),
  /* abreviado para ejes; el tooltip siempre da el valor completo */
  moneyK:n=>{n=+n||0;const s=n<0?'-':'';n=Math.abs(n);
    return n>=1e6?s+'$'+(n/1e6).toFixed(2)+'M':n>=1000?s+'$'+(n/1000).toFixed(1)+'K':s+'$'+n.toFixed(0);},
  numK:n=>{n=+n||0;const s=n<0?'-':'';n=Math.abs(n);
    return n>=1e6?s+(n/1e6).toFixed(2)+'M':n>=1000?s+(n/1000).toFixed(1)+'K':s+String(Math.round(n));},
  mpg:n=>(n||0).toFixed(1),
  pct:n=>(n>=0?'+':'')+(n||0).toFixed(1)+'%',
  pct0:n=>(n||0).toFixed(0)+'%',
  pct1:n=>(n||0).toFixed(1)+'%',
  signed:(n,d)=>(n>=0?'+':'')+(n||0).toFixed(d==null?0:d)};
const SEP='────────────────';   /* separador dentro del tooltip, antes de las comparativas */

/* ==================== tooltip de 3 capas (§5.4) ====================
   tt3({title, label, rows}) — rows(i) devuelve el array de comparativas del afterBody.
   title = contexto · label = métrica con unidad · afterBody = comparativas + acción. */
function tt3(cfg){cfg=cfg||{};
  return{callbacks:Object.assign({
    title:function(items){return cfg.title?cfg.title(items):(items[0]?String(items[0].label):'')},
    label:function(c){return cfg.label?cfg.label(c):' '+c.dataset.label+': '+fmt.num(c.parsed.y)},
    afterBody:function(items){if(!cfg.rows)return undefined;
      const r=cfg.rows(items[0].dataIndex,items);if(!r||!r.length)return undefined;
      return [SEP].concat(r);}
  },cfg.callbacks||{})};}
/* vsTarget(v,t,'high') → 'vs target (120): 12% below' */
function vsTarget(v,t,better,label,f){if(t==null||!isFinite(t)||t===0)return null;f=f||fmt.num;
  const d=(v-t)/Math.abs(t);const good=(better==='low')?(v<=t):(v>=t);
  return 'vs '+(label||'target')+' ('+f(t)+'): '+Math.abs(d*100).toFixed(0)+'% '+(good?'above':'below');}

/* ==================== modelo semántico (§5.2) ==================== */
const MODEL={rows:[],dims:{},measures:{}};
const state={weeksSel:'all',carriersSel:'all',truckSel:null,charts:CHZ};
let RENDER_ALL=function(){};
function onFilterChange(fn){if(typeof fn==='function')RENDER_ALL=fn}
/* defineModel({rows, dims:{carrier:Object.assign(r=>r.carrier,{label:'Carrier'})}, measures:{loads:rs=>rs.length}}) */
function defineModel(cfg){cfg=cfg||{};
  MODEL.rows=cfg.rows||[];MODEL.dims=cfg.dims||{};MODEL.measures=cfg.measures||{};
  Object.keys(MODEL.dims).forEach(function(k){if(state[k]===undefined)state[k]='all'});
  return MODEL;}
function setHas(s,v){return s.has(v)||s.has(String(v))||s.has(Number(v))}
function setDel(s,v){[v,String(v),Number(v)].forEach(function(x){s.delete(x)})}
function inSel(sel,v){if(sel==='all'||!sel||!sel.size)return true;return setHas(sel,v)}
function isWeekIn(w){return state.weeksSel==='all'||setHas(state.weeksSel,w)}
function isCarrierIn(c){return state.carriersSel==='all'||setHas(state.carriersSel,c)}
/* rowsF('carrier') → hechos con TODOS los filtros MENOS el de esa dimensión
   (comportamiento Power BI: la gráfica de la dimensión filtrada no se vacía). */
function rowsF(except){const ks=Object.keys(MODEL.dims).filter(function(k){return k!==except&&state[k]!=='all'});
  if(!ks.length)return MODEL.rows.slice();
  return MODEL.rows.filter(function(r){return ks.every(function(k){return inSel(state[k],MODEL.dims[k](r))})});}
function uniq(rows,key){const s=new Set();(rows||[]).forEach(function(r){
  const v=(typeof key==='function')?key(r):r[key];if(v!=null&&v!=='')s.add(v)});return s.size}
/* groupBy agrupa PRIMERO y evalúa la medida sobre cada subconjunto:
   los ratios (turn rate, MPG, eficiencia) sólo salen correctos así — nunca sumar ni promediar ratios. */
function groupBy(dim,measure,rows,opts){
  const d=MODEL.dims[dim];if(!d)throw new Error('dimensión no definida: '+dim);
  const m=(typeof measure==='function')?measure:MODEL.measures[measure];
  if(!m)throw new Error('medida no definida: '+measure);
  const o=opts||{},b=new Map();
  (rows||rowsF(dim)).forEach(function(r){const k=d(r);if(k==null||k==='')return;
    if(!b.has(k))b.set(k,[]);b.get(k).push(r)});
  let out=Array.from(b.entries()).map(function(e){return [e[0],m(e[1])]});
  out.sort(o.by==='label'
    ?function(a,z){return String(a[0]).localeCompare(String(z[0]),'es',{numeric:true})}
    :function(a,z){return z[1]-a[1]});
  if(o.top)out=out.slice(0,o.top);
  return{labels:out.map(function(e){return e[0]}),data:out.map(function(e){return e[1]}),pairs:out};}
/* ctxSeries — "single con contexto": si hay 1 valor seleccionado, dibuja los últimos n con el resto atenuado */
function ctxSeries(all,selSet,n){n=n||8;
  const sel=(selSet==='all'||!selSet)?all.slice():all.filter(function(v){return setHas(selSet,v)});
  if(sel.length!==1)return{items:sel,sel:new Set(sel),single:false};
  const i=all.indexOf(sel[0]);const start=Math.max(0,i-n+1);
  return{items:all.slice(start,i+1),sel:new Set(sel),single:true};}

/* ==================== cross-filter global ==================== */
function crossFilter(dim,value){if(!(dim in MODEL.dims))return;
  const cur=state[dim];
  if(cur==='all')state[dim]=new Set([value]);
  else if(setHas(cur,value)){setDel(cur,value);if(!cur.size)state[dim]='all';}
  else cur.add(value);
  syncChips(dim);renderFilterBar();RENDER_ALL();}
function onMarkClick(dim){return function(e,els,chart){const c=chart||(e&&e.chart);
  if(!c||!els||!els.length)return;crossFilter(dim,c.data.labels[els[0].index]);}}
function syncChips(dim){const sel=state[dim];
  document.querySelectorAll('[data-chips="'+dim+'"] .chip').forEach(function(ch){
    const v=ch.dataset.v;
    ch.classList.toggle('active', v==='all' ? sel==='all' : (sel!=='all'&&setHas(sel,v)));});}
function activeFilters(){return Object.keys(MODEL.dims).filter(function(k){
  return state[k]!=='all'&&state[k]&&state[k].size})}
function clearFilters(){Object.keys(MODEL.dims).forEach(function(k){state[k]='all';syncChips(k)});
  renderFilterBar();RENDER_ALL();}
/* Barra de filtros activos — OBLIGATORIA: <div id="filterBar" class="filter-bar"></div> */
function renderFilterBar(sel){const bar=document.querySelector(sel||'#filterBar');if(!bar)return;
  const act=activeFilters();
  if(!act.length){bar.innerHTML='';bar.classList.remove('show');return;}
  const lbl=function(k){return MODEL.dims[k].label||k};
  bar.innerHTML='<span class="fb-label">Filtros activos</span>'+
    act.map(function(k){return Array.from(state[k]).map(function(v){
      return '<button class="fpill" data-dim="'+k+'" data-v="'+v+'">'+lbl(k)+': <b>'+v+'</b><i>×</i></button>'
    }).join('')}).join('')+
    '<button class="fclear">Limpiar todo</button>';
  bar.classList.add('show');
  bar.querySelectorAll('.fpill').forEach(function(p){p.addEventListener('click',function(){
    crossFilter(p.dataset.dim,p.dataset.v)})});
  bar.querySelector('.fclear').addEventListener('click',clearFilters);}
/* Chips genéricas: buildChips(container, items, dim, renderAll) — contenedor con data-chips="<dim>" */
function buildChips(container,items,key,renderAll){
  container.setAttribute('data-chips',key);
  container.innerHTML=['all'].concat(items).map(function(v){
    return '<button class="chip'+(v==='all'?' all active':'')+'" data-v="'+v+'">'+(v==='all'?'Todas':v)+'</button>'}).join('');
  container.querySelectorAll('.chip').forEach(function(chip){chip.addEventListener('click',function(){
    const v=chip.dataset.v;
    if(v==='all'){state[key]='all';syncChips(key);renderFilterBar();(renderAll||RENDER_ALL)();}
    else crossFilter(key,v);});});}

/* ==================== data labels sin ensuciar barras ====================
   options.plugins.endLabel={enabled:true, fmt:fmt.int} + layout:{padding:{right:44}}
   dataset.endLabel=false excluye una serie · dataset.endLabelFmt formato propio */
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
const EndLabelPlugin={id:'endLabel',
  afterDatasetsDraw(chart,args,opts){const o=opts||{};if(o.enabled!==true)return;
    const a=chart.chartArea;if(!a)return;const ctx=chart.ctx;
    const f=o.fmt||function(v){return Intl.NumberFormat('en-US').format(Math.round(v))};
    chart.data.datasets.forEach(function(ds,di){
      if(ds.endLabel===false)return;
      if((ds.type||chart.config.type)!=='line')return;
      const meta=chart.getDatasetMeta(di);if(meta.hidden||!meta.data.length)return;
      let i=meta.data.length-1,raw;
      while(i>=0){raw=ds.data[i];const v=(raw&&typeof raw==='object')?raw.y:raw;
        if(v!=null&&v===v)break;i--;}
      if(i<0)return;const p=meta.data[i];if(!p)return;
      const val=(raw&&typeof raw==='object')?raw.y:raw;
      const txt=String((ds.endLabelFmt||f)(val));
      const col=(typeof ds.borderColor==='string')?ds.borderColor:OMMA.teal;
      ctx.save();ctx.font=o.font||"800 10.5px 'Manrope','Inter',sans-serif";
      ctx.textBaseline='middle';ctx.textAlign='left';
      const pad=7,bw=ctx.measureText(txt).width+pad*2,bh=18;
      let x=p.x+9;if(x+bw>ctx.canvas.clientWidth-2)x=p.x-9-bw;
      const y=Math.min(Math.max(p.y,a.top+bh/2),a.bottom-bh/2);
      ctx.fillStyle='#fff';rrect(ctx,x,y-bh/2,bw,bh,6);ctx.fill();
      ctx.strokeStyle=oA(col,.35);ctx.lineWidth=1;rrect(ctx,x,y-bh/2,bw,bh,6);ctx.stroke();
      ctx.fillStyle=col;ctx.fillText(txt,x+pad,y+0.5);ctx.restore();});}};
Chart.register(EndLabelPlugin);

/* ==================== Detail Card flotante (scatter / filas) ====================
   Requiere <div id="detailCard" class="detail-card"><span class="dc-close">×</span>
   <div class="dc-title" id="dcTitle"></div><div id="dcBody"></div></div> */
function showDetail(evt,title,rows){const card=document.getElementById('detailCard');if(!card)return;
  document.getElementById('dcTitle').textContent=title;
  document.getElementById('dcBody').innerHTML=rows.map(function(r){
    return '<div class="dc-row"><span>'+r[0]+'</span><b'+(r[2]?' style="color:'+r[2]+'"':'')+'>'+r[1]+'</b></div>'}).join('');
  /* v5 · CONTENEDOR. Un ancestro con transform, filter o will-change convierte
     position:fixed en position:absolute respecto de ese ancestro (spec de CSS).
     .gcard hace translateY(-2px) en hover — justo cuando se hace clic —, así que una
     detail card declarada DENTRO de la card se anclaba a ella y se iba fuera de pantalla;
     su overflow:hidden además la recortaba. Se reubica en <body> una sola vez.
     Vale para cualquier capa flotante: popovers, tooltips fijables y modales. */
  if(card.parentElement !== document.body) document.body.appendChild(card);
  /* v5 · .detail-card nace en display:none, así que medirla antes de mostrarla daba 0 y
     el primer clic la colocaba con el tamaño de reserva (250×160) — descentrada y a veces
     fuera de pantalla. Se muestra invisible, se mide de verdad y recién entonces se posiciona.
     Todo dentro del mismo turno de JS: el navegador no llega a pintar el estado intermedio. */
  const vis=card.style.visibility;
  card.style.visibility='hidden';
  card.classList.add('show');
  const w=card.offsetWidth||250, h=card.offsetHeight||160;
  card.style.left=Math.min(Math.max(8,evt.clientX-w/2),innerWidth-w-8)+'px';
  /* si no cabe debajo del punto, se voltea encima en vez de pegarse al borde inferior */
  const below=evt.clientY+18, flip=(below+h>innerHeight-8);
  card.style.top=Math.max(8,flip?(evt.clientY-h-14):below)+'px';
  card.style.visibility=vis||'';}
function hideDetail(){const c=document.getElementById('detailCard');if(c)c.classList.remove('show')}
document.addEventListener('click',function(e){const c=document.getElementById('detailCard');
  if(c&&c.classList.contains('show')&&!c.contains(e.target)&&e.target.tagName!=='CANVAS')c.classList.remove('show');});

/* ==================== Tooltip HTML flotante .scfloat (§5.5) ====================
   Se monta en <body>: una card con overflow:hidden y transform en hover recorta
   y desplaza cualquier tooltip interno. Se mide fuera de pantalla y se clampa al viewport. */
function ensureScFloat(canvas){const id='scfloat-'+(canvas.id||'x');let f=document.getElementById(id);
  if(!f){f=document.createElement('div');f.className='scfloat';f.id=id;document.body.appendChild(f);}
  canvas.__scfloat=f;return f;}
function showScFloat(canvas,evt,html){const f=ensureScFloat(canvas);f.innerHTML=html;
  const ne=(evt&&evt.native)?evt.native:evt;const vx=ne.clientX,vy=ne.clientY;
  f.style.position='fixed';f.style.left='-9999px';f.style.top='0px';f.classList.add('on'); /* medir oculto */
  const fw=f.offsetWidth||280,fh=f.offsetHeight||140,pad=12;
  let left=vx+18;if(left+fw>innerWidth-pad)left=vx-fw-18;                 /* flip de lado */
  if(left<pad)left=pad;if(left+fw>innerWidth-pad)left=innerWidth-fw-pad;
  let top=vy-fh/2;if(top<pad)top=pad;if(top+fh>innerHeight-pad)top=innerHeight-fh-pad;
  f.style.left=left+'px';f.style.top=top+'px';return f;}
function hideScFloat(canvas){const f=canvas&&canvas.__scfloat;if(f&&!f.classList.contains('pinned'))f.classList.remove('on');}
function clearAllFloats(){document.querySelectorAll('.scfloat').forEach(function(f){f.classList.remove('on','pinned');f.style.position='';});}
/* el scroll mata las tarjetas de hover, no las fijadas */
window.addEventListener('scroll',function(){document.querySelectorAll('.scfloat.on:not(.pinned)').forEach(function(p){p.classList.remove('on')})},true);
/* fila k/v lista para el innerHTML de .scfloat */
function scRow(k,v,cls){return '<div class="scrow"><span>'+k+'</span><span'+(cls?' class="'+cls+'"':'')+'>'+v+'</span></div>';}

/* ==================== Cumulative Gap Tracker ====================
   gapTracker(labels, cumActual, cumTarget, hex, totalPlan) → {datasets, tooltip} */
function gapTracker(labels,cumActual,cumTarget,hex,totalPlan){hex=hex||OMMA.teal;
  return{
    datasets:[
      {type:'line',label:'Acumulado',data:cumActual,borderColor:hex,
       backgroundColor:function(c){return c.chart.chartArea?oGrad(c.chart.ctx,c.chart.chartArea,hex,.16,0):oA(hex,.1)},
       fill:true,pointRadius:0,pointHoverRadius:7},
      {type:'line',label:'Target',data:cumTarget,borderColor:OMMA.ink,borderDash:[6,4],borderWidth:1.8,pointRadius:0}],
    tooltip:{callbacks:{afterBody:function(items){const i=items[0].dataIndex;
      const a=cumActual[i]||0,t=cumTarget[i]||0,gap=a-t;
      const out=[SEP,'Gap acumulado: '+(gap>=0?'+':'')+fmt.int(gap)+(t?' ('+((gap/Math.abs(t))*100).toFixed(1)+'%)':'')];
      if(totalPlan)out.push('Remaining: '+fmt.int(Math.max(0,totalPlan-a)));
      return out;}}}};}

/* ==================== gauge 270° / ring de score ==================== */
function gauge(id,val,max,color,centerVal,centerLbl,opts){opts=opts||{};
  return mkChart(id,{type:'doughnut',
    data:{datasets:[{data:[val,Math.max(0,max-val)],backgroundColor:[color,'#ECEFF2'],borderWidth:0,
      circumference:opts.full?360:270,rotation:opts.full?0:225,borderRadius:opts.full?[6,0]:0}]},
    options:{cutout:opts.cutout||'76%',
      plugins:{crosshair:false,legend:{display:false},tooltip:{enabled:false},
        doughnutCenter:{value:centerVal,text:centerLbl,valueColor:color}}}});}

/* ==================== count-up + barras HTML ==================== */
function countUp(el,to,ms,fmtFn){if(!el)return;ms=ms||500;
  fmtFn=fmtFn||function(v){return Intl.NumberFormat('en-US').format(Math.round(v))};
  const from=parseFloat((el.dataset.v||'0'))||0;const t0=performance.now();
  function step(t){const p=Math.min(1,(t-t0)/ms);const e=1-Math.pow(1-p,3);
    el.textContent=fmtFn(from+(to-from)*e);if(p<1)requestAnimationFrame(step);else el.dataset.v=to;}
  requestAnimationFrame(step);}
/* Las barras se pintan a 0 y se disparan en el frame siguiente para que la transición CSS corra */
function animBars(sel){requestAnimationFrame(function(){
  document.querySelectorAll(sel||'.pbar i,.pdbar-fill,.bench-je,.fill').forEach(function(b){
    if(b.dataset.w!=null)b.style.width=b.dataset.w+'%';
    if(b.dataset.s!=null)b.style.transform='scaleX('+b.dataset.s+')';});});}
/* Reveal: sólo se anima lo que está por DEBAJO del 94% del viewport; nunca re-anima */
function revealOnScroll(sel){
  if(matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const els=Array.from(document.querySelectorAll(sel||'[data-reveal]'));
  const below=els.filter(function(el){return el.getBoundingClientRect().top>innerHeight*0.94});
  below.forEach(function(el){el.style.opacity='0';el.style.transform='translateY(16px)';
    el.style.transition='opacity .55s ease, transform .55s ease';});
  const io=new IntersectionObserver(function(entries){entries.forEach(function(en){
    if(en.isIntersecting){en.target.style.opacity='1';en.target.style.transform='none';io.unobserve(en.target);}})},{threshold:0.08});
  below.forEach(function(el){io.observe(el)});}

/* ==================== tabs: resize SOLO de lo visible + deep-link (§6.1) ====================
   Redimensionar también las gráficas de pestañas ocultas (parent 0px) deja la
   pestaña recién abierta en canvas 0×0 → card en blanco. Se filtra por visibilidad. */
function resizeVisibleCharts(){Object.keys(CHZ).forEach(function(k){const c=CHZ[k];if(!c||!c.canvas)return;
  const par=c.canvas.parentNode;if(!par||!par.clientWidth)return;
  if(c.canvas.width===0||Math.abs(c.canvas.clientWidth-par.clientWidth)>1){try{c.resize()}catch(e){}}});}
function wireTabs(tabSel,paneAttr,onShow){
  function show(btn){const key=btn.dataset[paneAttr];
    document.querySelectorAll(tabSel).forEach(function(x){x.classList.remove('active')});
    btn.classList.add('active');
    document.querySelectorAll('[data-pane]').forEach(function(p){p.classList.toggle('active',p.dataset.pane===key)});
    clearAllFloats();
    resizeVisibleCharts();                       /* síncrono: el layout ya se aplicó */
    requestAnimationFrame(resizeVisibleCharts);  /* red de seguridad tras el reflow */
    settleVisibleCharts();                       /* v5: draw síncrono de las que no alcanzaron el frame */
    try{history.replaceState(null,'','#'+key)}catch(e){}
    if(onShow)onShow(key);}
  document.querySelectorAll(tabSel).forEach(function(t){t.addEventListener('click',function(){show(this)})});
  const h=(location.hash||'').replace('#','');
  if(h){const t=document.querySelector(tabSel+'[data-'+paneAttr+'="'+h+'"]');if(t)show(t);}}

/* ==================== blindaje: watchdog + auditoría (§6.2) ==================== */
/* __chartAudit() imprime el estado real de cada canvas visible */
function __chartAudit(){const out=[];document.querySelectorAll('canvas').forEach(function(cv){
  const ch=(Chart.getChart&&Chart.getChart(cv))||CHZ[cv.id]||null;
  out.push({id:cv.id||'(sin id)',visible:cv.offsetParent!==null,chart:!!ch,
    w:ch?ch.width:cv.width,h:ch?ch.height:cv.height,pintado:ch?!!ch.$painted:false});});
  if(console.table)console.table(out);return out;}
/* Watchdog: resucita charts colapsados o que nunca pintaron. onRebuild(ids) es el último recurso. */
function startChartWatchdog(onRebuild,everyMs){
  const WD={last:0,streak:0};
  return setInterval(function(){try{
    if(document.hidden)return;
    const dead=[];const now=Date.now();
    document.querySelectorAll('canvas').forEach(function(cv){
      if(cv.offsetParent===null)return;                       /* pestaña oculta: no es un fallo */
      if(cv.dataset&&cv.dataset.nochart)return;               /* canvas propio (no Chart.js): no se vigila */
      const ch=(Chart.getChart&&Chart.getChart(cv))||CHZ[cv.id]||null;
      if(!ch){dead.push(cv.id);return;}
      if(ch.width<=2||ch.height<=2){try{ch.resize()}catch(e){}
        if(ch.width<=2||ch.height<=2){dead.push(cv.id);return;}}
      if(!ch.$painted&&ch.$born&&(now-ch.$born)>1200){
        try{ch.update('none')}catch(e){}                      /* update('none') = draw síncrono */
        if(!ch.$painted)dead.push(cv.id);}});
    if(!dead.length){WD.streak=0;return;}
    if(now-WD.last<8000||WD.streak>=3)return;                 /* rate-limit: 1 cada 8s, máx 3 */
    WD.last=now;WD.streak++;
    console.warn('[watchdog] charts sin pintar:',dead);
    if(typeof onRebuild==='function')onRebuild(dead);
  }catch(e){console.error('[watchdog]',e)}},everyMs||4000);}

/* ==================== auditoría del contrato §5.1 — debe cerrar en 0 pendientes ==================== */
function auditCharts(){const rep=[];
  Object.keys(CHZ).forEach(function(id){const c=CHZ[id];if(!c||!c.config)return;
    const t=c.config.type,o=c.options||{},p=o.plugins||{},ds=c.data.datasets||[],miss=[];
    /* Excepción declarada del contrato: un gauge es un KPI dibujado como arco.
       No tiene dimensión que filtrar ni series que atenuar; sólo debe llevar center label. */
    if(c._gauge){
      const ok=!!(p.doughnutCenter&&(p.doughnutCenter.value||p.doughnutCenter.text));
      rep.push({chart:id,tipo:'gauge',pendientes:ok?0:1,
        detalle:ok?'OK · gauge (exento salvo center label)':'gauge sin center label'});
      return;}
    const circ=(t==='doughnut'||t==='pie'),
          scat=(t==='scatter'||t==='bubble'),
          hasBar=(t==='bar')||ds.some(function(d){return d.type==='bar'}),
          hasLine=(t==='line')||ds.some(function(d){return d.type==='line'}),
          cb=(p.tooltip&&p.tooltip.callbacks)||{},
          ttOff=(p.tooltip&&p.tooltip.enabled===false);
    if(!ttOff&&!(cb.afterBody||cb.footer||cb.afterLabel))miss.push('tooltip multi-métrica (afterBody)');
    if(ttOff&&!o.onHover)miss.push('tooltip nativo apagado sin tarjeta HTML (onHover)');
    if(circ&&!(p.doughnutCenter&&(p.doughnutCenter.value||p.doughnutCenter.text)))miss.push('doughnut center label');
    if(hasBar&&p.datalabels&&p.datalabels.display!==false)miss.push('data labels sobre barras (PROHIBIDO)');
    if(hasLine&&!(p.endLabel&&p.endLabel.enabled))miss.push('data label al final de la línea');
    if(!o.onClick)miss.push(scat?'click detail card':'click-to-filter');
    if((hasBar||circ)&&!c._hoverDim&&!_usesDim(c))miss.push('hover dimming (dim() o attachHoverDim)');
    if(scat&&!(o.interaction&&(o.interaction.mode==='nearest'||o.interaction.mode==='point')))
      miss.push("scatter/bubble: interaction.mode debe ser 'nearest' o 'point' (index duplica filas)");
    if(scat&&!ttOff&&!cb.label)miss.push('scatter: callbacks.label propio (no mostrar la tupla x,y)');
    rep.push({chart:id,tipo:t,pendientes:miss.length,detalle:miss.join(' · ')||'OK'});});
  const bad=rep.filter(function(r){return r.pendientes>0}).length;
  if(console.table)console.table(rep);
  console.log('%cauditCharts → '+rep.length+' charts | '+bad+' con pendientes',
    'font-weight:800;color:'+(bad?'#D9534F':'#4CAF7D'));
  return rep;}
function _usesDim(c){return (c.data.datasets||[]).some(function(d){return typeof d.backgroundColor==='function'})}
/* Nota: gap tracker (elemento 8) y cobertura mínima por dashboard se verifican a ojo
   sobre el screenshot — auditCharts no puede inferir si una serie tiene target. */

/* ============================================================================
   v4 — recetario avanzado destilado del P&L JE/RENTROL (49 charts).
   Ver SKILL.md §14 y §16.
   ========================================================================== */

/* ---------- semáforo universal: UN solo umbral para todo el reporte ----------
   100 / 90 / 80 del cumplimiento. Todo juicio del dashboard pasa por aquí. */
const SEM_COL={g:OMMA.success,y:'#D4A52E',o:'#D98A3C',r:OMMA.danger};
function sem(c){return c>=1?'g':c>=.9?'y':c>=.8?'o':'r'}
function semColor(c){return SEM_COL[sem(c)]}
/* Cumplimiento con curva raíz y tope: suaviza los extremos y evita que un
   outlier del 400% domine un score compuesto. alpha .60, cap 1.20. */
function comply(actual,std,inverse,alpha,cap){alpha=alpha==null?.6:alpha;cap=cap==null?1.2:cap;
  if(inverse)return actual<=0?cap:Math.min(cap,Math.pow(std/actual,alpha));
  return (std<=0||actual<=0)?0:Math.min(cap,Math.pow(actual/std,alpha));}

/* ---------- gauge 270° / ring de score ----------
   circumference:270 + rotation:225 → arranca abajo-izquierda. Track gris fijo.
   El label central se tiñe con el MISMO color del umbral. */
function gauge270(id,val,max,color,centerVal,centerLbl,opts){opts=opts||{};
  const c=mkChart(id,{type:'doughnut',
    data:{datasets:[{data:[Math.max(0,Math.min(val,max)),Math.max(0,max-val)],
      backgroundColor:[color,'#ECEFF2'],borderWidth:0,
      circumference:opts.full?360:270,rotation:opts.full?0:225,
      borderRadius:opts.full?[6,0]:0,
      /* El track gris NO es dato: sin esto, Chart.js lo desplaza y lo aclara al pasar el
         cursor, y el gauge parece invitar a un clic que no existe. hoverOffset:0 +
         hoverBackgroundColor idéntico + events:[] lo dejan completamente inerte. */
      hoverOffset:0,hoverBorderWidth:0,hoverBackgroundColor:[color,'#ECEFF2']}]},
    options:{cutout:opts.cutout||'76%',events:[],
      plugins:{crosshair:false,legend:{display:false},tooltip:{enabled:false},
        doughnutCenter:{value:centerVal,text:centerLbl,valueColor:color,maxSize:opts.maxSize||26}}}});
  if(c)c._gauge=true;   /* exento del contrato salvo el center label — no tiene datos que explorar */
  return c;}

/* ---------- modelo de radar N-prong ----------
   defs=[{ax,get,target,fmt,inv,baseline}] · devuelve métricas con pct normalizado a 0–120.
   · inv (menor es mejor)  → target/actual
   · baseline (0 es lo ideal: idle, speeding) → 0 eventos = 100%, baseline = 0%
   El cap universal es 120 y el eje r va 0→120 con paso 30. */
function radarModel(entity,defs){
  return defs.map(function(d){
    const a=d.get(entity), t=(typeof d.target==='function')?d.target(entity):d.target;
    let pct;
    if(d.baseline!=null){const b=(typeof d.baseline==='function')?d.baseline(entity):d.baseline;
      pct=a<=0?100:Math.max(0,(1-a/Math.max(1e-9,b))*100);}
    else if(d.inv)pct=a<=0?120:Math.min(120,(t/a)*100);
    else pct=t<=0?0:Math.min(120,(a/t)*100);
    return{ax:d.ax,actual:a,target:t,pct:Math.round(pct),fmt:d.fmt||fmt.num,inv:!!d.inv};});}
/* promedio del grupo: se promedian los VALORES reales por eje, no sólo el % */
function radarGroup(entities,defs){
  if(!entities.length)return[];
  const per=entities.map(function(e){return radarModel(e,defs)});
  return defs.map(function(d,i){
    return{ax:d.ax,fmt:d.fmt||fmt.num,inv:!!d.inv,
      actual:per.reduce((a,m)=>a+m[i].actual,0)/per.length,
      target:per.reduce((a,m)=>a+m[i].target,0)/per.length,
      pct:Math.round(per.reduce((a,m)=>a+m[i].pct,0)/per.length)};});}
const RADAR_SCALE={r:{min:0,max:120,beginAtZero:true,
  ticks:{display:true,stepSize:30,backdropColor:'transparent',color:'#B4B8C0',font:{size:8},callback:v=>v+'%',z:1},
  grid:{color:'#EBEFF3',circular:true},angleLines:{color:'#E6ECF2'},
  pointLabels:{font:{size:9,weight:'700'},color:OMMA.ink2,padding:4}}};
/* dataset por entidad; el alpha del relleno baja cuando hay muchas series encimadas */
function radarDataset(label,mets,color,n){
  return{label:label,data:mets.map(m=>m.pct),_metrics:mets,borderColor:color,
    backgroundColor:oA(color,(n||1)<=2?.14:.08),
    pointBackgroundColor:color,pointBorderColor:'#fff',pointBorderWidth:1.4,
    pointRadius:3,pointHoverRadius:6.5,borderWidth:2.2,fill:true,tension:.08};}
/* tabla de los N ejes para la tarjeta fijada */
function radarBreakdown(mets){
  const g='grid-template-columns:1.15fr 1fr 1fr .62fr;gap:3px 11px';
  const head='<div class="scrow" style="'+g+';margin-bottom:2px">'+
    ['Eje','Actual','Target','%'].map(function(h,i){
      return '<span style="color:#7E828C;font-size:8.5px;text-transform:uppercase'+(i?';text-align:right':'')+'">'+h+'</span>';}).join('')+'</div>';
  const rows='<div class="scrow" style="'+g+'">'+mets.map(function(m){
    const c=m.pct>=100?'#B0D028':m.pct>=90?'#E8D86A':m.pct>=80?'#E0A04A':'#F08080';
    return '<span style="color:#A6AAB5">'+m.ax+'</span>'+
      '<span style="color:#fff;text-align:right">'+m.fmt(m.actual)+'</span>'+
      '<span style="color:#C7CBD2;text-align:right">'+m.fmt(m.target)+'</span>'+
      '<span style="color:'+c+';font-weight:800;text-align:right">'+m.pct+'%</span>';}).join('')+'</div>';
  return head+rows;}

/* ---------- metric explorer: conmutador de métrica + 3 cajas + combo ----------
   defs={income:{lbl,fmt,axis,better:'high'|'low',val,tgt}, …}
   El combo es: barras (color por semáforo vs target) + target dashed + media anual punteada. */
function metricExplorer(cfg){
  const defs=cfg.metrics, seg=document.querySelector(cfg.seg), box=document.querySelector(cfg.stats);
  let cur=cfg.initial||Object.keys(defs)[0];
  function paint(){
    const d=defs[cur];
    if(seg)seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.m===cur));
    const rows=cfg.rows(), all=cfg.allRows?cfg.allRows():rows;
    const vals=rows.map(d.val), tgts=rows.map(d.tgt);
    const annMean=all.map(d.val).reduce((a,b)=>a+b,0)/(all.length||1);
    const pAvg=vals.reduce((a,b)=>a+b,0)/(vals.length||1);
    const tAvg=tgts.reduce((a,b)=>a+b,0)/(tgts.length||1);
    const meets=(v,t)=>d.better==='low'?v<=t:v>=t;
    const single=rows.length===1;
    const cols=rows.map((r,i)=>meets(vals[i],tgts[i])?OMMA.success:OMMA.danger);
    mkChart(cfg.canvas,{data:{labels:rows.map(cfg.label),datasets:[
      {type:'bar',label:d.lbl,data:vals,backgroundColor:dim(cols),borderRadius:6,
       maxBarThickness:single?60:24,order:3},
      {type:'line',label:'Target',data:tgts,borderColor:OMMA.ink,borderDash:[5,4],borderWidth:1.8,
       pointRadius:single?4:0,tension:.25,order:1,endLabel:false},
      {type:'line',label:'Media anual',data:rows.map(()=>annMean),borderColor:OMMA.lavender,
       borderDash:[2,3],borderWidth:1.6,pointRadius:0,order:2,endLabel:false}]},
     options:{scales:{x:gX,y:gYf(d.axis)},
       plugins:{crosshair:single?false:{},endLabel:{enabled:true,fmt:d.fmt},
         legend:{display:true,labels:{usePointStyle:true,boxWidth:8,font:{size:10.5}}},
         tooltip:tt3({title:it=>cfg.label(rows[it[0].dataIndex]),
           label:c=>' '+c.dataset.label+': '+d.fmt(c.parsed.y),
           rows:i=>{const r=rows[i],v=d.val(r),t=d.tgt(r);
             const dt=t?(v-t)/Math.abs(t):0, dm=annMean?(v-annMean)/Math.abs(annMean):0;
             return['vs target ('+d.fmt(t)+'): '+fmt.pct1(Math.abs(dt)*100)+' '+
                     (d.better==='high'?(v>=t?'arriba':'abajo'):(v<=t?'debajo':'encima')),
                    'vs media anual: '+fmt.pct1(Math.abs(dm)*100)+' '+(v>annMean?'arriba':'abajo')];}})},
       onClick:cfg.onClick}});
    if(box){
      const onT=Math.abs(tAvg?(pAvg-tAvg)/Math.abs(tAvg):0)<.02;    /* banda muerta ±2% = "EN META" */
      const ok=meets(pAvg,tAvg);
      const col=onT?'#D4A52E':(ok?OMMA.success:OMMA.danger);
      const txt=onT?'EN META':(d.better==='high'?(pAvg>tAvg?'SOBRE META':'BAJO META'):(pAvg>tAvg?'SOBRE LÍMITE':'BAJO LÍMITE'));
      const dm=annMean?(pAvg-annMean)/Math.abs(annMean):0;
      box.innerHTML=
        '<div class="ovme-chip"><div class="l">Promedio periodo · '+d.lbl+'</div><div class="v num">'+d.fmt(pAvg)+'</div><div class="s">'+rows.length+' periodos</div></div>'+
        '<div class="ovme-chip"><div class="l">Target</div><div class="v num">'+d.fmt(tAvg)+'</div><div class="s"><span class="ovme-stat" style="background:'+col+'">'+txt+'</span></div></div>'+
        '<div class="ovme-chip"><div class="l">Media anual</div><div class="v num">'+d.fmt(annMean)+'</div><div class="s">'+
          (Math.abs(dm)<.02?'● en la media':((dm>0?'▲ ':'▼ ')+fmt.pct1(Math.abs(dm)*100)))+'</div></div>';}
  }
  if(seg)seg.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){cur=b.dataset.m;paint();});});
  paint();
  return{paint,set:function(m){cur=m;paint();},get:function(){return cur;}};}

/* ---------- benchmark contra el campo ----------
   Color de la barra por ratio contra el benchmark, no por valor absoluto:
   ≥100% verde · ≥85% amarillo · resto rojo. */
function benchColor(v,bench){const r=bench>0?v/bench:(v>0?1.5:0);
  return r>=1?OMMA.success:r>=.85?'#D4A52E':OMMA.danger;}
/* pista doble DOM: el rival va en rayas diagonales, nunca en otro color pleno */
function benchTrackHTML(ownPct,otherPct,color){
  return '<div class="bench-track"><div class="bench-oth" style="width:'+otherPct+'%"></div>'+
    '<div class="bench-je" style="width:0%;background:'+color+'" data-w="'+ownPct+'"></div></div>';}

/* ---------- celdas de tabla con formato condicional ---------- */
/* heat RELATIVO al máximo visible: el degradado siempre usa el rango en pantalla */
function heatClass(v,maxV){if(!v||v<=0)return 'c0';
  const r=v/Math.max(maxV,1);return r>=.85?'c4':r>=.65?'c3':r>=.40?'c2':'c1';}
/* ptag(valor, ratioDeCumplimiento, formateador?) — si el valor ya viene formateado (string), se respeta */
function ptag(v,ratio,f){const s=sem(ratio);
  const txt=(typeof v==='string')?v:((f||fmt.num)(v));
  return '<span class="ptag '+(s==='g'?'good':s==='r'?'bad':'mid')+'">'+txt+'</span>';}
/* pérdida en AZUL (convención Tableau): el rojo se reserva al incumplimiento de meta */
function npCell(v,f){f=f||fmt.money0;
  if(v==null)return '<span class="dim">—</span>';
  return '<span class="npcell '+(v<0?'bad':v>0?'good':'neutral')+'">'+f(v)+'</span>';}
function pbarHTML(ratio){const p=Math.max(0,Math.min(100,ratio*100)),s=sem(ratio);
  return '<div class="pbarwrap"><div class="pbar"><i class="'+s+'" style="width:0%" data-w="'+p.toFixed(0)+'"></i></div>'+
    '<span class="pbarpct" style="color:'+SEM_COL[s]+'">'+p.toFixed(0)+'%</span></div>';}

/* ---------- reconciliación físico → facturado (largest remainder) ----------
   Reparte un total facturado entre celdas físicas sin perder ni inventar unidades.
   Sin esto, las barras diarias no suman lo que dice la prefactura. */
function reconcile(physical,billed){
  const tot=physical.reduce((a,b)=>a+b,0);
  if(!tot||billed===tot)return physical.slice();
  const f=billed/tot, raw=physical.map(v=>v*f), out=raw.map(Math.floor);
  let rem=billed-out.reduce((a,b)=>a+b,0);
  raw.map(function(v,i){return{i:i,fr:v-Math.floor(v)}})
     .sort((a,b)=>b.fr-a.fr)
     .slice(0,Math.max(0,rem))
     .forEach(function(o){out[o.i]++;});
  return out;}

/* ---------- contrato de anomalía ----------
   {sev:'alta'|'media'|'baja', type, entity, entityId?, week?, detail, metric, action, link, linkWeek?}
   Se RECALCULAN enteras en cada render: las anomalías respetan siempre el filtro activo. */
const SEV_RANK={alta:90,media:70,baja:50};
const SEV_LBL={alta:'ALTA',media:'MEDIA',baja:'BAJA'};
const SEV_CLS={alta:'high',media:'med',baja:'low'};
function sevBadge(sev){return '<span class="sev '+(SEV_CLS[sev]||'low')+'">'+
  '<span class="lvl">'+(SEV_LBL[sev]||'—')+'</span>'+
  '<span class="scr">'+(SEV_RANK[sev]||50)+'/100</span></span>';}


/* ============================================================================
   v5 — 26/Jul/2026. Ver references/chartjs.md §40–45.
   ========================================================================== */

/* ---------- entrada de las gráficas ----------
   Los defaults de Chart.js entran con un rebote genérico. Las barras deben crecer
   desde el CERO DEL EJE: es la única entrada que respeta el significado del gráfico. */
Chart.defaults.animation.duration = 720;
Chart.defaults.animation.easing = 'easeOutQuart';
Chart.defaults.animations.y = {
  from:function(ctx){ try{ return ctx.chart.scales.y ? ctx.chart.scales.y.getPixelForValue(0) : undefined; }catch(e){ return undefined; } }};
Chart.defaults.transitions.active.animation.duration = 180;   /* el hover responde ya */

/* ---------- líneas de referencia (§44) ----------
   Sólo pinta: no toca eventos, así que no necesita args.changed.
   Etiqueta sobre caja blanca para que no se pierda entre los puntos. */
const RefLinesPlugin={id:'refLines',
  afterDatasetsDraw:function(chart,args,opts){const o=opts||{};if(!o.lines||!o.lines.length)return;
    const a=chart.chartArea,y=chart.scales.y,ctx=chart.ctx;if(!a||!y)return;
    ctx.save();
    o.lines.forEach(function(L){const py=y.getPixelForValue(L.v);
      if(!isFinite(py)||py<a.top||py>a.bottom)return;
      ctx.setLineDash([5,4]);ctx.lineWidth=1.2;ctx.strokeStyle=oA(L.c,.5);
      ctx.beginPath();ctx.moveTo(a.left,py);ctx.lineTo(a.right,py);ctx.stroke();
      ctx.setLineDash([]);
      ctx.font=o.font||"800 9.5px 'Manrope','Inter',sans-serif";
      ctx.textAlign='left';ctx.textBaseline='bottom';
      const w=ctx.measureText(L.t).width+10;
      ctx.fillStyle='#fff';ctx.fillRect(a.left+5,py-15,w,13);
      ctx.fillStyle=L.c;ctx.fillText(L.t,a.left+10,py-3);});
    ctx.restore();}};
Chart.register(RefLinesPlugin);

/* ---------- medida por etiqueta (§45) ----------
   groupBy ordena por valor salvo que se pida by:'label'. Cruzar dos groupBy por
   índice alinea mal las series y pinta la mediana en la barra equivocada.
   medBy resuelve la segunda medida CONTRA LA FILA, no contra la posición. */
function medBy(labels,dimFn,measure,rows){
  const R=rows||MODEL.rows, m=measure||MODEL.measures.mediana;
  return labels.map(function(l){return m(R.filter(function(r){return dimFn(r)===l}))});}

/* ---------- re-render diferido (§45) ----------
   mkChart destruye y recrea. Si eso ocurre DENTRO del dispatch de un clic de
   Chart.js, el plugin de tooltip sigue recorriendo el chart muerto y revienta con
   "Cannot read properties of undefined (reading 'handleEvent')".
   deferRender saca el re-render del dispatch y colapsa ráfagas de filtros. */
function deferRender(fn){let raf=0;
  return function(){ if(raf)return; raf=requestAnimationFrame(function(){raf=0;fn();}); };}

/* ---------- color de ausencia ----------
   Un grupo sin dato NO es el peor caso: es gris. Pintar la ausencia con el color
   del peor caso inventa un juicio que el archivo no soporta. */
const NODATA='#B6BDC0';
function semColorOr(c,hasData){return hasData?semColor(c):NODATA}


/* ---------- asentar las gráficas de una vista recién mostrada ----------
   resizeVisibleCharts() encola el redibujo, pero si la vista trae 6–8 gráficas
   no caben todas en el presupuesto del mismo frame y alguna queda sin pintar
   durante ~150ms. El watchdog lo arreglaría, pero tarda segundos.
   settleVisibleCharts fuerza un draw SÍNCRONO —update('none')— sobre las que
   siguen sin pintar. Se llama al final de showPane/wireTabs. */
function settleVisibleCharts(delay){
  setTimeout(function(){
    document.querySelectorAll('canvas').forEach(function(cv){
      if(cv.offsetParent === null) return;
      const ch = (Chart.getChart && Chart.getChart(cv)) || CHZ[cv.id] || null;
      if(!ch) return;
      if(ch.width <= 2 || ch.height <= 2){ try{ ch.resize() }catch(e){} }
      if(!ch.$painted){ try{ ch.update('none') }catch(e){} }
    });
  }, delay == null ? 90 : delay);
}


/* ---------- sincronizar el punto latente con cada dibujo ----------
   attachLivePoint() coloca el anillo en píxeles del canvas. Si sólo se coloca una vez,
   queda en 0,0 porque al crear la gráfica los elementos aún no tienen posición, y
   además se desfasa durante los 720ms de animación de entrada y en cada resize.
   Este plugin lo reposiciona en afterRender: es una escritura de estilo, no un repintado. */
Chart.register({id:'livePointSync',
  afterRender:function(chart){ if(typeof chart.$livePoint === 'function') chart.$livePoint(); }});
