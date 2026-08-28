/* ============================================================
   BAMBÚ · Reporte 360 — informe semanal (lunes) + informe on-chain
   Une el antiguo "Blog · Informes" con el "Reporte 360".
   ============================================================ */

/* ---------- utilidades de fecha ---------- */
function addDaysIso(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function mondayOf(iso) { const d = new Date(iso + "T00:00:00Z"); const off = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - off); return d.toISOString().slice(0, 10); }
function listMondays(latestIso, count) { let m = mondayOf(latestIso); const out = []; for (let i = 0; i < count; i++) { out.push(m); m = addDaysIso(m, -7); } return out; }
function repFecha(iso) { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); }

/* ---------- snapshot del modelo en una fecha (datos reales) ---------- */
function repSnap(type, iso) {
  const R = window.BambuRealData[type]; if (!R) return null;
  let i = R.indexOfIso(iso);
  if (i < 0) for (let o = 1; o < 8 && i < 0; o++) i = R.dates.indexOf(addDaysIso(iso, o));
  if (i < 0) for (let o = 1; o < 8 && i < 0; o++) i = R.dates.indexOf(addDaysIso(iso, -o));
  if (i < 0) i = R.count - 1;
  const v = R.rowAt(i);
  const res = E.computeAsset({ type, values: v }, { k: 27 });
  return { i, iso: R.dates[i], v, res, price: v.price, sth: res.sth, lth: res.lth };
}

/* ---------- construcción del informe semanal ---------- */
function buildWeek(monIso, latestIso) {
  const sun = addDaysIso(monIso, 6);
  const end = sun > latestIso ? latestIso : sun;
  const METR = {
    BTC: [
      { key: "mvrvZ", lab: "MVRV Z-Score", dec: 2 },
      { key: "nuplLTH", lab: "NUPL · LTH", dec: 2 },
      { key: "lthSopr", lab: "SOPR · LTH", dec: 2 },
      { key: "puell", lab: "Puell Multiple", dec: 2 },
      { key: "rsi1d", lab: "RSI diario", dec: 0 },
    ],
    ETH: [
      { key: "mvrvZ", lab: "MVRV Z-Score", dec: 2 },
      { key: "nuplLTH", lab: "NUPL · LTH", dec: 2 },
      { key: "asopr", lab: "aSOPR", dec: 2 },
      { key: "mayer", lab: "Mayer Multiple", dec: 2 },
      { key: "rsi1d", lab: "RSI diario", dec: 0 },
    ],
  };
  const assets = ["BTC", "ETH"].map(t => {
    const a = repSnap(t, monIso), b = repSnap(t, end);
    if (!a || !b) return null;
    const chg = (b.price / a.price - 1) * 100;
    const tempA = (a.sth.temp + a.lth.temp) / 2, tempB = (b.sth.temp + b.lth.temp) / 2;
    const metrics = METR[t].map(m => {
      const va = a.v[m.key], vb = b.v[m.key];
      return { key: m.key, lab: m.lab, dec: m.dec, a: va, b: vb, d: (va != null && vb != null) ? vb - va : null };
    }).filter(m => m.b != null);
    return { t, a, b, chg, tempA, tempB, metrics };
  }).filter(Boolean);

  const btc = assets.find(x => x.t === "BTC") || assets[0];
  const regime = E.detectRegime(btc.b.v);
  const tempEnd = assets.reduce((s, x) => s + x.tempB, 0) / assets.length;
  const tempStart = assets.reduce((s, x) => s + x.tempA, 0) / assets.length;
  return { monIso, end, sun, assets, regime, tempEnd, tempStart };
}

/* narrativa breve de lo que pasó por activo */
function weekNarrative(w, type, sigOverride) {
  const A = w.assets.find(x => x.t === type); if (!A) return "";
  const name = type === "BTC" ? "Bitcoin" : "Ethereum";
  const up = A.chg >= 0;
  const dTemp = A.tempB - A.tempA;
  const sigChange = A.a.lth.signal !== A.b.lth.signal;
  // métrica que más se movió (en valor absoluto normalizado)
  const moved = [...A.metrics].filter(m => m.d != null).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  let s = `${name} ${up ? "subió" : "bajó"} un ${Math.abs(A.chg).toFixed(1)}% en la semana, cerrando en ${E.fmt.usd(A.b.price)}. `;
  const HN = window.BambuHistory;
  const rkN = snap => HN && HN.zoneOf ? (HN.zoneOf(snap.sth.temp, A.t, "sth", 27).rank + HN.zoneOf(snap.lth.temp, A.t, "lth", 27).rank) / 2 : (snap.sth.temp + snap.lth.temp) / 2;
  const pA = rkN(A.a), pB = rkN(A.b), dP = pB - pA;
  s += `La lectura del modelo ${Math.abs(dP) < 2 ? "se mantuvo estable" : dP > 0 ? "se calentó" : "se enfrió"} de ${pA.toFixed(0)} a ${pB.toFixed(0)} de 100 (${HN.zoneOf(pB, null).label}). `;
  const sigNow = sigOverride || A.b.lth.signal;
  const sigPrev = sigOverride ? E.signalFor((50 - pA) / 27) : A.a.lth.signal;
  if (sigNow !== sigPrev) s += `La postura del modelo cambió de ${sigPrev} a ${sigNow}. `;
  else s += `La postura del modelo se mantiene en ${sigNow}. `;
  if (moved) s += `El movimiento fundamental más relevante fue el ${moved.lab}, que pasó de ${moved.a.toFixed(moved.dec)} a ${moved.b.toFixed(moved.dec)}.`;
  return s;
}

/* señales de cierre de semana */
function weekSignals(w) {
  const out = [];
  w.assets.forEach(A => {
    [["STH", A.b.sth], ["LTH", A.b.lth]].forEach(([h, hr]) => out.push({ key: A.t + "·" + h, ticker: A.t, type: A.t, hz: h.toLowerCase(), price: A.b.price, ...hr }));
  });
  return out;
}

/* ---------- análogos históricos: momentos con MVRV-Z similar, PONDERADOS por ciclo ----------
   El mercado de 2013 no informa igual que el actual: otra liquidez, otro tamaño,
   sin ETF. Cada análogo pesa según a cuántos ciclos de halving está del vigente,
   así el último ciclo domina la proyección y los anteriores solo la matizan. */
const CYCLE_STARTS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"];
function cycleOf(iso) { let c = 0; for (let k = 0; k < CYCLE_STARTS.length; k++) if (iso >= CYCLE_STARTS[k]) c = k + 1; return c; }
/* mediana ponderada: el estadístico que respeta los pesos sin dejarse arrastrar
   por los extremos, al contrario que la media */
