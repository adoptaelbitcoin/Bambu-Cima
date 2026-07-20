/* ============================================================
   BAMBU GO · Secciones interactivas
   1) Explorador de métricas  2) Simulador  3) Comparador BTC/ETH
   ============================================================ */
const XE = window.BambuEngine;
const XDD = window.BambuData;
const XPAL = "sobria";

/* catálogo de métricas explorables (con referencias históricas y ayuda) */
const METRICS = [
  { key: "mvrvZ", label: "MVRV-Z", color: "#2E6FAE", fmt: v => v.toFixed(2),
    help: "Mide cuánto se aleja el precio del valor real al que se movieron las monedas en la cadena. Por debajo de 0 han estado los suelos históricos; por encima de 5, los techos de euforia.",
    refs: [{ v: 0, label: "suelo", col: "#4C9FB0" }, { v: 5, label: "techo", col: "#BC4A2E" }] },
  { key: "nuplLTH", label: "NUPL", color: "#7A5AB0", fmt: v => (v * 100).toFixed(0) + "%",
    help: "Ganancia latente de los holders de largo plazo: cuánto ganan sin haber vendido. Cerca de 0% domina el miedo (suelos); por encima del 75% aparece la euforia (techos).",
    refs: [{ v: 0, label: "miedo", col: "#4C9FB0" }, { v: 0.75, label: "euforia", col: "#BC4A2E" }] },
  { key: "mvrvLTH", label: "Precio / coste", color: "#C77B3A", fmt: v => "×" + v.toFixed(2),
    help: "Cuántas veces el precio actual supera el coste medio al que compraron los holders de largo plazo. Por debajo de ×1 el mercado cotiza con descuento sobre ese coste.",
    refs: [{ v: 1, label: "coste", col: "#9CA1A8" }] },
  { key: "mayer", label: "Mayer (media 200d)", color: "#B5407E", fmt: v => "×" + v.toFixed(2),
    help: "Precio dividido por su media móvil de 200 días. Por debajo de ×1 es históricamente barato; por encima de ×2,4 el mercado suele estar recalentado.",
    refs: [{ v: 1, label: "media", col: "#9CA1A8" }, { v: 2.4, label: "caro", col: "#BC4A2E" }] },
  { key: "rsi1w", label: "Data técnica", color: "#E08A35", fmt: v => v.toFixed(0),
    help: "RSI semanal: mide la fuerza del momentum a escala macro. Por debajo de 30 indica sobreventa (posible suelo); por encima de 70, sobrecompra (posible techo).",
    refs: [{ v: 30, label: "sobreventa", col: "#4C9FB0" }, { v: 70, label: "sobrecompra", col: "#BC4A2E" }] },
];

