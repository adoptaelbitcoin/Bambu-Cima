/* ============================================================
   BAMBÚ · Secciones — Resumen e Ingreso de Datos
   ============================================================ */

/* ---------- helpers compartidos ---------- */
function flatSignals(results) {
  const out = [];
  results.forEach(r => {
    out.push({ key: r.asset.ticker + "·STH", ticker: r.asset.ticker, horizon: "STH", ...r.sth });
    out.push({ key: r.asset.ticker + "·LTH", ticker: r.asset.ticker, horizon: "LTH", ...r.lth });
  });
  return out;
}
function marketTemp(results) {
  const s = flatSignals(results);
  return s.reduce((a, x) => a + x.temp, 0) / s.length;
}

/* ============================================================
   RESUMEN EJECUTIVO
   ============================================================ */
const KPI = ({ lab, val, meta, valStyle, mono }) => (
  <div className="card kpi">
    <div className="lab">{lab}</div>
    <div className={"val" + (mono ? " mono" : "")} style={valStyle}>{val}</div>
    {meta && <div className="meta">{meta}</div>}
  </div>
);

/* ---------- Veredicto dominante: la decisión de un vistazo ---------- */
function marketVerdict(results, regime) {
  const mt = marketTemp(results);
  const reg = DD.REGIMES[regime];
  const zone = E.zoneFor(mt);
  const comp = (50 - mt) / 27;
  const sig = E.signalFor(comp);
  const sg = DD.SIGNALS[sig];
  const capPct = DD.BASE_WEIGHT * sg.long * reg.mult * 100;
  let stance, action;
  if (mt < 20) { stance = "ACUMULAR"; action = "Comprar con convicción"; }
  else if (mt < 40) { stance = "ACUMULACIÓN SELECTIVA"; action = "Comprar en tramos"; }
  else if (mt < 60) { stance = "NEUTRAL · SELECTIVO"; action = "Mantener · esperar confirmación"; }
  else if (mt < 80) { stance = "DISTRIBUIR GRADUAL"; action = "Reducir / cubrir posición"; }
  else { stance = "DISTRIBUIR · FUERA"; action = "Vender / postura defensiva"; }
  return { mt, zone, sig, capPct, stance, action, reg };
}

