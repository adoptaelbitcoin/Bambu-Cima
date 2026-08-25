/* ============================================================
   BAMBÚ · Sección Cartera & Riesgo
   ============================================================ */

/* ---------- modelo de proyección anclado al ciclo · rendimientos decrecientes ----------
   Cada ciclo BTC sube menos: el pico del ciclo se topa en una banda (2.2–3X para BTC,
   amplificada para ETH) medida desde el precio actual. La trayectoria sigue la posición
   real del ciclo (markdown → suelo → markup → techo → distribución). */
function lerpAnchors(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) { const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i]; const t = (x - x0) / ((x1 - x0) || 1); return y0 + (y1 - y0) * t; }
  }
  return anchors[anchors.length - 1][1];
}
function cycleProjection(tk, P0) {
  const C = window.BambuCycle, now = C.computeNow();
  const mFrom = days => days / 30.4;
  const bottomM = Math.max(2.5, Math.min(9, now.daysToProjBottom != null ? mFrom(now.daysToProjBottom) : 4));
  const halvingM = Math.max(bottomM + 3, mFrom(now.daysUntil));
  const athM = Math.min(46, halvingM + mFrom(now.avgBull));
  // banda de pico de ciclo (rendimientos decrecientes)
  const band = tk === "ETH" ? { lo: 2.8, mid: 3.4, hi: 4.0 } : { lo: 2.2, mid: 2.6, hi: 3.0 };
  const peakGain = band.mid - 1;
  // trayectoria normalizada (fracción del pico): negativa en el bear, 1.0 en el techo
  const anchors = [
    [0, 0], [bottomM, -0.18], [bottomM + (halvingM - bottomM) * 0.45, -0.05],
    [halvingM, 0.28], [athM * 0.9, 0.80], [athM, 1.0],
    [Math.min(48, athM + 7), 0.72], [48, 0.60],
  ];
  const at = m => Math.round(lerpAnchors(anchors, m) * peakGain * 1000) / 10; // % desde P0
  const atBand = (m, key) => Math.round(lerpAnchors(anchors, m) * (band[key] - 1) * 1000) / 10;
  const phaseAt = m => {
    if (m < bottomM * 1.15) return "Markdown · bajista";
    if (m < halvingM * 0.7) return "Acumulación";
    if (m < athM * 0.9) return "Markup · alcista";
    if (m <= athM * 1.06) return "Euforia · techo";
    return "Distribución";
  };
  return { at, atBand, phaseAt, band, peakPrice: P0 * band.mid, peakLo: P0 * band.lo, peakHi: P0 * band.hi, athMonth: Math.round(athM), bottomMonth: Math.round(bottomM) };
}

