/* ============================================================
   BAMBÚ · Histórico diario sintético (90 días)
   Genera series plausibles por métrica que terminan en los
   valores actuales (Excel v2.2). Determinista (seeded).
   El mercado parte ~90 días atrás más "frío" (acumulación) y
   se calienta hacia neutral, contando una historia coherente.
   ============================================================ */
(function () {
  "use strict";
  const D = window.BambuData;
  const DAYS = 90;
  const END = new Date(2026, 4, 30); // 30 May 2026

  /* ----- RNG determinista ----- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function dateFor(i) { const d = new Date(END); d.setDate(d.getDate() - (DAYS - 1 - i)); return d; }
  function fmtDate(d) { return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); }
  function isoDate(d) { return d.toISOString().slice(0, 10); }

  /* ----- valores ~90 días atrás (mercado más frío) ----- */
  const START = {
    BTC: {
      price: 78000, rpSTH: 84000, sthSopr: 0.985, nuplSTH: 0.02,
      ssr: 8, cdd: 2, funding: -0.004, netflow: -6200, doi: -4,
      ema1d: -7, bb1d: 0.30, rsi1d: 39,
      rpLTH: 36000, lthSopr: 1.6, nuplLTH: 0.31, mvrvZ: 1.5, rhodl: 22000,
      reserve: 0.0034, lthSup: 71, asopr: 0.992,
      mayer: 1.0, picycle: 0.55, ma2y: 1.25,
      puell: 0.95, ema1w: 52, bb1w: 0.44, rsi1w: 46,
    },
    ETH: {
      price: 2050, rpSTH: 2240, sthSopr: 0.98, nuplSTH: -0.02,
      netEmS: 0.10, ssr: 8, funding: -0.003, netflow: -14000, doi: -5,
      ema1d: -10, bb1d: 0.28, rsi1d: 36,
      rpLTH: 1560, lthSopr: 1.1, nuplLTH: 0.14, mvrvZ: 0.5, rhodl: 30000,
      reserve: 0.0034, lthSup: 69, asopr: 0.99,
      mayer: 0.95, picycle: 0.55, ma2y: 1.15,
      netEmL: 0.10, ema1w: 18, bb1w: 0.40, rsi1w: 41,
    },
  };

  /* ----- bandas físicas por métrica ----- */
  const CLAMP = {
    rsi1d: [0, 100], rsi1w: [0, 100], bb1d: [-0.2, 1.4], bb1w: [-0.2, 1.4],
    picycle: [0, 1.3], lthSup: [40, 88], price: [1, 1e9], rpSTH: [1, 1e9], rpLTH: [1, 1e9],
    reserve: [0.0005, 0.05], mvrvSTH: [0.4, 4], mvrvLTH: [0.4, 6],
  };
  const SIGNED = new Set(["funding", "netflow", "doi", "ema1d", "ema1w", "nuplSTH", "nuplLTH", "mvrvZ", "netEmS", "netEmL"]);

  function buildSeries(key, start, end) {
    const r = rng(hash(key));
    const amp = Math.abs(end - start) * 0.20 + Math.abs(end || 1) * 0.018;
    const arr = [];
    let drift = 0;
    for (let i = 0; i < DAYS; i++) {
      const f = i / (DAYS - 1);
      const base = start + (end - start) * f;
      // ruido suave con algo de autocorrelación, menor cerca de los extremos
      drift = drift * 0.6 + (r() - 0.5) * 2 * amp * 0.5;
      let v = base + drift * (1 - Math.abs(f - 0.5) * 0.5);
      const cl = CLAMP[key];
      if (cl) v = Math.max(cl[0], Math.min(cl[1], v));
      else if (!SIGNED.has(key)) v = Math.max(0, v);
      arr.push(v);
    }
    arr[DAYS - 1] = end; // fija el valor de hoy
    return arr;
  }

  function genAsset(type) {
    const start = START[type] || START.BTC;
    const end = D.PRELOAD[type] || D.PRELOAD.BTC;
    const keys = Object.keys(end);
    const cols = {};
    keys.forEach(k => { cols[k] = buildSeries(k, start[k] ?? end[k], end[k]); });
    // ensambla por día
    const rows = [];
    for (let i = 0; i < DAYS; i++) {
      const date = dateFor(i);
      const values = {};
      keys.forEach(k => { values[k] = cols[k][i]; });
      rows.push({ i, date, label: fmtDate(date), iso: isoDate(date), values });
    }
    return rows;
  }

  const raw = { BTC: genAsset("BTC"), ETH: genAsset("ETH") };

  /* ===== INTEGRACIÓN DE DATOS REALES (BTC + ETH) =====
     Registro window.BambuRealData[type] cargado por btc_real.js / eth_real.js */
  const REALMAP = window.BambuRealData || {};
  const REAL = REALMAP.BTC || null;                 // compat retro (código BTC-céntrico)
  function realOf(type) { return REALMAP[type] || null; }
  ["BTC", "ETH"].forEach(type => {
    const R = REALMAP[type]; if (!R) return;
    if (D.PRELOAD[type]) Object.assign(D.PRELOAD[type], R.latest);
    const init = (D.ASSETS_INIT || []).find(a => a.type === type);
    if (init) Object.assign(init.values, R.latest);
    raw[type] = R.lastDays(DAYS);
  });
  try { window.BambuDataDate = "2026-09-02"; window.BambuDataTime = "13:00 UTC"; } catch (e) {}
  function realRows(days, type) { const R = realOf(type || "BTC"); return R ? R.lastDays(days) : (raw[type || "BTC"] || raw.BTC); }

  /* ----- composite diario derivado del motor (con caché: recalcularlo en cada
     render cuesta miles de llamadas al motor y bloquea el hilo) ----- */
  const _dcCache = {};
  function dailyComposites(type, k) {
    const ck = type + "|" + (k || 27);
    if (_dcCache[ck]) return _dcCache[ck];
    const E = window.BambuEngine;
    return _dcCache[ck] = raw[type].map(row => {
      const res = E.computeAsset({ type, values: row.values }, { k });
      return { label: row.label, iso: row.iso, date: row.date,
               sth: res.sth.composite, lth: res.lth.composite,
               sthTemp: res.sth.temp, lthTemp: res.lth.temp };
    });
  }

  /* ----- lecturas guardadas precargadas (Excel Histórico) ----- */
  const SNAPSHOTS = [
    { id: "20260512-001", date: "12 may 2026", regime: "ACUMULACIÓN", btcSTH: 0.55, btcLTH: 0.65, ethSTH: 0.48, ethLTH: 0.30, btcPx: 92000, ethPx: 2300, notes: "Lectura inicial" },
    { id: "20260519-001", date: "19 may 2026", regime: "ACUMULACIÓN", btcSTH: 0.45, btcLTH: 0.78, ethSTH: 0.40, ethLTH: 0.42, btcPx: 95000, ethPx: 2400, notes: "Subida moderada" },
  ];

  /* ----- catálogo de métricas para el explorador ----- */
  function metricCatalog(type) {
    const schema = D.metricsFor(type);
    const out = [{ key: "price", label: "Precio", tech: "Spot USD", unit: "USD", horizon: "—", group: "Precio", noscore: true,
                   read: "Precio spot del activo", score: null }];
    [["STH", schema.sth], ["LTH", schema.lth]].forEach(([h, sc]) => {
      sc.groups.forEach(g => g.metrics.forEach(m => {
        if (m.noscore && m.key.startsWith("rp")) {
          out.push({ ...m, horizon: h, groupName: g.name });
        } else if (!m.auto) {
          out.push({ ...m, horizon: h, groupName: g.name });
        } else {
          out.push({ ...m, horizon: h, groupName: g.name }); // auto: se calcula del valor
        }
      }));
    });
    // de-dup por key+horizon
    const seen = new Set(); const dedup = [];
    out.forEach(m => { const id = m.key + m.horizon; if (!seen.has(id)) { seen.add(id); dedup.push(m); } });
    return dedup;
  }

  /* ----- composites diarios para un rango de días (BTC real) -----
     Downsample a <= maxPoints para mantener el render fluido. */
  const _rcCache = {};
  function rangeComposites(type, k, days, maxPoints) {
    const ck = type + "|" + (k || 27) + "|" + days + "|" + (maxPoints || 380);
    if (_rcCache[ck]) return _rcCache[ck];
    const E = window.BambuEngine;
    let rows = realOf(type) ? realOf(type).lastDays(days) : raw[type];
    rows = sample(rows, maxPoints || 380);
    return _rcCache[ck] = rows.map(row => {
      const res = E.computeAsset({ type, values: row.values }, { k });
      return { label: row.label, iso: row.iso,
               sth: res.sth.composite, lth: res.lth.composite,
               sthTemp: res.sth.temp, lthTemp: res.lth.temp,
               price: row.values.price };
    });
  }
  // muestreo por zancada conservando el último elemento
  function sample(rows, max) {
    if (!max || rows.length <= max) return rows;
    const stride = Math.ceil(rows.length / max), out = [];
    for (let i = 0; i < rows.length; i += stride) out.push(rows[i]);
    if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
    return out;
  }

  /* ----- bandas y percentiles calibrados con la historia completa -----
     Todas las gráficas de temperatura de Bambu usan esta misma calibración:
     las bandas nacen de la distribución real del activo (decil frío / decil
     caliente), no de cortes fijos 0-100. */
  /* Escala publicada de Bambu: la temperatura se expresa como su POSICION en la
     historia del activo (0 = nunca estuvo mas frio, 100 = nunca mas caliente),
     y sobre esa escala los cortes son fijos y memorizables. */
  const FIXED_BANDS = [
    { id: "fria",     min: 0,  max: 20,  label: "CAPITULACIÓN",          temp: 10 },
    { id: "temprana", min: 20, max: 40,  label: "ACUMULACIÓN",           temp: 30 },
    { id: "neutral",  min: 40, max: 60,  label: "EQUILIBRIO",            temp: 50 },
    { id: "calida",   min: 60, max: 80,  label: "DISTRIBUCIÓN TEMPRANA", temp: 70 },
    { id: "caliente", min: 80, max: 100, label: "DISTRIBUCIÓN",          temp: 90 },
  ];
  const _bandCache = {};
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
  }
  function bandsFor(type, hz, k) {
    k = k || 27;
    const key = type + hz + k;
    if (_bandCache[key]) return _bandCache[key];
    let vals = [];
    try {
      const all = rangeComposites(type, k, 99999, 2000);
      vals = all.map(d => hz === "lth" ? d.lthTemp : d.sthTemp).filter(v => v != null).sort((x, y) => x - y);
    } catch (e) {}
    return _bandCache[key] = { bands: FIXED_BANDS, lo: 0, hi: 100, vals: vals.length >= 60 ? vals : null };
  }

  /* posición percentil (0-100) de una temperatura en la historia del activo:
     el valor que deben usar los colores y las barras para que "frío" y
     "caliente" signifiquen extremo histórico y no un corte arbitrario. */
  function tempRank(temp, type, hz, k) {
    const b = bandsFor(type, hz, k);
    if (!b.vals || temp == null) return temp;
    const v = b.vals; let lo = 0, hi = v.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < temp) lo = m + 1; else hi = m; }
    return Math.max(0, Math.min(100, (lo / v.length) * 100));
  }
  function bandOf(temp, bands) {
    const t = temp == null ? 0 : temp;
    for (const z of bands) if (t >= z.min && t < z.max) return z;
    return t >= bands[bands.length - 1].min ? bands[bands.length - 1] : bands[0];
  }

  /* Zona unica para toda la suite: etiqueta, fase, accion y percentil,
     derivadas de la distribucion historica del activo. */
  const _PHASE = { fria: "Capitulación", temprana: "Acumulación", neutral: "Equilibrio", calida: "Distribuci\u00f3n temprana", caliente: "Distribuci\u00f3n" };
  const _ACT = { fria: "Comprar con convicción", temprana: "Acumular en tramos", neutral: "Mantener", calida: "Reducir gradual", caliente: "Distribuir" };
  function zoneOf(temp, type, hz, k) {
    if (temp == null) return { label: "—", phase: "", action: "", rank: 0, id: "neutral" };
    if (!type) { const r0 = Math.round(temp); const z = bandOf(r0, FIXED_BANDS); return { label: z.label, phase: _PHASE[z.id], action: _ACT[z.id], rank: r0, id: z.id, min: z.min, max: z.max }; }
    /* Se redondea UNA vez y la etiqueta sale del valor redondeado: si no, en un
       corte de banda la cifra impresa y su etiqueta caen en zonas distintas
       (39,65 se imprime "40" pero se etiquetaba como ACUMULACIÓN). */
    const rank = Math.round(tempRank(temp, type, hz || "lth", k || 27));
    const z = bandOf(rank, FIXED_BANDS);
    return { label: z.label, phase: _PHASE[z.id], action: _ACT[z.id], rank: rank, id: z.id, min: z.min, max: z.max };
  }

  /* ----- backtest real desde puntos de inflexi\u00f3n hist\u00f3ricos -----
     composite calculado con el motor sobre datos reales + retorno 90d real */
  const BT_DATES = {
    BTC: [
      { iso: "2013-11-29", evt: "Top ciclo 2013" },
      { iso: "2015-01-14", evt: "Suelo bear 2015" },
      { iso: "2017-12-16", evt: "Top ciclo 2017" },
      { iso: "2018-12-15", evt: "Suelo bear 2018" },
      { iso: "2020-03-13", evt: "Crash COVID" },
      { iso: "2021-04-14", evt: "Pico parcial abr-21" },
      { iso: "2021-11-09", evt: "Top ciclo 2021" },
      { iso: "2022-06-18", evt: "Capitulación jun-22" },
      { iso: "2022-11-21", evt: "Suelo FTX" },
      { iso: "2023-10-15", evt: "Inicio rally ETF" },
      { iso: "2024-03-13", evt: "ATH post-halving" },
      { iso: "2024-08-05", evt: "Carry trade unwind" },
      { iso: "2025-10-06", evt: "ATH ciclo 2025" },
      { iso: "2026-03-04", evt: "Corrección 2026" },
    ],
    ETH: [
      { iso: "2018-01-13", evt: "Top ciclo 2018" },
      { iso: "2018-12-15", evt: "Suelo bear 2018" },
      { iso: "2020-03-13", evt: "Crash COVID" },
      { iso: "2021-05-11", evt: "Pico parcial may-21" },
      { iso: "2021-11-09", evt: "Top ciclo 2021" },
      { iso: "2022-06-18", evt: "Capitulación jun-22" },
      { iso: "2022-11-21", evt: "Suelo FTX" },
      { iso: "2023-10-12", evt: "Inicio rally 2023" },
      { iso: "2024-03-12", evt: "Pico marzo-24" },
      { iso: "2024-08-05", evt: "Carry trade unwind" },
      { iso: "2025-08-24", evt: "Pico ciclo 2025" },
      { iso: "2026-03-04", evt: "Corrección 2026" },
    ],
  };
  function realBacktest(k, type, horizon) {
    type = type || "BTC";
    horizon = horizon || "COMBO";
    const R = realOf(type); if (!R) return null;
    const E = window.BambuEngine;
    const sig = c => E.signalFor(c);
    const compOf = res => horizon === "STH" ? res.sth.composite : horizon === "LTH" ? res.lth.composite : res.lth.composite * 0.6 + res.sth.composite * 0.4;
    /* La señal se clasifica en la escala publicada: los agregados (hit-rate,
       niveles, equity, profit factor) tienen que contar el mismo conjunto que
       muestran las filas, o el resumen describe otro backtest. */
    const hzKey = horizon === "STH" ? "sth" : "lth";
    const sigRank = c => {
      const t = 50 - c * 27;
      const rk = zoneOf(t, type, hzKey, k).rank;
      return { sig: E.signalFor((50 - rk) / 27), rank: rk };
    };
    const out = [];
    (BT_DATES[type] || BT_DATES.BTC).forEach(d => {
      let i = R.indexOfIso(d.iso);
      if (i < 0) { // snap al más cercano
        for (let off = 1; off < 20 && i < 0; off++) {
          const a = R.dates.indexOf(shift(d.iso, off)); const b = R.dates.indexOf(shift(d.iso, -off));
          i = a >= 0 ? a : b;
        }
      }
      if (i < 0) return;
      const vals = R.rowAt(i);
      const res = E.computeAsset({ type, values: vals }, { k });
      const comp = compOf(res);
      const fwd = i + 90 < R.count ? R.price(i + 90) : null;
      const mov = fwd ? (fwd / R.price(i) - 1) * 100 : null;
      const sr = sigRank(comp);
      out.push({ date: R.labelEs(d.iso) + " " + d.iso.slice(0, 4), iso: d.iso, evt: d.evt,
        price: R.price(i), comp, sth: res.sth.composite, lth: res.lth.composite,
        sig: sr.sig, rank: sr.rank, temp: E.temperature(comp, k), mov,
        out: mov == null ? "En curso" : (mov >= 0 ? "+" : "") + mov.toFixed(0) + "% en 90 días" });
    });
    // hoy
    const lv = R.latest;
    const lr = E.computeAsset({ type, values: lv }, { k });
    const lc = compOf(lr);
    const lsr = sigRank(lc);
    out.push({ date: "Hoy " + R.latestIso, iso: R.latestIso, evt: "Lectura actual",
      price: lv.price, comp: lc, sth: lr.sth.composite, lth: lr.lth.composite,
      sig: lsr.sig, rank: lsr.rank, temp: E.temperature(lc, k), mov: null, out: "En curso", today: true });
    return out;
  }
  function shift(iso, days) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

  /* ----- estadísticas del backtest real ----- */
  function realStats(k, type, horizon) {
    const bt = realBacktest(k, type, horizon); if (!bt) return null;
    const dir = bt.filter(d => d.mov != null && d.sig !== "NEUTRAL");
    let hits = 0, gw = 0, gl = 0;
    dir.forEach(d => { const bull = d.sig.indexOf("COMPRA") >= 0; const ok = (bull && d.mov > 0) || (!bull && d.mov < 0); if (ok) { hits++; gw += Math.abs(d.mov); } else { gl += Math.abs(d.mov); } });
    return { n: dir.length, hits, hitRate: dir.length ? hits / dir.length : 0, pf: gl ? gw / gl : Infinity, gw, gl, total: bt.length };
  }

  window.BambuHistory = {
    DAYS, raw, dailyComposites, SNAPSHOTS, metricCatalog,
    REAL, realOf, isReal: t => !!realOf(t), realRows, rangeComposites, realBacktest, realStats, sample,
    bandsFor, tempRank, bandOf, quantile, zoneOf, FIXED_BANDS,
    RANGES: [{ d: 90, l: "90 días" }, { d: 365, l: "1 año" }, { d: 730, l: "2 años" }, { d: 1460, l: "4 años" }, { d: 999999, l: "Máximo" }],
    valueSeries(type, key) {
      return (raw[type] || []).map(r => ({ label: r.label, iso: r.iso, value: m_value(type, key, r.values) }));
    },
  };

  // valor de una métrica (incluye autos como MVRV)
  function m_value(type, key, values) {
    if (key === "mvrvSTH") return values.rpSTH ? values.price / values.rpSTH : null;
    if (key === "mvrvLTH") return values.rpLTH ? values.price / values.rpLTH : null;
    return values[key];
  }
  window.BambuHistory.mValue = m_value;
})();
