/* ============================================================
   BAMBÚ · MOTOR DE CÁLCULO
   composites · temperatura · zona · señal · régimen · color
   ============================================================ */
(function () {
  "use strict";
  const D = window.BambuData;

  /* ---------- utilidades de color ---------- */
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    const c = x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  // temperatura 0..100 → color según stops de la paleta
  function tempColor(temp, paletteKey) {
    const pal = D.PALETTES[paletteKey] || D.PALETTES.sobria;
    const stops = pal.stops;
    const t = Math.max(0, Math.min(100, temp));
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      if (t >= t0 && t <= t1) {
        const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        const a = hexToRgb(c0), b = hexToRgb(c1);
        return rgbToHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
      }
    }
    return stops[stops.length - 1][1];
  }
  // luminancia relativa → elegir texto claro/oscuro
  function readableText(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.42 ? "#1C2421" : "#FFFFFF";
  }
  function mix(hex, withHex, f) {
    const a = hexToRgb(hex), b = hexToRgb(withHex);
    return rgbToHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
  }

  /* ---------- score de una métrica ---------- */
  function metricValue(m, vals) {
    if (m.auto) return m.auto(vals);
    return vals[m.key];
  }
  function metricScore(m, vals) {
    if (m.noscore || !m.score) return null;
    const v = metricValue(m, vals);
    if (v === undefined || v === null || isNaN(v)) return null;
    return m.score(v);
  }
  function avgScores(arr) {
    const s = arr.filter(x => x !== null && x !== undefined);
    if (!s.length) return 0;
    return s.reduce((a, b) => a + b, 0) / s.length;
  }

  /* ---------- composite de un horizonte (STH o LTH) ---------- */
  function horizonResult(schemaHorizon, vals) {
    const groups = schemaHorizon.groups.map(g => {
      const scores = g.metrics.map(m => ({ m, score: metricScore(m, vals), value: metricValue(m, vals) }));
      const sectionScore = avgScores(scores.map(s => s.score));
      return { id: g.id, name: g.name, weight: g.weight, metrics: scores, sectionScore };
    });
    const composite = groups.reduce((a, g) => a + g.weight * g.sectionScore, 0);
    return { groups, composite };
  }

  /* ---------- composite → señal · 7 niveles ---------- */
  function signalFor(comp) {
    if (comp >= 1.5) return "COMPRA FUERTE";
    if (comp >= 0.75) return "COMPRA NATURAL";
    if (comp >= 0.25) return "COMPRA TEMPRANA";
    if (comp > -0.25) return "NEUTRAL";
    if (comp > -0.75) return "REDUCIR";
    if (comp > -1.5) return "VENTA";
    return "VENTA FUERTE";
  }

  /* ---------- composite → temperatura (sensibilidad k) ---------- */
  function temperature(comp, k) {
    k = k || 27;
    return Math.max(0, Math.min(100, 50 - comp * k));
  }

  /* ---------- temperatura → zona ---------- */
  function zoneFor(temp) {
    for (const z of D.ZONES) if (temp >= z.min && temp < z.max) return z;
    return temp >= 100 ? D.ZONES[D.ZONES.length - 1] : D.ZONES[0];
  }

  /* ---------- régimen de mercado (sobre BTC) ---------- */
  function detectRegime(btcVals) {
    const mayer = btcVals.mayer, lthSup = btcVals.lthSup, emaW = btcVals.ema1w;
    if ((mayer >= 2.2 || emaW >= 230) && lthSup < 62) return "DISTRIBUCIÓN";
    if (mayer <= 0.8 && lthSup >= 70) return "ACUMULACIÓN";
    if (mayer < 1.0) return "BEAR MARKET";
    return "BULL MARKET";
  }

  /* ---------- resultado completo de un activo ---------- */
  function computeAsset(asset, opts) {
    opts = opts || {};
    const k = opts.k || 27;
    const schema = D.metricsFor(asset.type);
    const vals = asset.values;
    const sth = horizonResult(schema.sth, vals);
    const lth = horizonResult(schema.lth, vals);
    const enrich = (r) => {
      const sig = signalFor(r.composite);
      const temp = temperature(r.composite, k);
      const zone = zoneFor(temp);
      return { ...r, signal: sig, temp, zone };
    };
    return { asset, schema, vals, sth: enrich(sth), lth: enrich(lth) };
  }

  /* ---------- sizing por señal (ajustado por régimen) ---------- */
  function sizing(signal, regimeName, price) {
    const sg = D.SIGNALS[signal];
    const mult = (D.REGIMES[regimeName] || {}).mult || 1;
    const base = D.BASE_WEIGHT;
    const longAdj = base * sg.long * mult;
    const hedge = base * sg.hedge;
    const net = longAdj - hedge;
    const stopUsd = price * (1 + sg.stop);
    return { sg, mult, longAdj, hedge, net, stopUsd, longPct: sg.long, hedgePct: sg.hedge };
  }

  /* ---------- agregados del dashboard ---------- */
  function computeAll(assets, opts) {
    const results = assets.map(a => computeAsset(a, opts));
    const btc = assets.find(a => a.type === "BTC") || assets[0];
    const regime = detectRegime(btc.values);
    // 4 señales clásicas (BTC/ETH · STH/LTH) si existen
    return { results, regime };
  }

  window.BambuEngine = {
    tempColor, readableText, mix, hexToRgb,
    metricValue, metricScore, horizonResult,
    signalFor, temperature, zoneFor, detectRegime,
    computeAsset, computeAll, sizing,
    fmt: {
      num(v, d) { if (v === null || v === undefined || isNaN(v)) return "—"; return Number(v).toLocaleString("es-ES", { minimumFractionDigits: d || 0, maximumFractionDigits: d ?? 2 }); },
      usd(v) { if (v === null || isNaN(v)) return "—"; return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 }); },
      pct(v, d) { if (v === null || isNaN(v)) return "—"; return (v > 0 ? "+" : "") + Number(v).toFixed(d ?? 1) + "%"; },
      score(v) { if (v === null || v === undefined) return "—"; return (v > 0 ? "+" : "") + v.toFixed(v % 1 === 0 ? 0 : 2); },
      signed(v, d) { if (v === null || isNaN(v)) return "—"; return (v > 0 ? "+" : "") + Number(v).toFixed(d ?? 2); },
    },
  };
})();
