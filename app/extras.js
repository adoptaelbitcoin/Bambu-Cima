/* ============================================================
   BAMBÚ · Datasets de ejemplo para herramientas 360°
   (precio/velas, dominancia, F&G, liquidaciones, cohortes,
    flujos, ballenas, correlaciones, calendario, sentimiento)
   * Datos de muestra plausibles — listos para conectar API real.
   ============================================================ */
(function () {
  "use strict";
  const H = window.BambuHistory;
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const SUPPLY = { BTC: 19_840_000, ETH: 120_500_000 };

  function candles(type) {
    const rows = (H.raw[type] || []);
    const r = rng(hash("cnd" + type));
    return rows.map((row, i) => {
      const c = row.values.price;
      const o = i > 0 ? rows[i - 1].values.price : c * (1 - (r() - 0.5) * 0.02);
      const k = 0.006 + r() * 0.016;
      const hi = Math.max(o, c) * (1 + k);
      const lo = Math.min(o, c) * (1 - k * (0.6 + r() * 0.6));
      return { label: row.label, iso: row.iso, o, h: hi, l: lo, c };
    });
  }
  function changes(type) {
    const rows = H.raw[type]; const n = rows.length; const last = rows[n - 1].values.price;
    const at = d => rows[Math.max(0, n - 1 - d)].values.price;
    return { last, d1: last / at(1) - 1, d7: last / at(7) - 1, d30: last / at(30) - 1 };
  }

  // dominancia (serie 90d)
  function dominanceSeries() {
    const r = rng(hash("dom")); const out = [];
    for (let i = 0; i < H.DAYS; i++) {
      const f = i / (H.DAYS - 1);
      const btc = 58 - f * 2.5 + (r() - 0.5) * 1.2;
      const eth = 12.5 + f * 0.6 + (r() - 0.5) * 0.6;
      out.push({ label: H.raw.BTC[i].label, btc, eth, alts: 100 - btc - eth });
    }
    return out;
  }

  function fearGreed() {
    // serie correlacionada con la temperatura del composite BTC-LTH (histórico)
    const comps = H.dailyComposites("BTC", 27);
    const r = rng(hash("fg"));
    const series = comps.map(d => {
      const base = d.lthTemp * 0.55 + d.sthTemp * 0.45;
      return { label: d.label, value: Math.max(2, Math.min(98, base + (r() - 0.5) * 12)) };
    });
    const value = Math.round(series[series.length - 1].value);
    return { value, series, label: fgLabel(value) };
  }
  function fgLabel(v) {
    return v < 20 ? "Miedo extremo" : v < 40 ? "Miedo" : v < 55 ? "Neutral" : v < 75 ? "Codicia" : "Codicia extrema";
  }

  function liquidations(type) {
    const px = H.raw[type][H.DAYS - 1].values.price;
    const r = rng(hash("liq" + type)); const levels = [];
    for (let i = -8; i <= 8; i++) {
      if (i === 0) continue;
      const price = px * (1 + i * 0.018);
      const dist = Math.exp(-Math.abs(i) / 4);
      if (i < 0) levels.push({ price, long: dist * (60 + r() * 80), short: 0 });
      else levels.push({ price, long: 0, short: dist * (55 + r() * 75) });
    }
    levels.sort((a, b) => b.price - a.price);
    const totalLong = levels.reduce((s, l) => s + l.long, 0);
    const totalShort = levels.reduce((s, l) => s + l.short, 0);
    return { px, levels, totalLong, totalShort };
  }

  const cohortsByAge = [
    { band: "< 1 mes", pct: 9, sth: true }, { band: "1–3 m", pct: 11, sth: true }, { band: "3–6 m", pct: 13, sth: true },
    { band: "6–12 m", pct: 16 }, { band: "1–2 a", pct: 19 }, { band: "2–3 a", pct: 13 }, { band: "3–5 a", pct: 12 }, { band: "5 a +", pct: 7 },
  ];
  const cohortsByWallet = [
    { band: "Shrimp · <1", pct: 6 }, { band: "Crab · 1–10", pct: 11 }, { band: "Fish · 10–100", pct: 17 },
    { band: "Shark · 100–1k", pct: 22 }, { band: "Whale · 1k–10k", pct: 28 }, { band: "Humpback · 10k+", pct: 16 },
  ];

  function flowSeries(type) {
    const r = rng(hash("flow" + type));
    const rows = (H.raw[type] || H.raw.BTC || []);
    return rows.map((row, i) => {
      const nf = (row.values && typeof row.values.netflow === "number") ? row.values.netflow : (Math.sin(i / 7) * 3500 + (r() - 0.5) * 6000 - 1500);
      return { label: row.label, netflow: nf, stables: 5.2 + (r() - 0.5) * 0.8 };
    });
  }
  const stablecoins = { totalB: 168, dominancePct: 5.1, change30: 3.4, list: [
    { name: "USDT", capB: 112, ch: 2.1 }, { name: "USDC", capB: 38, ch: 5.8 }, { name: "DAI", capB: 6.4, ch: -0.5 }, { name: "Otros", capB: 11.6, ch: 1.2 } ] };

  const whales = {
    accumAddrCount: 1_842, accumChange30: 4.6,
    largeTxCount: 12_640, largeTxChange: -8.2,
    netPositionBTC: 31_200, netPositionChange: 2.4,
    exchangeWhaleRatio: 0.41,
    series: (function () { const r = rng(hash("wh")); return H.raw.BTC.map((row, i) => ({ label: row.label, net: 20000 + i * 130 + (r() - 0.5) * 6000 })); })(),
  };

  // correlaciones · cripto + acciones/sectores + refugios, varias ventanas (3m / 6m / 12m)
  // factores: [riesgo-bolsa, dólar(DXY), materia prima, beta-cripto, refugio]
  const corrFactors = {
    "BTC":         [0.70, -0.30, 0.20, 1.00, 0.00],
    "ETH":         [0.70, -0.30, 0.15, 0.95, 0.00],
    "SOL":         [0.75, -0.30, 0.10, 0.90, -0.05],
    "MicroStrategy": [0.80, -0.30, 0.10, 1.05, 0.00],
    "Coinbase":    [0.85, -0.25, 0.05, 0.92, 0.00],
    "Nasdaq":      [0.90, -0.20, 0.00, 0.30, 0.00],
    "S&P 500":     [0.85, -0.20, 0.00, 0.25, 0.05],
    "Apple":       [0.82, -0.18, 0.00, 0.22, 0.05],
    "Salud (XLV)": [0.22, -0.05, 0.00, 0.02, 0.40],
    "C. básico":   [0.22, -0.05, 0.05, 0.02, 0.45],
    "Utilities":   [0.20, -0.05, 0.10, 0.02, 0.55],
    "Oro":         [0.10, -0.50, 0.70, 0.05, 0.80],
    "Oro mineras": [0.10, -0.45, 0.55, 0.05, 0.80],
    "Petróleo":    [0.40, -0.20, 0.80, 0.05, -0.10],
    "DXY":         [-0.40, 1.00, -0.20, -0.20, 0.30],
    "Bonos 10Y":   [-0.50, 0.10, -0.60, -0.10, 0.70],
    "VIX":         [-0.90, 0.20, 0.00, -0.30, 0.40],
  };
  const corrAssets = Object.keys(corrFactors);
  function cosineCorr(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) || 1); }
  function buildCorr(winSeed) {
    const r = rng(hash("corr" + winSeed)); const n = corrAssets.length; const M = [];
    for (let i = 0; i < n; i++) { M.push([]); for (let j = 0; j < n; j++) {
      if (i === j) { M[i][j] = 1; continue; }
      if (j < i) { M[i][j] = M[j][i]; continue; }
      const base = cosineCorr(corrFactors[corrAssets[i]], corrFactors[corrAssets[j]]);
      // ventanas más largas comprimen ligeramente hacia la correlación estructural
      const pull = winSeed >= 365 ? 0.86 : winSeed >= 180 ? 0.92 : 0.98;
      let v = base * pull + (r() - 0.5) * 0.10;
      v = Math.max(-0.97, Math.min(0.97, v));
      M[i][j] = Math.round(v * 100) / 100;
    } }
    return M;
  }
  const corrMatrices = { 90: buildCorr(90), 180: buildCorr(180), 365: buildCorr(365) };
  const corrMatrix = corrMatrices[90];

  // calendario macro (offset desde hoy)
  function calendar() {
    const C = window.BambuCycle; const now = new Date();
    const mk = (days, event, impact, type) => { const d = new Date(now); d.setDate(d.getDate() + days); return { date: d, event, impact, type, days }; };
    const list = [
      mk(2, "Datos de empleo (NFP)", "alto", "macro"),
      mk(6, "Dato de inflación CPI", "alto", "macro"),
      mk(9, "Decisión de tipos FOMC", "alto", "macro"),
      mk(13, "Vencimiento mensual de opciones BTC", "medio", "cripto"),
      mk(21, "PIB trimestral", "medio", "macro"),
      mk(34, "Acta de la Fed", "medio", "macro"),
    ];
    if (C) { const nh = C.computeNow(); list.push({ date: C.halvings.find(h => h.n === 5).date, event: "5º Halving de Bitcoin (est.)", impact: "alto", type: "cripto", days: nh.daysUntil }); }
    return list.sort((a, b) => a.days - b.days);
  }

  /* sentimiento agregado dinámico: derivado de la temperatura actual del composite BTC
     (coherente con Fear & Greed y con la lectura on-chain del día) */
  const sentiment = (function () {
    let t = 50;
    try {
      const comps = H.dailyComposites("BTC", 27);
      const last = comps[comps.length - 1];
      t = last.sthTemp * 0.55 + last.lthTemp * 0.45;
    } catch (e) { }
    const v = Math.round(Math.max(5, Math.min(95, t)));
    const socialLabel = v < 25 ? "Miedo extremo" : v < 42 ? "Miedo" : v < 58 ? "Neutral" : v < 75 ? "Optimista" : "Euforia";
    const fundingAvg = Math.round(((v - 50) / 50) * 0.028 * 1000) / 1000;
    const fundingLabel = fundingAvg <= -0.008 ? "Negativo · shorts pagan" : fundingAvg < 0.008 ? "Plano · sin apalancamiento" : "Positivo · longs pagan";
    const putCall = Math.round((1 + (50 - v) / 100 * 0.7) * 100) / 100;
    const putCallLabel = putCall > 1.05 ? "Sesgo put · cobertura" : putCall < 0.95 ? "Sesgo call" : "Equilibrado";
    const longShortRatio = Math.round((1 + (v - 50) / 100) * 100) / 100;
    const cl = x => Math.round(Math.max(5, Math.min(95, x)));
    return {
      social: v, socialLabel, fundingAvg, fundingLabel, putCall, putCallLabel, longShortRatio,
      sources: [
        { name: "Social (X / Reddit)", value: cl(v - 3), scale: 100 },
        { name: "Funding perpetuos", value: cl(v + 4), scale: 100 },
        { name: "Opciones (put/call)", value: cl(v - 6), scale: 100 },
        { name: "Long/Short ratio", value: cl(v + 2), scale: 100 },
      ],
    };
  })();

  window.BambuExtras = {
    SUPPLY, candles, changes, dominanceSeries, fearGreed, fgLabel, liquidations,
    cohortsByAge, cohortsByWallet, flowSeries, stablecoins, whales,
    corrAssets, corrMatrix, corrMatrices, calendar, sentiment,
    marketcap(type, price) { return SUPPLY[type] ? SUPPLY[type] * price : null; },
  };
})();
