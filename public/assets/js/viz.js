/* OMMA · Velox dispatch — custom visuals (not Chart.js).
   · Spiral: the well's 105 stages on a 3D helix. Each dot is a stage colored by its coverage.
     It spins ONLY while the well is pumping, at a speed proportional to the pace: the motion is
     the signal that the frac is live. Dragging rotates it by hand.
   · Route: two mine → well lanes with the loads en route at their actual position (assigned + lead). */
(function (root) {
  'use strict';
  const reduce = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  /* ============================== stage spiral ============================== */
  function Spiral(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.rot = 0.6;
    this.speed = 0;            // rad/s
    this.stages = [];
    this.hover = -1;
    this.pts = [];
    this.running = false;
    this.visible = true;
    this.drag = null;
    this.t0 = 0;
    this._bind();
  }
  Spiral.prototype._bind = function () {
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, rot: this.rot, moved: false }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x;
        if (Math.abs(dx) > 3) this.drag.moved = true;
        this.rot = this.drag.rot + dx * 0.012;
        this.draw();
        return;
      }
      const p = pos(e);
      const i = this.pick(p.x, p.y);
      if (i !== this.hover) { this.hover = i; this.draw(); }
      if (this.opts.onHover) this.opts.onHover(i >= 0 ? this.stages[i] : null, e);
    });
    const end = e => {
      const wasTap = this.drag && !this.drag.moved;
      this.drag = null;
      if (wasTap) {
        const p = pos(e);
        const i = this.pick(p.x, p.y);
        this.hover = i; this.draw();
        if (this.opts.onPick) this.opts.onPick(i >= 0 ? this.stages[i] : null, e);
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', () => { this.drag = null; });
    cv.addEventListener('pointerleave', () => { if (!this.drag) { this.hover = -1; this.draw(); if (this.opts.onHover) this.opts.onHover(null); } });
  };
  Spiral.prototype.set = function (stages, speed, meta) {
    this.stages = stages;
    this.speed = reduce() ? 0 : (speed || 0);
    this.meta = meta || {};
    this.resize();
    this.draw();
    this._loop();
  };
  Spiral.prototype.resize = function () {
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(r.width)), h = Math.max(220, Math.round(r.height));
    if (this.cv.width !== w * dpr || this.cv.height !== h * dpr) {
      this.cv.width = w * dpr; this.cv.height = h * dpr;
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    }
    this.w = w; this.h = h; this.dpr = dpr;
  };
  Spiral.prototype.geometry = function () {
    const n = this.stages.length || 1;
    const w = this.w, h = this.h;
    const R = Math.min(w * 0.3, h * 0.36);
    const top = h * 0.1, bot = h * 0.9;
    const turns = Math.max(3, Math.round(n / 15));
    const cx = w * 0.5;
    const f = R * 3.2;
    const tilt = 0.22;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const r = R * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * t)), 0.85));
      const th = Math.PI * 2 * turns * t + this.rot;
      const x3 = r * Math.cos(th), z3 = r * Math.sin(th);
      const s = f / (f + z3);
      const y = top + (bot - top) * t;
      pts.push({ i, x: cx + x3 * s, y: y + z3 * tilt, z: z3, s, r });
    }
    return pts;
  };
  Spiral.prototype.pick = function (x, y) {
    let best = -1, bd = 13 * 13;
    this.pts.forEach(p => { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd && p.z < 999) { bd = d; best = p.i; } });
    return best;
  };
  Spiral.prototype.draw = function (now) {
    if (!this.w) this.resize();
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const pts = this.pts = this.geometry();
    const S = this.stages;
    if (!S.length) return;
    const zmax = Math.max.apply(null, pts.map(p => Math.abs(p.z))) || 1;
    // context orbits (the reference's "field"): faint ellipses
    ctx.save();
    ctx.strokeStyle = 'rgba(136,147,166,.16)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const y = this.h * (0.3 + 0.13 * k), rx = this.w * (0.38 - 0.02 * k);
      ctx.beginPath(); ctx.ellipse(this.w / 2, y, rx, rx * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // helix: segments with alpha by depth
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const depth = ((a.z + b.z) / 2) / zmax;              // −1 near · +1 far
      const col = S[i].color || '#9AA6B6';
      ctx.strokeStyle = hexA(col.length === 7 ? col : '#9AA6B6', 0.18 + 0.5 * (1 - (depth + 1) / 2));
      ctx.lineWidth = 1.1 + 1.6 * (1 - (depth + 1) / 2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // segment boundary
    (this.meta.bounds || []).forEach(bi => {
      const p = pts[bi];
      if (!p) return;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(112,98,168,.55)';
      ctx.beginPath(); ctx.moveTo(this.w * 0.1, p.y); ctx.lineTo(this.w * 0.9, p.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "700 9.5px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillStyle = '#7062A8';
      ctx.fillText('Stg ' + (bi + 1), this.w * 0.1, p.y - 5);
      ctx.restore();
    });
    // dots, back to front
    const order = pts.slice().sort((a, b) => b.z - a.z);
    const tNow = (now || performance.now()) / 1000;
    order.forEach(p => {
      const st = S[p.i];
      const depth = p.z / zmax;
      const rad = (2.2 + 2.6 * (1 - (depth + 1) / 2)) * (st.cur ? 1.5 : 1) * (p.i === this.hover ? 1.6 : 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      if (st.fill) { ctx.fillStyle = st.fill; ctx.fill(); }
      ctx.lineWidth = st.fill ? 1.2 : 1.4;
      ctx.strokeStyle = st.stroke || '#fff';
      ctx.stroke();
      if (st.cur && !reduce()) {
        const k = (tNow % 1.8) / 1.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 2 + k * 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(230,162,60,' + (0.6 * (1 - k)).toFixed(3) + ')';
        ctx.lineWidth = 1.6; ctx.stroke();
      }
    });
    // endpoints
    ctx.font = "800 10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = '#8893A6';
    const p0 = pts[0], pn = pts[pts.length - 1];
    ctx.fillText('Stg 1', p0.x + 10, p0.y + 3);
    ctx.fillText('Stg ' + pts.length, pn.x + 10, pn.y + 3);
  };
  Spiral.prototype._loop = function () {
    const live = !reduce() && (this.speed > 0 || this.stages.some(s => s.cur));
    if (!live || this.running) return;
    this.running = true;
    let last = performance.now();
    const step = t => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (this.visible && !document.hidden && this.cv.offsetParent !== null) {
        if (!this.drag) this.rot += this.speed * dt;
        this.draw(t);
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  Spiral.prototype.stop = function () { this.running = false; };

  /* ============================== mine → well route ============================== */
  function renderRoute(svgHost, data) {
    /* data: {lanes:[{id,name,place,miles,leadTxt,color,loads:[{p,color,title}]}], well} */
    /* the drawing takes the width it is shown at (640 max), so its labels never shrink below their size */
    const W = Math.round(Math.max(340, Math.min(640, svgHost.clientWidth || 640))), H = 176;
    const lanes = data.lanes;
    const wellX = W - 64, wellY = H / 2;
    const y0 = 44, gap = lanes.length > 1 ? (H - 88) / (lanes.length - 1) : 0;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="route-svg" role="img" aria-label="Loads en route by mine">';
    s += '<defs><radialGradient id="rgWell" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#ECF4F6"/></radialGradient></defs>';
    lanes.forEach((ln, i) => {
      const y = y0 + i * gap;
      const x0 = 96;
      const c1x = x0 + (wellX - x0) * 0.55, c2x = x0 + (wellX - x0) * 0.75;
      const d = 'M' + x0 + ',' + y + ' C' + c1x + ',' + y + ' ' + c2x + ',' + wellY + ' ' + (wellX - 26) + ',' + wellY;
      ln._d = d;
      const active = ln.loads.length > 0;
      s += '<path d="' + d + '" class="rt-base"/>';
      s += '<path d="' + d + '" class="rt-flow' + (active ? ' on' : '') + '" style="stroke:' + ln.color + '"/>';
      s += '<g class="rt-mine"><rect x="6" y="' + (y - 22) + '" width="86" height="44" rx="11"/>' +
        '<text x="16" y="' + (y - 4) + '" class="rt-n">' + esc(ln.name) + '</text>' +
        '<text x="16" y="' + (y + 11) + '" class="rt-p">' + esc(ln.place) + '</text></g>';
      s += '<text x="' + (x0 + 14) + '" y="' + (y - 9) + '" class="rt-m">' + esc(ln.miles) + ' mi · lead ' + esc(ln.leadTxt) + '</text>';
      s += '<text x="' + (x0 + 14) + '" y="' + (y + 20) + '" class="rt-c">' + (active ? ln.loads.length + ' en route' : 'no loads en route') + '</text>';
    });
    s += '<g class="rt-well"><circle cx="' + wellX + '" cy="' + wellY + '" r="26" fill="url(#rgWell)"/>' +
      '<circle cx="' + wellX + '" cy="' + wellY + '" r="26" class="rt-ring"/>' +
      '<text x="' + wellX + '" y="' + (wellY - 2) + '" text-anchor="middle" class="rt-wn">WELL</text>' +
      '<text x="' + wellX + '" y="' + (wellY + 11) + '" text-anchor="middle" class="rt-wp">' + esc(data.wellShort || '') + '</text></g>';
    s += '<g class="rt-dots"></g></svg>';
    svgHost.innerHTML = s;
    const svg = svgHost.querySelector('svg');
    const g = svg.querySelector('.rt-dots');
    const NS = 'http://www.w3.org/2000/svg';
    lanes.forEach(ln => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', ln._d);
      const L = path.getTotalLength ? (svg.appendChild(path), path.getTotalLength()) : 0;
      ln.loads.forEach(ld => {
        const pt = L ? path.getPointAtLength(Math.max(0, Math.min(1, ld.p)) * L) : { x: 100, y: 50 };
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); c.setAttribute('r', '5.2');
        c.setAttribute('class', 'rt-dot');
        c.setAttribute('style', 'fill:' + ld.color);
        c.setAttribute('tabindex', '0');
        const t = document.createElementNS(NS, 'title'); t.textContent = ld.title; c.appendChild(t);
        g.appendChild(c);
      });
      if (path.parentNode) path.parentNode.removeChild(path);
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  root.Viz = { Spiral, renderRoute, esc };
})(typeof self !== 'undefined' ? self : this);
