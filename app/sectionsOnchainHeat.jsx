/* ============================================================
   BAMBÚ · On-chain · Vista de CALOR por activo y horizonte
   Verde oscuro = acumulación · Rojo oscuro = distribución
   - Índice Bambú: tomador de decisión diario (−100..+100)
   - Línea de calor de precio + ribbons de cada métrica
   - Tabla con celdas coloreadas por calor (score)
   - Filtro por rango rápido o intervalo de fechas
   ============================================================ */

/* ---------- escala de calor continua (muchas tonalidades) ----------
   s ∈ [-1,+1] · +1 verde (acumulación) · -1 rojo (distribución) · 0 gris */
const HEAT_STOPS = [
  [-1.00, "#5C1106"], [-0.85, "#76200F"], [-0.70, "#8E2A1A"], [-0.55, "#A53A22"],
  [-0.40, "#BC4F2C"], [-0.28, "#CD6A42"], [-0.16, "#D88E68"], [-0.07, "#C9ADA2"],
  [ 0.00, "#B4B8AE"], [ 0.07, "#A6C1A4"], [ 0.16, "#86BB8F"], [ 0.28, "#5EA871"],
  [ 0.40, "#3E8E5A"], [ 0.55, "#2C7A49"], [ 0.70, "#1B6539"], [ 0.85, "#0E5029"],
  [ 1.00, "#073C1E"],
];
function heatScore(s) {
  if (s === null || s === undefined || isNaN(s)) return "#E8EAE4";
  s = Math.max(-1, Math.min(1, s));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [a, ca] = HEAT_STOPS[i], [b, cb] = HEAT_STOPS[i + 1];
    if (s >= a && s <= b) return E.mix(ca, cb, (s - a) / ((b - a) || 1));
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}
const heatScale = heatScore;
function compHeat(comp) { return heatScore(Math.max(-1, Math.min(1, comp / 1.05))); }
const HEAT_GRAD = "linear-gradient(90deg," + HEAT_STOPS.map(s => `${s[1]} ${((s[0] + 1) / 2 * 100).toFixed(0)}%`).join(",") + ")";

/* ---------- tomador de decisión ---------- */
function decisionInfo(d) { // d ∈ [-1,1]
  if (d === null || d === undefined || isNaN(d)) return { txt: "—", tag: "Sin datos" };
  if (d >= 0.40) return { txt: "ACUMULAR FUERTE", tag: "Acumular fuerte" };
  if (d >= 0.15) return { txt: "ACUMULAR", tag: "Acumular" };
  if (d > -0.15) return { txt: "NEUTRAL", tag: "Neutral" };
  if (d > -0.40) return { txt: "DISTRIBUIR", tag: "Distribuir" };
  return { txt: "DISTRIBUIR FUERTE", tag: "Distribuir fuerte" };
}
function shiftIso(iso, days) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

/* ---------- construcción de métricas de calor por horizonte (curado BTC) ---------- */
function buildHeatMetrics(type, horizon, last) {
  const D = window.BambuData;
  const schema = D.metricsFor(type);
  const groups = (horizon === "STH" ? schema.sth : schema.lth).groups;
  let metrics = [];
  groups.forEach(g => g.metrics.forEach(m => {
    if (!m.score) return;
    const v = E.metricValue(m, last);
    if (v === undefined || v === null || isNaN(v)) return;
    metrics.push({ ...m, groupName: g.name });
  }));
  if (type === "BTC") {
    if (horizon === "LTH") {
      const rm = new Set(["mayer", "picycle", "ema1w"]);
      metrics = metrics.filter(m => !rm.has(m.key));
      const cddDef = schema.sth.groups.flatMap(g => g.metrics).find(m => m.key === "cdd");
      if (cddDef) { const cv = E.metricValue(cddDef, last); if (cv != null && !isNaN(cv)) metrics.push({ ...cddDef, groupName: "Liquidez / Flujo" }); }
    } else if (horizon === "STH") {
      metrics = metrics.filter(m => m.key !== "cdd");
    }
  }
  return metrics;
}
function indexOfMetrics(values, metrics) {
  let s = 0, c = 0;
  metrics.forEach(m => { const sc = E.metricScore(m, values); if (sc != null && !isNaN(sc)) { s += sc; c++; } });
  return c ? s / c : null;
}

/* ============================================================
   MATRIZ DE DIAGNÓSTICO + MATRIZ DE DECISIÓN (STH × LTH)
   estado: 0 = Capitulación/Acumulación · 1 = Neutral · 2 = Distribución
   filas = LTH (largo plazo) · columnas = STH (corto plazo)
   ============================================================ */