function wMedian(pairs) {
  const arr = pairs.filter(p => Number.isFinite(p.x)).sort((a, b) => a.x - b.x);
  const tot = arr.reduce((s, p) => s + p.w, 0);
  if (!tot) return null;
  let acc = 0;
  for (const p of arr) { acc += p.w; if (acc >= tot / 2) return p.x; }
  return arr[arr.length - 1].x;
}
function wQuantile(pairs, q) {
  const arr = pairs.filter(p => Number.isFinite(p.x)).sort((a, b) => a.x - b.x);
  const tot = arr.reduce((s, p) => s + p.w, 0);
  if (!tot) return null;
  let acc = 0;
  for (const p of arr) { acc += p.w; if (acc >= tot * q) return p.x; }
  return arr[arr.length - 1].x;
}
function analogStats(type, key, target, tol, horizons, minGap) {
  const R = window.BambuRealData[type]; if (!R || !R.cols[key]) return { count: 0, eps: [], agg: {}, closest: null };
  const col = R.cols[key], px = R.cols.price;
  const nowCycle = cycleOf(window.BambuDataDate || R.latestIso);
  const eps = []; let lastI = -1e9;
  for (let i = 0; i < R.count; i++) {
    const v = col[i]; if (v == null) continue;
    if (Math.abs(v - target) <= tol && i - lastI >= minGap && px[i] != null && px[i] > 0) {
      const fwd = {}; horizons.forEach(h => { const j = i + h; fwd[h] = (j < R.count && px[j] != null) ? (px[j] / px[i] - 1) * 100 : null; });
      const cyc = cycleOf(R.dates[i]);
      /* peso: el ciclo vigente cuenta 1; cada ciclo hacia atrás, un tercio */
      const w = Math.pow(1 / 3, Math.max(0, nowCycle - cyc));
      eps.push({ i, iso: R.dates[i], val: v, price: px[i], fwd, cycle: cyc, w }); lastI = i;
    }
  }
  const agg = {};
  horizons.forEach(h => {
    const pairs = eps.filter(e => Number.isFinite(e.fwd[h])).map(e => ({ x: e.fwd[h], w: e.w }));
    if (!pairs.length) return;
    /* extremos como percentiles ponderados (10/90): un único caso de 2013 no
       puede definir el techo o el suelo de la proyección */
    agg[h] = { med: wMedian(pairs), min: wQuantile(pairs, 0.10), max: wQuantile(pairs, 0.90), n: pairs.length,
               nCurrent: eps.filter(e => e.cycle === nowCycle && Number.isFinite(e.fwd[h])).length,
               wShare: pairs.reduce((s, p) => s + p.w, 0) ? eps.filter(e => e.cycle === nowCycle && Number.isFinite(e.fwd[h])).reduce((s, e) => s + e.w, 0) / pairs.reduce((s, p) => s + p.w, 0) : 0 };
  });
  const withFwd = eps.filter(e => Number.isFinite(e.fwd[90])).sort((a, b) => (b.cycle - a.cycle) || (Math.abs(a.val - target) - Math.abs(b.val - target)));
  return { count: eps.length, eps, agg, target, tol, closest: withFwd[0] || null, nowCycle };
}
/* reparto de desenlaces a 90 días: alcista / lateral / bajista */
function scenarioDist(a, h, hi, lo) {
  if (!a || !a.eps || !a.eps.length) return null;
  const ps = a.eps.filter(e => Number.isFinite(e.fwd[h])).map(e => ({ x: e.fwd[h], w: e.w }));
  if (!ps.length) return null;
  const tot = ps.reduce((s, p) => s + p.w, 0);
  const bull = ps.filter(p => p.x > hi).reduce((s, p) => s + p.w, 0) / tot;
  const bear = ps.filter(p => p.x < lo).reduce((s, p) => s + p.w, 0) / tot;
  return { bull, base: 1 - bull - bear, bear, n: ps.length, wCurrent: ((a.agg || {})[h] && a.agg[h].wShare) || 0 };
}
function mesAno(iso) { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { month: "short", year: "numeric", timeZone: "UTC" }); }



/* Percentil del movimiento: ¿cuán raro es este cambio PARA esta métrica?
   Compara el delta del periodo con todos los deltas históricos de la misma
   columna. Así un 0,42 en MVRV-Z se mide contra lo que MVRV-Z suele moverse,
   y no contra su propio nivel (que al rondar cero inflaba cualquier cambio). */
const _dpCache = {};
function deltaPctl(type, key, delta, spanDays, relative) {
  if (delta == null || !Number.isFinite(delta)) return 0;
  const ck = type + "|" + key + "|" + spanDays + "|" + (relative ? "r" : "a");
  let dist = _dpCache[ck];
  if (!dist) {
    const R = window.BambuRealData[type];
    const col = R && R.cols[key];
    if (!col) return 0;
    const step = Math.max(1, Math.round(spanDays));
    const out = [];
    for (let i = step; i < col.length; i += 1) {
      const a = col[i - step], b = col[i];
      if (a == null || b == null) continue;
      const d = relative ? (a ? (b / a - 1) * 100 : null) : b - a;
      if (d != null && Number.isFinite(d)) out.push(Math.abs(d));
    }
    if (out.length < 30) return 0;
    out.sort((x, y) => x - y);
    dist = _dpCache[ck] = out;
  }
  const v = Math.abs(delta);
  let lo = 0, hi = dist.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dist[m] < v) lo = m + 1; else hi = m; }
  return (lo / dist.length) * 100;
}

/* ---------- La anomalía de la semana y los hechos que la explican ----------
   Un informe se lee si abre por lo llamativo. Aquí la anomalía se elige por
   magnitud del movimiento (no se escribe a mano) y cada hecho lleva la cifra
   que lo respalda, para que el lector pueda comprobarlo. */
function weekFacts(w) {
  const facts = [];
  /* el rango real del informe: la semana en curso puede tener menos de 7 días */
  const nDays = Math.max(1, Math.round((new Date(w.end + "T00:00:00Z") - new Date(w.monIso + "T00:00:00Z")) / 86400000) + 1);
  const spanTxt = nDays >= 7 ? "siete días" : nDays === 1 ? "el día anterior" : `${nDays} días`;
  const agoTxt = nDays >= 7 ? "hace siete días" : nDays === 2 ? "el día anterior" : `hace ${nDays - 1} días`;
  const A = w.assets.find(x => x.t === "BTC") || w.assets[0];
  if (!A) return { anomaly: null, facts };
  const dPx = A.a.price ? (A.b.price / A.a.price - 1) * 100 : 0;
  const nm = t => t === "BTC" ? "Bitcoin" : "Ethereum";

  /* 01 · el precio */
  facts.push({
    quiet: Math.abs(dPx) < 2,
    t: Math.abs(dPx) < 2 ? "El precio no fue a ninguna parte." : dPx > 0 ? "El precio subió." : "El precio cayó.",
    d: `${E.fmt.usd(A.b.price)} frente a ${E.fmt.usd(A.a.price)} ${agoTxt}${Math.abs(dPx) >= 0.05 ? ` (${dPx > 0 ? "+" : ""}${dPx.toFixed(1)}%)` : ""}.`,
    mag: deltaPctl(A.t, "price", dPx, nDays, true),
  });

  /* 02 · quién vendió y con qué resultado (SOPR por cohorte) */
  const sL = A.b.v.lthSopr, sS = A.b.v.sthSopr;
  if (sL != null) facts.push({
    t: sL < 1 ? "Los tenedores de ciclo vendieron en pérdida." : "Los tenedores de ciclo vendieron con beneficio.",
    d: `Su SOPR cerró en ${sL.toFixed(3)}: recibieron ${(sL * 100).toFixed(0)} céntimos por cada dólar que pagaron. ${sL < 1 ? "Vender por debajo del coste es agotamiento, no euforia." : "Es toma de ganancias en marcha."}`,
    mag: deltaPctl(A.t, "lthSopr", A.b.v.lthSopr - (A.a.v.lthSopr ?? A.b.v.lthSopr), nDays, false),
  });
  if (sS != null) facts.push({
    t: sS < 1 ? "El comprador reciente también soltó por debajo de coste." : "El comprador reciente vendió en verde.",
    d: `SOPR de corto plazo en ${sS.toFixed(3)}, con un coste medio de ${E.fmt.usd(A.b.v.rpSTH)}.`,
    mag: deltaPctl(A.t, "sthSopr", A.b.v.sthSopr - (A.a.v.sthSopr ?? A.b.v.sthSopr), nDays, false),
  });

  /* 03 · ganancia sin realizar del ciclo */
  if (A.b.v.nuplLTH != null) {
    const p = A.b.v.nuplLTH * 100;
    facts.push({
      quiet: p >= 25 && p <= 50,
      t: p > 50 ? "La ganancia sin realizar del ciclo está en zona de techo." : p < 25 ? "La ganancia sin realizar del ciclo sigue contenida." : "La ganancia sin realizar del ciclo va a media altura.",
      d: `NUPL de largo plazo en ${p.toFixed(0)}%: es lo que los tenedores de años acumulan sin haber vendido todavía.`,
      mag: deltaPctl(A.t, "nuplLTH", (A.b.v.nuplLTH ?? 0) - (A.a.v.nuplLTH ?? A.b.v.nuplLTH ?? 0), nDays, false),
    });
  }

  /* 04 · la métrica que más se movió (solo si el movimiento es visible a su
     propia precisión: "pasó de 82 a 82" no es una anomalía) */
  const moved = [...A.metrics]
    .filter(m => m.d != null && m.a.toFixed(m.dec) !== m.b.toFixed(m.dec))
    .sort((x, y) => Math.abs(y.d / (Math.abs(y.b) || 1)) - Math.abs(x.d / (Math.abs(x.b) || 1)))[0];
  if (moved) facts.push({
    t: `${moved.lab} fue la métrica que más se movió.`,
    d: `Pasó de ${moved.a.toFixed(moved.dec)} a ${moved.b.toFixed(moved.dec)} en la semana${Math.abs(moved.d) > 0 ? ` (${moved.d > 0 ? "+" : ""}${moved.d.toFixed(moved.dec)})` : ""}.`,
    mag: deltaPctl(A.t, moved.key, moved.d, nDays, false),
  });

  /* 05 · la lectura, en la escala publicada (no la temperatura cruda) */
  const HB = window.BambuHistory;
  const rk = (snap) => HB && HB.zoneOf
    ? (HB.zoneOf(snap.sth.temp, A.t, "sth", 27).rank + HB.zoneOf(snap.lth.temp, A.t, "lth", 27).rank) / 2
    : (snap.sth.temp + snap.lth.temp) / 2;
  const pEnd = rk(A.b), pStart = rk(A.a), dT = pEnd - pStart;
  facts.push({
    quiet: Math.abs(dT) < 4,
    t: Math.abs(dT) < 2 ? "La lectura del modelo apenas se movió." : dT > 0 ? "La lectura del modelo se calentó." : "La lectura del modelo se enfrió.",
    d: `De ${pStart.toFixed(0)} a ${pEnd.toFixed(0)} de 100 en ${spanTxt}, con el régimen en ${w.regime}.`,
    /* La lectura deriva del precio, así que nunca compite por la anomalía:
       si lo hiciera, el titular repetiría el bloque que viene justo debajo. */
    derived: true,
    mag: Math.abs(dT),
  });

  /* la anomalía es el hecho de mayor magnitud, y no se repite abajo */
  const ordered = [...facts].filter(f => !f.quiet && !f.derived && f.mag >= 80).sort((a, b) => b.mag - a.mag);
  const anomaly = ordered[0] || null;
  const rest = facts.filter(f => f !== anomaly).slice(0, 4);
  return { anomaly, facts: rest, dPx };
}

