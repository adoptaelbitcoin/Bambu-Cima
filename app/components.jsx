/* ============================================================
   BAMBÚ · Componentes UI y charts
   ============================================================ */
const E = window.BambuEngine;
const DD = window.BambuData;

/* ---------- iconos (trazos simples) ---------- */
const Icon = ({ d, size = 17, sw = 1.7, fill = "none" }) => (
  <svg className="ni-ic" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const ICONS = {
  preguntas:["M12 17h.01", "M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2", "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"],
  resumen:  ["M3 13h4l2 6 4-14 2 8h6"],
  ingreso:  ["M4 6h16", "M4 12h9", "M4 18h6", "M15 17l2 2 4-4"],
  heatmap:  ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  backtest: ["M3 3v18h18", "M7 14l3-4 3 3 4-7"],
  historial:["M4 5h16", "M4 10h16", "M4 15h10", "M4 20h6"],
  stats:    ["M5 20V9", "M12 20V4", "M19 20v-7"],
  sizing:   ["M12 3a9 9 0 109 9", "M12 12l5-3", "M12 12V5"],
  historico:["M3.5 9a9 9 0 1 1-.5 5", "M3 5v4h4", "M12 8v4.5l3 1.8"],
  ciclo:    ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v4h-4"],
  mercado:  ["M3 17l5-5 4 3 6-7", "M3 21h18"],
  onchain:  ["M12 3v18", "M5 8l7-4 7 4", "M5 8v8l7 4 7-4V8"],
  macro:    ["M8 3v3M16 3v3", "M3.5 8h17", "M4 6h16v14H4z", "M8 13h3v3H8z"],
  cartera:  ["M3 6h18v12H3z", "M3 10h18", "M7 15h4"],
  escenarios:["M3 21h18", "M6 21v-6", "M11 21V8", "M16 21v-10", "M6 13l5-6 5 3"],
  alertas:  ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.5 21a1.5 1.5 0 0 1-3 0"],
  blog:     ["M4 5h16v14H4z", "M8 9h8M8 13h8M8 17h4", "M4 5l8 6 8-6"].slice(0,1).concat(["M7 8h10M7 12h10M7 16h6"]),
  reporte:  ["M7 3h7l5 5v13H7z", "M14 3v5h5", "M10 13h6M10 17h6"],
  guia:     ["M12 7a4 4 0 1 1 1.5 7.5c-.8.4-1.5 1-1.5 2", "M12 19h.01"],
  bambu:    ["M9 3v18", "M15 3v18", "M9 8h6", "M9 14h6"],
};

/* ---------- Card ---------- */
const Card = ({ title, sub, right, children, className = "", pad = true, style }) => (
  <div className={"card " + className} style={style}>
    {title && (
      <div className="card-h">
        <span className="diamond" />
        <h3>{title}</h3>
        <span className="spacer" />
        {right}
      </div>
    )}
    {sub && <div className="card-sub">{sub}</div>}
    <div className={pad ? "card-pad" : ""}>{children}</div>
  </div>
);

/* ---------- Signal pill ---------- */
const SIG_CLASS = { "COMPRA FUERTE": "sig-buy2", "COMPRA NATURAL": "sig-buy", "COMPRA TEMPRANA": "sig-buy0", "NEUTRAL": "sig-neut", "REDUCIR": "sig-sell0", "VENTA": "sig-sell", "VENTA FUERTE": "sig-sell2" };
const SignalPill = ({ signal, big }) => (
  <span className={"pill " + SIG_CLASS[signal]} style={big ? { fontSize: 13, padding: "7px 14px" } : null}>
    {signal}
  </span>
);

/* ---------- Score chip (coloreado por temperatura del score) ---------- */
const ScoreChip = ({ score, palette }) => {
  if (score === null || score === undefined) return <span className="score-chip" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>—</span>;
  const temp = 50 - score * 50;
  const bg = E.tempColor(temp, palette);
  return <span className="score-chip" style={{ background: mixSoft(bg), color: E.tempColor(temp, palette), border: `1px solid ${mixSoft(bg, .82)}` }}>{E.fmt.score(score)}</span>;
};
function mixSoft(hex, f = .88) { return E.mix(hex, "#FFFFFF", f); }

/* ============================================================
   THERMO GAUGE — arco semicircular de 5 zonas + aguja
   ============================================================ */
function ThermoGauge({ temp, palette, signal, size = 250 }) {
  const cx = size / 2, cy = size * 0.86, R = size * 0.40, w = size * 0.13;
  const a0 = 180, a1 = 360; // semicírculo superior
  const polar = (ang, r) => {
    const a = (ang * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (deg0, deg1, r, rw) => {
    const [x0, y0] = polar(deg0, r), [x1, y1] = polar(deg1, r);
    const [x2, y2] = polar(deg1, r - rw), [x3, y3] = polar(deg0, r - rw);
    const large = deg1 - deg0 > 180 ? 1 : 0;
    return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r - rw} ${r - rw} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const segs = 40;
  const segArcs = [];
  for (let i = 0; i < segs; i++) {
    const d0 = a0 + (a1 - a0) * (i / segs);
    const d1 = a0 + (a1 - a0) * ((i + 1) / segs) + 0.4;
    const t = ((i + 0.5) / segs) * 100;
    segArcs.push(<path key={i} d={arc(d0, d1, R, w)} fill={E.tempColor(t, palette)} />);
  }
  const needleAng = a0 + (a1 - a0) * (Math.max(0, Math.min(100, temp)) / 100);
  const [nx, ny] = polar(needleAng, R + 4);
  const [bx, by] = polar(needleAng + 90, 7);
  const [bx2, by2] = polar(needleAng - 90, 7);

  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
      {segArcs}
      {/* ticks */}
      {[0, 20, 40, 60, 80, 100].map(tk => {
        const [tx, ty] = polar(a0 + (a1 - a0) * (tk / 100), R + 8);
        const [tx2, ty2] = polar(a0 + (a1 - a0) * (tk / 100), R + 14);
        return <line key={tk} x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="#C2C9BD" strokeWidth="1.5" />;
      })}
      {/* aguja */}
      <polygon points={`${nx},${ny} ${bx},${by} ${bx2},${by2}`} fill="#1B2420" />
      <circle cx={cx} cy={cy} r="9" fill="#1B2420" />
      <circle cx={cx} cy={cy} r="4" fill="#fff" />
    </svg>
  );
}

/* ============================================================
   GRADIENT BAR — acumulación ←→ distribución con marcadores
   ============================================================ */
function GradientBar({ markers, palette, height = 26 }) {
  const stops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const grad = `linear-gradient(90deg, ${stops.map(s => `${s[1]} ${s[0]}%`).join(", ")})`;
  return (
    <div>
      <div className="gbar" style={{ height }}>
        <div className="gbar-track" style={{ background: grad }} />
        {markers.map((m, i) => {
          const col = E.tempColor(m.temp, palette);
          return (
            <React.Fragment key={i}>
              <div className="gbar-marker" style={{ left: m.temp + "%", background: "#1B2420", boxShadow: "0 0 0 2px #fff" }} />
              <div className="gbar-flag" style={{ left: m.temp + "%", top: m.flagTop ?? -27, background: col, color: E.readableText(col) }}>{m.label}</div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="gbar-scale">
        <span>0 · Acumulación</span><span>25 · Temprana</span><span>50 · Neutral</span><span>75 · Cálida</span><span>100 · Distribución</span>
      </div>
    </div>
  );
}

/* ============================================================
   HEAT MATRIX — filas × columnas coloreadas por temperatura
   ============================================================ */
function HeatMatrix({ rows, cols, cell, palette }) {
  return (
    <table className="matrix">
      <thead>
        <tr>
          <th className="row-h"></th>
          {cols.map((c, i) => <th key={i}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            <td className="row-h">{r}</td>
            {cols.map((c, ci) => {
              const d = cell(ri, ci);
              if (!d) return <td key={ci} className="heat-pad"></td>;
              const col = E.tempColor(d.temp, palette);
              return (
                <td key={ci} className="heat-pad">
                  <div className="heat-cell" style={{ background: col, color: E.readableText(col) }} title={d.title || ""}>
                    {d.text}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ============================================================
   LINE CHART (equity / composite) — SVG polyline
   ============================================================ */
function LineChart({ data, height = 180, color = "#3E7C57", fill = true, yFmt, baseline, markers, palette, dotTemp }) {
  const w = 760, pad = { l: 46, r: 16, t: 14, b: 26 };
  const fin = data.map(d => (d.y != null && isFinite(d.y)) ? d.y : null);
  const ys = fin.filter(v => v != null);
  if (!ys.length) return <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{ display: "block" }}><text x={w / 2} y={height / 2} textAnchor="middle" fontSize="13" fill="#8C9389">Sin datos para esta métrica</text></svg>;
  let min = Math.min(...ys), max = Math.max(...ys);
  if (baseline !== undefined) { min = Math.min(min, baseline); max = Math.max(max, baseline); }
  const span = max - min || 1; min -= span * 0.08; max += span * 0.08;
  const X = i => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const pts = data.map((d, i) => (fin[i] != null) ? `${X(i)},${Y(d.y)}` : null).filter(Boolean).join(" ");
  const firstI = fin.findIndex(v => v != null), lastI = fin.length - 1 - [...fin].reverse().findIndex(v => v != null);
  const areaPts = pts ? `${X(firstI)},${Y(min)} ${pts} ${X(lastI)},${Y(min)}` : "";
  const ticks = 4;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = min + (max - min) * (i / ticks);
        const y = Y(v);
        return <g key={i}>
          <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#EDF0EA" strokeWidth="1" />
          <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">{yFmt ? yFmt(v) : Math.round(v)}</text>
        </g>;
      })}
      {baseline !== undefined && <line x1={pad.l} y1={Y(baseline)} x2={w - pad.r} y2={Y(baseline)} stroke="#C2C9BD" strokeWidth="1" strokeDasharray="3 3" />}
      {fill && <polygon points={areaPts} fill={color} opacity="0.08" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        if (fin[i] == null) return null;
        const c = dotTemp ? E.tempColor(d.temp, palette) : color;
        return <circle key={i} cx={X(i)} cy={Y(d.y)} r={d.big ? 5 : 3.2} fill={c} stroke="#fff" strokeWidth="1.5" />;
      })}
      {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) &&
        <text key={"x" + i} x={X(i)} y={height - 8} textAnchor="middle" fontSize="9.5" fill="#8C9389" fontFamily="var(--mono)">{d.x}</text>)}
    </svg>
  );
}

/* ---------- mini barras horizontales ---------- */
function BarRow({ value, max, color, label, right }) {
  const pct = Math.min(100, Math.abs(value) / max * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span style={{ width: 116, fontSize: 12.5, fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 9, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 5 }} />
      </div>
      <span className="num" style={{ width: 58, textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{right}</span>
    </div>
  );
}

/* ---------- HelpDot · tooltip "?" con explicación sencilla ---------- */
function HelpDot({ k, term, def, color }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0, above: false });
  const ref = React.useRef(null);
  const g = (window.BambuGlossary && window.BambuGlossary[k]) || null;
  const T = term || (g && g.term);
  const Dtxt = def || (g && g.def);
  if (!Dtxt) return null;
  const show = () => {
    const r = ref.current.getBoundingClientRect();
    const w = 288, vh = window.innerHeight;
    const above = r.bottom + 150 > vh;
    setPos({ x: Math.max(10, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 10)), y: above ? r.top - 8 : r.bottom + 8, above });
    setOpen(true);
  };
  const toggle = (e) => { e.stopPropagation(); open ? setOpen(false) : show(); };
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, [open]);
  return (
    <span ref={ref} className="help-dot" style={color ? { color, borderColor: color } : null}
          onMouseEnter={show} onMouseLeave={() => setOpen(false)} onClick={toggle}>?
      {open && (
        <span className="help-pop" style={{ position: "fixed", left: pos.x, top: pos.y, transform: pos.above ? "translateY(-100%)" : "none" }} onClick={e => e.stopPropagation()}>
          <span className="hp-term">{T}</span>
          <span className="hp-def">{Dtxt}</span>
        </span>
      )}
    </span>
  );
}

Object.assign(window, { Icon, ICONS, Card, SignalPill, SIG_CLASS, ScoreChip, mixSoft, ThermoGauge, GradientBar, HeatMatrix, LineChart, BarRow, HelpDot });
