/* ============================================================
   BAMBU GO · Gráficas — precio coloreado por temperatura on-chain
   + tira de calor + casos históricos análogos. Datos reales.
   ============================================================ */
const SE = window.BambuEngine;
const SDD = window.BambuData;
const SH = window.BambuHistory;
const SPAL = "sobria";

function sTemp(d) { return d.sthTemp * 0.4 + d.lthTemp * 0.6; }
function sGrad() {
  const stops = (SDD.PALETTES[SPAL] || SDD.PALETTES.sobria).stops;
  return "linear-gradient(90deg," + stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
}
function niceUsd(v) {
  if (v >= 1000) return "$" + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k";
  return "$" + v.toFixed(v < 10 ? 2 : 0);
}

/* ---------- Precio (log) coloreado por temperatura + tira de calor ---------- */
function PriceHeatChart({ type, days, label }) {
  const data = React.useMemo(() => SH.rangeComposites(type, 27, days, 440), [type, days]);
  if (!data || data.length < 3) return null;

  const W = 800, H = 250, padL = 6, padR = 44, padT = 14, padB = 4;
  const ribbonH = 26, gap = 8;
  const prices = data.map(d => d.price).filter(p => p > 0);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const yl = v => Math.log(v);
  const ylo = yl(lo), yhi = yl(hi);
  const X = i => padL + (i / (data.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (yl(v) - ylo) / (yhi - ylo)) * (H - padT - padB);
  const cellW = (W - padL - padR) / data.length;

  // etiquetas de precio (3 niveles log)
  const ticks = [lo, Math.sqrt(lo * hi), hi];

  // segmentos de precio coloreados por temperatura
  const segs = [];
  for (let i = 1; i < data.length; i++) {
    if (!(data[i - 1].price > 0 && data[i].price > 0)) continue;
    segs.push(<line key={"s" + i} x1={X(i - 1)} y1={Y(data[i - 1].price)} x2={X(i)} y2={Y(data[i].price)}
      stroke={SE.tempColor(sTemp(data[i]), SPAL)} strokeWidth="2.6" strokeLinecap="round" />);
  }
  const last = data[data.length - 1];
  const lastCol = SE.tempColor(sTemp(last), SPAL);

  // años para el eje X
  const yearMarks = [];
  let lastYear = null;
  data.forEach((d, i) => {
    const yr = d.iso.slice(0, 4);
    if (yr !== lastYear) { yearMarks.push({ i, yr }); lastYear = yr; }
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + gap + ribbonH + 16}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* gridlines + etiquetas de precio */}
        {ticks.map((t, i) => (
          <g key={"t" + i}>
            <line x1={padL} y1={Y(t)} x2={W - padR} y2={Y(t)} stroke="#E6E4DA" strokeWidth="1" strokeDasharray="3 4" />
            <text x={W - padR + 6} y={Y(t) + 4} fontSize="11" fill="#8A9188" fontFamily="var(--mono)">{niceUsd(t)}</text>
          </g>
        ))}
        {/* años */}
        {yearMarks.map((m, i) => i % (yearMarks.length > 6 ? 2 : 1) === 0 && (
          <text key={"y" + i} x={X(m.i)} y={H + 2} fontSize="10.5" fill="#B7BBB0" fontFamily="var(--mono)">{m.yr}</text>
        ))}
        {/* línea de precio coloreada */}
        {segs}
        {/* marcador Ahora */}
        <circle cx={X(data.length - 1)} cy={Y(last.price)} r="5.5" fill={lastCol} stroke="#fff" strokeWidth="2.5" />
        <text x={X(data.length - 1)} y={Y(last.price) - 12} fontSize="11.5" fontWeight="700" fill={lastCol} textAnchor="end" fontFamily="var(--sans)">Ahora {niceUsd(last.price)}</text>

        {/* tira de calor alineada */}
        {data.map((d, i) => (
          <rect key={"r" + i} x={X(i) - cellW / 2} y={H + gap} width={cellW + 0.6} height={ribbonH}
            fill={SE.tempColor(sTemp(d), SPAL)} />
        ))}
        <text x={padL} y={H + gap + ribbonH + 13} fontSize="10" fill="#8A9188" fontFamily="var(--sans)">← más antiguo</text>
        <text x={W - padR} y={H + gap + ribbonH + 13} fontSize="10" fill="#8A9188" textAnchor="end" fontFamily="var(--sans)">hoy →</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, padding: "0 2px" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: SE.tempColor(10, SPAL) }}>Azul = barato · zona de acumulación</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: SE.tempColor(90, SPAL) }}>Rojo = caro · zona de distribución</span>
      </div>
    </div>
  );
}