/* Exportación en Markdown: el informe legible fuera de Bambu, o para pasarlo
   a una IA sin perder los números. */
function weekMarkdown(w, sigs) {
  const L = [];
  L.push(`# Informe semanal on-chain · Bambú`);
  L.push(`**Semana del ${repFecha(w.monIso)} al ${repFecha(w.end)}** · Régimen: ${w.regime} · Modelo Bambú v2.2`);
  L.push("");
  const wf = weekFacts(w);
  if (wf.anomaly) { L.push("## La anomalía de la semana"); L.push(`**${wf.anomaly.t}** ${wf.anomaly.d}`); L.push(""); }
  else { L.push("## La semana, en una línea"); L.push("**Semana sin anomalías: nada se salió de su rango.** Ninguna métrica registró un movimiento fuera de lo habitual."); L.push(""); }
  L.push("## La semana, contada");
  weekStory(w).forEach((b, i) => {
    L.push(`### ${i + 1}. ${b.h}`);
    L.push(b.p);
    if (b.concepto && CONCEPTOS[b.concepto]) L.push(`> **Aprende — ${CONCEPTOS[b.concepto].t}:** ${CONCEPTOS[b.concepto].d}`);
    L.push("");
  });
  L.push("");
  L.push("## Cifras de cierre");
  L.push("| Activo | Precio | Convicción | Lectura | Zona | Señal |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  sigs.forEach(s => {
    const z = window.BambuHistory.zoneOf(s.temp, s.type || s.ticker, s.hz || "lth");
    L.push(`| ${s.key} | ${E.fmt.usd(s.price)} | ${E.fmt.signed(s.composite)} | ${z.rank.toFixed(0)}/100 | ${z.label} | ${s.signal} |`);
  });
  L.push("");
  const baseMd = new Date(w.end + "T00:00:00Z");
  const calMd = (window.BambuExtras && window.BambuExtras.calendar)
    ? window.BambuExtras.calendar().map(e => ({ ...e, days: Math.round((e.date - baseMd) / 86400000) })).filter(e => e.days >= 0).sort((a, b) => a.days - b.days)
    : [];
  const wa = weekAhead(w, calMd);
  if (wa.length) {
    L.push("## Lo que tener en cuenta esta semana");
    wa.forEach((q, i) => { L.push(`**${i + 1}. ${q.q}** — ${q.a}`); L.push(`${q.body}`); L.push(`_${q.lvl} · ${q.lvlLab}_`); L.push(""); });
  }
  L.push("## Detalle por activo");
  w.assets.forEach(A => {
    const HM = window.BambuHistory;
    const pM = HM && HM.zoneOf ? (HM.zoneOf(A.b.sth.temp, A.t, "sth", 27).rank + HM.zoneOf(A.b.lth.temp, A.t, "lth", 27).rank) / 2 : null;
    L.push(`### ${A.t}`);
    L.push(weekNarrative(w, A.t, pM != null ? E.signalFor((50 - pM) / 27) : null));
    L.push("");
  });
  const les = weekLessons(w);
  if (les.length) { L.push("## Lo que te llevas de esta edición"); les.forEach((l, i) => L.push(`${i + 1}. **${l.t}** — ${l.d}`)); L.push(""); }
  L.push("---");
  L.push("_Contenido educativo. No es asesoramiento financiero. Invertir en criptoactivos conlleva riesgo de pérdida._");
  return L.join("\n");
}


/* ---------- Las cuatro preguntas, proyectadas a la semana que empieza ----------
   Mismas preguntas que el Resumen, pero respondidas en clave de qué esperar y
   qué vigilar: cada una trae el nivel concreto y lo que cambiaría la respuesta. */
