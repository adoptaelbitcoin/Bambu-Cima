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
      return { lab: m.lab, dec: m.dec, a: va, b: vb, d: (va != null && vb != null) ? vb - va : null };
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
function weekNarrative(w, type) {
  const A = w.assets.find(x => x.t === type); if (!A) return "";
  const name = type === "BTC" ? "Bitcoin" : "Ethereum";
  const up = A.chg >= 0;
  const dTemp = A.tempB - A.tempA;
  const sigChange = A.a.lth.signal !== A.b.lth.signal;
  // métrica que más se movió (en valor absoluto normalizado)
  const moved = [...A.metrics].filter(m => m.d != null).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  let s = `${name} ${up ? "subió" : "bajó"} un ${Math.abs(A.chg).toFixed(1)}% en la semana, cerrando en ${E.fmt.usd(A.b.price)}. `;
  s += `La temperatura del modelo ${Math.abs(dTemp) < 1.5 ? "se mantuvo estable" : dTemp > 0 ? "se calentó" : "se enfrió"} de ${A.tempA.toFixed(0)}° a ${A.tempB.toFixed(0)}° (${window.BambuHistory.zoneOf(A.tempB, A.t, "lth").label}). `;
  if (sigChange) s += `La señal de largo plazo cambió de ${A.a.lth.signal} a ${A.b.lth.signal}. `;
  else s += `La señal de largo plazo se mantiene en ${A.b.lth.signal}. `;
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

/* ---------- análogos históricos: busca momentos con MVRV-Z similar y mide el futuro ---------- */
function analogStats(type, key, target, tol, horizons, minGap) {
  const R = window.BambuRealData[type]; if (!R || !R.cols[key]) return { count: 0, eps: [] };
  const col = R.cols[key], px = R.cols.price;
  const eps = []; let lastI = -1e9;
  for (let i = 0; i < R.count; i++) {
    const v = col[i]; if (v == null) continue;
    if (Math.abs(v - target) <= tol && i - lastI >= minGap && px[i] != null && px[i] > 0) {
      const fwd = {}; horizons.forEach(h => { const j = i + h; fwd[h] = (j < R.count && px[j] != null) ? (px[j] / px[i] - 1) * 100 : null; });
      eps.push({ i, iso: R.dates[i], val: v, price: px[i], fwd }); lastI = i;
    }
  }
  const agg = {};
  horizons.forEach(h => {
    const xs = eps.map(e => e.fwd[h]).filter(x => Number.isFinite(x)).sort((a, b) => a - b);
    if (xs.length) agg[h] = { med: xs[Math.floor(xs.length / 2)], min: xs[0], max: xs[xs.length - 1], n: xs.length };
  });
  // análogo más cercano con futuro completo a 90d
  const withFwd = eps.filter(e => Number.isFinite(e.fwd[90])).sort((a, b) => Math.abs(a.val - target) - Math.abs(b.val - target));
  return { count: eps.length, eps, agg, target, tol, closest: withFwd[0] || null };
}
/* reparto de desenlaces a 90 días: alcista / lateral / bajista */
function scenarioDist(a, h, hi, lo) {
  const xs = a.eps.map(e => e.fwd[h]).filter(x => Number.isFinite(x));
  if (!xs.length) return null;
  const bull = xs.filter(x => x > hi).length / xs.length;
  const bear = xs.filter(x => x < lo).length / xs.length;
  return { bull, base: 1 - bull - bear, bear, n: xs.length };
}
function mesAno(iso) { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { month: "short", year: "numeric", timeZone: "UTC" }); }