/* ---------- Casos históricos análogos: qué pasó después ---------- */
function similarCases(type, currentSig, currentTemp) {
  const bt = SH.realBacktest(27, type, "COMBO");
  if (!bt) return { cases: [], avg: null, dir: "neu" };
  const dirOf = s => s.indexOf("COMPRA") >= 0 ? "buy" : s.indexOf("VENTA") >= 0 ? "sell" : "neu";
  const dirNow = dirOf(currentSig);
  const closed = bt.filter(d => d.mov != null && !d.today);
  let cases = closed.filter(d => dirOf(d.sig) === dirNow);
  if (cases.length < 2) {
    // sin coincidencia de señal: usa las lecturas más parecidas por temperatura
    cases = closed.slice().sort((a, b) => Math.abs(a.temp - currentTemp) - Math.abs(b.temp - currentTemp)).slice(0, 3);
  }
  const avg = cases.length ? cases.reduce((a, d) => a + d.mov, 0) / cases.length : null;
  return { cases: cases.sort((a, b) => b.iso.localeCompare(a.iso)), avg, dir: dirNow };
}

Object.assign(window, { PriceHeatChart, similarCases, sGrad });

/* ---------- serie de una métrica desde datos reales ---------- */
function metricSeries(type, key, days) {
  const R = window.BambuRealData && window.BambuRealData[type];
  if (!R) return [];
  const n = R.count, start = Math.max(0, n - days), out = [];
  for (let i = start; i < n; i++) {
    let val;
    if (key === "mvrvLTH") { const p = R.cols.price[i], rp = R.cols.rpLTH[i]; val = (p && rp) ? p / rp : null; }
    else val = R.cols[key] ? R.cols[key][i] : null;
    if (val != null && !isNaN(val)) out.push({ iso: R.dates[i], value: val });
  }
  return SH.sample(out, 400);
}

