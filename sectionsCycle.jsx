/* ============================================================
   BAMBÚ · Sección Ciclo Halving
   ============================================================ */

/* Catmull-Rom → path suave */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* ---------- curva de ciclo ---------- */
function CycleCurve({ palette, progress, phase }) {
  const C = window.BambuCycle;
  const w = 920, h = 320, pad = { l: 16, r: 16, t: 24, b: 46 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const X = p => pad.l + p * plotW;
  const Y = ht => pad.t + (1 - ht) * plotH;
  const pts = C.SHAPE.map(([p, ht]) => [X(p), Y(ht)]);
  const path = smoothPath(pts);
  const areaPath = path + ` L ${X(1)} ${Y(0)} L ${X(0)} ${Y(0)} Z`;
  const markerX = X(progress);
  // altura de la curva en progress (interpola lineal en SHAPE)
  let curH = 0.3;
  for (let i = 0; i < C.SHAPE.length - 1; i++) {
    const [p0, h0] = C.SHAPE[i], [p1, h1] = C.SHAPE[i + 1];
    if (progress >= p0 && progress <= p1) { const f = (progress - p0) / (p1 - p0 || 1); curH = h0 + (h1 - h0) * f; break; }
  }
  const markerY = Y(curH);
  const gid = "cycgrad_" + palette;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={E.tempColor(100, palette)} stopOpacity="0.55" />
          <stop offset="28%" stopColor={E.tempColor(78, palette)} stopOpacity="0.4" />
          <stop offset="55%" stopColor={E.tempColor(52, palette)} stopOpacity="0.28" />
          <stop offset="80%" stopColor={E.tempColor(26, palette)} stopOpacity="0.22" />
          <stop offset="100%" stopColor={E.tempColor(8, palette)} stopOpacity="0.16" />
        </linearGradient>
        <clipPath id="pastclip"><rect x="0" y="0" width={markerX} height={h} /></clipPath>
      </defs>

      {/* bandas de fase */}
      {C.PHASES.map((ph, i) => (
        <g key={i}>
          <line x1={X(ph.to)} y1={pad.t} x2={X(ph.to)} y2={Y(0)} stroke="#EDF0EA" strokeWidth="1" />
          <text x={X((ph.from + ph.to) / 2)} y={h - 26} textAnchor="middle" fontSize="9.5" fill="#8C9389">{ph.name}</text>
          <text x={X((ph.from + ph.to) / 2)} y={h - 14} textAnchor="middle" fontSize="9" fill={E.tempColor(ph.temp, palette)} fontFamily="var(--mono)" fontWeight="600">{ph.temp}°</text>
        </g>
      ))}

      {/* área + curva completa (futuro, tenue) */}
      <path d={areaPath} fill={`url(#${gid})`} opacity="0.5" />
      <path d={path} fill="none" stroke="#B7BEB2" strokeWidth="2" strokeDasharray="5 5" />
      {/* pasado (sólido) */}
      <g clipPath="url(#pastclip)">
        <path d={areaPath} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke="#1B2420" strokeWidth="2.6" strokeLinecap="round" />
      </g>

      {/* marcador "estás aquí" */}
      <line x1={markerX} y1={pad.t - 6} x2={markerX} y2={Y(0)} stroke="#1B2420" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx={markerX} cy={markerY} r="7" fill={E.tempColor(phase.temp, palette)} stroke="#fff" strokeWidth="2.5" />
      <g transform={`translate(${Math.min(markerX, w - 150)}, ${pad.t - 14})`}>
        <rect x="6" y="-2" width="142" height="20" rx="5" fill="#1B2420" />
        <text x="77" y="12" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">▼ Estás aquí · {(progress * 100).toFixed(0)}%</text>
      </g>

      {/* etiquetas extremos */}
      <text x={X(0)} y={Y(0) + 16} fontSize="10" fill="#8C9389" fontFamily="var(--mono)">Halving</text>
      <text x={X(1)} y={Y(0) + 16} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">Próx. halving</text>
    </svg>
  );
}