function weekAhead(w, cal) {
  const H = window.BambuHistory;
  const A = w.assets.find(x => x.t === "BTC") || w.assets[0];
  if (!A) return [];
  const v = A.b.v, tk = A.t;
  const zS = H.zoneOf(A.b.sth.temp, tk, "sth", 27);
  const zL = H.zoneOf(A.b.lth.temp, tk, "lth", 27);
  const gap = Math.abs(zS.rank - zL.rank);
  const mv = window.marketVerdict ? window.marketVerdict([{ asset: { type: tk, ticker: tk, values: v }, sth: A.b.sth, lth: A.b.lth }], w.regime) : null;
  const ev = (cal || []).filter(e => e.days >= 0 && e.days <= 7);
  const out = [];

  out.push({
    q: "¿Qué se puede esperar del precio esta semana?",
    a: zS.rank > 70 ? "Un retroceso sería lo normal" : zS.rank < 30 ? "Un rebote sería lo normal" : "Sin dirección marcada",
    lvl: v.rpSTH ? E.fmt.usd(v.rpSTH) : "—", lvlLab: "nivel que decide el ánimo del corto plazo",
    body: `El corto plazo cierra la semana en ${zS.rank.toFixed(0)} de 100 (${zS.label.toLowerCase()})${v.rsi1d != null ? `, con el RSI diario en ${v.rsi1d.toFixed(0)}` : ""}. ` +
      (zS.rank > 70 ? "Tras varias semanas de subida el mercado suele pararse a digerir; un recorte no cambiaría la fase de fondo."
        : zS.rank < 30 ? "Desde estas lecturas el rebote técnico es frecuente, aunque por sí solo no marca un giro de ciclo."
          : "Sin extremos, la semana suele resolverse en rango.") +
      (v.rpSTH ? ` La referencia a vigilar es ${E.fmt.usd(v.rpSTH)}: por debajo aparece presión de venta del comprador reciente, por encima se calma.` : ""),
  });

  out.push({
    q: "¿Qué haría cambiar la lectura del ciclo?",
    a: gap >= 20 ? "Que el corto plazo se alinee con el ciclo" : "Nada a la vista en 7 días",
    lvl: v.rpLTH ? E.fmt.usd(v.rpLTH) : "—", lvlLab: "coste medio de los tenedores de años",
    body: `El ciclo cierra en ${zL.rank.toFixed(0)} de 100 (${zL.label.toLowerCase()})${v.nuplLTH != null ? ` con un ${(v.nuplLTH * 100).toFixed(0)}% de ganancia sin realizar` : ""}. ` +
      (v.rpLTH ? `Perder ${E.fmt.usd(v.rpLTH)} de forma sostenida sería el aviso de cambio estructural; mientras aguante, la fase no se rompe. ` : "") +
      (gap >= 20 ? `Hoy los dos horizontes divergen ${gap.toFixed(0)} puntos, así que lo más probable es que el corto plazo corrija hacia el ciclo antes de que el ciclo siga al corto.`
        : "Los dos horizontes van en la misma dirección, así que la semana no debería traer sorpresas de fondo."),
  });

  out.push({
    q: "¿Qué hago con mi dinero esta semana?",
    a: mv ? mv.action : zL.action,
    lvl: mv ? mv.capPct.toFixed(1) + "%" : "—", lvlLab: "exposición sugerida · igual que el veredicto",
    body: (mv ? `La lectura de ${tk}, combinando sus dos plazos, cierra en ${mv.pos.toFixed(0)} de 100, que sugiere tener ${mv.capPct.toFixed(1)} de cada 100 en ${tk} y el resto esperando. ` : "") +
      (mv && mv.pos < 40 ? "Semana para aportar según calendario, sin adelantar tramos por impaciencia."
        : mv && mv.pos > 60 ? "Semana para asegurar parte, no para aumentar: si toca vender un tramo, se vende."
          : "Semana de sostener: cumple tu plan y no improvises movimientos extra.") +
      (gap >= 20 ? " Con los horizontes divergentes, partir cualquier operación en varios tramos reduce el coste de equivocarse en el momento." : ""),
  });

  out.push({
    q: "¿Qué hay en el calendario que pueda mover el mercado?",
    a: ev.length ? `${ev.length} evento${ev.length > 1 ? "s" : ""} en 7 días` : "Semana sin citas relevantes",
    lvl: ev.length ? ev[0].event : "—", lvlLab: ev.length ? `el más próximo · en ${ev[0].days} día${ev[0].days === 1 ? "" : "s"}` : "sin eventos a 7 días",
    body: (ev.length
      ? `Esta semana hay ${ev.map(e => `${e.event} (en ${e.days}d)`).join(", ")}. Los datos macro mueven el precio a corto plazo pero rara vez cambian la fase de ciclo: sirven para elegir el día de ejecutar, no para decidir si se ejecuta.`
      : "No hay citas macro ni vencimientos relevantes en los próximos 7 días, así que el precio debería responder sobre todo a los flujos on-chain.") +
      " Lo que decide sigue siendo el plan, no el titular.",
  });

  return out;
}


/* ============================================================
   CAPA NARRATIVA · el informe como lectura, no como tabla
   Cada concepto se explica la primera vez que aparece, con una
   analogía corta, para que leer informes enseñe por acumulación.
   ============================================================ */

/* Diccionario de conceptos: la explicación llana que se inyecta en el texto */
const CONCEPTOS = {
  rpLTH: { t: "precio realizado de los tenedores de largo plazo",
    d: "el precio medio al que compraron los que llevan años sin mover sus monedas. Es su punto de equilibrio: por encima ganan, por debajo pierden." },
  rpSTH: { t: "precio realizado de los compradores recientes",
    d: "el precio medio al que compró la gente que entró en los últimos meses. Cuando el precio cae por debajo, esa gente empieza a perder y suele vender con miedo." },
  sopr: { t: "SOPR",
    d: "compara a qué precio se vendieron hoy las monedas frente a lo que costaron. Por encima de 1 se vende con beneficio; por debajo, con pérdida." },
  nupl: { t: "NUPL",
    d: "la ganancia que los tenedores acumulan pero todavía no han cobrado. Cuanto más alta, más tentación de vender hay guardada en el mercado." },
  mvrvZ: { t: "MVRV Z-Score",
    d: "mide cuánto se ha separado el precio de lo que el mercado pagó de media. Sirve para saber si está caro o barato en términos históricos." },
  rsi: { t: "RSI",
    d: "mide si el precio ha subido o bajado demasiado rápido. Por encima de 70 se considera recalentado; por debajo de 30, agotado a la baja." },
  mayer: { t: "Mayer Multiple",
    d: "el precio dividido por su media de los últimos 200 días. Alrededor de 1 el precio está en su tendencia; muy por encima, adelantado." },
  lectura: { t: "la lectura de Bambu",
    d: "una sola cifra de 0 a 100 que dice en qué posición está el mercado frente a toda su propia historia. Bajo 20 casi nunca estuvo más frío; sobre 80, casi nunca más caliente." },
};

/* Cuenta la semana en párrafos, explicando lo que usa. Devuelve bloques con
   texto y, cuando toca, el concepto que conviene aprender ahí. */
