/* ============================================================
   BAMBÚ · Charts 2 — velas, donut, barras divergentes,
   matriz de correlación
   ============================================================ */

/* ---------- velas (candlestick) ---------- */
function Candles({ data, height = 220, up = "#3E7C57", down = "#C0492E" }) {
  const w = 760, pad = { l: 48, r: 12, t: 12, b: 24 };
  const lows = data.map(d => d.l), highs = data.map(d => d.h);
  let min = Math.min(...lows), max = Math.max(...highs);
  const span = (max - min) || 1; min -= span * 0.04; max += span * 0.04;
  const plotW = w - pad.l - pad.r;
  const cw = Math.max(2, plotW / data.length * 0.62);
  const X = i => pad.l + (i + 0.5) / data.length * plotW;
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const ticks = 4;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = min + (max - min) * (i / ticks), y = Y(v);
        return <g key={i}><line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#EDF0EA" strokeWidth="1" />
          <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">{v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0)}</text></g>;
      })}
      {data.map((d, i) => {
        const col = d.c >= d.o ? up : down;
        const yo = Y(d.o), yc = Y(d.c);
        return <g key={i}>
          <line x1={X(i)} y1={Y(d.h)} x2={X(i)} y2={Y(d.l)} stroke={col} strokeWidth="1" />
          <rect x={X(i) - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(1.5, Math.abs(yc - yo))} fill={col} rx="0.5" />
        </g>;
      })}
      {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) &&
        <text key={"x" + i} x={X(i)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="#8C9389" fontFamily="var(--mono)">{d.label}</text>)}
    </svg>
  );
}

/* ---------- donut ---------- */
function Donut({ data, size = 170, thickness = 26, centerLabel, centerSub }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 4, r = R - thickness;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const a0 = acc, a1 = acc + (d.value / total) * Math.PI * 2; acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    return <path key={i} d={`M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`} fill={d.color} />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
      {centerLabel && <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="600" fill="#1B2420" fontFamily="var(--mono)">{centerLabel}</text>}
      {centerSub && <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10" fill="#8C9389">{centerSub}</text>}
    </svg>
  );
}

/* ---------- barras divergentes (liquidaciones por nivel) ---------- */
function DivergingBars({ rows, leftColor = "#3E7C57", rightColor = "#C0492E", height = 300, currentPrice }) {
  const maxV = Math.max(...rows.map(r => Math.max(r.long, r.short))) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r, i) => {
        const near = currentPrice && Math.abs(r.price - currentPrice) / currentPrice < 0.01;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 92px 1fr", alignItems: "center", gap: 8, height: (height - rows.length * 2) / rows.length }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {r.long > 0 && <div style={{ width: (r.long / maxV * 100) + "%", height: 13, background: leftColor, borderRadius: "4px 0 0 4px", opacity: .85 }} />}
            </div>
            <div className="num" style={{ textAlign: "center", fontSize: 11.5, fontWeight: near ? 700 : 500, color: near ? "var(--brand)" : "var(--ink-2)" }}>
              {r.price >= 1000 ? (r.price / 1000).toFixed(1) + "k" : r.price.toFixed(0)}
            </div>
            <div>
              {r.short > 0 && <div style={{ width: (r.short / maxV * 100) + "%", height: 13, background: rightColor, borderRadius: "0 4px 4px 0", opacity: .85 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- matriz de correlación (escala divergente azul↔rojo) ---------- */
function corrColor(v) {
  // -1 (azul) → 0 (gris) → +1 (rojo cálido)
  if (v >= 0) { const f = v; return E.mix("#EEF0EC", "#C0492E", f); }
  const f = -v; return E.mix("#EEF0EC", "#2E6FAE", f);
}
function CorrMatrix({ assets, matrix }) {
  return (
    <table className="matrix">
      <thead><tr><th className="row-h"></th>{assets.map((a, i) => <th key={i}>{a}</th>)}</tr></thead>
      <tbody>
        {assets.map((a, ri) => (
          <tr key={ri}>
            <td className="row-h">{a}</td>
            {assets.map((b, ci) => {
              const v = matrix[ri][ci];
              const bg = ri === ci ? "#1B2420" : corrColor(v);
              const tc = ri === ci ? "#fff" : Math.abs(v) > 0.55 ? "#fff" : "#1B2420";
              return <td key={ci} className="heat-pad"><div className="heat-cell" style={{ background: bg, color: tc, fontSize: 12 }}>{v.toFixed(2)}</div></td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- mini stat con delta ---------- */
function DeltaStat({ lab, val, delta, deltaFmt, sub }) {
  const up = delta >= 0;
  return (
    <div className="card kpi">
      <div className="lab">{lab}</div>
      <div className="num val">{val}</div>
      <div className="meta">
        {delta !== undefined && <span className="num" style={{ fontWeight: 600, color: up ? "var(--brand)" : "#A83C26" }}>{up ? "▲" : "▼"} {deltaFmt ? deltaFmt(delta) : E.fmt.pct(delta * 100)}</span>}
        {sub && <span className="muted">{sub}</span>}
      </div>
    </div>
  );
}

Object.assign(window, { Candles, Donut, DivergingBars, CorrMatrix, corrColor, DeltaStat });
