/* ============================================================
   BAMBÚ · Sección Histórico — series diarias, comparativos,
   explorador de métricas y lecturas guardadas
   ============================================================ */

const ASSET_COLORS = ["#C77B3A", "#3E6FB0", "#3E7C57", "#8A5AA8", "#B0476A"];
function assetColor(idx) { return ASSET_COLORS[idx % ASSET_COLORS.length]; }

/* ---------- chart multi-línea (composite BTC vs ETH) ---------- */
function MultiLine({ series, height = 210, yFmt, baseline }) {
  const w = 760, pad = { l: 46, r: 14, t: 14, b: 26 };
  const vals = series.flatMap(s => s.data.map(d => d.y)).filter(v => v != null && !isNaN(v));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (baseline !== undefined) { min = Math.min(min, baseline); max = Math.max(max, baseline); }
  const span = (max - min) || 1; min -= span * 0.1; max += span * 0.1;
  const n = series[0].data.length;
  const X = i => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const ticks = 4;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = min + (max - min) * (i / ticks), y = Y(v);
        return <g key={i}>
          <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#EDF0EA" strokeWidth="1" />
          <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">{yFmt ? yFmt(v) : Math.round(v)}</text>
        </g>;
      })}
      {baseline !== undefined && <line x1={pad.l} y1={Y(baseline)} x2={w - pad.r} y2={Y(baseline)} stroke="#C2C9BD" strokeWidth="1" strokeDasharray="3 3" />}
      {series.map((s, si) => (
        <polyline key={si} points={s.data.map((d, i) => `${X(i)},${Y(d.y)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {series[0].data.map((d, i) => (i % Math.ceil(n / 8) === 0 || i === n - 1) &&
        <text key={i} x={X(i)} y={height - 8} textAnchor="middle" fontSize="9.5" fill="#8C9389" fontFamily="var(--mono)">{d.x}</text>)}
    </svg>
  );
}
const Lgnd = ({ items }) => (
  <div className="legend" style={{ marginTop: 10 }}>
    {items.map((it, i) => <span key={i} className="li"><span style={{ width: 14, height: 3, borderRadius: 2, background: it.color, display: "inline-block" }} />{it.name}</span>)}
  </div>
);

/* ---------- gráfica de temperatura con bandas de zona (histórico) ---------- */
function HistTempChart({ data, palette, height = 200 }) {
  const w = 760, pad = { l: 34, r: 12, t: 10, b: 22 };
  const n = data.length;
  const X = i => pad.l + (n <= 1 ? 0.5 : i / (n - 1)) * (w - pad.l - pad.r);
  const Y = t => pad.t + (1 - Math.max(0, Math.min(100, t)) / 100) * (height - pad.t - pad.b);
  const pts = data.map((d, i) => `${X(i)},${Y(d.temp)}`).join(" ");
  const cur = data[n - 1], curCol = E.tempColor(cur.temp, palette);
  const stride = Math.ceil(n / 8);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {[...DD.ZONES].map(z => {
        const y0 = Y(z.max), y1 = Y(z.min), col = E.tempColor(z.temp, palette);
        return <g key={z.id}>
          <rect x={pad.l} y={y0} width={w - pad.l - pad.r} height={y1 - y0} fill={mixSoft(col, 0.72)} />
          <text x={w - pad.r - 4} y={(y0 + y1) / 2 + 3} textAnchor="end" fontSize="8.5" fill={col} fontWeight="600" opacity="0.85">{z.label}</text>
        </g>;
      })}
      {[0, 50, 100].map(t => <line key={t} x1={pad.l} y1={Y(t)} x2={w - pad.r} y2={Y(t)} stroke="rgba(0,0,0,.06)" strokeWidth="1" />)}
      <text x={pad.l - 5} y={Y(100) + 3} textAnchor="end" fontSize="8.5" fill="#A83C26" fontWeight="700">100</text>
      <text x={pad.l - 5} y={Y(50) + 3} textAnchor="end" fontSize="8.5" fill="#8C9389">50</text>
      <text x={pad.l - 5} y={Y(0) + 3} textAnchor="end" fontSize="8.5" fill="#2E6FAE" fontWeight="700">0</text>
      <polyline points={pts} fill="none" stroke="#1B2420" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
      <circle cx={X(n - 1)} cy={Y(cur.temp)} r="5" fill={curCol} stroke="#fff" strokeWidth="2" />
      {data.map((d, i) => (i % stride === 0 || i === n - 1) &&
        <text key={i} x={X(i)} y={height - 6} textAnchor="middle" fontSize="9" fill="#8C9389" fontFamily="var(--mono)">{d.x}</text>)}
    </svg>
  );
}

/* ============================================================
   SECCIÓN HISTÓRICO (por activo: BTC / ETH)
   ============================================================ */
function SectionHistorico({ results, regime, palette, k, snapshots, onSaveSnapshot }) {
  const H = window.BambuHistory;
  const assetOpts = results.filter(r => H.isReal(r.asset.type)).map(r => r.asset.type);
  const opts = [...new Set(assetOpts.length ? assetOpts : ["BTC"])];
  const [asset, setAsset] = React.useState(opts[0] || "BTC");
  const type = opts.includes(asset) ? asset : opts[0];
  const real = H.isReal(type);

  const [horizon, setHorizon] = React.useState("LTH");
  const [range, setRange] = React.useState(real ? 365 : 90);
  const [notes, setNotes] = React.useState("");

  // catálogo + métrica seleccionada (default: primera con score)
  const catalog = React.useMemo(() => H.metricCatalog(type), [type]);
  const firstScored = catalog.find(m => m.score && !m.noscore) || catalog[0];
  const [metricId, setMetricId] = React.useState(firstScored.key + firstScored.horizon);
  const sel = catalog.find(m => (m.key + m.horizon) === metricId) || firstScored;

  const xlab = iso => {
    const d = new Date(iso + "T00:00:00Z");
    if (range <= 180) return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" });
    return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
  };

  const comp = React.useMemo(() => H.rangeComposites(type, k, range), [type, k, range]);
  const rows = React.useMemo(() => H.realRows(range, type), [type, range]);
  const metricRows = React.useMemo(() => H.sample(rows, 380), [rows]);
  const metricSeries = metricRows.map(r => ({ x: xlab(r.iso), y: H.mValue(type, sel.key, r.values) }));
  const metricPoints = metricRows.map(r => {
    const v = H.mValue(type, sel.key, r.values);
    const sc = (sel.score && !sel.noscore) ? sel.score(v) : null;
    return { iso: r.iso, x: xlab(r.iso), y: (v != null && isFinite(v)) ? v : null, score: sc };
  });
  const pricePoints = metricRows.map(r => {
    const v = H.mValue(type, sel.key, r.values);
    const sc = (sel.score && !sel.noscore) ? sel.score(v) : null;
    return { iso: r.iso, x: xlab(r.iso), y: r.values.price, score: sc };
  });

  // temperatura por horizonte en el rango
  const tempSeries = comp.map(d => ({ x: xlab(d.iso), iso: d.iso, temp: horizon === "STH" ? d.sthTemp : d.lthTemp, price: d.price }));
  const temps = tempSeries.map(d => d.temp);
  const tMin = Math.min(...temps), tMax = Math.max(...temps), tAvg = temps.reduce((a, b) => a + b, 0) / temps.length;

  // distribución por zona (días en cada zona en la ventana)
  const zoneCount = DD.ZONES.map(z => ({ z, n: temps.filter(t => t >= z.min && (t < z.max || (z.max === 100 && t <= 100))).length }));
  const totalT = temps.length || 1;

  // estado actual del activo/horizonte (de results)
  const curRes = results.find(r => r.asset.type === type) || results[0];
  const curHr = horizon === "STH" ? curRes.sth : curRes.lth;

  const totalDays = real ? H.realOf(type).count : H.DAYS;
  const firstIso = real ? H.realOf(type).dates[0] : "—";
  const lastIso = real ? H.realOf(type).latestIso : "—";

  // score y señal actuales de la métrica seleccionada
  const curMetricVal = H.mValue(type, sel.key, rows[rows.length - 1].values);
  const curMetricScore = sel.score && !sel.noscore ? sel.score(curMetricVal) : null;

  const tableRows = rows.slice(-60).reverse();

  const save = () => { onSaveSnapshot(notes); setNotes(""); };
  const RangeSel = () => (
    <select className="inp" style={{ textAlign: "left", width: 120, fontFamily: "var(--sans)" }} value={range} onChange={e => setRange(+e.target.value)}>
      {H.RANGES.map(r => <option key={r.d} value={r.d}>{r.l}</option>)}
    </select>
  );
  const HorizonSeg = () => (
    <div className="seg"><button className={horizon === "STH" ? "on" : ""} onClick={() => setHorizon("STH")}>STH · corto</button><button className={horizon === "LTH" ? "on" : ""} onClick={() => setHorizon("LTH")}>LTH · largo</button></div>
  );
  const aColor = type === "ETH" ? "#3E6FB0" : "#C77B3A";

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Histórico de datos {real && <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", verticalAlign: "middle", marginLeft: 8 }}>{type} · datos reales</span>}</h1>
        <p>Histórico independiente de cada activo: valida que los extremos del pasado se repiten y da contexto a la lectura de hoy. <strong>{totalDays.toLocaleString("es-ES")} días</strong> de {type} desde {firstIso} hasta {lastIso}.</p>
      </div>

      {/* selector de activo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="tabs">
          {opts.map(o => (
            <button key={o} className={"tab" + (type === o ? " active" : "")} onClick={() => setAsset(o)}>
              {o === "BTC" ? "Bitcoin" : o === "ETH" ? "Ethereum" : o} <span className="tk">{o}</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <RangeSel />
        <HorizonSeg />
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <div className="card kpi"><div className="lab">Días en base de datos</div><div className="num val">{totalDays.toLocaleString("es-ES")}</div><div className="meta muted">{type} · diario</div></div>
        <div className="card kpi"><div className="lab">Precio {type} hoy</div><div className="num val">{E.fmt.usd(rows[rows.length - 1].values.price)}</div><div className="meta muted">{lastIso}</div></div>
        <div className="card kpi"><div className="lab">Temperatura {horizon} hoy</div><div className="num val" style={{ color: E.tempColor(curHr.temp, palette) }}>{curHr.temp.toFixed(0)}°</div><div className="meta"><span className="badge" style={{ background: mixSoft(E.tempColor(curHr.temp, palette)), color: E.tempColor(curHr.temp, palette) }}>{curHr.zone.label}</span></div></div>
        <div className="card kpi"><div className="lab">Lecturas guardadas</div><div className="num val" style={{ color: "var(--brand)" }}>{snapshots.length}</div><div className="meta muted">Snapshots del comité</div></div>
      </div>

      {/* Precio */}
      <Card title={`Precio de ${type === "BTC" ? "Bitcoin" : type === "ETH" ? "Ethereum" : type}`} sub={`Serie diaria real · ${H.RANGES.find(r => r.d === range)?.l} · coloreado por el score de ${sel.label}`}>
        <ScoreLine points={pricePoints} palette={palette} unit="USD" height={196} fill />
      </Card>

      {/* Temperatura: manómetro + curva con bandas de zona (reemplaza la tira térmica) */}
      <Card title={`Temperatura del mercado · ${type}-${horizon}`} sub="Manómetro de hoy + recorrido por las zonas en el tiempo · abajo/azul = acumulación, arriba/rojo = distribución" style={{ marginTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "center" }}>
          {/* manómetro */}
          <div className="gauge-wrap">
            <ThermoGauge temp={curHr.temp} palette={palette} size={280} />
            <div className="gauge-read">
              <div className="gauge-temp" style={{ color: E.tempColor(curHr.temp, palette) }}>{curHr.temp.toFixed(0)}°</div>
              <div className="gauge-zone" style={{ color: E.tempColor(curHr.temp, palette) }}>{curHr.zone.label}</div>
              <div className="gauge-phase">{curHr.zone.phase} → <strong>{curHr.zone.action}</strong></div>
            </div>
          </div>
          {/* curva con bandas */}
          <div>
            <HistTempChart data={tempSeries} palette={palette} height={210} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, fontSize: 12 }}>
              <span className="muted">En la ventana: mín <strong className="num">{tMin.toFixed(0)}°</strong> · media <strong className="num">{tAvg.toFixed(0)}°</strong> · máx <strong className="num">{tMax.toFixed(0)}°</strong></span>
            </div>
            {/* distribución por zona */}
            <div style={{ marginTop: 12 }}>
              <div className="tiny muted" style={{ marginBottom: 6 }}>Reparto del periodo por zona (cuántos días estuvo en cada una):</div>
              <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                {zoneCount.map(({ z, n }) => n > 0 && (
                  <div key={z.id} title={`${z.label}: ${n} días (${(n / totalT * 100).toFixed(0)}%)`} style={{ width: (n / totalT * 100) + "%", background: E.tempColor(z.temp, palette), display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {n / totalT > 0.08 && <span style={{ fontSize: 10, fontWeight: 700, color: E.readableText(E.tempColor(z.temp, palette)) }}>{(n / totalT * 100).toFixed(0)}%</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Evolución del composite */}
      <Card title={`Evolución de la convicción · ${type}`} sub="Índice de Convicción ponderado por sección · línea base en 0 · coloreado por temperatura (azul = acumular, rojo = distribuir)" style={{ marginTop: 16 }}>
        <ScoreLine points={comp.map(d => { const y = horizon === "STH" ? d.sth : d.lth; return { x: xlab(d.iso), y, temp: E.temperature(y, k) }; })} palette={palette} baseline={0} unit="" height={200} />
      </Card>

      {/* Explorador de métricas */}
      <Card title={`Explorador de métricas on-chain · ${type}`} sub="Elige una métrica para ver su valor diario, su SCORE (−1 distribuir … +1 acumular) y la SEÑAL que aporta" style={{ marginTop: 16 }}
            right={
              <select className="inp" style={{ textAlign: "left", width: 250, fontFamily: "var(--sans)" }} value={metricId} onChange={e => setMetricId(e.target.value)}>
                {catalog.filter(m => !m.noscore).map(m => <option key={m.key + m.horizon} value={m.key + m.horizon}>{m.label}{m.horizon !== "—" ? ` · ${m.horizon}` : ""}</option>)}
              </select>
            }>
        {/* cabecera explicativa de la métrica */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap", padding: "4px 2px 14px", borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{sel.label}</span>
              <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>{sel.horizon}</span>
              <HelpDot k={sel.key} />
            </div>
            <div className="mono tiny muted" style={{ marginTop: 3 }}>{sel.tech}</div>
            {sel.read && <div className="tiny" style={{ marginTop: 5, color: "var(--ink-2)" }}>Interpretación: {sel.read}</div>}
          </div>
          {/* score / señal actual */}
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div className="tiny muted">Valor hoy</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{fmtVal(curMetricVal, sel.unit)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="tiny muted">Score</div>
              <div style={{ marginTop: 3 }}>{curMetricScore == null ? <span className="muted">—</span> : <ScoreChip score={curMetricScore} palette={palette} />}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="tiny muted">Señal</div>
              <div style={{ marginTop: 3 }}>{curMetricScore == null ? <span className="muted">—</span> : <SignalDotForScore score={curMetricScore} />}</div>
            </div>
          </div>
        </div>

        {/* leyenda de score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="tiny muted">Escala del SCORE:</span>
          {[["+1", "Compra fuerte", 0], ["+0.5", "Compra", 25], ["0", "Neutral", 50], ["−0.5", "Reducir", 75], ["−1", "Venta fuerte", 100]].map(([s, l, t]) => (
            <span key={s} className="badge" style={{ background: mixSoft(E.tempColor(t, palette)), color: E.tempColor(t, palette) }}>{s} · {l}</span>
          ))}
        </div>

        <MetricExplorerChart points={metricPoints} palette={palette} unit={sel.unit} resetKey={metricId} />

        {/* tabla fecha / valor / score / señal */}
        <div className="tiny muted" style={{ margin: "16px 0 6px" }}>Detalle diario · últimos 60 días (más reciente primero)</div>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table className="tbl">
            <thead><tr><th>Fecha</th><th className="r">Precio {type}</th><th className="r">{sel.label}</th><th className="c">Score</th><th className="c">Señal</th></tr></thead>
            <tbody>
              {tableRows.map((r, idx) => {
                const v = H.mValue(type, sel.key, r.values);
                const sc = sel.score && !sel.noscore ? sel.score(v) : null;
                const isToday = idx === 0;
                return (
                  <tr key={r.iso} className={isToday ? "today" : ""}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.iso}{isToday ? " · hoy" : ""}</td>
                    <td className="r num">{E.fmt.usd(r.values.price)}</td>
                    <td className="r num">{fmtVal(v, sel.unit)}</td>
                    <td className="c">{sc === null ? <span className="tiny muted">—</span> : <ScoreChip score={sc} palette={palette} />}</td>
                    <td className="c">{sc === null ? <span className="tiny muted">—</span> : <SignalDotForScore score={sc} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Lecturas guardadas */}
      <Card title="Lecturas guardadas" sub="Snapshots del comité · convicción por activo y horizonte" style={{ marginTop: 16 }}
            right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="inp" placeholder="Nota de esta lectura…" value={notes} onChange={e => setNotes(e.target.value)} style={{ textAlign: "left", width: 220, fontFamily: "var(--sans)" }} />
              <button className="btn primary" onClick={save}>+ Guardar lectura actual</button>
            </div>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>Fecha</th><th>Régimen</th><th className="r">BTC·STH</th><th className="r">BTC·LTH</th><th className="r">ETH·STH</th><th className="r">ETH·LTH</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {snapshots.map((s, i) => (
                <tr key={i} className={s.live ? "today" : ""}>
                  <td className="mono tiny">{s.id}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{s.date}</td>
                  <td><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>{s.regime}</span></td>
                  {["btcSTH", "btcLTH", "ethSTH", "ethLTH"].map(kk => (
                    <td key={kk} className="r"><CompCell v={s[kk]} palette={palette} /></td>
                  ))}
                  <td className="muted tiny" style={{ maxWidth: 200 }}>{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- explorador: gráfica coloreada por score + zoom por días ---------- */
function scoreTemp(score) { return score == null ? 50 : 50 - score * 50; }

/* línea cuyos tramos/puntos se colorean con el tono del score (o temp) de cada fecha */
function ptTemp(p) { return p.temp != null ? p.temp : scoreTemp(p.score); }
function ScoreLine({ points, palette, unit, height = 196, fill = false, baseline }) {
  const W = 760, pad = { l: 48, r: 14, t: 14, b: 24 };
  const vals = points.map(p => p.y).filter(v => v != null && isFinite(v));
  if (!vals.length) return <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>Sin datos para esta métrica</div>;
  let min = Math.min(...vals), max = Math.max(...vals);
  if (baseline != null) { min = Math.min(min, baseline); max = Math.max(max, baseline); }
  const span = (max - min) || 1; min -= span * 0.08; max += span * 0.08;
  const X = i => pad.l + (points.length <= 1 ? 0.5 : i / (points.length - 1)) * (W - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const ticks = 4, stride = Math.max(1, Math.ceil(points.length / 8));
  const linePts = points.map((p, i) => (p.y != null && isFinite(p.y)) ? `${X(i)},${Y(p.y)}` : null).filter(Boolean).join(" ");
  const fi = points.findIndex(p => p.y != null && isFinite(p.y));
  const li = points.length - 1 - [...points].reverse().findIndex(p => p.y != null && isFinite(p.y));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = min + (max - min) * (i / ticks), y = Y(v);
        return <g key={i}>
          <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#EDF0EA" strokeWidth="1" />
          <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#8C9389" fontFamily="var(--mono)">{fmtAxis(v, unit)}</text>
        </g>;
      })}
      {baseline != null && <line x1={pad.l} y1={Y(baseline)} x2={W - pad.r} y2={Y(baseline)} stroke="#C2C9BD" strokeWidth="1" strokeDasharray="3 3" />}
      {fill && linePts && <polygon points={`${X(fi)},${Y(min)} ${linePts} ${X(li)},${Y(min)}`} fill="#586259" opacity="0.06" />}
      {/* línea coloreada por el score/temp de cada tramo */}
      {points.map((p, i) => {
        if (i === 0 || p.y == null || points[i - 1].y == null) return null;
        const a = points[i - 1], col = E.tempColor((ptTemp(a) + ptTemp(p)) / 2, palette);
        return <line key={"s" + i} x1={X(i - 1)} y1={Y(a.y)} x2={X(i)} y2={Y(p.y)} stroke={col} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {/* puntos coloreados por score/temp */}
      {points.length <= 120 && points.map((p, i) => p.y != null &&
        <circle key={"d" + i} cx={X(i)} cy={Y(p.y)} r={points.length <= 60 ? 3 : 2.2} fill={E.tempColor(ptTemp(p), palette)} stroke="#fff" strokeWidth="1.2" />)}
      {points.map((p, i) => (i % stride === 0 || i === points.length - 1) &&
        <text key={"x" + i} x={X(i)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="#8C9389" fontFamily="var(--mono)">{p.x}</text>)}
    </svg>
  );
}

function MetricExplorerChart({ points, palette, unit, resetKey }) {
  const n = points.length;
  const [zoom, setZoom] = React.useState([0, Math.max(0, n - 1)]);
  React.useEffect(() => { setZoom([0, Math.max(0, n - 1)]); }, [resetKey, n]);
  const i0 = Math.max(0, Math.min(zoom[0], zoom[1]));
  const i1 = Math.min(n - 1, Math.max(zoom[0], zoom[1]));
  const view = points.slice(i0, i1 + 1);

  const brushRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const idxFromX = (clientX) => {
    const r = brushRef.current.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round(f * (n - 1));
  };
  const onMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const cur = idxFromX(e.clientX);
    if (d.mode === "new") setZoom([d.startIdx, cur]);
    else if (d.mode === "left") setZoom([Math.min(cur, d.orig[1] - 2), d.orig[1]]);
    else if (d.mode === "right") setZoom([d.orig[0], Math.max(cur, d.orig[0] + 2)]);
    else if (d.mode === "pan") {
      const wdt = d.orig[1] - d.orig[0];
      let s = Math.max(0, Math.min(n - 1 - wdt, d.orig[0] + (cur - d.startIdx)));
      setZoom([s, s + wdt]);
    }
  };
  const onUp = () => { dragRef.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  const onDown = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { mode, startIdx: idxFromX(e.clientX), orig: [i0, i1] };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const W = 760, HT = 196;
  const vals = view.map(p => p.y).filter(v => v != null && isFinite(v));
  if (!vals.length) return <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>Sin datos para esta métrica</div>;

  // sparkline del brush (todos los puntos)
  const bw = 760, bh = 40, bvals = points.map(p => p.y).filter(v => v != null && isFinite(v));
  const bmin = bvals.length ? Math.min(...bvals) : 0, bmax = bvals.length ? Math.max(...bvals) : 1;
  const bspan = (bmax - bmin) || 1;
  const BX = i => (n <= 1 ? 0.5 : i / (n - 1)) * bw;
  const BY = v => 4 + (1 - (v - bmin) / bspan) * (bh - 8);
  const bpts = points.map((p, i) => (p.y != null && isFinite(p.y)) ? `${BX(i)},${BY(p.y)}` : null).filter(Boolean).join(" ");
  const selL = (i0 / (n - 1)) * 100, selW = ((i1 - i0) / (n - 1)) * 100;

  const fIso = view[0].iso, lIso = view[view.length - 1].iso;

  return (
    <div>
      <ScoreLine points={view} palette={palette} unit={unit} height={HT} />

      {/* control de zoom por días */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <span className="tiny muted" style={{ fontWeight: 600 }}>Zoom por días</span>
        <span className="tiny muted">{view.length} puntos · <strong className="num" style={{ color: "var(--ink)" }}>{fIso}</strong> → <strong className="num" style={{ color: "var(--ink)" }}>{lIso}</strong></span>
        <span style={{ flex: 1 }} />
        {(i0 > 0 || i1 < n - 1) && <button className="btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setZoom([0, n - 1])}>Restablecer</button>}
      </div>
      <div ref={brushRef} onPointerDown={e => onDown(e, "new")}
           style={{ position: "relative", height: bh + 4, marginTop: 6, borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--border)", overflow: "hidden", cursor: "crosshair", touchAction: "none" }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${bw} ${bh}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <polyline points={bpts} fill="none" stroke="#A9B2A6" strokeWidth="1.4" />
        </svg>
        {/* zonas fuera de selección, atenuadas */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: selL + "%", background: "rgba(27,36,32,.10)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: (100 - selL - selW) + "%", background: "rgba(27,36,32,.10)", pointerEvents: "none" }} />
        {/* selección arrastrable */}
        <div onPointerDown={e => onDown(e, "pan")}
             style={{ position: "absolute", top: 0, bottom: 0, left: selL + "%", width: selW + "%", border: "1.5px solid var(--brand)", background: "rgba(62,124,87,.10)", cursor: "grab", boxSizing: "border-box" }}>
          <div onPointerDown={e => onDown(e, "left")} style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 9, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: "var(--brand)" }} />
          </div>
          <div onPointerDown={e => onDown(e, "right")} style={{ position: "absolute", right: -4, top: 0, bottom: 0, width: 9, cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: "var(--brand)" }} />
          </div>
        </div>
      </div>
      <div className="tiny muted" style={{ marginTop: 5 }}>Arrastra sobre la franja para acotar un rango de días · mueve la ventana o sus extremos para afinar el zoom.</div>
    </div>
  );
}

function CompCell({ v, palette }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  const temp = 50 - v * 27, col = E.tempColor(temp, palette);
  return <span className="num" style={{ fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: mixSoft(col), color: col }}>{E.fmt.signed(v)}</span>;
}

function fmtVal(v, unit) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  if (unit === "USD") return E.fmt.usd(v);
  if (Math.abs(v) >= 1000) return E.fmt.num(v, 0);
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
function fmtAxis(v, unit) {
  if (unit === "USD") return v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0);
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + "k";
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

Object.assign(window, { SectionHistorico, MultiLine, fmtVal, fmtAxis, assetColor, MetricExplorerChart });