/* ---------- comparación de fases alcistas vs bajistas ---------- */
function BullBearChart({ palette, now }) {
  const C = window.BambuCycle;
  const rows = C.cycles.filter(c => c.n >= 2); // ciclos con halving real (2–5)
  const bullCol = E.tempColor(28, palette), bearCol = E.tempColor(72, palette);
  const maxD = Math.max(C.avgBull, C.avgBear, ...rows.map(c => Math.max(c.bullDays || 0, c.bearDays || 0, c.current ? now.daysSinceATH || 0 : 0))) * 1.05;
  const W = 760, rowH = 34, gap = 10, labW = 132, midGap = 0;
  const half = (W - labW) / 2;
  const H = rows.length * (rowH + gap) + 56;
  const Xbull = d => half - (d / maxD) * half; // crece a la izquierda desde el centro
  const Wbull = d => (d / maxD) * half;
  const cx = labW + half;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* cabeceras */}
      <text x={labW + half / 2} y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill={bullCol}>◀ ALCISTA (halving → ATH)</text>
      <text x={cx + half / 2} y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill={bearCol}>BAJISTA (ATH → suelo) ▶</text>
      <line x1={cx} y1="22" x2={cx} y2={H - 30} stroke="#D7DBD0" strokeWidth="1.5" />
      {/* líneas de promedio */}
      <line x1={cx - Wbull(C.avgBull)} y1="24" x2={cx - Wbull(C.avgBull)} y2={H - 30} stroke={bullCol} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <line x1={cx + Wbull(C.avgBear)} y1="24" x2={cx + Wbull(C.avgBear)} y2={H - 30} stroke={bearCol} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      {rows.map((c, i) => {
        const y = 30 + i * (rowH + gap);
        const bull = c.bullDays || 0;
        const bearDone = c.current ? (now.daysSinceATH || 0) : (c.bearDays || 0);
        const isCur = c.current;
        return (
          <g key={c.n}>
            <text x="4" y={y + rowH / 2 + 4} fontSize="11.5" fontWeight="600" fill="#1B2420">Ciclo {c.dispN}{isCur ? " · actual" : ""}</text>
            <text x="4" y={y + rowH / 2 + 16} fontSize="8.5" fill="#8C9389" fontFamily="var(--mono)">{c.halvingLabel}</text>
            {/* bull (izquierda) */}
            <rect x={cx - Wbull(bull)} y={y} width={Wbull(bull)} height={rowH} rx="4" fill={bullCol} opacity={isCur ? 0.9 : 0.85} />
            <text x={cx - Wbull(bull) - 6} y={y + rowH / 2 + 4} textAnchor="end" fontSize="10.5" fontWeight="700" fill={bullCol} fontFamily="var(--mono)">{bull}d</text>
            {/* bear (derecha) */}
            {bearDone > 0 && <rect x={cx} y={y} width={Wbull(bearDone)} height={rowH} rx="4" fill={bearCol} opacity={isCur ? 0.45 : 0.85} stroke={isCur ? bearCol : "none"} strokeDasharray={isCur ? "4 3" : "0"} strokeWidth={isCur ? 1.5 : 0} />}
            <text x={cx + Wbull(bearDone) + 6} y={y + rowH / 2 + 4} fontSize="10.5" fontWeight="700" fill={bearCol} fontFamily="var(--mono)">{isCur ? bearDone + "d…" : (c.bearDays != null ? c.bearDays + "d" : "—")}</text>
          </g>
        );
      })}
      <text x={cx - Wbull(C.avgBull)} y={H - 16} textAnchor="middle" fontSize="9" fill={bullCol} fontWeight="600">media {C.avgBull}d</text>
      <text x={cx + Wbull(C.avgBear)} y={H - 16} textAnchor="middle" fontSize="9" fill={bearCol} fontWeight="600">media {C.avgBear}d</text>
    </svg>
  );
}