function SectionCartera({ results, regime, palette, portfolio, setPortfolio }) {
  const X = window.BambuExtras;
  const priceOf = tk => { const r = results.find(x => x.asset.ticker === tk); return r ? r.asset.values.price : null; };
  const sigOf = tk => { const r = results.find(x => x.asset.ticker === tk); return r ? r.lth.signal : "NEUTRAL"; };

  const rows = portfolio.map(p => {
    const cur = priceOf(p.ticker) || p.entry;
    const dir = p.side === "long" ? 1 : -1;
    const pnlPct = (cur - p.entry) / p.entry * dir;
    const pnlUsd = p.sizeUsd * pnlPct;
    const value = p.sizeUsd + pnlUsd;
    return { ...p, cur, pnlPct, pnlUsd, value };
  });
  const totalInvested = rows.reduce((s, r) => s + r.sizeUsd, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalPnl = totalValue - totalInvested;
  const longExp = rows.filter(r => r.side === "long").reduce((s, r) => s + r.value, 0);
  const shortExp = rows.filter(r => r.side === "short").reduce((s, r) => s + r.value, 0);
  const netExp = longExp - shortExp;

  const addRow = () => setPortfolio(prev => [...prev, { id: "p" + Date.now(), ticker: results[0].asset.ticker, side: "long", sizeUsd: 1000, entry: priceOf(results[0].asset.ticker) || 1000 }]);
  const upd = (id, field, val) => setPortfolio(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const del = id => setPortfolio(prev => prev.filter(p => p.id !== id));

  // ---- Plan de operación: ¿buen momento? + dirección + horizonte + proyección multi-plazo ----
  const [planTk, setPlanTk] = React.useState(results[0].asset.ticker);
  const [planHz, setPlanHz] = React.useState("LTH");
  const [planDir, setPlanDir] = React.useState("long");
  const [capital, setCapital] = React.useState(10000);
  const [riskPct, setRiskPct] = React.useState(1.5);
  const [stopOver, setStopOver] = React.useState(null); // override manual del stop %
  React.useEffect(() => { setStopOver(null); }, [planTk, planHz, planDir]);
  const isLong = planDir === "long";

  const planRes = results.find(x => x.asset.ticker === planTk) || results[0];
  const planPrice = planRes.asset.values.price;
  const planVals = planRes.asset.values;
  const hz = planHz === "STH" ? planRes.sth : planRes.lth;
  const ref = planHz === "STH" ? planVals.rpSTH : planVals.rpLTH;
  // stop sugerido: para long, soporte debajo; para short, resistencia encima
  const loCap = planHz === "STH" ? 5 : 10, hiCap = planHz === "STH" ? 16 : 32;
  const onRisk = isLong ? (ref && ref < planPrice) : (ref && ref > planPrice);
  const suggStop = Math.round(onRisk ? Math.min(hiCap, Math.max(loCap, Math.abs(planPrice - ref) / planPrice * 100)) : (planHz === "STH" ? 9 : 18));
  const stopPct = stopOver != null ? stopOver : suggStop;
  const stopPrice = isLong ? planPrice * (1 - stopPct / 100) : planPrice * (1 + stopPct / 100);

  // proyección anclada al ciclo · rendimientos decrecientes (pico topado 2.2–3X)
  const MONTHS = [3, 6, 12, 18, 24, 30, 36, 42, 48];
  const cyc = cycleProjection(planTk, planPrice);
  // sizing ajustado por régimen
  const riskUsd = capital * riskPct / 100;
  const regMult = DD.REGIMES[regime].mult;
  const posNotional = stopPct > 0 ? (riskUsd / (stopPct / 100)) * regMult : 0;
  const units = planPrice > 0 ? posNotional / planPrice : 0;
  const proj = MONTHS.map(m => {
    const med = cyc.at(m);                          // movimiento de precio % (escenario base de ciclo)
    const dirPnl = isLong ? med : -med;             // resultado según dirección
    const tgtPx = planPrice * (1 + med / 100);
    const profit = posNotional * (dirPnl / 100);
    const rr = stopPct > 0 ? Math.abs(dirPnl) / stopPct : null;
    return { m, med, dirPnl, tgtPx, profit, rr, phase: cyc.phaseAt(m) };
  });
  const bias12 = cyc.at(12);

  // veredicto ¿buen momento? según dirección
  const momentVerdict = (sig, temp) => {
    if (isLong) {
      if (/COMPRA/.test(sig) || temp < 38) return { t: "Buen momento para abrir LONG", col: E.tempColor(20, palette), tag: "Favorable" };
      if (/VENTA|REDUCIR/.test(sig) || temp > 66) return { t: "Mal momento para LONG", col: E.tempColor(85, palette), tag: "Desfavorable" };
      return { t: "LONG selectivo · espera confirmación", col: E.tempColor(48, palette), tag: "Neutral" };
    }
    if (/VENTA|REDUCIR/.test(sig) || temp > 62) return { t: "Buen momento para abrir SHORT", col: E.tempColor(20, palette), tag: "Favorable" };
    if (/COMPRA/.test(sig) || temp < 40) return { t: "Mal momento para SHORT", col: E.tempColor(85, palette), tag: "Desfavorable" };
    return { t: "SHORT selectivo · espera confirmación", col: E.tempColor(48, palette), tag: "Neutral" };
  };
  const mv = momentVerdict(hz.signal, hz.temp);
  const projOf = (hr, months) => { const md = cyc.at(months); return isLong ? md : -md; };

  // matriz de correlación · ventana seleccionable (>3 meses por defecto)
  const [corrWin, setCorrWin] = React.useState(180);
  const corrM = X.corrMatrices[corrWin] || X.corrMatrix;
  const winLabel = corrWin === 90 ? "3 meses" : corrWin === 180 ? "6 meses" : "12 meses";
  const corrWinSeg = (
    <div className="seg">
      {[[90, "3m"], [180, "6m"], [365, "12m"]].map(([v, l]) => (
        <button key={v} className={corrWin === v ? "on" : ""} onClick={() => setCorrWin(v)}>{l}</button>
      ))}
    </div>
  );
  const btcRow = corrM[0];
  const divs = X.corrAssets.map((a, i) => ({ a, c: btcRow[i], i })).filter(d => d.i !== 0).sort((x, y) => x.c - y.c);
  const divTag = c => c <= -0.2 ? { t: "cobertura inversa", col: "#2E6FAE" } : Math.abs(c) < 0.25 ? { t: "descorrelacionado", col: "#3E7C57" } : c < 0.5 ? { t: "diversifica", col: "#D69A40" } : { t: "se mueve con BTC", col: "#C0492E" };
  const decorrelated = divs.filter(d => Math.abs(d.c) < 0.35);

  return (
    <div className="fade-in">
      <div className="page-head"><h1>Cartera &amp; Riesgo</h1><p>Simula tus posiciones, mide exposición y P&amp;L, y dimensiona el riesgo con la disciplina del modelo.</p></div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <div className="card kpi"><div className="lab">Valor de cartera</div><div className="num val">{E.fmt.usd(totalValue)}</div><div className="meta muted">Invertido {E.fmt.usd(totalInvested)}</div></div>
        <DeltaStat lab="P&L total" val={E.fmt.usd(totalPnl)} delta={totalInvested ? totalPnl / totalInvested : 0} sub="no realizado" />
        <div className="card kpi"><div className="lab">Exposición neta</div><div className="num val" style={{ color: netExp >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.usd(netExp)}</div><div className="meta muted">L {E.fmt.usd(longExp)} · S {E.fmt.usd(shortExp)}</div></div>
        <div className="card kpi"><div className="lab">Régimen activo</div><div className="num val" style={{ fontSize: 20, color: "var(--brand)" }}>{regime}</div><div className="meta"><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>×{DD.REGIMES[regime].mult.toFixed(2)}</span></div></div>
      </div>

      <Card title="Simulador de posiciones" sub="Edita activo, lado, tamaño y precio de entrada · el precio actual viene del modelo" pad={false}
        right={<button className="btn primary" onClick={addRow}>+ Posición</button>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Activo</th><th>Lado</th><th className="r">Tamaño USD</th><th className="r">Entrada</th><th className="r">Actual</th><th className="r">P&L %</th><th className="r">P&L USD</th><th>Señal modelo</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <select className="inp" style={{ width: 90, textAlign: "left", fontFamily: "var(--sans)", padding: "5px 8px" }} value={r.ticker} onChange={e => upd(r.id, "ticker", e.target.value)}>
                      {results.map(x => <option key={x.asset.ticker} value={x.asset.ticker}>{x.asset.ticker}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="seg" style={{ padding: 2 }}>
                      <button className={r.side === "long" ? "on" : ""} style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => upd(r.id, "side", "long")}>Long</button>
                      <button className={r.side === "short" ? "on" : ""} style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => upd(r.id, "side", "short")}>Short</button>
                    </div>
                  </td>
                  <td className="r"><input className="inp" type="number" style={{ width: 96 }} value={r.sizeUsd} onChange={e => upd(r.id, "sizeUsd", +e.target.value)} /></td>
                  <td className="r"><input className="inp" type="number" style={{ width: 96 }} value={r.entry} onChange={e => upd(r.id, "entry", +e.target.value)} /></td>
                  <td className="r num">{E.fmt.usd(r.cur)}</td>
                  <td className="r num" style={{ fontWeight: 600, color: r.pnlPct >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(r.pnlPct * 100)}</td>
                  <td className="r num" style={{ fontWeight: 600, color: r.pnlUsd >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.usd(r.pnlUsd)}</td>
                  <td><SignalPill signal={sigOf(r.ticker)} /></td>
                  <td><button className="btn ghost" style={{ padding: "4px 8px", color: "var(--ink-3)" }} onClick={() => del(r.id)}>✕</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="9" className="muted" style={{ textAlign: "center", padding: 24 }}>Añade tu primera posición para simular.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Plan de operación */}
      <Card title="Plan de operación · ¿buen momento, long o short, y qué esperar a cada plazo?" sub="El modelo recomienda si abrir, distingue dirección (long/short) y horizonte, dimensiona la posición por tu riesgo y proyecta el recorrido de 3 a 48 meses con el modelo de ciclo (pico topado 2.2–3X)" style={{ marginTop: 16 }}>
        {/* selectores */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="seg">{results.map(x => <button key={x.asset.ticker} className={planTk === x.asset.ticker ? "on" : ""} onClick={() => setPlanTk(x.asset.ticker)}>{x.asset.ticker}</button>)}</div>
          <div className="seg">
            <button className={isLong ? "on" : ""} onClick={() => setPlanDir("long")} style={isLong ? { background: mixSoft("#2C9A55", 0.4), color: "#1B6535" } : null}>▲ Long</button>
            <button className={!isLong ? "on" : ""} onClick={() => setPlanDir("short")} style={!isLong ? { background: mixSoft("#C0492E", 0.4), color: "#8E2A1A" } : null}>▼ Short</button>
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="tiny muted">Stop según:</span>
          <div className="seg">
            <button className={planHz === "STH" ? "on" : ""} onClick={() => setPlanHz("STH")}>Corto · STH</button>
            <button className={planHz === "LTH" ? "on" : ""} onClick={() => setPlanHz("LTH")}>Largo · LTH</button>
          </div>
        </div>

        {/* veredicto + comparación STH/LTH */}
        <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 16, alignItems: "stretch" }}>
          <div style={{ border: `1px solid ${mixSoft(mv.col, 0.5)}`, background: mixSoft(mv.col, 0.85), borderRadius: 10, padding: "14px 16px" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>¿Buen momento? · {planTk} {planHz} · {isLong ? "LONG" : "SHORT"}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: mv.col, lineHeight: 1.15, marginTop: 5 }}>{mv.t}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              <span className="tiny"><span className="muted">Señal</span> <SignalPill signal={hz.signal} /></span>
              <span className="tiny"><span className="muted">Temp.</span> <strong className="num" style={{ color: mv.col }}>{hz.temp.toFixed(0)}°</strong></span>
              <span className="tiny"><span className="muted">Zona</span> <strong>{window.BambuHistory.zoneOf(hz.temp, planRes.asset.type, planHz === "STH" ? "sth" : "lth").label}</strong></span>
              <span className="tiny"><span className="muted">Régimen</span> <strong>×{regMult.toFixed(2)}</strong></span>
            </div>
          </div>
          {/* diferencia de proyección STH vs LTH (resultado según dirección) */}
          <div style={{ display: "flex", gap: 10 }}>
            {[["STH", planRes.sth, 3, "3 meses"], ["LTH", planRes.lth, 12, "12 meses"]].map(([lab, hr, win, plazo]) => {
              const m = projOf(hr, win); const on = planHz === lab;
              const c = E.tempColor(hr.temp, palette);
              return (
                <div key={lab} style={{ flex: 1, border: on ? `2px solid ${c}` : "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", background: on ? mixSoft(c, 0.88) : "var(--surface)" }}>
                  <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>{lab}</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 700, color: c, marginTop: 3 }}>{hr.temp.toFixed(0)}°</div>
                  <div className="tiny" style={{ marginTop: 4 }}>{isLong ? "Long" : "Short"} a {plazo}: <strong className="num" style={{ color: m >= 0 ? "var(--brand)" : "#A83C26" }}>{m >= 0 ? "+" : ""}{m.toFixed(0)}%</strong></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* inputs + niveles base */}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1.25fr", gap: 16, alignItems: "start", marginBottom: 16 }}>
          <div>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Tu riesgo</div>
            {[["Capital total (USD)", capital, v => setCapital(v), 100], ["Riesgo por operación (%)", riskPct, v => setRiskPct(v), 0.1], [`Stop-loss (% ${isLong ? "bajo" : "sobre"} entrada)`, stopPct, v => setStopOver(v), 0.5]].map(([lab, val, set, step], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{lab}{i === 2 && <span className="tiny muted"> · sugerido {suggStop}%</span>}</span>
                <input className="inp" type="number" step={step} style={{ width: 110 }} value={val} onChange={e => set(+e.target.value)} />
              </div>
            ))}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <PlanStat lab="Tamaño posición" val={E.fmt.usd(posNotional)} sub={units.toFixed(4) + " " + planTk} />
              <PlanStat lab="Riesgo máx." val={E.fmt.usd(riskUsd)} sub={(isLong ? "−" : "+") + stopPct + "% → stop"} col="#A83C26" />
            </div>
          </div>

          <div>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Niveles de la operación</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <PlanRow lab="Entrada (precio actual)" px={planPrice} pct={0} usd={0} col="var(--ink)" entry />
              <PlanRow lab={`Stop-loss · ${isLong ? "soporte" : "resistencia"}`} px={stopPrice} pct={isLong ? -stopPct : stopPct} usd={-riskUsd} col="#A83C26" />
            </div>
            <div style={{ background: mixSoft(isLong ? "#2C9A55" : "#C0492E", 0.86), borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
              <div className="tiny" style={{ fontWeight: 700, color: isLong ? "#1B6535" : "#8E2A1A", marginBottom: 3 }}>{isLong ? "▲ Posición LONG · qué esperar" : "▼ Posición SHORT · qué esperar"}</div>
              <div className="tiny" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
                {isLong
                  ? <>Ganas si el precio <strong>sube</strong> y pierdes (hasta el stop) si cae. La historia proyecta un sesgo <strong style={{ color: bias12 >= 0 ? "var(--brand)" : "#A83C26" }}>{bias12 >= 0 ? "alcista" : "bajista"}</strong> a 12 meses para {planTk}: a favor de un long.</>
                  : <>Ganas si el precio <strong>baja</strong> y pierdes (hasta el stop) si sube. La proyección histórica a 12 meses es <strong style={{ color: bias12 >= 0 ? "#A83C26" : "var(--brand)" }}>{bias12 >= 0 ? "alcista (en contra del short)" : "bajista (a favor del short)"}</strong>. Operar short contra la tendencia de ciclo exige plazos cortos y stops estrictos.</>}
              </div>
            </div>
          </div>
        </div>

        {/* proyección multi-plazo: objetivos de 3 a 48 meses */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "2px 2px 8px", flexWrap: "wrap" }}>
          <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>Objetivos por plazo · resultado esperado de tu {isLong ? "LONG" : "SHORT"} (modelo de ciclo)</span>
          <span className="tiny muted">Pico de ciclo estimado (~mes {cyc.athMonth}): <strong className="num" style={{ color: "var(--ink)" }}>{E.fmt.usd(cyc.peakLo)}–{E.fmt.usd(cyc.peakHi)}</strong> · {cyc.band.lo}–{cyc.band.hi}X</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Plazo</th><th className="r">Precio proyectado</th><th className="r">Mov. precio</th><th className="r">Tu resultado</th><th className="r">Ganancia USD</th><th className="r">R:R</th><th>Fase del ciclo</th></tr></thead>
            <tbody>
              {proj.map(p => (
                <tr key={p.m} className={(planHz === "STH" && p.m === 3) || (planHz === "LTH" && p.m === 12) ? "today" : ""}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{p.m} meses</td>
                  <td className="r num">{p.tgtPx != null ? E.fmt.usd(p.tgtPx) : "—"}</td>
                  <td className="r num" style={{ color: p.med == null ? "var(--ink-3)" : p.med >= 0 ? "var(--brand)" : "#A83C26" }}>{p.med == null ? "—" : (p.med >= 0 ? "+" : "") + p.med.toFixed(0) + "%"}</td>
                  <td className="r num" style={{ fontWeight: 700, color: p.dirPnl == null ? "var(--ink-3)" : p.dirPnl >= 0 ? "var(--brand)" : "#A83C26" }}>{p.dirPnl == null ? "—" : (p.dirPnl >= 0 ? "+" : "") + p.dirPnl.toFixed(0) + "%"}</td>
                  <td className="r num" style={{ fontWeight: 600, color: p.profit == null ? "var(--ink-3)" : p.profit >= 0 ? "var(--brand)" : "#A83C26" }}>{p.profit == null ? "—" : (p.profit >= 0 ? "+" : "") + E.fmt.usd(p.profit)}</td>
                  <td className="r num" style={{ color: p.rr == null ? "var(--ink-3)" : p.rr >= 2 ? "var(--brand)" : p.rr >= 1 ? "var(--ink)" : "#A83C26" }}>{p.rr == null ? "—" : p.rr.toFixed(1) + ":1"}</td>
                  <td className="tiny muted" style={{ whiteSpace: "nowrap" }}>{p.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
          El pico del ciclo se topa en <strong>{cyc.band.lo}X–{cyc.band.hi}X</strong> desde el precio actual (rendimientos decrecientes: cada ciclo BTC sube menos). La trayectoria sigue la posición real del ciclo — primero el suelo del bear (~mes {cyc.bottomMonth}), luego el markup hacia el techo (~mes {cyc.athMonth}) y la posterior distribución. En <strong>long</strong> ganas con la subida, en <strong>short</strong> con la caída. Es un escenario base de ciclo, no una garantía — define el plan antes de entrar.
        </div>
      </Card>

      {/* diversificadores frente a BTC */}
      <Card title="Diversificadores frente a BTC" sub={`Activos ordenados por menor correlación con BTC · ventana ${winLabel}`} right={corrWinSeg} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {divs.map(d => {
            const tag = divTag(d.c);
            const w = Math.abs(d.c) * 100;
            return (
              <div key={d.a} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 86, fontSize: 12.5, fontWeight: 600 }}>{d.a}</span>
                <div style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-2)" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: d.c >= 0 ? "50%" : (50 - w / 2) + "%", width: (w / 2) + "%", background: tag.col, borderRadius: 5 }} />
                </div>
                <span className="num tiny" style={{ width: 42, textAlign: "right", fontWeight: 600, color: tag.col }}>{d.c.toFixed(2)}</span>
                <span className="badge" style={{ width: 118, textAlign: "center", background: mixSoft(tag.col), color: tag.col, fontSize: 10.5 }}>{tag.t}</span>
              </div>
            );
          })}
        </div>
        <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {decorrelated.length} de {divs.length} activos están <strong>descorrelacionados</strong> de BTC (|ρ| &lt; 0.35) en {winLabel}: {decorrelated.slice(0, 5).map(d => d.a).join(", ") || "ninguno"}. Fuera del cripto, las <strong>acciones defensivas</strong> (Utilities, Consumo básico, Salud), el <strong>oro</strong> y sus <strong>mineras</strong>, los <strong>bonos a 10 años</strong> y el <strong>VIX</strong> ofrecen baja o nula correlación. Ojo con los proxies como <strong>MicroStrategy</strong> o <strong>Coinbase</strong>: se mueven igual que BTC y <strong>no diversifican</strong>.
        </div>
      </Card>

      {/* matriz completa */}
      <Card title="Matriz de correlación" sub={`Diversificación real entre ${X.corrAssets.length} activos · ventana ${winLabel} · rojo = se mueven juntos, azul = opuestos`} right={corrWinSeg} style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <CorrMatrix assets={X.corrAssets} matrix={corrM} />
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          <span className="li"><span className="sw" style={{ background: "#2E6FAE" }} />−1 opuestos</span>
          <span className="li"><span className="sw" style={{ background: "#EEF0EC" }} />0 sin relación</span>
          <span className="li"><span className="sw" style={{ background: "#C0492E" }} />+1 juntos</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>BTC y ETH están muy correlacionados ({corrM[0][1].toFixed(2)}): no diversifican entre sí, y proxies como MicroStrategy o Coinbase tampoco. Para diversificar de verdad hay que salir del cripto: <strong>acciones defensivas</strong> (Utilities, Consumo básico, Salud), <strong>oro</strong>, <strong>bonos</strong>, <strong>dólar (DXY)</strong> y <strong>VIX</strong> mantienen baja o negativa su correlación incluso en ventanas de {winLabel}.</div>
      </Card>
    </div>
  );
}

/* ---------- bloque reutilizable: diversificadores + matriz de correlación ---------- */
function CorrBlock() {
  const X = window.BambuExtras;
  const [corrWin, setCorrWin] = React.useState(180);
  const corrM = X.corrMatrices[corrWin] || X.corrMatrix;
  const winLabel = corrWin === 90 ? "3 meses" : corrWin === 180 ? "6 meses" : "12 meses";
  const corrWinSeg = (
    <div className="seg">
      {[[90, "3m"], [180, "6m"], [365, "12m"]].map(([v, l]) => (
        <button key={v} className={corrWin === v ? "on" : ""} onClick={() => setCorrWin(v)}>{l}</button>
      ))}
    </div>
  );
  const btcRow = corrM[0];
  const divs = X.corrAssets.map((a, i) => ({ a, c: btcRow[i], i })).filter(d => d.i !== 0).sort((x, y) => x.c - y.c);
  const divTag = c => c <= -0.2 ? { t: "cobertura inversa", col: "#2E6FAE" } : Math.abs(c) < 0.25 ? { t: "descorrelacionado", col: "#3E7C57" } : c < 0.5 ? { t: "diversifica", col: "#D69A40" } : { t: "se mueve con BTC", col: "#C0492E" };
  const decorrelated = divs.filter(d => Math.abs(d.c) < 0.35);
  return (
    <div>
      {/* diversificadores frente a BTC */}
      <Card title="Diversificadores frente a BTC" sub={`Activos ordenados por menor correlación con BTC · ventana ${winLabel}`} right={corrWinSeg} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {divs.map(d => {
            const tag = divTag(d.c);
            const w = Math.abs(d.c) * 100;
            return (
              <div key={d.a} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 86, fontSize: 12.5, fontWeight: 600 }}>{d.a}</span>
                <div style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-2)" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: d.c >= 0 ? "50%" : (50 - w / 2) + "%", width: (w / 2) + "%", background: tag.col, borderRadius: 5 }} />
                </div>
                <span className="num tiny" style={{ width: 42, textAlign: "right", fontWeight: 600, color: tag.col }}>{d.c.toFixed(2)}</span>
                <span className="badge" style={{ width: 118, textAlign: "center", background: mixSoft(tag.col), color: tag.col, fontSize: 10.5 }}>{tag.t}</span>
              </div>
            );
          })}
        </div>
        <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {decorrelated.length} de {divs.length} activos están <strong>descorrelacionados</strong> de BTC (|ρ| &lt; 0.35) en {winLabel}: {decorrelated.slice(0, 5).map(d => d.a).join(", ") || "ninguno"}. Fuera del cripto, las <strong>acciones defensivas</strong> (Utilities, Consumo básico, Salud), el <strong>oro</strong> y sus <strong>mineras</strong>, los <strong>bonos a 10 años</strong> y el <strong>VIX</strong> ofrecen baja o nula correlación. Ojo con los proxies como <strong>MicroStrategy</strong> o <strong>Coinbase</strong>: se mueven igual que BTC y <strong>no diversifican</strong>.
        </div>
      </Card>

      {/* matriz completa */}
      <Card title="Matriz de correlación" sub={`Diversificación real entre ${X.corrAssets.length} activos · ventana ${winLabel} · rojo = se mueven juntos, azul = opuestos`} right={corrWinSeg} style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <CorrMatrix assets={X.corrAssets} matrix={corrM} />
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          <span className="li"><span className="sw" style={{ background: "#2E6FAE" }} />−1 opuestos</span>
          <span className="li"><span className="sw" style={{ background: "#EEF0EC" }} />0 sin relación</span>
          <span className="li"><span className="sw" style={{ background: "#C0492E" }} />+1 juntos</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>BTC y ETH están muy correlacionados ({corrM[0][1].toFixed(2)}): no diversifican entre sí, y proxies como MicroStrategy o Coinbase tampoco. Para diversificar de verdad hay que salir del cripto: <strong>acciones defensivas</strong> (Utilities, Consumo básico, Salud), <strong>oro</strong>, <strong>bonos</strong>, <strong>dólar (DXY)</strong> y <strong>VIX</strong> mantienen baja o negativa su correlación incluso en ventanas de {winLabel}.</div>
      </Card>
    </div>
  );
}

function PlanRow({ lab, px, pct, usd, col, big, entry }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: big ? "9px 12px" : "7px 12px", borderRadius: 8, background: big ? mixSoft(col, 0.86) : "var(--surface-3)", border: entry ? "1px dashed var(--border-2)" : "1px solid transparent" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: col, flex: "none" }} />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{lab}</span>
      <span className="num" style={{ fontWeight: 700, fontSize: big ? 15 : 13 }}>{E.fmt.usd(px)}</span>
      {!entry && <span className="num tiny" style={{ width: 52, textAlign: "right", fontWeight: 600, color: col }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>}
      {!entry && <span className="num tiny" style={{ width: 84, textAlign: "right", fontWeight: 600, color: usd >= 0 ? "var(--brand)" : "#A83C26" }}>{usd >= 0 ? "+" : ""}{E.fmt.usd(usd)}</span>}
      {entry && <span className="tiny muted" style={{ width: 136, textAlign: "right" }}>precio actual</span>}
    </div>
  );
}
function PlanStat({ lab, val, sub, col }) {
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 9, padding: "10px 12px" }}>
      <div className="tiny muted">{lab}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: col || "var(--ink)", lineHeight: 1.1, marginTop: 2 }}>{val}</div>
      <div className="tiny muted" style={{ marginTop: 2 }}>{sub}</div>
    </div>
  );
}
Object.assign(window, { SectionCartera, CorrBlock });