/* ---------- 1 · Explorador de métricas ---------- */
function MetricExplorer({ type }) {
  const [key, setKey] = React.useState("mvrvZ");
  const [days, setDays] = React.useState(1460);
  const m = METRICS.find(x => x.key === key) || METRICS[0];
  const priceSeries = React.useMemo(() => window.metricSeries(type, "price", days), [type, days]);
  const series = React.useMemo(() => window.metricSeries(type, key, days), [type, key, days]);
  const RANGES = [{ d: 730, l: "2 a" }, { d: 1460, l: "4 a" }, { d: 999999, l: "Máx" }];

  const chip = on => ({ cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 9, border: on ? "1px solid var(--brand)" : "1px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" });

  return (
    <div>
      {/* precio arriba */}
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "16px 18px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Precio de {type}</span>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 5 }}>{RANGES.map(x => <button key={x.d} onClick={() => setDays(x.d)} style={chip(x.d === days)}>{x.l}</button>)}</div>
        </div>
        <window.MetricLineChart series={priceSeries} color="#3E7C57" refs={[]} fmtVal={v => XE.fmt.usd(v)} />
      </div>

      {/* indicadores abajo */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", margin: "0 2px 9px" }}>Elige un indicador para compararlo con el precio:</div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        {METRICS.map(x => <button key={x.key} onClick={() => setKey(x.key)} style={chip(x.key === key)}>{x.label}</button>)}
      </div>
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "16px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 7 }}>{m.label}<window.HelpS title={m.label} text={m.help} /></span>
          <span style={{ flex: 1 }} />
        </div>
        <window.MetricLineChart series={series} color={m.color} refs={m.refs} fmtVal={m.fmt} />
      </div>
    </div>
  );
}

/* ---------- 2 · Simulador: ¿y si invierto hoy? ---------- */
function InvestSimulator({ type, sig, temp, price }) {
  const [amount, setAmount] = React.useState(1000);
  const [horizon, setHorizon] = React.useState(90);
  const sim = window.similarCases(type, sig, temp);
  const cases = sim.cases.filter(c => c.mov != null);
  const avg90 = sim.avg || 0;
  const best = cases.length ? Math.max(...cases.map(c => c.mov)) : 0;
  const worst = cases.length ? Math.min(...cases.map(c => c.mov)) : 0;
  const scale = horizon / 90;
  const projPct = avg90 * scale, bestPct = best * scale, worstPct = worst * scale;
  const proj = amount * (1 + projPct / 100);
  const col = projPct >= 0 ? "var(--brand-2)" : "#B0402A";

  const Row = ({ lab, pct, strong }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: strong ? "var(--ink)" : "var(--ink-2)", fontWeight: strong ? 700 : 500 }}>{lab}</span>
      <span style={{ flex: 1 }} />
      <span className="num" style={{ fontSize: strong ? 16 : 13.5, fontWeight: 700, color: pct >= 0 ? "var(--brand-2)" : "#B0402A" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
      <span className="num" style={{ fontSize: strong ? 16 : 13.5, fontWeight: strong ? 700 : 500, minWidth: 92, textAlign: "right" }}>{XE.fmt.usd(amount * (1 + pct / 100))}</span>
    </div>
  );

  const fld = { fontFamily: "var(--mono)", fontSize: 15, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)", width: "100%" };

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18, alignItems: "start" }}>
        <div>
          <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Invierto en {type} (USD)</label>
          <input style={fld} type="number" value={amount} onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))} />
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Horizonte</label>
            <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{horizon} días</span>
          </div>
          <input type="range" min="30" max="540" step="30" value={horizon} onChange={e => setHorizon(+e.target.value)} style={{ width: "100%", marginTop: 6, accentColor: "#3E7C57" }} />
          <div className="num" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Compras {(amount / price).toFixed(5)} {type} a {XE.fmt.usd(price)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Proyección a {horizon} días (escenario medio)</div>
          <div className="num" style={{ fontSize: 32, fontWeight: 700, color: col, lineHeight: 1.1 }}>{XE.fmt.usd(proj)}</div>
          <Row lab="Escenario medio" pct={projPct} strong />
          <Row lab="Mejor caso análogo" pct={bestPct} />
          <Row lab="Peor caso análogo" pct={worstPct} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12, lineHeight: 1.5, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        Estimación simple: escala el movimiento histórico medio a 90 días ({avg90 >= 0 ? "+" : ""}{avg90.toFixed(0)}%) en {cases.length} momentos parecidos. No es una predicción; el mercado puede hacer cualquier cosa. Rendimientos pasados no garantizan resultados futuros.
      </div>
    </div>
  );
}

/* ---------- 3 · Comparador BTC vs ETH ---------- */
function Comparator({ results, verdictOf, regime, days }) {
  const btc = results.find(r => r.asset.type === "BTC");
  const eth = results.find(r => r.asset.type === "ETH");
  if (!btc || !eth) return null;
  const vB = verdictOf(btc, regime), vE = verdictOf(eth, regime);
  const cheaper = vB.mt < vE.mt ? "BTC" : "ETH";

  const Col = ({ tk, v, r }) => {
    const col = XE.tempColor(v.mt, XPAL);
    return (
      <div style={{ flex: 1, textAlign: "center", padding: "6px 4px" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{tk}</div>
        <div className="num" style={{ fontSize: 40, fontWeight: 700, color: col, lineHeight: 1.05, marginTop: 4 }}>{Math.round(v.mt)}°</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{v.stance}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{v.zone.label}</div>
      </div>
    );
  };

  return (
    <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <Col tk="BTC" v={vB} r={btc} />
        <div style={{ width: 1, background: "var(--border)" }} />
        <Col tk="ETH" v={vE} r={eth} />
      </div>
      <div style={{ textAlign: "center", background: "var(--brand-soft)", borderRadius: 10, padding: "10px 14px", margin: "6px 0 16px", fontSize: 13, color: "var(--brand-ink)" }}>
        Ahora mismo <b>{cheaper}</b> está más barato en términos on-chain ({Math.round(Math.min(vB.mt, vE.mt))}° vs {Math.round(Math.max(vB.mt, vE.mt))}°).
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6, fontWeight: 600 }}>Temperatura de ambos en el tiempo</div>
      <window.CompareTempChart days={days} />
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 3, background: "#3E7C57", borderRadius: 2 }} />BTC</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 3, background: "#7A5AB0", borderRadius: 2 }} />ETH</span>
      </div>
    </div>
  );
}

Object.assign(window, { MetricExplorer, InvestSimulator, Comparator });