/* ---------- vista del informe semanal ---------- */
function InformeSemanal({ results, palette }) {
  const R = window.BambuRealData.BTC;
  const latest = R ? R.latestIso : "2026-06-28";
  const mondays = React.useMemo(() => listMondays(latest, 10), [latest]);
  const [mon, setMon] = React.useState(mondays[0]);
  const monUse = mondays.includes(mon) ? mon : mondays[0];
  const w = React.useMemo(() => buildWeek(monUse, latest), [monUse, latest]);

  const X = window.BambuExtras, C = window.BambuCycle;
  const fg = X.fearGreed();
  const now = C.computeNow();
  const tempCol = E.tempColor(w.tempEnd, palette);
  const dTemp = w.tempEnd - w.tempStart;
  const sigs = weekSignals(w);
  const cal = X.calendar().filter(e => e.days >= 0 && e.days <= 35).slice(0, 6);
  const macroCol = now.athPassed ? E.tempColor(72, palette) : E.tempColor(30, palette);

  // análogos históricos (momentos con MVRV-Z similar) y escenarios a 90 días
  const btcA = w.assets.find(x => x.t === "BTC") || w.assets[0];
  const ethA = w.assets.find(x => x.t === "ETH");
  const anBTC = analogStats("BTC", "mvrvZ", btcA.b.v.mvrvZ, 0.5, [30, 90, 180], 21);
  const anETH = ethA ? analogStats("ETH", "mvrvZ", ethA.b.v.mvrvZ, 0.5, [30, 90, 180], 21) : null;
  const g90 = anBTC.agg[90] || { med: 0, min: 0, max: 0, n: 0 };
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
          {mondays.map((m, i) => <option key={m} value={m}>{repFecha(m)} → {repFecha(addDaysIso(m, 6) > latest ? latest : addDaysIso(m, 6))}{i === 0 ? " · actual" : ""}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn primary no-print" onClick={doPrint}>⤓ Exportar informe a PDF</button>
      </div>

      <article id="report-sheet" className="card card-pad" style={{ padding: 28, maxWidth: 1000 }}>
        {/* cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid var(--ink)", paddingBottom: 14, marginBottom: 18 }}>
          <svg width="34" height="34" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="7" fill="#3E7C57" /><path d="M12 8.5v15M20 8.5v15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><path d="M12 13h8M12 18.5h8" stroke="#A6D9B8" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.02em" }}>Informe semanal on-chain</div>
            <div className="tiny muted">Semana del {repFecha(w.monIso)} al {repFecha(w.end)} · Modelo Bambú v2.2</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tiny muted">Régimen</div>
            <div style={{ fontWeight: 700, color: "var(--brand)" }}>{w.regime}</div>
          </div>
        </div>

        {/* cifras de cabecera */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          <RepBox lab="Temperatura mercado" val={w.tempEnd.toFixed(0) + "°"} sub={`${dTemp >= 0 ? "▲" : "▼"} ${Math.abs(dTemp).toFixed(0)}° en la semana`} color={tempCol} />
          <RepBox lab="Fear & Greed" val={fg.value} sub={fg.label} color={E.tempColor(fg.value, palette)} />
          <RepBox lab="Ciclo halving" val={(now.progress * 100).toFixed(0) + "%"} sub={"día " + now.daysSince + " · " + now.daysUntil + "d al próximo"} />
          <RepBox lab="Sizing régimen" val={"×" + DD.REGIMES[w.regime].mult.toFixed(2)} sub={w.regime} />
        </div>

        {/* LO QUE PASÓ */}
        <RepHead n="1" t="Lo que pasó esta semana" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {w.assets.map(A => {
            const col = E.tempColor(A.tempB, palette);
            return (
              <div key={A.t} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${col}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{A.t === "BTC" ? "Bitcoin" : "Ethereum"} <span className="tk">{A.t}</span></span>
                  <span className="num" style={{ fontWeight: 700, color: A.chg >= 0 ? "var(--brand)" : "#A83C26" }}>{A.chg >= 0 ? "▲" : "▼"} {Math.abs(A.chg).toFixed(1)}%</span>
                  <span className="num muted">{E.fmt.usd(A.b.price)}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <span className="num" style={{ fontWeight: 700, color: col }}>{A.tempB.toFixed(0)}°</span>
                  <SignalPill signal={A.b.lth.signal} />
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>{weekNarrative(w, A.t)}</p>
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
        <RepHead n="2" t="Señales del modelo · cierre de semana" />
        <table className="tbl" style={{ marginBottom: 20 }}>
          <thead><tr><th>Activo</th><th className="c">Convicción</th><th className="c">Temp.</th><th className="c">Zona</th><th>Señal</th><th className="r">LONG aj.</th><th className="r">Net</th></tr></thead>
          <tbody>
            {sigs.map((s, i) => {
              const sz = E.sizing(s.signal, w.regime, s.price);
              const col = E.tempColor(s.temp, palette);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{s.key}</td>
                  <td className="c num">{E.fmt.signed(s.composite)}</td>
                  <td className="c num" style={{ color: col, fontWeight: 600 }}>{s.temp.toFixed(0)}°</td>
                  <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col }}>{window.BambuHistory.zoneOf(s.temp, s.type || s.ticker, s.hz || "lth").label}</span></td>
                  <td><SignalPill signal={s.signal} /></td>
                  <td className="r num">{(sz.longAdj * 100).toFixed(2)}%</td>
                  <td className="r num" style={{ fontWeight: 600, color: sz.net >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(sz.net * 100, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* LO QUE VIENE */}
        <RepHead n="3" t="Lo que viene · escenarios" />
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
              const g = a.agg[90], g6 = a.agg[180];
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
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 2px 10px" }}>Escenarios a 90 días · proyección sobre BTC desde {E.fmt.usd(btcPx)}{dist ? ` · base ${dist.n} análogos` : ""}</div>
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
          Las probabilidades son la frecuencia histórica de cada desenlace a 90 días en los análogos por MVRV-Z (alcista &gt; +12%, bajista &lt; −12%, base intermedio), no una predicción. ETH amplifica estos rangos por su mayor beta frente a Bitcoin.
        </div>

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