function weekStory(w) {
  const H = window.BambuHistory;
  const A = w.assets.find(x => x.t === "BTC") || w.assets[0];
  if (!A) return [];
  const B = w.assets.find(x => x.t === "ETH");
  const va = A.a.v, vb = A.b.v;
  const dPx = A.a.price ? (A.b.price / A.a.price - 1) * 100 : 0;
  const nDays = Math.max(1, Math.round((new Date(w.end + "T00:00:00Z") - new Date(w.monIso + "T00:00:00Z")) / 86400000) + 1);
  const rk = (snap, t) => H && H.zoneOf ? (H.zoneOf(snap.sth.temp, t, "sth", 27).rank + H.zoneOf(snap.lth.temp, t, "lth", 27).rank) / 2 : 0;
  const pIni = rk(A.a, A.t), pFin = rk(A.b, A.t);
  const zS = H.zoneOf(A.b.sth.temp, A.t, "sth", 27), zL = H.zoneOf(A.b.lth.temp, A.t, "lth", 27);
  const zSa = H.zoneOf(A.a.sth.temp, A.t, "sth", 27), zLa = H.zoneOf(A.a.lth.temp, A.t, "lth", 27);
  const blocks = [];
  const mag = Math.abs(dPx);
  const fuerte = mag >= 10, medio = mag >= 4;

  /* 1 · lo que pasó, en lenguaje de calle */
  blocks.push({
    h: "Lo primero: el precio",
    p: `${A.t === "BTC" ? "Bitcoin" : "Ethereum"} ${dPx > 0 ? "subió" : dPx < 0 ? "bajó" : "acabó donde empezó"} ${mag < 0.5 ? "prácticamente nada" : `un ${mag.toFixed(1)}%`} ${nDays >= 7 ? "en la semana" : `en ${nDays} días`}, de ${E.fmt.usd(A.a.price)} a ${E.fmt.usd(A.b.price)}.` +
      (fuerte ? ` Un movimiento de esta talla no es rutina: son de los que cambian el ánimo del mercado y, con él, lo que conviene hacer.`
        : medio ? ` Es un movimiento normal: mueve el precio pero no la fase de fondo.`
          : ` Cuando el precio no va a ninguna parte, lo interesante está debajo: en quién compró y quién vendió mientras el gráfico se quedaba quieto.`) +
      (B ? ` ${B.t === "ETH" ? "Ethereum" : B.t} hizo ${B.chg > 0 ? "+" : ""}${B.chg.toFixed(1)}% en el mismo periodo${Math.abs(B.chg) > Math.abs(dPx) * 1.2 ? ", tirando más que Bitcoin" : Math.abs(B.chg) < Math.abs(dPx) * 0.8 ? ", más flojo que Bitcoin" : ", muy en línea con Bitcoin"}.` : ""),
  });

  /* 2 · la lectura de Bambu, explicada */
  blocks.push({
    h: "Qué dice el modelo",
    concepto: "lectura",
    p: `La lectura pasó de ${pIni.toFixed(0)} a ${pFin.toFixed(0)} de 100. ` +
      (Math.abs(pFin - pIni) >= 15
        ? `Un salto de ${Math.abs(pFin - pIni).toFixed(0)} puntos es mucho: el mercado cambió de sitio, no solo de precio.`
        : `Se movió ${Math.abs(pFin - pIni).toFixed(0)} puntos, así que el terreno sigue siendo parecido.`) +
      ` Bambu mide dos plazos por separado, y esta semana no dicen lo mismo: el corto plazo cerró en ${zS.rank.toFixed(0)} (${zS.label.toLowerCase()}) y el ciclo en ${zL.rank.toFixed(0)} (${zL.label.toLowerCase()}).` +
      (Math.abs(zS.rank - zL.rank) >= 20
        ? ` Esa diferencia de ${Math.abs(zS.rank - zL.rank).toFixed(0)} puntos es la clave de la semana: hay recorrido de fondo, pero comprar hoy es comprar en un momento caliente. En la práctica significa repartir en tramos en lugar de entrar de golpe.`
        : ` Al ir los dos en la misma dirección, la lectura es más fiable de lo habitual.`),
  });

  /* 3 · el coste de cada grupo: la idea más útil del on-chain */
  if (vb.rpLTH && vb.rpSTH) {
    const dL = (A.b.price / vb.rpLTH - 1) * 100, dS = (A.b.price / vb.rpSTH - 1) * 100;
    blocks.push({
      h: "Quién gana y quién pierde ahora mismo",
      concepto: "rpLTH",
      p: `La blockchain guarda a qué precio compró cada moneda, así que se puede saber cuánto pagó cada grupo. Los tenedores de largo plazo tienen un coste medio de ${E.fmt.usd(vb.rpLTH)}: con el precio en ${E.fmt.usd(A.b.price)} van un ${Math.abs(dL).toFixed(0)}% ${dL > 0 ? "por delante" : "por detrás"}. ` +
        `Los que compraron hace poco pagaron de media ${E.fmt.usd(vb.rpSTH)}, así que están un ${Math.abs(dS).toFixed(0)}% ${dS > 0 ? "en verde" : "en rojo"}. ` +
        (dS < 0
          ? `Ese segundo número es el que da sustos: cuando el comprador reciente pierde, vende con miedo y las caídas se aceleran. ${E.fmt.usd(vb.rpSTH)} es, por tanto, el nivel a vigilar.`
          : `Con el comprador reciente en ganancia hay menos riesgo de ventas por pánico, aunque más tentación de recoger beneficio. Si el precio pierde ${E.fmt.usd(vb.rpSTH)}, ese equilibrio se rompe.`),
    });
  }

  /* 4 · quién vendió: SOPR por cohorte */
  if (vb.lthSopr != null) {
    const sL = vb.lthSopr, sLa = va.lthSopr, subiendo = sLa != null && sL > sLa;
    blocks.push({
      h: "¿Están vendiendo los que llevan años?",
      concepto: "sopr",
      p: `Su SOPR cerró en ${sL.toFixed(3)}, es decir que por cada dólar que pagaron recibieron ${(sL * 100).toFixed(0)} céntimos. ` +
        (sL < 1
          ? `Siguen soltando por debajo de coste, y eso es agotamiento, no euforia: el que vende en pérdida después de años suele estar rindiéndose, y esa oferta se acaba.`
          : `Ya venden con beneficio, que es la manera educada de decir que están empezando a repartir. No es una alarma, pero sí el primer paso de la distribución.`) +
        (sLa != null ? ` Hace ${nDays >= 7 ? "una semana" : nDays + " días"} estaba en ${sLa.toFixed(3)}: ${subiendo ? (sL < 1 ? "se están acercando a recuperar lo que pagaron, así que su pérdida se reduce" : "cada vez venden con más beneficio") : (sL < 1 ? "venden con más pérdida que antes, señal de que aún queda rendición por delante" : "su beneficio al vender se ha estrechado")}.` : ""),
    });
  }

  /* 5 · la ganancia guardada */
  if (vb.nuplLTH != null) {
    const p = vb.nuplLTH * 100, pa = va.nuplLTH != null ? va.nuplLTH * 100 : null;
    blocks.push({
      h: "Cuánta ganancia hay sin cobrar",
      concepto: "nupl",
      p: `El NUPL de largo plazo está en ${p.toFixed(0)}%${pa != null ? `, frente al ${pa.toFixed(0)}% de ${nDays >= 7 ? "hace una semana" : "hace unos días"}` : ""}. Traducido: los tenedores de años acumulan esa ganancia sobre el papel y todavía no la han tocado. ` +
        (p < 25 ? `Es un nivel bajo. Históricamente, mientras esta cifra está aquí el ciclo tiene sitio para seguir: nadie tiene tanta ganancia como para querer salir corriendo.`
          : p < 50 ? `Es un nivel intermedio: ya hay motivo para recoger beneficio, pero no la euforia que marca los techos.`
            : `Es un nivel alto. En los ciclos anteriores, cuando esta cifra pasa de 50% empieza la distribución en serio.`),
    });
  }

  /* 6 · técnico, para el corto plazo */
  if (vb.rsi1d != null) {
    blocks.push({
      h: "¿Va demasiado rápido?",
      concepto: "rsi",
      p: `El RSI diario cerró en ${vb.rsi1d.toFixed(0)}${va.rsi1d != null ? ` (venía de ${va.rsi1d.toFixed(0)})` : ""}. ` +
        (vb.rsi1d > 70 ? `Por encima de 70 el precio ha corrido más de lo que suele aguantar sin descansar. No significa que se dé la vuelta, sino que un parón o un recorte serían lo normal, y que comprar aquí es pagar la prisa de los demás.`
          : vb.rsi1d < 30 ? `Por debajo de 30 el precio ha caído más rápido de lo habitual. Suele venir un rebote, aunque un rebote no es un cambio de ciclo.`
            : `Está en zona media, sin tensión: ni recalentado ni agotado.`) +
        (vb.mayer != null ? ` El Mayer Multiple, que compara el precio con su media de 200 días, está en ${vb.mayer.toFixed(2)}: ${vb.mayer > 1.2 ? "el precio va bastante por delante de su tendencia" : vb.mayer < 0.9 ? "el precio va por detrás de su tendencia" : "el precio está prácticamente en su tendencia"}.` : ""),
    });
  }

  return blocks;
}

/* Lo que el lector se lleva aprendido, elegido según lo que pasó esta semana */
function weekLessons(w) {
  const A = w.assets.find(x => x.t === "BTC") || w.assets[0];
  if (!A) return [];
  const vb = A.b.v;
  const dPx = A.a.price ? (A.b.price / A.a.price - 1) * 100 : 0;
  const out = [];
  out.push({
    t: "Precio y fase no son lo mismo",
    d: "Una subida fuerte cambia el precio, no necesariamente el punto del ciclo. Por eso Bambu mide dos plazos: uno dice si el momento es bueno para ejecutar, el otro si la fase acompaña.",
  });
  if (vb.rpSTH) out.push({
    t: "El nivel que importa no es un número redondo",
    d: `Los niveles que mueven el mercado son los costes reales de la gente, no las cifras bonitas. Hoy ese nivel es ${E.fmt.usd(vb.rpSTH)}: lo que pagó de media el comprador reciente.`,
  });
  if (vb.lthSopr != null) out.push({
    t: "Vender en pérdida es señal de suelo, no de techo",
    d: "Cuando los tenedores de años sueltan por debajo de su coste, están rindiéndose. Los techos se hacen con todo el mundo ganando, no perdiendo.",
  });
  if (Math.abs(dPx) >= 10) out.push({
    t: "Después de un movimiento fuerte, reparte",
    d: "Cuando el corto plazo se recalienta, partir la operación en varios tramos cuesta menos que acertar el día exacto. La prisa se paga.",
  });
  return out.slice(0, 3);
}