/* Nombres tomados del mismo vocabulario de bandas del motor */
const STATE_LABELS = ["Acumulación", "Neutral", "Distribución"];
const STATE_SHORT = ["Acumulación", "Neutral", "Distribución"];
/* etiqueta fina según la banda exacta del activo (Capitulación vs Acumulación…) */
function stateLabel(idx, type, hz) {
  const H = window.BambuHistory;
  if (idx == null) return "—";
  if (type && H && H.bandsFor) {
    const temp = Math.max(0, Math.min(100, 50 - idx * 50));
    return H.bandOf(temp, H.bandsFor(type, hz || "lth", 27).bands).label;
  }
  const s = stateOf(idx);
  return s == null ? "—" : STATE_LABELS[s];
}
// [LTH][STH]
const DIAG = [
  [ // LTH Frío
    { phase: "Suelo de ciclo", note: "Máxima infravaloración: largo y corto plazo en pérdidas/miedo.", tone: 1.0 },
    { phase: "Acumulación temprana", note: "Base estructural barata; el corto plazo aún sin euforia.", tone: 0.6 },
    { phase: "Rebote dentro de acumulación", note: "Calentón táctico sobre una base barata: oportunidad si recula.", tone: 0.3 },
  ],
  [ // LTH Neutral
    { phase: "Corrección / recarga", note: "El ciclo en equilibrio y el corto plazo sobrevendido: zona de compra.", tone: 0.5 },
    { phase: "Equilibrio de mercado", note: "Sin sesgo claro en ninguno de los dos horizontes.", tone: 0.0 },
    { phase: "Recalentamiento táctico", note: "Ciclo neutral pero corto plazo caliente: riesgo de corrección.", tone: -0.4 },
  ],
  [ // LTH Caliente
    { phase: "Sacudida en euforia (shakeout)", note: "Ciclo caro pero corto plazo lavado: rebote probable, no perseguir.", tone: -0.1 },
    { phase: "Distribución en curso", note: "Estructura de ciclo cara; las manos firmes reparten.", tone: -0.6 },
    { phase: "Techo de ciclo", note: "Máximo riesgo: euforia en largo y corto plazo a la vez.", tone: -1.0 },
  ],
];
const DECISION = [
  [
    { act: "Acumular fuerte", detail: "Sobreponderar · convicción máxima." },
    { act: "Acumular", detail: "Entrar en tramos · horizonte largo." },
    { act: "Acumular con paciencia", detail: "Esperar enfriamiento del STH para añadir." },
  ],
  [
    { act: "Comprar la debilidad", detail: "Aprovechar el STH sobrevendido." },
    { act: "Mantener", detail: "Peso base · sin movimientos bruscos." },
    { act: "Reducir parcial", detail: "Tomar ganancias tácticas · stops ajustados." },
  ],
  [
    { act: "Mantener con cautela", detail: "No perseguir el rebote · vigilar de cerca." },
    { act: "Distribuir gradual", detail: "Repartir en tramos · cubrir parcialmente." },
    { act: "Distribuir fuerte", detail: "Mayoría a cash · cobertura activa." },
  ],
];
/* Estado (0 fr\u00edo / 1 neutral / 2 caliente) derivado de las MISMAS bandas por
   percentiles que el resto de Bambu: el \u00edndice se traduce a temperatura y se
   busca su banda hist\u00f3rica, en vez de usar cortes fijos \u00b10.15. */
function stateOf(idx, type, hz) {
  if (idx == null) return null;
  const H = window.BambuHistory;
  if (type && H && H.bandsFor) {
    const temp = Math.max(0, Math.min(100, 50 - idx * 50));
    const id = H.bandOf(temp, H.bandsFor(type, hz || "lth", 27).bands).id;
    if (id === "fria" || id === "temprana") return 0;
    if (id === "calida" || id === "caliente") return 2;
    return 1;
  }
  return idx >= 0.15 ? 0 : idx <= -0.15 ? 2 : 1;
}

