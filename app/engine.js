/* ============================================================
   BAMBÚ · MOTOR DE CÁLCULO
   composites · temperatura · zona · señal · régimen · color
   ============================================================ */
(function () {
  "use strict";

  /* ---------- pluralización ----------
     Vive aquí, en el motor que cargan todas las suites, para que cualquier
     sección pueda usarla sin guardas: tenerla en sectionsReport.jsx rompía
     las páginas que no cargan ese archivo. */
  function plu(n, sing, plural) {
    if (Math.abs(n) === 1) return sing;
    if (plural) return plural;
    /* plural español, para que "mes" no acabe en "mess" ni "operación" en
       "operacións": los call sites pueden seguir pasando el plural a mano. */
    const s = String(sing);
    if (/ión$/.test(s)) return s.replace(/ión$/, "iones");
    if (/[aeiouáéíóú]$/i.test(s)) return s + "s";
    if (/z$/i.test(s)) return s.replace(/z$/i, "ces");
    return s + "es";
  }
  function nplu(n, sing, plural, dec) {
    /* el número se redondea UNA vez y la palabra sale de ese mismo valor:
       Math.round(-0.5) es -0 pero Math.round(Math.abs(-0.5)) es 1, y esa
       discrepancia imprimía "1 puntos" y "2 punto". */
    const v = dec == null ? Math.round(Math.abs(n)) : Number(Math.abs(n).toFixed(dec));
    return (dec == null ? v : v.toFixed(dec)) + " " + plu(v, sing, plural);
  }

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
  /* ---------- tinta legible a partir del color de relleno ----------
     tempColor() está diseñada para RELLENOS (barras, celdas, insignias con
     mixSoft), donde el color va de fondo. Como texto sobre fondo claro su
     banda central no llega al mínimo de contraste, así que inkColor oscurece
     el mismo matiz hasta alcanzar la ratio pedida: conserva el color de la
     zona y se puede leer. ratio 4.5 para texto normal, 3 para titulares. */
  function _lum(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(hex, bgHex) {
    const a = _lum(hex), b = _lum(bgHex || "#FFFFFF");
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  function inkColor(hex, ratio, bgHex) {
    const target = ratio || 4.5, bg = bgHex || "#FFFFFF";
    let out = hex;
    for (let i = 0; i < 24 && contrast(out, bg) < target; i++) out = mix(out, "#0B1512", 0.08);
    return out;
  }
  /* atajo: tinta para una temperatura de la escala */
  function tempInk(temp, paletteKey, ratio, bgHex) {
    return inkColor(tempColor(temp, paletteKey), ratio, bgHex);
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
  /* null, no 0: un grupo sin ninguna métrica medible no es "neutral", es
     desconocido. Devolver 0 lo metía en el composite con todo su peso y
     arrastraba la lectura al centro. */
  function avgScores(arr) {
    const s = arr.filter(x => x !== null && x !== undefined);
    if (!s.length) return null;
    return s.reduce((a, b) => a + b, 0) / s.length;
  }

  /* ---------- composite de un horizonte (STH o LTH) ---------- */
  function horizonResult(schemaHorizon, vals) {
    const groups = schemaHorizon.groups.map(g => {
      const scores = g.metrics.map(m => ({ m, score: metricScore(m, vals), value: metricValue(m, vals) }));
      const sectionScore = avgScores(scores.map(s => s.score));
      const puntuables = g.metrics.filter(m => !m.noscore && m.score).length;
      const medidas = scores.filter(s => s.score !== null && s.score !== undefined).length;
      return { id: g.id, name: g.name, weight: g.weight, metrics: scores, sectionScore,
               cobertura: { medidas, puntuables } };
    });
    /* Los pesos se renormalizan sobre los grupos que sí tienen dato: con
       cobertura completa el resultado es idéntico al de antes (los pesos suman
       1), y sin ella el composite deja de diluirse con ceros inventados. */
    const activos = groups.filter(g => g.sectionScore !== null);
    const wTotal = activos.reduce((a, g) => a + g.weight, 0);
    groups.forEach(g => { g.pesoEfectivo = (g.sectionScore === null || !wTotal) ? 0 : g.weight / wTotal; });
    const composite = wTotal ? activos.reduce((a, g) => a + g.weight * g.sectionScore, 0) / wTotal : 0;
    const cob = groups.reduce((a, g) => ({ medidas: a.medidas + g.cobertura.medidas, puntuables: a.puntuables + g.cobertura.puntuables }), { medidas: 0, puntuables: 0 });
    return { groups, composite, cobertura: cob };
  }

  /* ---------- composite → señal · 7 niveles ---------- */
  /* Señal desde la lectura publicada (0-100). Los cortes coinciden con las
     bandas que se muestran al usuario, así que la píldora, el veredicto y el
     pie de la tarjeta nunca pueden contradecirse. */
  function signalForRank(rank) {
    if (rank == null) return "NEUTRAL";
    /* Se redondea con el MISMO criterio que zoneOf, que etiqueta sobre el
       entero: sin esto, en [x.5, x+1) de cada corte la zona saltaba de banda
       y la señal no, y la tarjeta se contradecía consigo misma. */
    const r = Math.round(rank);
    if (r < 10) return "COMPRA FUERTE";
    if (r < 20) return "COMPRA NATURAL";
    if (r < 40) return "COMPRA TEMPRANA";
    if (r < 60) return "NEUTRAL";
    if (r < 80) return "REDUCIR";
    if (r < 90) return "VENTA";
    return "VENTA FUERTE";
  }
  /* Veredicto en palabras, agrupando las 7 señales. Es la fuente única para
     el Historial, el chrome y cualquier vista que resuma en 3 etiquetas: cada
     módulo con su propia escalera de cortes acababa contradiciendo al Resumen. */
  const _VERDICT = {
    "COMPRA FUERTE":  { w: "ACUMULAR",           short: "Comprar con convicción",  plain: "barato",  kind: "acc" },
    "COMPRA NATURAL": { w: "ACUMULAR",           short: "Comprar en tramos",       plain: "barato",  kind: "acc" },
    "COMPRA TEMPRANA":{ w: "ACUMULAR",           short: "Empezar a comprar",       plain: "barato",  kind: "acc" },
    "NEUTRAL":        { w: "MANTENER",           short: "Sin ventaja clara",       plain: "neutral", kind: "neu" },
    "REDUCIR":        { w: "REDUCIR/DISTRIBUIR", short: "Asegurar parte",          plain: "caro",    kind: "dist" },
    "VENTA":          { w: "REDUCIR/DISTRIBUIR", short: "Repartir salidas",        plain: "caro",    kind: "dist" },
    "VENTA FUERTE":   { w: "REDUCIR/DISTRIBUIR", short: "Postura defensiva",       plain: "caro",    kind: "dist" },
  };
  function verdictFromRank(rank) {
    const sig = signalForRank(rank);
    return { sig, ..._VERDICT[sig] };
  }
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
    /* LTH Supply % de BTC no tiene serie real: si falta, el régimen se decide
       con Mayer y la EMA semanal en vez de bloquearse por un dato ausente. */
    const supBaja = lthSup == null ? true : lthSup < 62;
    const supAlta = lthSup == null ? true : lthSup >= 70;
    if ((mayer >= 2.2 || emaW >= 230) && supBaja) return "DISTRIBUCIÓN";
    if (mayer <= 0.8 && supAlta) return "ACUMULACIÓN";
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

  /* ---------- exposición del capital total ----------
     Antes esta cifra salía de BASE_WEIGHT × long × régimen, y su techo era el
     6,9%: una escala de peso POR POSICIÓN aplicada a una pregunta que es sobre
     TODO el capital. La consecuencia es que el tablero nunca pedía estar dentro
     ni fuera, solo distintos grados de casi nada.
     Ahora la exposición recorre el rango completo: en el extremo frío el capital
     está 100% invertido y en el extremo caliente 100% fuera. La curva es sobre
     el percentil de la lectura, no sobre la señal, así que se mueve de forma
     continua en vez de a saltos de categoría. El régimen inclina el resultado
     unos puntos, pero no impide llegar a los extremos: en un suelo de ciclo
     dentro de un bear market el modelo sigue pudiendo pedir todo dentro. */
  const EXPO_CURVE = [[0, 100], [12, 100], [25, 88], [38, 70], [50, 52], [62, 33], [75, 15], [88, 0], [100, 0]];
  const REGIME_TILT = { "ACUMULACIÓN": 8, "BULL MARKET": 4, "BEAR MARKET": -6, "DISTRIBUCIÓN": -10 };
  function exposureFor(rank, regimeName) {
    if (rank == null || !isFinite(rank)) return 0;
    const r = Math.max(0, Math.min(100, rank));
    let base = 0;
    for (let i = 1; i < EXPO_CURVE.length; i++) {
      const [x0, y0] = EXPO_CURVE[i - 1], [x1, y1] = EXPO_CURVE[i];
      if (r <= x1) { base = y0 + (y1 - y0) * (x1 === x0 ? 0 : (r - x0) / (x1 - x0)); break; }
    }
    const tilt = REGIME_TILT[regimeName] || 0;
    return Math.max(0, Math.min(100, base + tilt));
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

  window.plu = plu; window.nplu = nplu;

  window.BambuEngine = {
    tempColor, readableText, mix, hexToRgb, inkColor, tempInk, contrast,
    metricValue, metricScore, horizonResult,
    signalFor, signalForRank, verdictFromRank, temperature, zoneFor, detectRegime,
    computeAsset, computeAll, sizing, exposureFor,
    fmt: {
      num(v, d) { if (v === null || v === undefined || isNaN(v)) return "—"; return Number(v).toLocaleString("es-ES", { minimumFractionDigits: d || 0, maximumFractionDigits: d ?? 2 }); },
      usd(v) { if (v === null || isNaN(v)) return "—"; return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 }); },
      pct(v, d) { if (v === null || isNaN(v)) return "—"; return (v > 0 ? "+" : "") + Number(v).toFixed(d ?? 1) + "%"; },
      score(v) { if (v === null || v === undefined) return "—"; return (v > 0 ? "+" : "") + v.toFixed(v % 1 === 0 ? 0 : 2); },
      signed(v, d) { if (v === null || isNaN(v)) return "—"; return (v > 0 ? "+" : "") + Number(v).toFixed(d ?? 2); },
    },
  };
})();
