/* ============================================================
   BAMBÚ · Gráficos de los informes (Reporte 360)
   SVG ligeros, sin librerías: líneas, barras y lectura 0–100.
   ============================================================ */

const RC_COL = { price: "#141714", sth: "#3d6fbf", lth: "#3E7C57", pos: "#3E7C57", neg: "#A83C26", grid: "#E3E6E1", mut: "#7A817B" };
const rcDate = iso => { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }); };
const rcUsd = v => v >= 1000 ? "$" + Math.round(v).toLocaleString("es-ES", { useGrouping: "always" }) : "$" + v.toLocaleString("es-ES", { maximumFractionDigits: 0 });

function useRcW(def) {
  const ref = React.useRef(null), [w, setW] = React.useState(def || 640);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const upd = () => { const cw = Math.round(el.clientWidth); if (cw > 120) setW(cw); };
    upd(); const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function rcTicks(lo, hi, n) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10)); return out;
}

/* Líneas múltiples. series: [{vals, color, label, width, dash}] */
function RcLine({ dates, series, height = 190, fmt = v => v.toFixed(2), lo: loF, hi: hiF, bands, refY, title, markX }) {
  const [ref, W] = useRcW(); const H = height * Math.min(1, Math.max(.8, W / 640)), PL = 62, PR = 12, PT = 10, PB = 26, iw = W - PL - PR, ih = H - PT - PB, n = dates.length;
  let lo = Infinity, hi = -Infinity;
  series.forEach(s => s.vals.forEach(v => { if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  if (refY != null) { lo = Math.min(lo, refY); hi = Math.max(hi, refY); }
  const pad = (hi - lo) * 0.08 || 1; lo = loF != null ? loF : lo - pad; hi = hiF != null ? hiF : hi + pad;
  const x = i => PL + (n <= 1 ? iw / 2 : i / (n - 1) * iw), y = v => PT + (1 - (v - lo) / (hi - lo)) * ih;
  const ticks = rcTicks(lo, hi, W < 480 ? 4 : 5);
  const xl = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1];
  const path = vals => { let d = "", on = false; vals.forEach((v, i) => { if (v == null || !isFinite(v)) { on = false; return; } d += (on ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); on = true; }); return d; };
  return (
    <figure ref={ref} style={{ margin: 0, minWidth: 0 }}>
      {title && <figcaption className="tiny muted" style={{ fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} role="img">
        {bands && bands.map((b, k) => <rect key={k} x={PL} width={iw} y={y(Math.min(hi, b[1]))} height={Math.max(0, y(Math.max(lo, b[0])) - y(Math.min(hi, b[1])))} fill={b[2]} opacity={b[3] || .14} />)}
        {ticks.map(t => <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke={RC_COL.grid} strokeWidth="1" /><text x={PL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="11.5" fill={RC_COL.mut} fontFamily="JetBrains Mono, monospace">{fmt(t)}</text></g>)}
        {refY != null && <line x1={PL} x2={W - PR} y1={y(refY)} y2={y(refY)} stroke={RC_COL.mut} strokeDasharray="4 3" strokeWidth="1.2" />}
        {markX != null && markX >= 0 && markX < n && <line x1={x(markX)} x2={x(markX)} y1={PT} y2={PT + ih} stroke={RC_COL.mut} strokeDasharray="2 3" strokeWidth="1" />}
        {series.map((s, k) => <path key={k} d={path(s.vals)} fill="none" stroke={s.color} strokeWidth={s.width || 1.8} strokeDasharray={s.dash || null} strokeLinejoin="round" strokeLinecap="round" />)}
        {series.map((s, k) => { let j = s.vals.length - 1; while (j >= 0 && (s.vals[j] == null || !isFinite(s.vals[j]))) j--; return j >= 0 ? <circle key={"c" + k} cx={x(j)} cy={y(s.vals[j])} r="3" fill={s.color} /> : null; })}
        {xl.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11.5" fill={RC_COL.mut}>{rcDate(dates[i])}</text>)}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 4 }}>
        {series.map((s, k) => <span key={k} className="tiny" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}><i style={{ width: 14, height: 0, borderTop: `2px ${s.dash ? "dashed" : "solid"} ${s.color}` }}></i>{s.label}</span>)}
      </div>
    </figure>
  );
}

/* Barras con signo. labels/vals del mismo largo; base = línea de referencia */
function RcBars({ labels, vals, height = 150, fmt = v => v.toFixed(1), base = 0, title, hl, valueLabels = true }) {
  const [ref, W] = useRcW(); const H = height * Math.min(1, Math.max(.85, W / 640)), PL = 50, PR = 8, PT = 16, PB = 24, iw = W - PL - PR, ih = H - PT - PB, n = vals.length;
  const fin = vals.filter(v => v != null && isFinite(v));
  let lo = Math.min(base, ...fin), hi = Math.max(base, ...fin); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * ih, bw = iw / n, gap = Math.min(6, bw * 0.25);
  const ticks = rcTicks(lo, hi, 3);
  const every = Math.ceil(n / Math.max(4, Math.floor(iw / 44)));
  return (
    <figure ref={ref} style={{ margin: 0, minWidth: 0 }}>
      {title && <figcaption className="tiny muted" style={{ fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} role="img">
        {ticks.map(t => <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke={RC_COL.grid} /><text x={PL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="11.5" fill={RC_COL.mut} fontFamily="JetBrains Mono, monospace">{fmt(t)}</text></g>)}
        <line x1={PL} x2={W - PR} y1={y(base)} y2={y(base)} stroke={RC_COL.mut} strokeWidth="1.2" />
        {vals.map((v, i) => { if (v == null || !isFinite(v)) return null; const up = v >= base, y0 = y(base), y1 = y(v); const xx = PL + i * bw + gap / 2;
          return <g key={i}>
            <rect x={xx} width={Math.max(1, bw - gap)} y={Math.min(y0, y1)} height={Math.max(1, Math.abs(y1 - y0))} fill={up ? RC_COL.pos : RC_COL.neg} opacity={hl == null || hl === i ? 1 : .55} rx="1.5" />
            {valueLabels && n <= 14 && bw >= 30 && <text x={xx + (bw - gap) / 2} y={up ? y1 - 4 : y1 + 11} textAnchor="middle" fontSize="11" fontWeight="600" fill={up ? RC_COL.pos : RC_COL.neg} fontFamily="JetBrains Mono, monospace">{fmt(v)}</text>}
          </g>; })}
        {labels.map((l, i) => i % every === 0 || i === n - 1 ? <text key={i} x={PL + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill={RC_COL.mut} fontWeight={hl === i ? 700 : 400}>{l}</text> : null)}
      </svg>
    </figure>
  );
}

const RC_ZONES = [[0, 20, "#1f4e9c", .13], [20, 40, "#8fc0f0", .2], [40, 60, "#d8dcd6", .25], [60, 80, "#ee9b4a", .15], [80, 100, "#c0392b", .13]];

/* Precio frente a coste STH y LTH, `days` días hasta endI */
function RcPriceCost({ t, endI, days = 90, startI, height, title }) {
  const R = window.BambuRealData[t]; if (!R) return null;
  const i0 = startI != null ? startI : Math.max(0, endI - days + 1);
  const sl = k => R.cols[k].slice(i0, endI + 1);
  return <RcLine dates={R.dates.slice(i0, endI + 1)} height={height} fmt={rcUsd} title={title}
    series={[{ vals: sl("price"), color: RC_COL.price, label: "Precio", width: 2.1 }, { vals: sl("rpSTH"), color: RC_COL.sth, label: "Coste STH" }, { vals: sl("rpLTH"), color: RC_COL.lth, label: "Coste LTH", dash: "5 3" }]} />;
}

/* Lectura diaria 0–100 STH y LTH entre i0 e i1 (inclusive) */
function rcRankSeries(t, i0, i1) {
  const R = window.BambuRealData[t], H = window.BambuHistory, out = { sth: [], lth: [], dates: [] };
  for (let i = i0; i <= i1; i++) {
    const v = R.rowAt(i), res = E.computeAsset({ type: t, values: DD.valuesFor(t, v) }, { k: 27 });
    out.sth.push(H.zoneOf(res.sth.temp, t, "sth", 27).rank); out.lth.push(H.zoneOf(res.lth.temp, t, "lth", 27).rank); out.dates.push(R.dates[i]);
  }
  return out;
}
function RcRank({ t, i0, i1, height = 170, title }) {
  const s = React.useMemo(() => rcRankSeries(t, i0, i1), [t, i0, i1]);
  return <RcLine dates={s.dates} lo={0} hi={100} bands={RC_ZONES} height={height} fmt={v => v.toFixed(0)} title={title}
    series={[{ vals: s.sth, color: RC_COL.sth, label: "Lectura STH (corto)", width: 2 }, { vals: s.lth, color: RC_COL.lth, label: "Lectura LTH (ciclo)", width: 2 }]} />;
}

/* SOPR STH diario como barras sobre 1 */
function RcSopr({ t, i0, i1, height = 130, title }) {
  const R = window.BambuRealData[t];
  const vals = R.cols.sthSopr.slice(i0, i1 + 1), labels = R.dates.slice(i0, i1 + 1).map(d => String(+d.slice(8)));
  return <RcBars labels={labels} vals={vals} base={1} height={height} fmt={v => v.toFixed(3).replace(".", ",")} title={title} valueLabels={false} />;
}

Object.assign(window, { RcLine, RcBars, RcPriceCost, RcRank, RcSopr, RC_COL, RC_ZONES });