/* ---------- precios alineados por fecha de halving (todos los ciclos) ---------- */
function HalvingPriceChart({ palette }) {
  const C = window.BambuCycle;
  const RD = window.BambuRealData || {};
  const [asset, setAsset] = React.useState("BTC");
  const ethBorn = (RD.ETH && RD.ETH.dates[0]) || "9999";
  const ethHas = c => asset !== "ETH" || ethBorn <= c.start;
  const R = RD[asset];
  const COLORS = { 2: "#C79A3A", 3: "#3E6FB0", 4: "#8A5AA8", 5: "#1B6535" };
  const allCycles = C.cycles.filter(c => c.n >= 2 && ethHas(c));
  const [sel, setSel] = React.useState(() => C.cycles.filter(c => c.n >= 2).map(c => c.n));
  if (!R) return <div className="tiny muted">Sin datos de precio.</div>;
  const toggle = n => setSel(s => s.includes(n) ? (s.length > 1 ? s.filter(x => x !== n) : s) : [...s, n]);
  const maxDays = 1458, step = 3;
  const series = allCycles.map(c => {
    let i0 = R.dates.findIndex(dd => dd >= c.start);
    const p0 = R.price(i0);
    const pts = [];
    for (let day = 0; day <= maxDays && i0 + day < R.count; day += step) pts.push({ day, mult: R.price(i0 + day) / p0 });
    const peakMult = pts.length ? Math.max(...pts.map(p => p.mult)) : 1;
    return { n: c.n, dispN: c.dispN, current: c.current, label: c.halvingLabel, year: c.start.slice(0, 4), p0, pts, peakMult, color: COLORS[c.n], on: sel.includes(c.n) };
  });
  const shown = series.filter(s => s.on);
  const w = 880, h = 360, pad = { l: 42, r: 14, t: 14, b: 30 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const minM = 0.25, maxM = 120;
  const lg = v => Math.log10(v);
  const X = d => pad.l + (d / maxDays) * plotW;
  const Y = m => pad.t + (1 - (lg(Math.max(minM, Math.min(maxM, m))) - lg(minM)) / (lg(maxM) - lg(minM))) * plotH;
  const yTicks = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const xTicks = [0, 200, 400, 600, 800, 1000, 1200, 1400];
  const now = C.computeNow();
  return (
    <div>
      {/* selector de ciclos a comparar */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <div className="seg" style={{ marginRight: 4 }}>
          <button className={asset === "BTC" ? "on" : ""} onClick={() => setAsset("BTC")}>BTC</button>
          <button className={asset === "ETH" ? "on" : ""} onClick={() => setAsset("ETH")}>ETH</button>
        </div>
        <span className="tiny muted" style={{ marginRight: 2 }}>Comparar:</span>
        {series.map(s => (
          <button key={s.n} onClick={() => toggle(s.n)} className="btn" style={{ padding: "4px 11px", fontSize: 11.5, borderColor: s.on ? s.color : "var(--border-2)", background: s.on ? mixSoft(s.color, 0.84) : "var(--surface)", color: s.on ? s.color : "var(--ink-3)", fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.on ? s.color : "var(--ink-3)", display: "inline-block", marginRight: 6, opacity: s.on ? 1 : 0.4 }} />
            Ciclo {s.dispN}{s.current ? " · actual" : ""}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn" style={{ padding: "4px 11px", fontSize: 11.5 }} onClick={() => setSel(allCycles.map(c => c.n))}>Todos</button>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {yTicks.map(t => <g key={t}>
          <line x1={pad.l} y1={Y(t)} x2={w - pad.r} y2={Y(t)} stroke={t === 1 ? "#C2C9BD" : "#EDF0EA"} strokeWidth={t === 1 ? 1.4 : 1} strokeDasharray={t === 1 ? "4 3" : "0"} />
          <text x={pad.l - 6} y={Y(t) + 3} textAnchor="end" fontSize="9" fill="#8C9389" fontFamily="var(--mono)">{t}×</text>
        </g>)}
        {xTicks.map(t => <text key={t} x={X(t)} y={h - 12} textAnchor="middle" fontSize="9" fill="#8C9389" fontFamily="var(--mono)">{t}d</text>)}
        {shown.some(s => s.current) && <>
          <line x1={X(now.daysSince)} y1={pad.t} x2={X(now.daysSince)} y2={pad.t + plotH} stroke="#1B2420" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.5" />
          <text x={X(now.daysSince)} y={pad.t + 10} textAnchor="middle" fontSize="8.5" fill="#1B2420" fontWeight="700">hoy · d{now.daysSince}</text>
        </>}
        {shown.map(s => (
          <polyline key={s.n} points={s.pts.map(p => `${X(p.day)},${Y(p.mult)}`).join(" ")} fill="none"
            stroke={s.color} strokeWidth={s.current ? 2.8 : 1.8} opacity={s.current ? 1 : 0.72}
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {shown.map(s => { const last = s.pts[s.pts.length - 1]; return last && <circle key={s.n} cx={X(last.day)} cy={Y(last.mult)} r={s.current ? 4.5 : 3} fill={s.color} stroke="#fff" strokeWidth="1.5" />; })}
        <text x={pad.l - 6} y={pad.t - 2} textAnchor="end" fontSize="8.5" fill="#8C9389">×precio</text>
      </svg>
      <div className="legend" style={{ marginTop: 8 }}>
        {shown.map(s => (
          <span key={s.n} className="li">
            <span style={{ width: 16, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} />
            Ciclo {s.dispN} · {s.label} ({s.year}){s.current ? " · actual" : ""} · máx {s.peakMult.toFixed(1)}×
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- BTC vs ETH dentro de cada ciclo de halving ---------- */
function BtcEthCycleCompare({ palette }) {
  const C = window.BambuCycle, RD = window.BambuRealData || {};
  const R = RD.BTC, RE = RD.ETH;
  if (!R || !RE) return <div className="tiny muted">Sin datos de precio para la comparación.</div>;
  const ethBorn = RE.dates[0];
  /* mínimo dentro de una ventana */
  const lowIn = (D, start, end) => {
    const i0 = D.dates.findIndex(d => d >= start);
    if (i0 < 0) return null;
    let iEnd = D.dates.findIndex(d => d >= end); if (iEnd < 0) iEnd = D.count - 1;
    let low = Infinity, li = i0;
    for (let i = i0; i <= iEnd && i < D.count; i++) { const p = D.price(i); if (p > 0 && p < low) { low = p; li = i; } }
    return isFinite(low) ? { low, lowDate: D.iso(li) } : null;
  };
  /* máximo dentro de una ventana */
  const peakIn = (D, start, end) => {
    const i0 = D.dates.findIndex(d => d >= start);
    if (i0 < 0) return null;
    let iEnd = D.dates.findIndex(d => d >= end); if (iEnd < 0) iEnd = D.count - 1;
    let peak = 0, pi = i0;
    for (let i = i0; i <= iEnd && i < D.count; i++) { const p = D.price(i); if (p > peak) { peak = p; pi = i; } }
    return peak ? { peak, peakDate: D.iso(pi) } : null;
  };
  /* suelo del ciclo ANTERIOR → techo del ciclo actual */
  const perf = (D, prevStart, cycStart, end) => {
    const lo = lowIn(D, prevStart, cycStart);
    const pk = peakIn(D, cycStart, end);
    if (!lo || !pk) return null;
    return { ...lo, ...pk, peakMult: pk.peak / lo.low };
  };
  const rows = C.cycles.filter(c => c.n >= 2).map(c => {
    const prev = C.cycles.find(p => p.n === c.n - 1);
    if (!prev || ethBorn > prev.start) return null;
    const end = c.current ? R.latestIso : c.end;
    return { c, end, btc: perf(R, prev.start, c.start, end), eth: perf(RE, prev.start, c.start, end) };
  }).filter(r => r && r.btc && r.eth);

  const btcCol = "#C79A3A", ethCol = "#3E6FB0";
  const maxMult = Math.max(...rows.flatMap(r => [r.btc.peakMult, r.eth.peakMult]));
  const W = 760, labW = 116, valW = 60, barMax = W - labW - valW - 14;
  const barW = m => Math.max(2, (Math.log10(m) / Math.log10(maxMult)) * barMax);
  const barH = 22, barGap = 5, groupGap = 26;
  const groupH = barH * 2 + barGap;
  const H = rows.length * (groupH + groupGap) + 8;
  const yof = d => { const dt = new Date(d + "T00:00:00Z"); return dt.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }); };

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {rows.map((r, i) => {
          const y0 = 6 + i * (groupH + groupGap);
          const yB = y0, yE = y0 + barH + barGap;
          return (
            <g key={r.c.n}>
              <text x="0" y={y0 + 14} fontSize="12" fontWeight="700" fill="#1B2420">Ciclo {r.c.dispN}{r.c.current ? " · actual" : ""}</text>
              <text x="0" y={y0 + 29} fontSize="8.5" fill="#8C9389" fontFamily="var(--mono)">{r.c.halvingLabel}</text>
              <text x="0" y={y0 + 41} fontSize="8.5" fill="#8C9389" fontFamily="var(--mono)">{r.c.start.slice(0, 4)}</text>
              {/* BTC */}
              <rect x={labW} y={yB} width={barW(r.btc.peakMult)} height={barH} rx="4" fill={btcCol} opacity="0.9" />
              <text x={labW + 7} y={yB + barH / 2 + 4} fontSize="10" fontWeight="700" fill="#fff">BTC</text>
              <text x={labW + barW(r.btc.peakMult) + 6} y={yB + barH / 2 + 4} fontSize="11" fontWeight="700" fill={btcCol} fontFamily="var(--mono)">{r.btc.peakMult.toFixed(1)}×</text>
              {/* ETH */}
              <rect x={labW} y={yE} width={barW(r.eth.peakMult)} height={barH} rx="4" fill={ethCol} opacity="0.9" />
              <text x={labW + 7} y={yE + barH / 2 + 4} fontSize="10" fontWeight="700" fill="#fff">ETH</text>
              <text x={labW + barW(r.eth.peakMult) + 6} y={yE + barH / 2 + 4} fontSize="11" fontWeight="700" fill={ethCol} fontFamily="var(--mono)">{r.eth.peakMult.toFixed(1)}×</text>
            </g>
          );
        })}
      </svg>
      <div className="legend" style={{ margin: "6px 0 14px" }}>
        <span className="li"><span style={{ width: 16, height: 9, borderRadius: 3, background: btcCol, display: "inline-block" }} />BTC · del suelo del ciclo anterior al techo de este ciclo</span>
        <span className="li"><span style={{ width: 16, height: 9, borderRadius: 3, background: ethCol, display: "inline-block" }} />ETH · misma medición</span>
        <span className="tiny muted">Múltiplo suelo → techo (escala logarítmica)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr><th>Ciclo</th><th className="r">Suelo (ciclo anterior)</th><th className="r">Suelo → techo BTC</th><th className="r">Suelo → techo ETH</th><th className="r">ETH vs BTC</th></tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const ratio = r.eth.peakMult / r.btc.peakMult;
              const win = ratio >= 1;
              return (
                <tr key={r.c.n} className={r.c.current ? "today" : ""}>
                  <td style={{ fontWeight: 600 }}>Ciclo {r.c.dispN}{r.c.current ? " · actual" : ""}<div className="tiny muted mono">{r.c.halvingLabel} · {C.fmtES(r.c.start)}</div></td>
                  <td className="r tiny"><div className="num" style={{ color: btcCol, fontWeight: 600 }}>BTC {E.fmt.usd(r.btc.low)}<span className="muted"> · {yof(r.btc.lowDate)}</span></div><div className="num" style={{ color: ethCol, fontWeight: 600 }}>ETH {E.fmt.usd(r.eth.low)}<span className="muted"> · {yof(r.eth.lowDate)}</span></div></td>
                  <td className="r"><div className="num" style={{ fontWeight: 700, color: btcCol }}>{r.btc.peakMult.toFixed(1)}×</div><div className="tiny muted">{yof(r.btc.peakDate)}</div></td>
                  <td className="r"><div className="num" style={{ fontWeight: 700, color: ethCol }}>{r.eth.peakMult.toFixed(1)}×</div><div className="tiny muted">{yof(r.eth.peakDate)}</div></td>
                  <td className="r"><span className="badge" style={{ background: mixSoft(win ? ethCol : btcCol, 0.82), color: win ? ethCol : btcCol, fontWeight: 700 }}>{win ? "×" + ratio.toFixed(1) + " más" : "×" + (1 / ratio).toFixed(1) + " menos"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
        ETH no tiene halving propio, pero su precio se mueve <strong>al ritmo del ciclo de Bitcoin</strong>. Históricamente ETH amplifica el ciclo: en las fases alcistas suele multiplicar más que BTC (mayor beta), y en las correcciones cae más fuerte. <strong>Acotación:</strong> el múltiplo se mide desde el <strong>punto más bajo del ciclo anterior</strong> (el suelo del mercado bajista previo) hasta el <strong>punto más alto del ciclo siguiente</strong> — el recorrido completo suelo → techo que ofreció cada ciclo a quien acumuló en la capitulación.
      </div>
    </div>
  );
}

/* ============================================================
   SECCIÓN CICLO
   ============================================================ */
function SectionCiclo({ palette }) {
  const C = window.BambuCycle;
  const now = C.computeNow();
  const phCol = E.tempColor(now.phase.temp, palette);
  const maxPeak = Math.max(now.daysSince, ...C.cycles.map(c => c.peakDays)) * 1.12;
  const macroCol = now.athPassed ? E.tempColor(72, palette) : E.tempColor(30, palette);

  const KPIc = ({ lab, val, meta, valStyle }) => (
    <div className="card kpi"><div className="lab">{lab}</div><div className="num val" style={valStyle}>{val}</div><div className="meta muted">{meta}</div></div>
  );

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Ciclo Halving +</h1>
        <p>Posición de Bitcoin dentro del ciclo de halving. Cada <strong>210.000 bloques</strong> (~4 años) la recompensa se reduce a la mitad. El pico del ciclo coincide con la <strong style={{ color: E.tempColor(92, palette) }}>distribución (caliente)</strong> y el suelo con la <strong style={{ color: E.tempColor(10, palette) }}>acumulación (fría)</strong>.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <KPIc lab="Próximo halving" val={now.daysUntil + " días"} valStyle={{ color: "var(--brand)" }} meta={C.fmtES(now.nextH.date) + " · est. (bloque 1.050.000)"} />
        <KPIc lab="Día del ciclo" val={now.daysSince + " / " + now.cycleLen} meta={"desde el 4º halving (" + C.fmtES(now.lastH.date) + ")"} />
        <KPIc lab="Ciclo actual" val={"Ciclo " + now.cycleNumber} meta={"4º halving · 3.125 BTC · bloque 840.000"} />
        <KPIc lab="Fase macro" val={now.macroPhase.split(" · ")[0]} valStyle={{ color: macroCol, fontSize: 20 }} meta={now.athPassed ? `${now.daysSinceATH} d desde el ATH (${C.fmtES(now.ath.d)})` : `pre-ATH · ${now.daysToATH} d al pico`} />
      </div>

      {/* curva */}
      {/* Fases alcistas vs bajistas */}
      <Card title="Fases alcistas vs bajistas · comparación de todos los ciclos" sub={`Días del halving al ATH (alcista) y del ATH al suelo (bajista) · promedios históricos: bull ${C.avgBull} d · bear ${C.avgBear} d`} style={{ marginTop: 0 }}>
        <BullBearChart palette={palette} now={now} />
      </Card>

      {/* Precio alineado por halving */}
      <Card title="Precio desde cada halving · todos los ciclos alineados" sub="Cada curva arranca en su halving (día 0 = precio del halving = 1×) · escala logarítmica de múltiplos · la línea punteada marca el día actual del ciclo en curso" style={{ marginTop: 16 }}>
        <HalvingPriceChart palette={palette} />
        <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
          Comparación fractal: cada ciclo multiplica menos que el anterior (rendimientos decrecientes). El ciclo actual (verde) se compara directamente contra los anteriores al mismo número de días tras el halving. Cambia entre <strong>BTC</strong> y <strong>ETH</strong> para ver el mismo patrón en cada activo.
        </div>
      </Card>


      {/* barra de progreso halving→halving */}
      <Card title="Línea de tiempo del ciclo" sub="Desde el 4º halving hasta el próximo (estimado)" style={{ marginTop: 16 }}>
        <div style={{ position: "relative", height: 14, borderRadius: 8, background: "var(--surface-3)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, width: (now.progress * 100) + "%", background: `linear-gradient(90deg, ${E.tempColor(20, palette)}, ${phCol})`, borderRadius: 8 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5 }}>
          <span><strong>{C.fmtES(now.lastH.date)}</strong><br /><span className="muted">4º halving · 3.125 BTC</span></span>
          <span style={{ textAlign: "center", color: phCol, fontWeight: 600 }}>● Estás aquí<br /><span className="num" style={{ color: "var(--ink-2)" }}>día {now.daysSince} · {(now.progress * 100).toFixed(0)}%</span></span>
          <span style={{ textAlign: "right" }}><strong>{C.fmtES(now.nextH.date)}</strong><br /><span className="muted">5º halving · 1.5625 BTC (est.)</span></span>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", marginTop: 16, alignItems: "start" }}>
        {/* tabla histórica */}
        <Card title="Cronología de ciclos" sub="Génesis = ciclo 1 · bloque, recompensa, suelo y ATH de cada era" pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>Ciclo</th><th>Evento · bloque</th><th className="r">Recompensa</th><th className="r">Mínimo</th><th className="r">Máximo (ATH)</th><th className="r">ROI</th></tr>
              </thead>
              <tbody>
                {C.cycles.map(c => (
                  <tr key={c.n} className={c.current ? "today" : ""}>
                    <td style={{ fontWeight: 600 }}>Ciclo {c.dispN}{c.current ? " · actual" : ""}</td>
                    <td className="tiny"><div style={{ fontWeight: 600 }}>{c.halvingLabel}</div><div className="muted mono">{C.fmtES(c.start)} · blq {c.block.toLocaleString("es-ES")}</div></td>
                    <td className="r num">{c.reward} BTC</td>
                    <td className="r"><div className="num" style={{ fontWeight: 600, color: E.tempColor(10, palette) }}>{E.fmt.usd(c.low.p)}</div><div className="tiny muted">{C.fmtES(c.low.d)}</div></td>
                    <td className="r"><div className="num" style={{ fontWeight: 600, color: E.tempColor(92, palette) }}>{E.fmt.usd(c.high.p)}</div><div className="tiny muted">{C.fmtES(c.high.d)}</div></td>
                    <td className="r num" style={{ fontWeight: 600, color: "var(--brand)" }}>{c.partial ? "—" : (c.roi >= 100 ? Math.round(c.roi) : c.roi.toFixed(1)) + "×"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* proyección: qué falta */}
        <Card title="¿Qué falta por terminar?" sub="Proyección de la fase actual según el patrón histórico">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--surface-3)", borderRadius: 10, padding: "13px 15px" }}>
              <div className="tiny muted">Fase macro actual</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: macroCol, marginTop: 3 }}>{now.macroPhase}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>{now.athPassed
                ? <>El ATH del ciclo fue el <strong>{C.fmtES(now.ath.d)}</strong> ({E.fmt.usd(now.ath.p)}), hace <strong className="num">{now.daysSinceATH}</strong> días. La fase alcista duró <strong className="num">{now.bullDone}</strong> días.</>
                : <>Aún no se confirma el ATH del ciclo.</>}</div>
            </div>
            {now.athPassed && (
              <div style={{ background: mixSoft(macroCol, 0.82), borderRadius: 10, padding: "13px 15px", border: `1px solid ${mixSoft(macroCol, 0.5)}` }}>
                <div className="tiny" style={{ color: "var(--ink-2)" }}>Suelo proyectado (ATH + bear medio de {C.avgBear} d)</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>{C.fmtES(now.projBottom)}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Faltarían <strong className="num" style={{ color: macroCol }}>~{Math.max(0, now.daysToProjBottom)}</strong> días para el suelo macro si se repite el patrón (bears históricos: 363–411 d).</div>
              </div>
            )}
            <div className="tiny muted" style={{ lineHeight: 1.55 }}>
              Los mercados <strong style={{ color: E.tempColor(72, palette) }}>bajistas</strong> de Bitcoin son muy simétricos: duran <strong>360–410 días</strong>. Las fases <strong style={{ color: E.tempColor(28, palette) }}>alcistas</strong> post-halving tardan más en madurar: <strong>500–550 días</strong> hasta el pico de euforia.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { SectionCiclo, CycleCurve, smoothPath, BullBearChart, BtcEthCycleCompare });