function VerdictBanner({ results, regime, palette, title }) {
  const v = marketVerdict(results, regime);
  const col = E.tempColor(v.mt, palette);
  const grad = "linear-gradient(90deg," + (DD.PALETTES[palette] || DD.PALETTES.sobria).stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
  const sthT = results.reduce((a, r) => a + r.sth.temp, 0) / results.length;
  const lthT = results.reduce((a, r) => a + r.lth.temp, 0) / results.length;
  const align = Math.abs(sthT - lthT) < 15;
  const mPct = Math.round(v.reg.mult * 100);
  const regPhrase = v.reg.mult < 1
    ? `Fase ${regime}: por prudencia, invierte solo el ${mPct}% de tu tamaño habitual en cada compra — la fase puede extenderse y conviene guardar munición.`
    : v.reg.mult > 1
      ? `Fase ${regime}: históricamente favorable — puedes invertir hasta el ${mPct}% de tu tamaño habitual en cada compra.`
      : `Fase ${regime}: sin sesgo claro — mantén tu tamaño habitual de compra (100%).`;
  const reasons = [
    regPhrase,
    `Temperatura de mercado ${v.mt.toFixed(0)}° → zona ${v.zone.label} (${v.zone.phase}).`,
    align ? `Corto y largo plazo alineados (${sthT.toFixed(0)}° / ${lthT.toFixed(0)}°): señal más fiable.`
          : `Divergencia corto vs largo plazo (${sthT.toFixed(0)}° / ${lthT.toFixed(0)}°): actuar con cautela.`,
  ];
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `6px solid ${col}`, overflow: "hidden", padding: 0 }}>
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr 1.2fr", gap: 0 }}>
        <div style={{ padding: "18px 22px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".14em" }}>{title || "Veredicto del mercado"}</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", color: col, lineHeight: 1.05, marginTop: 6 }}>{v.stance}</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: "var(--ink)" }}>{v.action}</div>
          <div style={{ marginTop: 12, height: 8, borderRadius: 5, background: grad, position: "relative" }}>
            <div style={{ position: "absolute", left: v.mt + "%", top: -3, width: 4, height: 14, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 2px #fff" }} />
          </div>
        </div>
        <div style={{ padding: "18px 22px", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>Exposición sugerida <HelpDot k="posicionamiento" /></div>
          <div className="num" style={{ fontSize: 27, fontWeight: 700, color: col, lineHeight: 1.1, marginTop: 3 }}>{v.capPct.toFixed(1)}%</div>
          <div className="tiny muted">LONG del portafolio</div>
          <div style={{ marginTop: 6 }}><SignalPill signal={v.sig} /></div>
        </div>
        <div style={{ padding: "16px 22px", borderLeft: "1px solid var(--border)" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>Por qué</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {reasons.map((r, i) => <li key={i} style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--ink-2)", display: "flex", gap: 6 }}><span style={{ color: col, fontWeight: 700 }}>›</span>{r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SectionResumen({ results, regime, palette }) {
  const [tab, setTab] = React.useState(results[0].asset.id);
  const valid = results.some(r => r.asset.id === tab);
  const active = valid ? tab : results[0].asset.id;

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Resumen ejecutivo</h1>
        <p>Lectura consolidada del modelo v2.2. La <strong>temperatura</strong> traduce cada <strong>Índice de Convicción</strong> a una zona: frío = acumulación, caliente = distribución.</p>
      </div>

      {/* pestañas por moneda */}
      <div className="tabs" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {results.map(r => (
          <button key={r.asset.id} className={"tab" + (active === r.asset.id ? " active" : "")} onClick={() => setTab(r.asset.id)}>
            {r.asset.name} <span className="tk">{r.asset.ticker}</span>
          </button>
        ))}
      </div>

      <ResumenAsset result={results.find(r => r.asset.id === active)} regime={regime} palette={palette} />
    </div>
  );
}

/* ---------- vista consolidada ---------- */
function ResumenConsolidado({ results, regime, palette }) {
  const sigs = flatSignals(results);
  const mt = marketTemp(results);
  const mz = E.zoneFor(mt);
  const reg = DD.REGIMES[regime];
  const ST = DD.STATS;
  const btc = results.find(r => r.asset.type === "BTC") || results[0];
  const eth = results.find(r => r.asset.type === "ETH");
  const mtCol = E.tempColor(mt, palette);

  // estados consolidados STH y LTH (media de temperaturas por horizonte)
  const sthTemps = results.map(r => r.sth.temp), lthTemps = results.map(r => r.lth.temp);
  const sthT = sthTemps.reduce((a, b) => a + b, 0) / sthTemps.length;
  const lthT = lthTemps.reduce((a, b) => a + b, 0) / lthTemps.length;
  const sthZ = E.zoneFor(sthT), lthZ = E.zoneFor(lthT);

  // gradiente de la paleta para las barras de estado
  const palStops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const palGrad = "linear-gradient(90deg," + palStops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";

  return (
    <div className="fade-in">
      <VerdictBanner results={results} regime={regime} palette={palette} />
      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <KPI lab={<>Régimen de mercado</>} val={regime} valStyle={{ fontSize: 22, color: "var(--brand)" }}
             meta={<><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>{sizeTxt(reg.mult)}</span><HelpDot k="regimen" /></>} />
        <PriceKPI lab="Precio BTC" r={btc} palette={palette} />
        {eth && <PriceKPI lab="Precio ETH" r={eth} palette={palette} />}
        <KPI lab="Temperatura de mercado" mono val={mt.toFixed(0) + "°"} valStyle={{ color: mtCol }}
             meta={<span className="badge" style={{ background: mixSoft(mtCol), color: mtCol }}>{mz.label} · {mz.phase}</span>} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Cuatro señales */}
        <Card title="Señales del mercado" sub="La barra muestra el estado: azul/frío = zona de compra · rojo/caliente = zona de venta">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {sigs.slice(0, 4).map((s, i) => {
              const col = E.tempColor(s.temp, palette);
              return (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "13px 15px", borderLeft: `4px solid ${col}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.key}</span>
                    <SignalPill signal={s.signal} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
                    <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>{E.fmt.signed(s.composite)}</span>
                    <span className="muted tiny">convicción</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <span className="num" style={{ fontSize: 16, fontWeight: 600, color: col }}>{s.temp.toFixed(0)}°</span>
                  </div>
                  {/* barra de estado coloreada (frío→caliente) con marcador */}
                  <div style={{ marginTop: 9, height: 9, borderRadius: 5, background: palGrad, position: "relative" }}>
                    <div style={{ position: "absolute", left: s.temp + "%", top: -2.5, width: 4, height: 14, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 2px #fff" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span className="tiny" style={{ color: E.tempColor(8, palette), fontWeight: 600 }}>compra</span>
                    <span className="tiny" style={{ color: E.tempColor(92, palette), fontWeight: 600 }}>venta</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Estadísticas del modelo */}
        <Card title="Estadísticas del modelo" sub="Estados STH y LTH + desempeño del backtest"
              right={<HelpDot k="estadosSTHLTH" />}>
          {/* los 2 estados que se miden */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <StateChip lab="Estado STH · corto" temp={sthT} zone={sthZ} palette={palette} />
            <StateChip lab="Estado LTH · largo" temp={lthT} zone={lthZ} palette={palette} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <StatBox lab="Hit-rate global" val={(ST.hitRate * 100).toFixed(1) + "%"} sub={`${ST.totalHits}/${ST.totalSignals} señales`} good />
            <StatBox lab="Profit factor" val={ST.profitFactor.toFixed(1)} sub="Modelo sólido (≥2)" good />
            <StatBox lab="Max drawdown" val={(ST.maxDrawdown * 100).toFixed(0) + "%"} sub="Peor caída del equity" />
            <StatBox lab="Equity simulado" val={E.fmt.num(ST.equityFinal, 0)} sub="Base 100 · 14 ventanas" good />
          </div>
        </Card>
      </div>

      {/* Posicionamiento + barra de mercado */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 16 }}>
        <Card title="Termómetro del mercado" sub="Posición de cada señal en el espectro acumulación → distribución">
          <div style={{ padding: "30px 8px 6px" }}>
            <GradientBar palette={palette} markers={dedupeMarkers(sigs.slice(0, 4).map(s => ({ temp: s.temp, label: s.key })))} />
          </div>
        </Card>

        <Card title="Posicionamiento recomendado" sub="Rango LONG sugerido por señal · ajustado por régimen" right={<HelpDot k="posicionamiento" />}>
          <table className="tbl">
            <thead><tr><th>Señal</th><th className="c">Rango sugerido</th><th className="r">NET</th></tr></thead>
            <tbody>
              {sigs.slice(0, 4).map((s, i) => {
                const sz = E.sizing(s.signal, regime, results.find(r => r.asset.ticker === s.ticker).vals.price);
                const lo = sz.longAdj * 0.85 * 100, hi = sz.longAdj * 1.15 * 100;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.key}</td>
                    <td className="c num">{lo.toFixed(2)}–{hi.toFixed(2)}%</td>
                    <td className="r num" style={{ fontWeight: 600, color: sz.net >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(sz.net * 100, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="tiny muted" style={{ margin: "12px 2px 0", lineHeight: 1.5 }}>
            El rango sugerido es la horquilla de exposición LONG recomendada por señal, ya ajustada por el régimen actual (×{reg.mult.toFixed(2)}). Entra de forma escalonada: cerca del mínimo si priorizas prudencia, del máximo si tu convicción es alta.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* texto humano para el multiplicador de régimen */
function sizeTxt(mult) {
  const p = Math.round(mult * 100);
  return mult < 1 ? `Compra al ${p}% de lo habitual` : mult > 1 ? `Compra hasta el ${p}% de lo habitual` : "Compra tu tamaño habitual";
}

/* KPI de precio con Realized LTH y distancia */
function PriceKPI({ lab, r, palette }) {
  const price = r.vals.price, rpLTH = r.vals.rpLTH, rpSTH = r.vals.rpSTH;
  const dist = (rpLTH && price) ? (price / rpLTH - 1) * 100 : null;
  const distCol = dist == null ? "var(--ink-3)" : dist > 0 ? E.tempColor(Math.min(92, 50 + dist * 0.9), palette) : E.tempColor(Math.max(8, 50 + dist * 0.9), palette);
  return (
    <div className="card kpi">
      <div className="lab">{lab}</div>
      <div className="val mono">{E.fmt.usd(price)}</div>
      <div className="meta" style={{ flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
        <span className="muted tiny">Realized LTH {rpLTH ? E.fmt.usd(rpLTH) : "—"} · STH {rpSTH ? E.fmt.usd(rpSTH) : "—"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="num tiny" style={{ fontWeight: 700, color: distCol }}>{dist == null ? "—" : (dist > 0 ? "+" : "") + dist.toFixed(1) + "% vs LTH"}</span>
          <span className="tiny muted">{dist == null ? "" : dist > 0 ? "(prima · sobre coste)" : "(descuento · bajo coste)"}</span>
          <HelpDot k="realizadoLTH" />
        </span>
      </div>
    </div>
  );
}

/* chip de estado STH/LTH */
function StateChip({ lab, temp, zone, palette }) {
  const col = E.tempColor(temp, palette);
  const palStops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const grad = "linear-gradient(90deg," + palStops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 10, padding: "11px 13px" }}>
      <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{lab}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "4px 0 8px" }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 700, color: col }}>{temp.toFixed(0)}°</span>
        <span className="badge" style={{ background: mixSoft(col), color: col }}>{zone.label}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: grad, position: "relative" }}>
        <div style={{ position: "absolute", left: temp + "%", top: -2, width: 3, height: 11, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 1.5px #fff" }} />
      </div>
    </div>
  );
}

/* ---------- vista por moneda (pestaña) ---------- */
function ResumenAsset({ result, regime, palette }) {
  const a = result.asset;
  const reg = DD.REGIMES[regime];
  const H = window.BambuHistory;
  const hist = H && H.raw[a.type] ? H.dailyComposites(a.type, 27) : null;
  const sthCol = E.tempColor(result.sth.temp, palette);
  const lthCol = E.tempColor(result.lth.temp, palette);

  const HCard = ({ hr, label }) => {
    const col = E.tempColor(hr.temp, palette);
    return (
      <Card title={`${a.ticker} · ${label}`} right={<SignalPill signal={hr.signal} />}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div>
            <div className="num" style={{ fontSize: 40, fontWeight: 600, color: col, lineHeight: 1 }}>{hr.temp.toFixed(0)}°</div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: col, marginTop: 6 }}>{hr.zone.label} · {hr.zone.phase}</div>
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{E.fmt.signed(hr.composite)}</div>
            <div className="tiny muted">convicción <HelpDot k="conviccion" /></div>
          </div>
        </div>
        <div style={{ marginTop: 14, height: 8, borderRadius: 5, background: "var(--surface-3)", position: "relative" }}>
          <div style={{ position: "absolute", left: hr.temp + "%", top: -3, width: 4, height: 14, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)" }} />
        </div>
        <div className="divider" style={{ margin: "14px 0 10px" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {hr.groups.map(g => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 7, background: "var(--surface-3)" }}>
              <span className="tiny" style={{ fontWeight: 600 }}>{g.name}</span>
              <span className="tiny muted">{(g.weight * 100).toFixed(0)}%</span>
              <ScoreChip score={g.sectionScore} palette={palette} />
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="fade-in">
      <VerdictBanner results={[result]} regime={regime} palette={palette} title={`Veredicto · ${a.ticker}`} />
      {/* KPIs del activo */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <PriceKPI lab={`Precio ${a.ticker}`} r={{ vals: a.values }} palette={palette} />
        <KPI lab="Régimen" val={regime} valStyle={{ fontSize: 20, color: "var(--brand)" }} meta={<><span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>{sizeTxt(reg.mult)}</span><HelpDot k="regimen" /></>} />
        <KPI lab="Temperatura STH" mono val={result.sth.temp.toFixed(0) + "°"} valStyle={{ color: sthCol }} meta={<span className="badge" style={{ background: mixSoft(sthCol), color: sthCol }}>{result.sth.zone.label}</span>} />
        <KPI lab="Temperatura LTH" mono val={result.lth.temp.toFixed(0) + "°"} valStyle={{ color: lthCol }} meta={<span className="badge" style={{ background: mixSoft(lthCol), color: lthCol }}>{result.lth.zone.label}</span>} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <HCard hr={result.sth} label="Corto plazo · STH" />
        <HCard hr={result.lth} label="Largo plazo · LTH" />
      </div>

      {/* decisión global: Índice Bambú + matrices diagnóstico/decisión */}
      <div style={{ marginTop: 16 }}>
        {window.DiagMatrices
          ? <window.DiagMatrices type={a.type} last={a.values} palette={palette} />
          : null}
      </div>

      <div style={{ marginTop: 16 }}>
        {/* histórico del composite con rango + precio — ancho completo */}
        <ConvHist a={a} palette={palette} />
      </div>

      <div style={{ marginTop: 16 }}>
        {/* posicionamiento en lenguaje de inversor */}
        <Card title={<>¿Cómo posicionarte hoy? <HelpDot k="posNet" /></>} sub={`Por cada $100 de tu portafolio total, cuánto conviene tener en ${a.ticker} según cada horizonte · fase ${regime}`}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Tu próxima compra · corto plazo (STH)", result.sth, "posLong"], ["Tu patrimonio · ciclo (LTH)", result.lth, "posHedge"]].map(([lab, hr]) => {
              const sz = E.sizing(hr.signal, regime, a.values.price);
              const inv = Math.max(0, sz.longAdj * 100), resv = Math.max(0, sz.hedge * 100);
              const net = sz.net * 100;
              const wait = Math.max(0, 100 - inv - resv);
              return (
                <div key={lab} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "15px 17px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{lab}</span>
                    <SignalPill signal={hr.signal} />
                  </div>
                  <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
                    <div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>${inv.toFixed(0)}</div><div className="tiny muted">en {a.ticker}</div></div>
                    {resv >= 0.5 && <div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: "#A83C26" }}>${resv.toFixed(0)}</div><div className="tiny muted">cobertura <HelpDot k="posHedge" /></div></div>}
                    <div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-3)" }}>${wait.toFixed(0)}</div><div className="tiny muted">en espera (USD, resto)</div></div>
                    <div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: net >= 0 ? "var(--brand)" : "#A83C26" }}>${net.toFixed(0)}</div><div className="tiny muted">posición neta <HelpDot k="posNet" /></div></div>
                  </div>
                  {/* barra visual: invertido / cobertura / en espera */}
                  <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginTop: 12, background: "var(--surface-3)" }}>
                    <div style={{ width: Math.min(100, inv) + "%", background: "var(--brand)" }}></div>
                    {resv >= 0.5 && <div style={{ width: Math.min(100, resv) + "%", background: "#A83C26" }}></div>}
                  </div>
                  <div className="tiny muted" style={{ marginTop: 5 }}>█ verde = en {a.ticker} · gris = en espera (USD){resv >= 0.5 ? " · rojo = cobertura" : ""}</div>
                  <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
                    {hr.signal.indexOf("COMPRA") >= 0
                      ? `Señal de compra: de cada $100 de tu portafolio total, unos $${inv.toFixed(0)} en ${a.ticker}; el resto espera en USD para comprar en tramos si sigue barato.`
                      : hr.signal.indexOf("VENTA") >= 0
                        ? `Señal de venta: baja a ~$${inv.toFixed(0)} de cada $100 en ${a.ticker} y deja el resto en USD${resv >= 0.5 ? `, con ~$${resv.toFixed(0)} de cobertura` : ""}.`
                        : `Sin ventaja clara: mantén ~$${inv.toFixed(0)} de cada $100 en ${a.ticker} y no añadas hasta que la señal cambie.`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="divider" style={{ margin: "14px 0 10px" }} />
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>
            <strong>Cómo usarlo:</strong> el porcentaje es sobre tu <strong>portafolio total</strong> (igual que la “Exposición sugerida” del veredicto de arriba). Compara la “posición neta” con lo que realmente tienes invertido: si tienes más, no añadas (o reduce); si tienes menos y la señal es de compra, acércate al nivel sugerido en tramos. Si el precio cae de <strong className="num">{E.fmt.usd(E.sizing(result.lth.signal, regime, a.values.price).stopUsd)}</strong>, el modelo considera que el escenario cambió: revísalo antes de seguir añadiendo.
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Histórico de convicción con rangos (días/ciclos) + precio ---------- */
function convRanges() {
  const end = new Date((window.BambuDataDate || "2026-06-30") + "T00:00:00Z");
  const since = iso => Math.round((end - new Date(iso + "T00:00:00Z")) / 86400000);
  return [
    ["90 días", 90], ["180 días", 180], ["1 año", 365],
    ["Ciclo 4 (actual, desde halving 2024)", since("2024-04-20")],
    ["Ciclos 3 y 4 (desde halving 2020)", since("2020-05-11")],
    ["Ciclos 2, 3 y 4 (desde halving 2016)", since("2016-07-09")],
  ];
}
function ConvHist({ a, palette }) {
  const H = window.BambuHistory;
  const [days, setDays] = React.useState(90);
  const data = React.useMemo(() => (H && H.rangeComposites) ? H.rangeComposites(a.type, 27, days, 260) : null, [a.type, days]);
  if (!data || !data.length) return (
    <Card title={`Histórico de convicción · ${a.ticker}`} sub="Sin histórico para este activo">
      <div className="muted" style={{ padding: "30px 0", textAlign: "center" }}>Las series diarias están disponibles para BTC y ETH.</div>
    </Card>
  );
  const priceCol = "var(--brand)";
  const RANGES = React.useMemo(convRanges, []);
  const first = data[0], lastD = data[data.length - 1];
  const last = lastD;
  const readOf = c => c > 0.25 ? "barato · zona de compra" : c < -0.25 ? "caro · zona de venta" : "neutral · sin ventaja";
  const colOf = c => c > 0.25 ? "var(--brand)" : c < -0.25 ? "#A83C26" : "var(--ink-3)";
  return (
    <Card title={<>{`Histórico de convicción · ${a.ticker}`} <HelpDot k="conviccion" /></>}
          sub="El precio arriba y, debajo, lo que el modelo opinaba en cada momento: sobre 0 = barato (comprar), bajo 0 = caro (asegurar)">
      {/* menú desplegable de rango */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <label className="tiny muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Periodo</label>
        <select value={days} onChange={e => setDays(+e.target.value)}
                style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600, padding: "9px 13px", borderRadius: 9, border: "1.5px solid var(--border-2, #D7DBD0)", background: "var(--card, #fff)", color: "var(--ink)", cursor: "pointer", maxWidth: "100%" }}>
          {RANGES.map(([l, d]) => <option key={d} value={d}>{l}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span className="tiny muted num">{first.label} → {lastD.label}</span>
      </div>
      <div className="tiny muted" style={{ marginBottom: 4, fontWeight: 600 }}>Precio {a.ticker} · USD</div>
      <MultiLine height={190} yFmt={v => E.fmt.usd(v)}
        series={[{ name: `Precio ${a.ticker}`, color: priceCol, data: data.map(d => ({ x: d.label, y: d.price })) }]} />
      <div className="divider" style={{ margin: "12px 0" }} />
      <div className="tiny muted" style={{ marginBottom: 4, fontWeight: 600 }}>Índice de convicción · positivo = barato · negativo = caro</div>
      <MultiLine height={230} baseline={0} yFmt={v => v.toFixed(1)}
        series={[{ name: "STH", color: "#C77B3A", data: data.map(d => ({ x: d.label, y: d.sth })) },
                 { name: "LTH", color: "#3E6FB0", data: data.map(d => ({ x: d.label, y: d.lth })) }]} />
      <Lgnd items={[{ name: `Precio ${a.ticker}`, color: priceCol }, { name: "STH · corto plazo", color: "#C77B3A" }, { name: "LTH · ciclo", color: "#3E6FB0" }]} />
      {/* lectura guiada */}
      <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "13px 16px", marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", marginBottom: 7 }}>Cómo leer esta gráfica</div>
        <div className="tiny" style={{ lineHeight: 1.65, color: "var(--ink-2)" }}>
          Cada línea es la “opinión” del modelo en ese momento: <strong>sobre 0 = el mercado estaba barato</strong> (buen momento para comprar) y <strong>bajo 0 = estaba caro</strong> (momento de asegurar). Compárala con el precio de arriba: verás que los picos positivos coinciden con suelos y los negativos con techos — esa es la prueba de que el índice anticipa, no persigue, al precio.
          <br />Hoy: <strong>corto plazo (STH) {E.fmt.signed(last.sth)}</strong> → <strong style={{ color: colOf(last.sth) }}>{readOf(last.sth)}</strong> · <strong>ciclo (LTH) {E.fmt.signed(last.lth)}</strong> → <strong style={{ color: colOf(last.lth) }}>{readOf(last.lth)}</strong>. El STH guía tus próximos aportes; el LTH, qué hacer con el patrimonio.
        </div>
      </div>
    </Card>
  );
}

function StatBox({ lab, val, sub, good }) {
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 10, padding: "13px 15px" }}>
      <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-3)" }}>{lab}</div>
      <div className="num" style={{ fontSize: 25, fontWeight: 600, marginTop: 6, color: good ? "var(--brand)" : "var(--ink)" }}>{val}</div>
      <div className="tiny muted" style={{ marginTop: 3 }}>{sub}</div>
    </div>
  );
}
function dedupeMarkers(ms) {
  // separa verticalmente etiquetas con temperaturas muy cercanas
  const sorted = ms.map((m, i) => ({ ...m, i })).sort((a, b) => a.temp - b.temp);
  let lastTemp = -99, level = 0;
  sorted.forEach(m => {
    if (m.temp - lastTemp < 14) level = level === 0 ? 1 : 0; else level = 0;
    m.flagTop = level === 0 ? -27 : -46;
    lastTemp = m.temp;
  });
  return sorted;
}

/* ============================================================
   INGRESO DE DATOS
   ============================================================ */
function SectionIngreso({ assets, results, regime, palette, onChange, onAddAsset, activeAsset, setActiveAsset }) {
  const [horizon, setHorizon] = React.useState("STH");
  const asset = assets.find(a => a.id === activeAsset) || assets[0];
  const res = results.find(r => r.asset.id === asset.id);
  const hr = horizon === "STH" ? res.sth : res.lth;
  const schema = horizon === "STH" ? res.schema.sth : res.schema.lth;
  const col = E.tempColor(hr.temp, palette);

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Ingreso de datos</h1>
        <p>Introduce los valores de las métricas on-chain. El modelo calcula el <strong>score</strong>, el <strong>Índice de Convicción</strong> ponderado, la <strong>temperatura</strong> y la <strong>señal</strong> en tiempo real.</p>
      </div>

      {/* selector de activo */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="tabs">
          {assets.map(a => (
            <button key={a.id} className={"tab" + (a.id === activeAsset ? " active" : "")} onClick={() => setActiveAsset(a.id)}>
              {a.name} <span className="tk">{a.ticker}</span>
            </button>
          ))}
          <button className="tab-add" onClick={onAddAsset}>+ Añadir activo</button>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="seg">
          <button className={horizon === "STH" ? "on" : ""} onClick={() => setHorizon("STH")}>Corto plazo · STH</button>
          <button className={horizon === "LTH" ? "on" : ""} onClick={() => setHorizon("LTH")}>Largo plazo · LTH</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start" }}>
        {/* formulario */}
        <Card pad={false}>
          {/* precio + realized */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
            <PriceField label={`Precio ${asset.ticker}`} tech="Spot USD" value={asset.values.price}
                        onChange={v => onChange(asset.id, "price", v)} unit="USD" />
          </div>
          <div style={{ padding: "0 20px 18px" }}>
            {schema.groups.map(g => {
              const gScores = hr.groups.find(x => x.id === g.id);
              return (
                <div key={g.id}>
                  <div className="group-head">
                    <span className="gh-name" style={{ color: "var(--ink)" }}>◆ {g.name}</span>
                    <span className="gh-w">{(g.weight * 100).toFixed(0)}%</span>
                    <span className="gh-line" />
                    <span className="gh-score">avg {E.fmt.signed(gScores.sectionScore)}</span>
                  </div>
                  {g.metrics.map(m => {
                    const cell = gScores.metrics.find(x => x.m.key === m.key);
                    return <MetricRow key={m.key} m={m} value={cell.value} score={cell.score} palette={palette}
                                     onChange={v => onChange(asset.id, m.key, v)} />;
                  })}
                </div>
              );
            })}
          </div>
        </Card>

        {/* panel resultado live */}
        <div style={{ position: "sticky", top: 0 }}>
          <Card title={`Resultado · ${asset.ticker} ${horizon}`}>
            <div style={{ textAlign: "center", padding: "6px 0 4px" }}>
              <div className="num" style={{ fontSize: 46, fontWeight: 600, color: col, lineHeight: 1 }}>{hr.temp.toFixed(0)}°</div>
              <div style={{ marginTop: 8 }}><SignalPill signal={hr.signal} big /></div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: col }}>{hr.zone.label} · {hr.zone.phase}</div>
            </div>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
              <span className="muted">Índice de Convicción</span>
              <span className="num" style={{ fontWeight: 600 }}>{E.fmt.signed(hr.composite)}</span>
            </div>
            {hr.groups.map(g => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: "1px solid var(--border)" }}>
                <span className="muted">{g.name} <span className="tiny">· {(g.weight * 100).toFixed(0)}%</span></span>
                <ScoreChip score={g.sectionScore} palette={palette} />
              </div>
            ))}
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="tiny muted" style={{ lineHeight: 1.5 }}>
              Régimen actual <strong style={{ color: "var(--brand)" }}>{regime}</strong> · multiplicador de sizing ×{DD.REGIMES[regime].mult.toFixed(2)} aplicado en la pestaña Sizing &amp; Stops.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PriceField({ label, tech, value, onChange, unit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{tech}</div>
      </div>
      <div className="inp-unit" style={{ width: 180 }}>
        <input className="inp" type="number" value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ fontSize: 16 }} />
        <span className="u">{unit}</span>
      </div>
    </div>
  );
}

function MetricRow({ m, value, score, palette, onChange }) {
  const auto = !!m.auto;
  return (
    <div className="metric-row">
      <div>
        <div className="m-name">{m.label}<HelpDot k={m.key} /></div>
        <div className="m-read">{m.read || m.src}</div>
      </div>
      <div className="inp-unit">
        {auto
          ? <input className="inp auto" value={value !== undefined ? Number(value).toFixed(2) : "—"} readOnly title="Calculado automáticamente" />
          : <input className="inp" type="number" value={value ?? ""} onChange={e => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))} />}
        {m.unit && <span className="u" style={{ right: auto ? 11 : 11 }}>{m.unit}</span>}
      </div>
      <div style={{ textAlign: "center" }}>
        {m.noscore ? <span className="muted tiny">—</span> : <ScoreChip score={score} palette={palette} />}
      </div>
      <div style={{ textAlign: "center" }}>
        {m.noscore ? <span className="tiny muted">ref</span> : <SignalDotForScore score={score} />}
      </div>
    </div>
  );
}
function SignalDotForScore({ score }) {
  if (score === null || score === undefined) return <span className="badge sig-neut">—</span>;
  const lab = score >= 1 ? "COMPRA" : score > 0 ? "Compra" : score <= -1 ? "REDUCIR" : score < 0 ? "Reducir" : "Neutral";
  const cls = score > 0 ? (score >= 1 ? "sig-buy2" : "sig-buy") : score < 0 ? (score <= -1 ? "sig-sell2" : "sig-sell") : "sig-neut";
  return <span className={"badge " + cls}>{lab}</span>;
}

Object.assign(window, { SectionResumen, SectionIngreso, flatSignals, marketTemp, dedupeMarkers, convRanges });