/* ---------- gráfica de línea de una métrica (con referencias) ---------- */
function MetricLineChart({ series, color, refs, fmtVal }) {
  if (!series || series.length < 3) return <div style={{ padding: 30, textAlign: "center", color: "var(--ink-3)" }}>Sin datos para esta métrica.</div>;
  const W = 800, H = 220, padL = 6, padR = 52, padT = 14, padB = 22;
  const vals = series.map(d => d.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  (refs || []).forEach(r => { lo = Math.min(lo, r.v); hi = Math.max(hi, r.v); });
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = i => padL + (i / (series.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  let d = "";
  series.forEach((p, i) => { d += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.value).toFixed(1) + " "; });
  const area = d + `L ${X(series.length - 1)} ${H - padB} L ${X(0)} ${H - padB} Z`;
  const last = series[series.length - 1];
  // años
  const yearMarks = []; let ly = null;
  series.forEach((p, i) => { const y = p.iso.slice(0, 4); if (y !== ly) { yearMarks.push({ i, y }); ly = y; } });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {(refs || []).map((r, i) => (
        <g key={"r" + i}>
          <line x1={padL} y1={Y(r.v)} x2={W - padR} y2={Y(r.v)} stroke={r.col || "#C9CCC3"} strokeWidth="1" strokeDasharray="4 4" />
          <text x={W - padR + 6} y={Y(r.v) + 4} fontSize="10.5" fill={r.col || "#8A9188"} fontFamily="var(--sans)">{r.label}</text>
        </g>
      ))}
      <path d={area} fill={color} opacity="0.08" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {yearMarks.map((m, i) => i % (yearMarks.length > 6 ? 2 : 1) === 0 && (
        <text key={"y" + i} x={X(m.i)} y={H - 4} fontSize="10.5" fill="#B7BBB0" fontFamily="var(--mono)">{m.y}</text>
      ))}
      <circle cx={X(series.length - 1)} cy={Y(last.value)} r="5" fill={color} stroke="#fff" strokeWidth="2.5" />
      <text x={X(series.length - 1)} y={Y(last.value) - 11} fontSize="12" fontWeight="700" fill={color} textAnchor="end" fontFamily="var(--sans)">{fmtVal ? fmtVal(last.value) : last.value.toFixed(2)}</text>
    </svg>
  );
}

/* ---------- comparador: temperatura de BTC vs ETH en el tiempo ---------- */
function CompareTempChart({ days }) {
  const btc = React.useMemo(() => SH.rangeComposites("BTC", 27, days, 300), [days]);
  const eth = React.useMemo(() => SH.rangeComposites("ETH", 27, days, 300), [days]);
  const W = 800, H = 190, padL = 6, padR = 34, padT = 12, padB = 20;
  const n = Math.min(btc.length, eth.length);
  if (n < 3) return null;
  const X = i => padL + (i / (n - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - v / 100) * (H - padT - padB);
  const line = arr => { let d = ""; for (let i = 0; i < n; i++) { const t = arr[i].sthTemp * 0.4 + arr[i].lthTemp * 0.6; d += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(t).toFixed(1) + " "; } return d; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {[20, 50, 80].map((t, i) => (
        <g key={i}><line x1={padL} y1={Y(t)} x2={W - padR} y2={Y(t)} stroke="#E6E4DA" strokeWidth="1" strokeDasharray="3 4" />
          <text x={W - padR + 5} y={Y(t) + 4} fontSize="10" fill="#8A9188" fontFamily="var(--mono)">{t}°</text></g>
      ))}
      <path d={line(btc)} fill="none" stroke="#3E7C57" strokeWidth="2.4" strokeLinejoin="round" />
      <path d={line(eth)} fill="none" stroke="#7A5AB0" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

Object.assign(window, { metricSeries, MetricLineChart, CompareTempChart });

/* ---------- Zonas de acumulación / distribución sobre el precio ---------- */
function SignalZonesChart({ type, days }) {
  const data = React.useMemo(() => SH.rangeComposites(type, 27, days, 440), [type, days]);
  if (!data || data.length < 3) return null;
  const W = 800, H = 260, padL = 6, padR = 46, padT = 14, padB = 22;
  const prices = data.map(d => d.price).filter(p => p > 0);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const yl = v => Math.log(v), ylo = yl(lo), yhi = yl(hi);
  const X = i => padL + (i / (data.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (yl(v) - ylo) / (yhi - ylo)) * (H - padT - padB);
  const cls = d => { const t = sTemp(d); return t < 40 ? "acc" : t > 60 ? "dist" : "neu"; };

  // bandas contiguas por clase
  const bands = []; let start = 0;
  for (let i = 1; i <= data.length; i++) {
    if (i === data.length || cls(data[i]) !== cls(data[start])) { bands.push({ from: start, to: i - 1, c: cls(data[start]) }); start = i; }
  }
  const bandColor = { acc: "rgba(46,111,174,.14)", dist: "rgba(188,74,46,.13)", neu: "transparent" };

  // línea de precio
  let d = "";
  data.forEach((p, i) => { if (p.price > 0) d += (d ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.price).toFixed(1) + " "; });
  const last = data[data.length - 1];
  const ticks = [lo, Math.sqrt(lo * hi), hi];
  const yearMarks = []; let ly = null;
  data.forEach((p, i) => { const y = p.iso.slice(0, 4); if (y !== ly) { yearMarks.push({ i, y }); ly = y; } });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* bandas de zona */}
        {bands.map((b, i) => b.c !== "neu" && (
          <rect key={"b" + i} x={X(b.from) - (W - padL - padR) / data.length / 2} y={padT}
            width={(X(b.to) - X(b.from)) + (W - padL - padR) / data.length} height={H - padT - padB} fill={bandColor[b.c]} />
        ))}
        {ticks.map((t, i) => (
          <g key={"t" + i}>
            <line x1={padL} y1={Y(t)} x2={W - padR} y2={Y(t)} stroke="#DDE0D7" strokeWidth="1" strokeDasharray="3 4" />
            <text x={W - padR + 6} y={Y(t) + 4} fontSize="11" fill="#8A9188" fontFamily="var(--mono)">{niceUsd(t)}</text>
          </g>
        ))}
        {yearMarks.map((m, i) => i % (yearMarks.length > 6 ? 2 : 1) === 0 && (
          <text key={"y" + i} x={X(m.i)} y={H - 5} fontSize="10.5" fill="#B7BBB0" fontFamily="var(--mono)">{m.y}</text>
        ))}
        <path d={d} fill="none" stroke="#2C3A31" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(data.length - 1)} cy={Y(last.price)} r="5" fill={SE.tempColor(sTemp(last), SPAL)} stroke="#fff" strokeWidth="2.5" />
        <text x={X(data.length - 1)} y={Y(last.price) - 11} fontSize="11.5" fontWeight="700" fill="#2C3A31" textAnchor="end" fontFamily="var(--sans)">Ahora {niceUsd(last.price)}</text>
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 16, height: 11, borderRadius: 3, background: "rgba(46,111,174,.35)" }} />Zona de acumulación (señal de compra)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 16, height: 11, borderRadius: 3, background: "rgba(188,74,46,.32)" }} />Zona de distribución (señal de venta)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 16, height: 3, borderRadius: 2, background: "#2C3A31" }} />Precio</span>
      </div>
    </div>
  );
}

Object.assign(window, { SignalZonesChart });

/* ---------- "?" de ayuda con popover ---------- */
function HelpS({ text, title }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label="Explicación"
        style={{ cursor: "pointer", width: 17, height: 17, borderRadius: "50%", border: "1.4px solid #9FB0A4", background: open ? "#3E7C57" : "transparent", color: open ? "#fff" : "#5C6660", fontSize: 11, fontWeight: 700, lineHeight: 1, padding: 0, display: "grid", placeItems: "center", fontFamily: "var(--sans)" }}>?</button>
      {open && (
        <>
          <span onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <span style={{ position: "absolute", top: "130%", left: "50%", transform: "translateX(-50%)", zIndex: 61, width: 250, maxWidth: "72vw", background: "#16241C", color: "#E7ECE6", borderRadius: 11, padding: "12px 14px", boxShadow: "0 12px 34px rgba(0,0,0,.3)", fontSize: 12.5, lineHeight: 1.5, fontWeight: 400, textAlign: "left", letterSpacing: 0, textTransform: "none" }}>
            {title && <div style={{ fontWeight: 700, marginBottom: 4, color: "#EAD98A" }}>{title}</div>}
            {text}
          </span>
        </>
      )}
    </span>
  );
}
Object.assign(window, { HelpS });
