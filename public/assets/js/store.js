/* OMMA · Velox dispatch — shared state sync.
   Remote mode: Netlify Function /api/state (every dispatcher sees the same thing).
   Local mode: if the function does not exist (GitHub Pages, file opened from disk), the state lives
   only in this browser and the app says so. Offline: work continues and operations are queued
   until the network is back. */
(function (root) {
  'use strict';
  const R = root.DispatchReducer, Seed = root.Seed;
  const LS_STATE = 'ovd.state.v1', LS_PENDING = 'ovd.pending.v1', LS_ME = 'ovd.me', LS_MODE = 'ovd.mode';
  const API = 'api/state';
  const POLL_MS = 15000, POLL_IDLE_MS = 60000, IDLE_AFTER = 10 * 60e3;

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota or private mode */ } }
  function uid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  async function fetchJSON(url, opts, timeout) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), timeout || 10000) : null;
    try {
      const res = await fetch(url, Object.assign({ headers: { accept: 'application/json' } }, opts || {}, ctl ? { signal: ctl.signal } : {}));
      const ct = res.headers.get('content-type') || '';
      let body = null;
      if (ct.includes('application/json')) body = await res.json();
      return { status: res.status, body, json: ct.includes('application/json') };
    } finally { if (tm) clearTimeout(tm); }
  }

  const Store = {
    mode: 'init',          // remote · local · offline
    connected: false,      // reached the shared state at least once this session
    state: null,
    v: 0,
    pending: [],
    lastSync: null,
    lastError: null,
    inflight: false,
    _subs: [],
    _timer: null,
    _backoff: 0,
    _lastActivity: Date.now(),

    me() { return lsGet(LS_ME, ''); },
    setMe(v) { lsSet(LS_ME, String(v || '').trim().slice(0, 24)); },

    subscribe(fn) { this._subs.push(fn); return () => { this._subs = this._subs.filter(f => f !== fn); }; },
    _emit(reason) { this._subs.forEach(f => { try { f(this.state, reason); } catch (e) { console.error('[store] listener', e); } }); },
    _persist() { lsSet(LS_STATE, this.state); lsSet(LS_PENDING, this.pending); },

    /* server state + my operations not confirmed yet */
    _rebase(server) {
      let st = server;
      if (this.pending.length) st = R.apply(server, this.pending).state;
      this.state = st;
    },

    async init() {
      const cached = lsGet(LS_STATE, null);
      this.pending = lsGet(LS_PENDING, []);
      this.state = (cached && cached.config) ? cached : Seed.initialState();
      this.v = this.state.v || 0;
      this._emit('boot');
      await this._connect();
      this._schedule();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(true); });
      window.addEventListener('online', () => this.poll(true));
      ['pointerdown', 'keydown', 'scroll'].forEach(ev => window.addEventListener(ev, () => { this._lastActivity = Date.now(); }, { passive: true }));
      return this;
    },

    async _connect() {
      try {
        const r = await fetchJSON(API, { cache: 'no-store' }, 9000);
        if (r.status === 404) {
          /* the function does not exist here (static host or a file on disk): local mode for good */
          this.mode = 'local';
          lsSet(LS_MODE, 'local');
          this._emit('mode');
          return;
        }
        if (!r.json || !r.body || r.body.ok !== true) {
          /* a gateway error or a captive-portal page is not "no server": stay offline and retry */
          throw new Error('HTTP ' + r.status);
        }
        this.connected = true;
        this.mode = 'remote';
        lsSet(LS_MODE, 'remote');
        if (!r.body.state || !r.body.state.config) {
          /* empty store: this client seeds it with the initial configuration */
          const seedState = (this.state && this.state.config) ? this.state : Seed.initialState();
          const init = { id: uid(), type: 'init', state: seedState, by: this.me(), t: new Date().toISOString() };
          this.pending = [init].concat(this.pending.filter(o => o.type !== 'init'));
          await this.flush();
        } else {
          this.v = r.body.v || 0;
          this._rebase(r.body.state);
          this.lastSync = Date.now();
          this._persist();
          this._emit('sync');
          if (this.pending.length) await this.flush();
        }
      } catch (e) {
        /* only a file opened from disk is local for sure; anything else is treated as a network problem:
           changes queue up (nothing is lost) and the app keeps trying to reach the shared state */
        this.mode = (typeof location !== 'undefined' && location.protocol === 'file:') ? 'local' : 'offline';
        this.lastError = e && e.message;
        this._emit('mode');
      }
    },

    /* applies locally (optimistic) and queues for the server */
    dispatch(ops) {
      const me = this.me();
      const t = new Date().toISOString();
      ops = (Array.isArray(ops) ? ops : [ops]).map(o => Object.assign({ id: uid(), by: me, t }, o));
      this.state = R.apply(this.state, ops).state;
      this._lastActivity = Date.now();
      if (this.mode === 'local') {
        this.state.v = (this.state.v || 0) + 1;
        this._persist();
        this._emit('local');
        return ops;
      }
      this.pending = this.pending.concat(ops);
      this._persist();
      this._emit('optimistic');
      clearTimeout(this._flushT);
      this._flushT = setTimeout(() => this.flush(), 350);   // batches quick clicks into a single POST
      return ops;
    },

    async flush() {
      if (this.inflight || !this.pending.length || this.mode === 'local') return;
      this.inflight = true;
      const batch = this.pending.slice(0, 200);
      try {
        const r = await fetchJSON(API, {
          method: 'POST', cache: 'no-store',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ ops: batch })
        }, 15000);
        if (r.status === 200 && r.body && r.body.ok) {
          const sent = new Set(batch.map(o => o.id));
          this.pending = this.pending.filter(o => !sent.has(o.id));
          this.v = r.body.v || this.v;
          this._rebase(r.body.state);
          this.mode = 'remote';
          this.lastSync = Date.now();
          this.lastError = null;
          this._backoff = 0;
          this._persist();
          this._emit('sync');
        } else if (r.status === 404) {
          this.mode = 'local';
          this.pending = [];
          this._persist();
          this._emit('mode');
        } else if (r.status === 400 || r.status === 413) {
          /* operation rejected by the server: dropped so it does not block the queue */
          const sent = new Set(batch.map(o => o.id));
          this.pending = this.pending.filter(o => !sent.has(o.id));
          this.lastError = (r.body && r.body.error) || ('Error ' + r.status);
          this._persist();
          this._emit('error');
        } else {
          throw new Error((r.body && r.body.error) || ('HTTP ' + r.status));
        }
      } catch (e) {
        this.mode = 'offline';
        this.lastError = e && e.message;
        this._backoff = Math.min(60000, (this._backoff || 2000) * 2);
        this._emit('mode');
        clearTimeout(this._retryT);
        this._retryT = setTimeout(() => this.flush(), this._backoff);
      } finally {
        this.inflight = false;
      }
      if (this.pending.length && this.mode === 'remote') setTimeout(() => this.flush(), 50);
    },

    async poll(force) {
      if (this.mode === 'local') return;
      if (document.hidden && !force) return;
      /* never reached the server this session (boot was offline): connect properly, seeding if empty */
      if (!this.connected) { const was = this.mode; await this._connect(); if (this.mode === 'remote' && was !== 'remote') this._emit('sync'); return; }
      if (this.pending.length) return this.flush();
      try {
        const r = await fetchJSON(API, { cache: 'no-cache' }, 9000);
        if (r.status === 200 && r.body && r.body.ok) {
          const sv = r.body.v || 0;
          if (r.body.state && r.body.state.config && (sv !== this.v || this.mode !== 'remote')) {
            const was = this.mode;
            this.v = sv;
            this._rebase(r.body.state);
            this.mode = 'remote';
            this._persist();
            this._emit(was === 'remote' ? 'remote-change' : 'sync');
          } else if (this.mode !== 'remote') { this.mode = 'remote'; this._emit('mode'); }
          this.lastSync = Date.now();
          this.lastError = null;
        } else if (r.status === 404) {
          this.mode = 'local'; this._emit('mode');
        }
      } catch (e) {
        if (this.mode !== 'offline') { this.mode = 'offline'; this.lastError = e && e.message; this._emit('mode'); }
      }
    },

    _schedule() {
      clearTimeout(this._timer);
      const idle = Date.now() - this._lastActivity > IDLE_AFTER;
      this._timer = setTimeout(async () => { await this.poll(); this._schedule(); }, idle ? POLL_IDLE_MS : POLL_MS);
    },

    /* only to "start over" in local mode */
    resetLocal() {
      this.state = Seed.initialState();
      this.pending = [];
      this._persist();
      this._emit('local');
    }
  };

  root.Store = Store;
})(typeof self !== 'undefined' ? self : this);