/* ---------- vista del informe semanal ---------- */
function InformeSemanal({ results, palette }) {
  const R = window.BambuRealData.BTC;
  const latest = R ? R.latestIso : "2026-06-28";
  /* archivo de ediciones: todas las semanas del último año */
  const mondays = React.useMemo(() => listMondays(latest, 53), [latest]);
  /* La semana en curso puede tener 1-2 días: abrir en ella haría que el informe
     dijera "nada pasó" sobre datos incompletos. Se abre en la última completa. */
  const fullIdx = mondays.findIndex(m => addDaysIso(m, 6) <= latest);
  const [mon, setMon] = React.useState(mondays[fullIdx >= 0 ? fullIdx : 0]);
  const monUse = mondays.includes(mon) ? mon : mondays[0];
  const w = React.useMemo(() => buildWeek(monUse, latest), [monUse, latest]);

  const X = window.BambuExtras, C = window.BambuCycle;
  const fg = X.fearGreed();
  const now = C.computeNow();
  /* La cabecera muestra la MISMA escala publicada que el resto del informe:
     dos cifras distintas del mismo concepto en una página es inaceptable. */
  const HH = window.BambuHistory;
  const rankOf = (snap, type) => {
    if (!HH || !HH.zoneOf) return (snap.sth.temp + snap.lth.temp) / 2;
    return (HH.zoneOf(snap.sth.temp, type, "sth", 27).rank + HH.zoneOf(snap.lth.temp, type, "lth", 27).rank) / 2;
  };
  const posEnd = w.assets.length ? w.assets.reduce((acc, A) => acc + rankOf(A.b, A.t), 0) / w.assets.length : w.tempEnd;
  const posStart = w.assets.length ? w.assets.reduce((acc, A) => acc + rankOf(A.a, A.t), 0) / w.assets.length : w.tempStart;
  const tempCol = E.tempColor(posEnd, palette);
  const dTemp = posEnd - posStart;
  const sigs = weekSignals(w);
  const wf = weekFacts(w);
  /* El calendario mide sus días desde la fecha de datos; en una hoja fechada en
     w.end hay que recalcular el offset o el informe diría "en 2 días" sobre un
     evento a 53 días de esa semana. */
  const calFrom = (iso) => {
    const base = new Date(iso + "T00:00:00Z");
    return X.calendar().map(e => ({ ...e, days: Math.round((e.date - base) / 86400000) }))
                       .filter(e => e.days >= 0).sort((a, b) => a.days - b.days);
  };
  const isCurrentWeek = addDaysIso(w.monIso, 6) >= latest;
  const calWeek = calFrom(w.end);
  const cal = calWeek.filter(e => e.days <= 35).slice(0, 6);
  const wAhead = weekAhead(w, calWeek);
  const story = weekStory(w);
  const lessons = weekLessons(w);
  const macroCol = now.athPassed ? E.tempColor(72, palette) : E.tempColor(30, palette);

  // análogos históricos (momentos con MVRV-Z similar) y escenarios a 90 días
  const btcA = w.assets.find(x => x.t === "BTC") || w.assets[0];
  const ethA = w.assets.find(x => x.t === "ETH");
  const anBTC = analogStats("BTC", "mvrvZ", btcA.b.v.mvrvZ, 0.5, [30, 90, 180], 21);
  const anETH = ethA ? analogStats("ETH", "mvrvZ", ethA.b.v.mvrvZ, 0.5, [30, 90, 180], 21) : null;
  const g90 = (anBTC.agg || {})[90] || { med: 0, min: 0, max: 0, n: 0 };
  const dist = scenarioDist(anBTC, 90, 12, -12);
  const btcPx = btcA.b.price;
  const tgt = pct => btcPx * (1 + pct / 100);
  const scen = [
    { name: "Alcista · continuación", col: E.tempColor(18, palette), pct: g90.max, prob: dist ? dist.bull : null,
      trig: `Recuperar el coste base de los STH (${E.fmt.usd(btcA.b.v.rpSTH)}) y un MVRV-Z al alza confirmarían el giro.`,
      hist: now.athPassed ? "En ciclos previos, los suelos de markdown dieron paso a expansiones de varios cientos de % a 6–12 meses." : "Las fases pre-ATH post-halving han extendido el rally otros 100–250 días en media." },
    { name: "Base · lateralización", col: E.tempColor(50, palette), pct: g90.med, prob: dist ? dist.base : null,
      trig: `Rango entre el coste base LTH (${E.fmt.usd(btcA.b.v.rpLTH)}) y los STH; el mercado digiere sin tendencia clara.`,
      hist: "El desenlace medio de los análogos: digestión lateral mientras las manos firmes absorben oferta." },
    { name: "Bajista · capitulación", col: E.tempColor(85, palette), pct: g90.min, prob: dist ? dist.bear : null,
      trig: `Perder de forma sostenida el coste base LTH abriría una sobreextensión bajista hacia el suelo de ciclo.`,
      hist: now.athPassed ? `Los bear de BTC duran 360–410 días; el suelo macro se proyecta hacia ${C.fmtES(now.projBottom)}.` : "Una ruptura aquí adelantaría el techo del ciclo respecto al patrón histórico." },
  ];

  const doPrint = () => { document.body.classList.add("printing"); setTimeout(() => { window.print(); document.body.classList.remove("printing"); }, 60); };

  return (
    <div className="fade-in">
      {/* selector de semana */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px", flexWrap: "wrap" }}>
        <span className="tiny muted">Semana del lunes:</span>
        <select className="inp" style={{ textAlign: "left", width: 230, fontFamily: "var(--sans)" }} value={monUse} onChange={e => setMon(e.target.value)}>
          {mondays.map((m, i) => {
            const inProgress = addDaysIso(m, 6) > latest;
            const dias = Math.round((new Date((inProgress ? latest : addDaysIso(m, 6)) + "T00:00:00Z") - new Date(m + "T00:00:00Z")) / 86400000) + 1;
            return <option key={m} value={m}>{repFecha(m)} → {repFecha(inProgress ? latest : addDaysIso(m, 6))}{inProgress ? ` · en curso (${dias} de 7 días)` : ""}</option>;
          })}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn no-print" onClick={() => {
          const md = weekMarkdown(w, sigs);
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
          a.download = `bambu-informe-${w.monIso}.md`; a.click();
        }}>⤓ Markdown</button>
        <button className="btn primary no-print" onClick={doPrint}>⤓ Exportar informe a PDF</button>
      </div>

      <article id="report-sheet" className="card card-pad" style={{ padding: 28, maxWidth: 1000 }}>
        {/* cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid var(--ink)", paddingBottom: 14, marginBottom: 18 }}>
          <svg width="34" height="34" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="7" fill="#3E7C57" /><path d="M12 8.5v15M20 8.5v15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><path d="M12 13h8M12 18.5h8" stroke="#A6D9B8" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.02em" }}>Informe semanal on-chain</div>
            <div className="tiny muted">Semana del {repFecha(w.monIso)} al {repFecha(w.end)}{addDaysIso(w.monIso, 6) > latest ? ` · en curso, ${Math.round((new Date(w.end + "T00:00:00Z") - new Date(w.monIso + "T00:00:00Z")) / 86400000) + 1} de 7 días` : ""} · Modelo Bambú v2.2</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tiny muted">Régimen</div>
            <div style={{ fontWeight: 700, color: "var(--brand)" }}>{w.regime}</div>
          </div>
        </div>

        {/* cifras de cabecera */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          <RepBox lab="Lectura del conjunto" val={posEnd.toFixed(0) + " /100"} sub={`media de ${w.assets.map(A => A.t).join(" y ")} · ${dTemp >= 0 ? "▲" : "▼"} ${Math.abs(dTemp).toFixed(0)} puntos`} color={tempCol} />
          <RepBox lab="Fear & Greed" val={fg.value} sub={fg.label} color={E.tempColor(fg.value, palette)} />
          <RepBox lab="Ciclo halving" val={(now.progress * 100).toFixed(0) + "%"} sub={"día " + now.daysSince + " · " + now.daysUntil + "d al próximo"} />
          <RepBox lab="Tamaño de cada compra" val={"×" + DD.REGIMES[w.regime].mult.toFixed(2)} sub={w.regime + " · tendencia de medio plazo"} />
        </div>

        {/* APERTURA · la anomalía y el mapa de la semana */}
        <div style={{ borderLeft: `5px solid ${tempCol}`, background: "var(--surface-2, #F2F6F2)", borderRadius: "0 11px 11px 0", padding: "16px 20px", marginBottom: 18 }}>
          <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".13em", fontWeight: 700, color: tempCol, marginBottom: 7 }}>{wf.anomaly ? "La anomalía de la semana" : "La semana, en una línea"}</div>
          {wf.anomaly
            ? <>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-.01em" }}>{wf.anomaly.t}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 5 }}>{wf.anomaly.d}</div>
              </>
            : <>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-.01em" }}>Semana sin anomalías: nada se salió de su rango.</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 5 }}>La lectura cierra en {posEnd.toFixed(0)} de 100 tras moverse {Math.abs(dTemp).toFixed(0)} puntos, y ninguna métrica registró un movimiento fuera de lo habitual. Que no pase nada también es información: son las semanas en las que el plan se cumple sin tocarlo.</div>
              </>}
        </div>

        <RepHead n="1" t="La semana, contada" />
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)", marginBottom: 18 }}>
          Esto se puede leer sin saber nada de análisis on-chain: cada cosa que se usa se explica al usarla. Si es tu primer informe, léelo de arriba abajo; en cuatro o cinco semanas tendrás el vocabulario entero sin haber estudiado nada.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 22 }}>
          {story.map((b, i) => (
            <div key={i}>
              <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: tempCol }}>{String(i + 1).padStart(2, "0")}</span>
                {b.h}
              </h4>
              <p style={{ fontSize: 14, lineHeight: 1.72, color: "var(--ink-2)", margin: 0, textWrap: "pretty" }}>{b.p}</p>
              {b.concepto && CONCEPTOS[b.concepto] &&
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 9, background: "var(--surface-2, #F2F6F2)", borderRadius: 9, padding: "9px 13px" }}>
                  <span className="tiny" style={{ flex: "none", fontWeight: 700, color: tempCol, textTransform: "uppercase", letterSpacing: ".08em", paddingTop: 1 }}>Aprende</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    <strong style={{ color: "var(--ink)" }}>{CONCEPTOS[b.concepto].t}:</strong> {CONCEPTOS[b.concepto].d}
                  </span>
                </div>}
            </div>
          ))}
        </div>

        {/* LO QUE PASÓ */}
        <RepHead n="2" t="Lo que pasó esta semana · por activo" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {w.assets.map(A => {
            const HR = window.BambuHistory;
            const rkA = snap => HR && HR.zoneOf ? (HR.zoneOf(snap.sth.temp, A.t, "sth", 27).rank + HR.zoneOf(snap.lth.temp, A.t, "lth", 27).rank) / 2 : (snap.sth.temp + snap.lth.temp) / 2;
            const posA = rkA(A.b);
            /* la señal sale del MISMO rank que se imprime, como en la sección 3 */
            const sigA = E.signalFor((50 - posA) / 27);
            const col = E.tempColor(posA, palette);
            return (
              <div key={A.t} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${col}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{A.t === "BTC" ? "Bitcoin" : "Ethereum"} <span className="tk">{A.t}</span></span>
                  <span className="num" style={{ fontWeight: 700, color: A.chg >= 0 ? "var(--brand)" : "#A83C26" }}>{A.chg >= 0 ? "▲" : "▼"} {Math.abs(A.chg).toFixed(1)}%</span>
                  <span className="num muted">{E.fmt.usd(A.b.price)}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <span className="num" style={{ fontWeight: 700, color: col }}>{posA.toFixed(0)} <span className="tiny muted" style={{ fontWeight: 500 }}>/100</span></span>
                  <SignalPill signal={sigA} />
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>{weekNarrative(w, A.t, sigA)}</p>
                <table className="tbl">
                  <thead><tr><th>Fundamental</th><th className="r">Inicio</th><th className="r">Cierre</th><th className="r">Δ semana</th></tr></thead>
                  <tbody>
                    {A.metrics.map((m, i) => {
                      const up = m.d >= 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.lab}</td>
                          <td className="r num muted">{m.a != null ? m.a.toFixed(m.dec) : "—"}</td>
                          <td className="r num" style={{ fontWeight: 600 }}>{m.b.toFixed(m.dec)}</td>
                          <td className="r num" style={{ color: m.d == null ? "var(--ink-3)" : up ? "var(--brand)" : "#A83C26" }}>{m.d == null ? "—" : (up ? "+" : "") + m.d.toFixed(m.dec)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* SEÑALES (cifras del reporte 360) */}
        <RepHead n="3" t="Cifras de cierre · señales del modelo" />
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 12 }}>
          Cómo se lee esta tabla: cada activo aparece dos veces, una por plazo. <strong>STH</strong> es el corto plazo (semanas) y <strong>LTH</strong> el ciclo (meses y años). La <strong>lectura</strong> va de 0 a 100 y dice la posición frente al historial del propio activo. <strong>LONG aj.</strong> es cuánto de tu capital tocaría tener comprado según esa lectura, y <strong>Net</strong> el resultado después de descontar la parte protegida.
        </p>
        <table className="tbl" style={{ marginBottom: 20 }}>
          <thead><tr><th>Activo</th><th className="c">Convicción</th><th className="c">Lectura /100</th><th className="c">Zona</th><th>Señal</th><th className="r">LONG aj.</th><th className="r">Net</th></tr></thead>
          <tbody>
            {sigs.map((s, i) => {
              /* cifra, zona, señal y sizing salen TODOS del mismo rank */
              const zr = window.BambuHistory.zoneOf(s.temp, s.type || s.ticker, s.hz || "lth");
              const rowSig = E.signalFor((50 - zr.rank) / 27);
              const sz = E.sizing(rowSig, w.regime, s.price);
              const col = E.tempColor(zr.rank, palette);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{s.key}</td>
                  <td className="c num">{E.fmt.signed(s.composite)}</td>
                  <td className="c num" style={{ color: col, fontWeight: 600 }}>{zr.rank.toFixed(0)}</td>
                  <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col }}>{zr.label}</span></td>
                  <td><SignalPill signal={rowSig} /></td>
                  <td className="r num">{(sz.longAdj * 100).toFixed(2)}%</td>
                  <td className="r num" style={{ fontWeight: 600, color: sz.net >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(sz.net * 100, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* LO QUE VIENE */}
        <RepHead n="4" t="Lo que tener en cuenta esta semana" />
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", marginBottom: 14 }}>
          Las mismas cuatro preguntas del Resumen, respondidas en clave de la semana que empieza: qué esperar, qué nivel vigilar y qué haría cambiar la respuesta.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
          {wAhead.map((q, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "14px 17px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 7 }}>
                <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 200, fontSize: 14.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{q.q}</span>
                <span className="badge" style={{ background: mixSoft(tempCol), color: tempCol, fontWeight: 700 }}>{q.a}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>{q.body}</p>
              <div className="tiny muted" style={{ marginTop: 8, display: "flex", gap: 7, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="num" style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>{q.lvl}</span>
                <span>{q.lvlLab}</span>
              </div>
            </div>
          ))}
        </div>

        <RepHead n="5" t="Lo que viene · escenarios" />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Catalizadores próximos</div>
            <table className="tbl">
              <tbody>
                {cal.map((e, i) => (
                  <tr key={i}>
                    <td className="num muted" style={{ width: 58, whiteSpace: "nowrap" }}>+{e.days}d</td>
                    <td style={{ fontWeight: 600 }}>{e.event}</td>
                    <td className="r"><span className="badge" style={{ background: e.impact === "alto" ? mixSoft(E.tempColor(85, palette)) : "var(--surface-3)", color: e.impact === "alto" ? E.tempColor(85, palette) : "var(--ink-3)" }}>{e.impact}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Contexto de ciclo</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: macroCol, marginBottom: 4 }}>{now.macroPhase}</div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
              {now.athPassed
                ? <>El ATH del ciclo se marcó el {C.fmtES(now.ath.d)} ({E.fmt.usd(now.ath.p)}), hace {now.daysSinceATH} días. Si se repite el patrón histórico (bear medio {C.avgBear}d), el suelo macro se proyecta hacia <strong>{C.fmtES(now.projBottom)}</strong> (~{Math.max(0, now.daysToProjBottom)}d). </>
                : <>Aún no se confirma el ATH del ciclo; restan ~{now.daysToATH}d al pico según el patrón medio. </>}
              Próximo halving: <strong>{C.fmtES(now.nextH.date)}</strong> ({now.daysUntil}d).
            </p>
            <div className="tiny muted" style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--border)", lineHeight: 1.55 }}>
              Ojo a no confundir dos cosas que aparecen en este informe: arriba el <strong>régimen</strong> dice <strong>{w.regime}</strong> y aquí el contexto de ciclo dice <strong>{now.macroPhase}</strong>. No se contradicen porque no miden lo mismo. El régimen describe la <strong>tendencia de los últimos meses</strong> —de ahí sale el tamaño de cada compra—, mientras el contexto de ciclo sitúa el momento <strong>respecto al máximo histórico</strong>, que se marcó hace {now.daysSinceATH || 0} días. Se puede estar rebotando con fuerza y seguir por debajo del techo del ciclo: es exactamente lo que ocurre hoy.
            </div>
          </div>
        </div>

        {/* Qué dice la historia */}
        <div style={{ background: "var(--surface-3)", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Qué dice la historia · situaciones on-chain comparables</div>
          <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
            La lectura actual no es nueva: el modelo busca en el histórico real momentos con un <strong>MVRV Z-Score</strong> parecido al de hoy y mide qué hizo el precio después. Es la forma más honesta de anticipar: no predecir, sino apoyarse en cómo se resolvieron condiciones equivalentes.
          </p>
          <div className="grid" style={{ gridTemplateColumns: ethA ? "1fr 1fr" : "1fr", gap: 12 }}>
            {[{ tk: "BTC", a: anBTC, snap: btcA }, ...(ethA ? [{ tk: "ETH", a: anETH, snap: ethA }] : [])].map(({ tk, a, snap }) => {
              const col = tk === "BTC" ? "#C77B3A" : "#3E6FB0";
              const g = (a.agg || {})[90], g6 = (a.agg || {})[180];
              return (
                <div key={tk} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", background: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: col }}>{tk === "BTC" ? "Bitcoin" : "Ethereum"}</span>
                    <span className="tiny muted">MVRV-Z hoy {snap.b.v.mvrvZ != null ? snap.b.v.mvrvZ.toFixed(2) : "—"}</span>
                  </div>
                  {a.count >= 2 && g
                    ? <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                        En <strong>{a.count}</strong> episodios con MVRV-Z cercano ({(a.target - a.tol).toFixed(1)}–{(a.target + a.tol).toFixed(1)}), a 90 días el precio rindió en mediana <strong style={{ color: g.med >= 0 ? "var(--brand)" : "#A83C26" }}>{g.med >= 0 ? "+" : ""}{g.med.toFixed(0)}%</strong> (rango {g.min.toFixed(0)}% … {g.max.toFixed(0)}%){g6 ? <>; a 180 días, mediana <strong style={{ color: g6.med >= 0 ? "var(--brand)" : "#A83C26" }}>{g6.med >= 0 ? "+" : ""}{g6.med.toFixed(0)}%</strong></> : null}.
                        {a.closest ? <> El análogo más cercano fue <strong>{mesAno(a.closest.iso)}</strong> (MVRV-Z {a.closest.val.toFixed(2)}), tras el cual subió <strong style={{ color: a.closest.fwd[90] >= 0 ? "var(--brand)" : "#A83C26" }}>{a.closest.fwd[90] >= 0 ? "+" : ""}{a.closest.fwd[90].toFixed(0)}%</strong> en 90 días.</> : null}
                      </p>
                    : <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>Sin suficientes episodios históricos comparables{tk === "ETH" ? " (ETH solo tiene datos desde 2015)" : ""}.</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Escenarios a 90 días */}
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 2px 10px" }}>Escenarios a 90 días · proyección sobre BTC desde {E.fmt.usd(btcPx)}{dist ? ` · ${dist.n} análogos, con el ciclo actual pesando ${(dist.wCurrent * 100).toFixed(0)}%` : ""}</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 4 }}>
          {scen.map((s, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 15px", borderTop: `4px solid ${s.col}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                {s.prob != null && <span className="badge" style={{ background: mixSoft(s.col), color: s.col, fontWeight: 700 }}>{(s.prob * 100).toFixed(0)}%</span>}
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: s.col, lineHeight: 1.1 }}>{s.pct >= 0 ? "+" : ""}{s.pct.toFixed(0)}%</div>
              <div className="num tiny muted" style={{ marginBottom: 8 }}>BTC ≈ {E.fmt.usd(tgt(s.pct))}</div>
              <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)" }}><strong style={{ color: "var(--ink)" }}>Gatillo:</strong> {s.trig}</p>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-3)" }}>{s.hist}</p>
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
          Las probabilidades son la frecuencia histórica de cada desenlace a 90 días en los análogos por MVRV-Z (alcista &gt; +12%, bajista &lt; −12%, base intermedio), no una predicción. <strong>Los análogos no pesan igual</strong>: el mercado de 2013 tenía otra liquidez, otro tamaño y ningún ETF, así que cada ciclo hacia atrás cuenta un tercio que el siguiente. Por eso el ciclo actual y el anterior concentran la proyección, mientras los ciclos previos a 2020 solo la matizan; los rangos son percentiles ponderados, no el máximo y el mínimo absolutos, para que un único episodio de hace diez años no defina el techo. ETH amplifica estos rangos por su mayor beta frente a Bitcoin.
        </div>

        {/* CIERRE PEDAGÓGICO · lo que el lector se lleva de esta edición */}
        {lessons.length > 0 &&
          <div style={{ marginTop: 22, background: "var(--surface-2, #F2F6F2)", borderRadius: 12, padding: "18px 20px" }}>
            <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, color: tempCol, marginBottom: 11 }}>Lo que te llevas de esta edición</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {lessons.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span className="num" style={{ flex: "none", width: 24, height: 24, borderRadius: 7, background: "#fff", color: tempCol, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, border: "1px solid var(--border)" }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{l.t}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 2 }}>{l.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="tiny muted" style={{ marginTop: 13, lineHeight: 1.5 }}>Tres ideas por semana. En dos meses habrás recorrido el vocabulario completo del análisis on-chain sin haber estudiado nada aparte.</div>
          </div>}

        <div className="tiny muted" style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid var(--border)", lineHeight: 1.5 }}>
          Informe semanal generado por el modelo Bambú v2.2 sobre métricas públicas on-chain · semana {repFecha(w.monIso)} – {repFecha(w.end)}. No constituye asesoramiento financiero · Pedro Iván Avellaneda
        </div>
      </article>
    </div>
  );
}

function RepHead({ n, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 0 12px" }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--brand-soft)", color: "var(--brand-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</span>
      <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-2)" }}>{t}</span>
    </div>
  );
}

/* ============================================================
   SECCIÓN REPORTE 360 (informe semanal + informe on-chain)
   ============================================================ */
function SectionReporte({ results, regime, palette }) {
  const [mode, setMode] = React.useState("semanal");
  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>Reporte 360</h1>
          <p>Informes del modelo sobre datos reales on-chain. El <strong>informe semanal</strong> recopila cada lunes lo que pasó y lo que viene; el <strong>informe on-chain</strong> reconstruye el análisis para cualquier temporalidad.</p>
        </div>
        <div className="seg no-print">
          <button className={mode === "semanal" ? "on" : ""} onClick={() => setMode("semanal")}>Informe semanal · lunes</button>
          <button className={mode === "onchain" ? "on" : ""} onClick={() => setMode("onchain")}>Informe on-chain</button>
        </div>
      </div>

      {mode === "semanal"
        ? <InformeSemanal results={results} palette={palette} />
        : <InformeOnchain palette={palette} />}
    </div>
  );
}

function RepBox({ lab, val, sub, color }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "13px 15px" }}>
      <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>{lab}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, color: color || "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{val}</div>
      <div className="tiny muted" style={{ marginTop: 3 }}>{sub}</div>
    </div>
  );
}
Object.assign(window, { SectionReporte, InformeSemanal, analogStats, scenarioDist });