function DiagMatrices({ type, last, palette }) {
  const sthMetrics = buildHeatMetrics(type, "STH", last);
  const lthMetrics = buildHeatMetrics(type, "LTH", last);
  const sthIdx = indexOfMetrics(last, sthMetrics);
  const lthIdx = indexOfMetrics(last, lthMetrics);
  const sSt = stateOf(sthIdx, type, "sth"), lSt = stateOf(lthIdx, type, "lth");
  const diag = (lSt != null && sSt != null) ? DIAG[lSt][sSt] : null;
  const dec = (lSt != null && sSt != null) ? DECISION[lSt][sSt] : null;
  const sthCol = heatScore(sthIdx), lthCol = heatScore(lthIdx);

  const Grid = ({ cells, render }) => (
    <table className="matrix diag-matrix">
      <thead>
        <tr>
          <th className="row-h" style={{ fontSize: 10 }}>LTH ↓ / STH →</th>
          {STATE_SHORT.map((s, i) => <th key={i} style={{ color: heatScore(i === 0 ? 0.7 : i === 1 ? 0 : -0.7) }}>{s}</th>)}
        </tr>
      </thead>
      <tbody>
        {cells.map((row, li) => (
          <tr key={li}>
            <td className="row-h" style={{ fontSize: 11, fontWeight: 600, color: heatScore(li === 0 ? 0.7 : li === 1 ? 0 : -0.7) }}>{STATE_SHORT[li]}</td>
            {row.map((c, si) => {
              const here = li === lSt && si === sSt;
              const bg = heatScore(c.tone);
              return (
                <td key={si} className="heat-pad">
                  <div style={{ position: "relative", borderRadius: 8, padding: "9px 10px", minHeight: 62, background: mixSoft(bg, here ? 0.42 : 0.74), border: here ? `2.5px solid ${bg}` : "1px solid var(--border)", boxShadow: here ? "0 4px 14px rgba(0,0,0,.12)" : "none" }}>
                    {here && <span style={{ position: "absolute", top: -9, right: -7, background: bg, color: E.readableText(bg), fontSize: 8.5, fontWeight: 700, padding: "2px 6px", borderRadius: 100, letterSpacing: ".04em" }}>ACTUAL</span>}
                    {render(c, here)}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <Card title={<>{type} · Diagnóstico y decisión STH × LTH <HelpDot k="diagMatriz" /></>} sub="Cruce del corto plazo (¿conviene comprar ya?) con el largo plazo (¿en qué parte del ciclo estamos?). La casilla ACTUAL es el mercado hoy: la primera matriz dice qué está pasando y la segunda qué hacer con tu capital" style={{ marginBottom: 16 }}>
      {/* resumen */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <span className="pill" style={{ background: mixSoft(sthCol), color: sthCol, fontSize: 13 }}>STH {sthIdx == null ? "—" : (sthIdx > 0 ? "+" : "") + Math.round(sthIdx * 100)} · {stateLabel(sthIdx, type, "sth")}</span>
        <span className="muted">×</span>
        <span className="pill" style={{ background: mixSoft(lthCol), color: lthCol, fontSize: 13 }}>LTH {lthIdx == null ? "—" : (lthIdx > 0 ? "+" : "") + Math.round(lthIdx * 100)} · {stateLabel(lthIdx, type, "lth")}</span>
        <span style={{ flex: 1, minWidth: 12 }} />
        {diag && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Diagnóstico</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{diag.phase}</div>
            </div>
            <span style={{ width: 1, height: 30, background: "var(--border)" }} />
            <div>
              <div className="tiny muted">Decisión</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: heatScore(diag.tone) }}>{dec.act}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div className="diag-h">Matriz de diagnóstico <HelpDot term="Matriz de diagnóstico" def="Cruza el estado del corto plazo (STH) y del largo plazo (LTH) para identificar la fase del mercado: desde 'suelo de ciclo' (verde) hasta 'techo de ciclo' (rojo). La celda marcada ACTUAL es la lectura de hoy." /></div>
          <Grid cells={DIAG} render={(c, here) => (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2 }}>{c.phase}</div>
              <div className="tiny" style={{ color: "var(--ink-2)", marginTop: 4, lineHeight: 1.3, fontSize: 10 }}>{c.note}</div>
            </>
          )} />
        </div>
        <div>
          <div className="diag-h">Matriz de decisión <HelpDot term="Matriz de decisión" def="Traduce cada fase de la matriz de diagnóstico en una acción concreta de cartera: acumular, mantener, reducir o distribuir, con el matiz de ejecución. La celda ACTUAL indica qué hacer hoy." /></div>
          <Grid cells={DECISION} render={(c, here) => (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2 }}>{c.act}</div>
              <div className="tiny" style={{ color: "var(--ink-2)", marginTop: 4, lineHeight: 1.3, fontSize: 10 }}>{c.detail}</div>
            </>
          )} />
        </div>
      </div>
    </Card>
  );
}

function OnchainHeat({ type, palette, k }) {
  const H = window.BambuHistory;
  const D = window.BambuData;
  const isRealBtc = H.isReal(type);
  const allReal = H.realOf(type);
  const minIso = allReal ? allReal.dates[0] : null;
  const maxIso = allReal ? allReal.latestIso : null;

  const [horizon, setHorizon] = React.useState("LTH");
  const [mode, setMode] = React.useState("quick");           // quick | custom
  const [range, setRange] = React.useState(isRealBtc ? 730 : 90);
  const [from, setFrom] = React.useState(allReal ? shiftIso(maxIso, -730) : null);
  const [to, setTo] = React.useState(maxIso);
  const [activePreset, setActivePreset] = React.useState(null);

  // ---- presets de rango basados en ciclos (halving / techos / suelos) ----
  const presets = React.useMemo(() => {
    if (!allReal) return [];
    const C = window.BambuCycle;
    const clamp = iso => iso < minIso ? minIso : iso > maxIso ? maxIso : iso;
    const yr = iso => iso.slice(0, 4);
    const list = [];
    if (type === "BTC" && C) {
      const Hs = C.halvings.filter(h => h.n >= 1 && (h.date <= maxIso || h.est));
      for (let i = 0; i < Hs.length - 1; i++) {
        const a = Hs[i], b = Hs[i + 1];
        list.push({ id: "hv" + i, group: "⛏ Halving → Halving", label: `${a.label} (${yr(a.date)}) → ${b.est ? "hoy" : b.label + " (" + yr(b.date) + ")"}`, from: clamp(a.date), to: b.est ? maxIso : clamp(b.date) });
      }
      const highs = C.cycles.map(c => c.high), lows = C.cycles.map(c => c.low);
      for (let i = 0; i < highs.length - 1; i++) list.push({ id: "hh" + i, group: "📈 Techo → Techo", label: `Techo ${yr(highs[i].d)} → Techo ${yr(highs[i + 1].d)}`, from: clamp(highs[i].d), to: clamp(highs[i + 1].d) });
      list.push({ id: "hhnow", group: "📈 Techo → Techo", label: `Techo ${yr(highs[highs.length - 1].d)} → hoy`, from: clamp(highs[highs.length - 1].d), to: maxIso });
      highs.forEach(h => { const nl = lows.filter(l => l.d > h.d).sort((a, b) => a.d < b.d ? -1 : 1)[0]; if (nl) list.push({ id: "hl" + h.d, group: "📉 Techo → Suelo", label: `Techo ${yr(h.d)} → Suelo ${yr(nl.d)}`, from: clamp(h.d), to: clamp(nl.d) }); });
      lows.forEach(l => { const nh = highs.filter(h => h.d > l.d).sort((a, b) => a.d < b.d ? -1 : 1)[0]; if (nh) list.push({ id: "lh" + l.d, group: "📈 Suelo → Techo", label: `Suelo ${yr(l.d)} → Techo ${yr(nh.d)}`, from: clamp(l.d), to: clamp(nh.d) }); });
    } else if (allReal) {
      // ETH (u otro): extremos derivados de su propia serie real
      let athI = 0, lowI = 0;
      for (let i = 0; i < allReal.count; i++) { const p = allReal.price(i); if (p > allReal.price(athI)) athI = i; if (p < allReal.price(lowI)) lowI = i; }
      const athIso = allReal.dates[athI];
      let preLowI = 0; for (let i = 0; i < athI; i++) if (allReal.price(i) < allReal.price(preLowI)) preLowI = i;
      let postLowI = athI; for (let i = athI; i < allReal.count; i++) if (allReal.price(i) < allReal.price(postLowI)) postLowI = i;
      list.push({ id: "lh", group: "📈 Suelo → Techo", label: `Suelo ${yr(allReal.dates[preLowI])} → Techo ${yr(athIso)} (ATH)`, from: allReal.dates[preLowI], to: athIso });
      if (postLowI > athI) list.push({ id: "hl", group: "📉 Techo → Suelo", label: `Techo ${yr(athIso)} → Suelo ${yr(allReal.dates[postLowI])}`, from: athIso, to: allReal.dates[postLowI] });
      list.push({ id: "htoday", group: "📈 Techo → hoy", label: `Techo ${yr(athIso)} (ATH) → hoy`, from: athIso, to: maxIso });
    }
    return list;
  }, [type, minIso, maxIso]);

  const presetGroups = React.useMemo(() => {
    const g = [], idx = {};
    presets.forEach(p => { if (idx[p.group] == null) { idx[p.group] = g.length; g.push([p.group, []]); } g[idx[p.group]][1].push(p); });
    return g;
  }, [presets]);

  const applyRangeSelect = (v) => {
    if (v.startsWith("preset:")) { const p = presets.find(x => x.id === v.slice(7)); if (p) { setActivePreset(p.id); setMode("custom"); setFrom(p.from); setTo(p.to); } }
    else if (v === "custom") { setActivePreset(null); setMode("custom"); }
    else { setActivePreset(null); setMode("quick"); setRange(+v); }
  };
  const selectValue = activePreset ? "preset:" + activePreset : (mode === "custom" ? "custom" : range);

  // filas según modo
  const rows = React.useMemo(() => {
    if (!allReal) return H.raw[type] || [];
    if (mode === "custom") {
      const lo = from < minIso ? minIso : from, hi = to > maxIso ? maxIso : to;
      const out = [];
      for (let i = 0; i < allReal.count; i++) { const iso = allReal.dates[i]; if (iso >= lo && iso <= hi) out.push({ i, iso, label: allReal.labelEs(iso), values: allReal.rowAt(i) }); }
      return out.length ? out : allReal.lastDays(90);
    }
    return H.realRows(range, type);
  }, [type, range, mode, from, to]);

  const chartRows = React.useMemo(() => H.sample(rows, 360), [rows]);
  // tabla: SIEMPRE orden descendente (más reciente → más antiguo), días consecutivos sin saltos.
  // Hasta ~1100 días se muestran día a día; más allá se submuestrea conservando el orden descendente.
  const tableRows = React.useMemo(() => {
    const desc = rows.slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
    return desc.length <= 1100 ? desc : H.sample(desc, 900);
  }, [rows]);
  const tableTruncated = rows.length > 1100;
  const spanDays = rows.length;

  // métricas con score del horizonte presentes en los datos
  const schema = D.metricsFor(type);
  const groups = (horizon === "STH" ? schema.sth : schema.lth).groups;
  const last = rows[rows.length - 1].values;
  let metrics = buildHeatMetrics(type, horizon, last);

  // ---- tomador de decisión: media de scores de las métricas visibles ----
  function rowDecision(values) {
    let s = 0, c = 0;
    metrics.forEach(m => { const sc = E.metricScore(m, values); if (sc != null && !isNaN(sc)) { s += sc; c++; } });
    return c ? s / c : null;
  }
  const todayDec = rowDecision(last);
  const todayInfo = decisionInfo(todayDec);
  const todayCol = heatScore(todayDec);
  const decChart = React.useMemo(() => chartRows.map(r => rowDecision(r.values)), [chartRows, metrics.length, horizon]);

  // etiquetas de eje X
  const xlab = iso => {
    const d = new Date(iso + "T00:00:00Z");
    if (spanDays <= 200) return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" });
    return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
  };

  // ---- dimensiones del panel ----
  const W = 900, GUT = 178, PLOT = W - GUT - 12, PRICEH = 150, DECH = 36, ROWH = 24, GAP = 3;
  const n = chartRows.length;
  const X = i => GUT + (n === 1 ? 0.5 : i / (n - 1)) * PLOT;
  const cellW = PLOT / Math.max(1, n);
  const prices = chartRows.map(r => r.values.price);
  let pmin = Math.min(...prices), pmax = Math.max(...prices);
  const psp = (pmax - pmin) || 1; pmin -= psp * 0.06; pmax += psp * 0.06;
  const PY = v => 8 + (1 - (v - pmin) / (pmax - pmin)) * (PRICEH - 16);
  const decY = PRICEH + 16, metricsY = decY + DECH + 16;
  const panelH = metricsY + metrics.length * (ROWH + GAP) + 28;

  // segmentos de precio coloreados por la decisión
  const segs = [];
  for (let i = 1; i < n; i++) segs.push({ x1: X(i - 1), y1: PY(prices[i - 1]), x2: X(i), y2: PY(prices[i]), c: heatScore(((decChart[i] ?? 0) + (decChart[i - 1] ?? 0)) / 2) });
  const labelStride = Math.ceil(n / 9);

  const quickRanges = (isRealBtc ? H.RANGES : [{ d: 90, l: "90 días" }]);

  return (
    <div>
      {/* controles */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={horizon === "STH" ? "on" : ""} onClick={() => setHorizon("STH")}>{type}-STH · corto plazo</button>
          <button className={horizon === "LTH" ? "on" : ""} onClick={() => setHorizon("LTH")}>{type}-LTH · largo plazo</button>
        </div>
        <span style={{ flex: 1 }} />
        {isRealBtc && (
          <>
            <select className="inp" style={{ textAlign: "left", width: 210, fontFamily: "var(--sans)" }}
                    value={selectValue}
                    onChange={e => applyRangeSelect(e.target.value)}>
              <optgroup label="Rangos rápidos">
                {quickRanges.map(r => <option key={r.d} value={r.d}>{r.l}</option>)}
                <option value="custom">Personalizado…</option>
              </optgroup>
              {presetGroups.map(([g, items]) => (
                <optgroup key={g} label={g}>
                  {items.map(p => <option key={p.id} value={"preset:" + p.id}>{p.label}</option>)}
                </optgroup>
              ))}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" className="inp" style={{ width: 140, fontFamily: "var(--mono)", fontSize: 12 }} min={minIso} max={maxIso} value={from}
                     onChange={e => { setFrom(e.target.value); setMode("custom"); setActivePreset(null); }} />
              <span className="muted tiny">→</span>
              <input type="date" className="inp" style={{ width: 140, fontFamily: "var(--mono)", fontSize: 12 }} min={minIso} max={maxIso} value={to}
                     onChange={e => { setTo(e.target.value); setMode("custom"); setActivePreset(null); }} />
            </div>
          </>
        )}
        {!isRealBtc && <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>{type} · muestra 90d</span>}
      </div>

      {/* KPI: tomador de decisión de hoy */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="card" style={{ padding: "16px 20px", borderLeft: `6px solid ${todayCol}` }}>
          <div className="lab" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", display: "flex", alignItems: "center" }}>Índice Bambú · {type}-{horizon} · hoy <HelpDot k="indice" /></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: todayCol }}>{todayDec == null ? "—" : (todayDec > 0 ? "+" : "") + Math.round(todayDec * 100)}</span>
            <span className="pill" style={{ background: mixSoft(todayCol), color: todayCol, fontSize: 13 }}>{todayInfo.txt}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>Escala −100 (distribuir) ←→ +100 (acumular) · consolida {metrics.length} métricas {horizon}.</div>
        </div>
        <div className="card kpi"><div className="lab">Precio {type} hoy</div><div className="num val">{E.fmt.usd(last.price)}</div><div className="meta muted">{rows[rows.length - 1].iso || "—"}</div></div>
        <div className="card kpi"><div className="lab">Periodo analizado</div><div className="num val" style={{ fontSize: 20 }}>{spanDays.toLocaleString("es-ES")} días</div><div className="meta muted">{(rows[0].iso || "").slice(0, 10)} → {(rows[rows.length - 1].iso || "").slice(0, 10)}</div></div>
      </div>

      {/* MATRICES DE DIAGNÓSTICO Y DECISIÓN */}
      <DiagMatrices type={type} last={last} palette={palette} />

      {/* leyenda gradiente */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span className="tiny muted" style={{ fontWeight: 600 }}>Distribuir</span>
        <div style={{ flex: 1, height: 12, borderRadius: 6, background: HEAT_GRAD, maxWidth: 420 }} />
        <span className="tiny muted" style={{ fontWeight: 600 }}>Acumular</span>
        <span className="tiny muted">· verde = capitulación/acumulación · rojo = distribución · gris = neutral</span>
      </div>

      {/* PANEL DE CALOR */}
      <Card title={`${type}-${horizon} · Mapa de calor temporal`} sub="Precio coloreado por el Índice Bambú · banda DECISIÓN + cada métrica como banda de calor">
        <div style={{ overflowX: "auto" }}>
          <svg width="100%" viewBox={`0 0 ${W} ${panelH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", minWidth: 700 }}>
            {/* eje Y precio */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
              const v = pmin + (pmax - pmin) * (1 - f), y = 8 + f * (PRICEH - 16);
              return <g key={i}>
                <line x1={GUT} y1={y} x2={W - 12} y2={y} stroke="#EDF0EA" strokeWidth="1" />
                <text x={GUT - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">{v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(v < 10 ? 1 : 0)}</text>
              </g>;
            })}
            <text x={6} y={PY((pmin + pmax) / 2)} fontSize="11" fontWeight="600" fill="#1B2420">Precio {type}</text>
            {segs.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.c} strokeWidth="2.4" strokeLinecap="round" />)}

            {/* banda DECISIÓN (tomador de decisión) */}
            <text x={6} y={decY + DECH / 2 + 4} fontSize="11" fontWeight="700" fill="#1B2420">◆ DECISIÓN</text>
            {chartRows.map((r, i) => <rect key={"d" + i} x={X(i) - cellW / 2} y={decY} width={cellW + 0.6} height={DECH} fill={heatScore(decChart[i])} />)}
            <rect x={GUT} y={decY} width={PLOT} height={DECH} fill="none" stroke="#1B2420" strokeWidth="1.2" rx="2" />
            {chartRows.map((r, i) => (i % labelStride === 0 || i === n - 1) && decChart[i] != null &&
              <text key={"dn" + i} x={X(i)} y={decY + DECH / 2 + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="var(--mono)" fill={E.readableText(heatScore(decChart[i]))}>{(decChart[i] > 0 ? "+" : "") + Math.round(decChart[i] * 100)}</text>)}

            {/* ribbons por métrica */}
            {metrics.map((m, mi) => {
              const y = metricsY + mi * (ROWH + GAP);
              return <g key={m.key + m.horizon}>
                <text x={6} y={y + ROWH / 2 + 3.5} fontSize="10" fill="#1B2420" fontWeight="500">{m.label.length > 28 ? m.label.slice(0, 27) + "…" : m.label}</text>
                {chartRows.map((r, i) => {
                  const sc = E.metricScore(m, r.values);
                  return <rect key={i} x={X(i) - cellW / 2} y={y} width={cellW + 0.6} height={ROWH} fill={heatScore(sc)} />;
                })}
              </g>;
            })}

            {/* eje X */}
            {chartRows.map((r, i) => (i % labelStride === 0 || i === n - 1) &&
              <text key={"x" + i} x={X(i)} y={panelH - 6} textAnchor="middle" fontSize="9.5" fill="#8C9389" fontFamily="var(--mono)">{xlab(r.iso)}</text>)}
          </svg>
        </div>
      </Card>

      {/* TABLA DE CALOR */}
      <Card title={`${type}-${horizon} · Tabla de calor`} sub={`Ordenada de la fecha más reciente a la más antigua · ${tableTruncated ? `${tableRows.length} fechas muestreadas de ${spanDays.toLocaleString("es-ES")} días` : `${tableRows.length} días consecutivos`} · DECISIÓN = Índice Bambú (verde acumular, rojo distribuir)`} style={{ marginTop: 16 }} pad={false}
        right={<div style={{ display: "flex", gap: 6 }}>
          <button className="btn" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => exportHeatCSV(type, horizon, tableRows, metrics, rowDecision)}>⤓ CSV</button>
          <button className="btn" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => exportHeatPDF(type, horizon, tableRows, metrics, rowDecision, palette, { from: rows[rows.length - 1].iso, to: rows[0].iso })}>⤓ PDF</button>
        </div>}>
        <div style={{ overflow: "auto", maxHeight: 560 }}>
          <table className="tbl heat-tbl">
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--surface)" }}>Fecha</th>
                <th className="r">Precio</th>
                <th className="c" style={{ position: "sticky", left: 0, zIndex: 1 }}>Decisión</th>
                {metrics.map(m => <th key={m.key + m.horizon} className="c" title={m.tech}><span style={{ display: "inline-flex", alignItems: "center" }}>{shortLabel(m.label)}<HelpDot k={m.key} /></span></th>)}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, idx) => {
                const isToday = idx === 0 && mode !== "custom";
                const dec = rowDecision(r.values);
                const decBg = heatScore(dec);
                return (
                  <tr key={r.iso}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 2, background: isToday ? "var(--brand-soft)" : "var(--surface)" }}>{r.iso}{isToday ? " · hoy" : ""}</td>
                    <td className="r num" style={{ fontWeight: 600 }}>{E.fmt.usd(r.values.price)}</td>
                    <td className="c num" style={{ background: decBg, color: E.readableText(decBg), fontWeight: 700, fontSize: 13 }}>{dec == null ? "—" : (dec > 0 ? "+" : "") + Math.round(dec * 100)}</td>
                    {metrics.map(m => {
                      const v = E.metricValue(m, r.values);
                      const sc = E.metricScore(m, r.values);
                      const bg = heatScore(sc);
                      return <td key={m.key + m.horizon} className="c num" style={{ background: bg, color: E.readableText(bg), fontWeight: 600 }}>{window.fmtVal(v, m.unit)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="tiny muted" style={{ marginTop: 10 }}>
        {isRealBtc
          ? <>Datos reales · el <strong>Índice Bambú</strong> promedia las {metrics.length} métricas {horizon} con señal y va de −100 (distribuir) a +100 (acumular). Las métricas sin fuente (SSR, funding, Reserve Risk…) no entran aquí.</>
          : <>{type} usa datos de muestra (90 días). Conecta su CSV para datos reales.</>}
      </div>
    </div>
  );
}

function shortLabel(l) {
  return l.replace(" · oscilador (SMA90 / SMA365)", "").replace(" (Adjusted SOPR)", "").replace("Multiple", "Mult.").replace(" — Desv. %", "").replace("Bollinger %B", "BB%B").replace("Realized Price", "RP");
}

/* ---------- exportación de la tabla de calor ---------- */
function heatExportRows(type, horizon, tableRows, metrics, rowDecision) {
  const head = ["Fecha", "Precio_USD", "Decision_IndiceBambu", ...metrics.map(m => shortLabel(m.label).replace(/\s+/g, "_"))];
  const body = tableRows.map(r => {
    const dec = rowDecision(r.values);
    return [r.iso, Math.round(r.values.price), dec == null ? "" : Math.round(dec * 100),
      ...metrics.map(m => { const v = E.metricValue(m, r.values); return v == null || isNaN(v) ? "" : +(+v).toFixed(4); })];
  });
  return { head, body };
}
function exportHeatCSV(type, horizon, tableRows, metrics, rowDecision) {
  const { head, body } = heatExportRows(type, horizon, tableRows, metrics, rowDecision);
  const csv = [head.join(",")].concat(body.map(r => r.join(","))).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Bambu_calor_${type}-${horizon}_${tableRows[0].iso}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportHeatPDF(type, horizon, tableRows, metrics, rowDecision, palette, span) {
  const { head, body } = heatExportRows(type, horizon, tableRows, metrics, rowDecision);
  const decIdx = 2;
  const cell = (val, ci) => {
    if (ci === 0 || ci === 1) return `<td class="lft">${ci === 1 ? "$" + Number(val).toLocaleString("en-US") : val}</td>`;
    let bg = "#fff", sc = null;
    if (ci === decIdx) { sc = val === "" ? null : val / 100; }
    else { const m = metrics[ci - 3]; sc = m && m.score && val !== "" ? m.score(+val) : null; }
    if (sc != null) bg = heatScore(sc);
    const tc = sc != null ? E.readableText(bg) : "#1B2420";
    return `<td style="background:${bg};color:${tc};font-weight:${ci === decIdx ? 700 : 500}">${val}</td>`;
  };
  const rowsHtml = body.map(r => "<tr>" + r.map((v, ci) => cell(v, ci)).join("") + "</tr>").join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Bambú · Calor ${type}-${horizon}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: -apple-system, system-ui, sans-serif; color: #1B2420; margin: 0; padding: 18px; }
    h1 { font-size: 17px; margin: 0 0 2px; }
    .sub { font-size: 11px; color: #586259; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 8.5px; }
    th, td { border: 1px solid #E4E7DF; padding: 3px 4px; text-align: center; font-variant-numeric: tabular-nums; }
    th { background: #15201A; color: #fff; font-size: 8px; position: sticky; top: 0; }
    td.lft, th:first-child, th:nth-child(2) { text-align: left; white-space: nowrap; }
    .legend { margin: 10px 0; font-size: 10px; color: #586259; }
    .sw { display: inline-block; width: 26px; height: 11px; border-radius: 3px; vertical-align: middle; }
  </style></head><body>
  <h1>🎋 Bambú · Tabla de calor ${type}-${horizon}</h1>
  <div class="sub">${span.from} → ${span.to} · ${body.length} filas · DECISIÓN = Índice Bambú (−100 distribuir … +100 acumular) · generado ${new Date().toLocaleDateString("es-ES")}</div>
  <div class="legend">Distribuir <span class="sw" style="background:${heatScore(-0.8)}"></span><span class="sw" style="background:${heatScore(-0.3)}"></span><span class="sw" style="background:${heatScore(0)}"></span><span class="sw" style="background:${heatScore(0.3)}"></span><span class="sw" style="background:${heatScore(0.8)}"></span> Acumular</div>
  <table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>
  </body></html>`);
  w.document.close();
}

Object.assign(window, { OnchainHeat, heatScore, heatScale, compHeat, decisionInfo, DiagMatrices, buildHeatMetrics, indexOfMetrics });
