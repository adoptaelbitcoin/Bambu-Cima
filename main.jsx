/* ============================================================
   BAMBÚ · App shell + navegación + Tweaks
   ============================================================ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "sobria",
  "sensitivity": 27,
  "density": "regular"
}/*EDITMODE-END*/;

const NAVGROUPS = [
  { label: "Análisis", items: [
    { id: "resumen",  label: "Resumen",         icon: "resumen" },
    { id: "heatmap",  label: "Heatmap de zonas", icon: "heatmap" },
    { id: "historico",label: "Histórico",        icon: "historico" },
    { id: "ciclo",    label: "Ciclo Halving +", icon: "ciclo" },
  ]},
  { label: "Mercado", items: [
    { id: "onchain",  label: "On-chain+",        icon: "onchain" },
    { id: "macro",    label: "Macro & sentimiento", icon: "macro" },
  ]},
  { label: "Decisión", items: [
    { id: "cartera",  label: "Cartera & Riesgo", icon: "cartera" },
    { id: "escenarios",label: "¿Qué pasaría si?", icon: "escenarios" },
    { id: "alertas",  label: "Alertas & Diario", icon: "alertas" },
  ]},
  { label: "Validación", items: [
    { id: "backtest", label: "Backtest & Stats", icon: "backtest" },
    { id: "sizing",   label: "Sizing & Stops",  icon: "sizing" },
    { id: "reporte",  label: "Reporte 360",     icon: "reporte" },
  ]},
  { label: "Ayuda", items: [
    { id: "guia",     label: "Cómo usar Bambu", icon: "guia" },
  ]},
];
const TITLES = {
  resumen: ["Resumen ejecutivo", "Lectura consolidada del modelo v2.2"],
  heatmap: ["Heatmap de zonas", "Mapa térmico acumulación → distribución"],
  historico:["Histórico de datos", "Series diarias y comparativos BTC / ETH"],
  ciclo:   ["Ciclo Halving +", "Ciclos, fases alcistas/bajistas y proyección"],
  backtest:["Backtest & Estadísticas", "Puntos de inflexión + hit-rate, profit factor y resultados"],
  sizing:  ["Sizing & Stops", "Gestión de riesgo LONG / SHORT"],
  onchain: ["On-chain ampliado", "Cohortes, flujos y ballenas"],
  macro:   ["Macro & sentimiento", "Calendario económico y sentimiento"],
  cartera: ["Cartera & Riesgo", "Simulador, stops y correlaciones"],
  escenarios:["¿Qué pasaría si?", "What-if, ciclo y backtest interactivo"],
  alertas: ["Alertas & diario", "Avisos del modelo, watchlist y bitácora"],
  reporte: ["Reporte 360", "Informe semanal de los lunes e informe on-chain"],
  guia:    ["Cómo usar Bambu", "Guía de uso sencilla, paso a paso"],
};

/* explicación detallada por sección · se muestra en el "?" junto al título */
const SECTION_HELP = {
  resumen: "Tu punto de partida. Reúne en una sola lectura la señal del modelo para BTC y ETH: temperatura (¿caro o barato?), señal (comprar/mantener/reducir) e índice de convicción. Si solo vas a mirar una pestaña, mira esta.",
  heatmap: "Mapa térmico del mercado. Ubica cada señal entre acumulación (frío/azul) y distribución (caliente/rojo). Sirve para ver de un vistazo en qué zona del ciclo está cada activo y horizonte.",
  historico: "Series diarias reales de BTC y ETH. Explora cualquier métrica on-chain en el tiempo, coloreada por su score, y compara cómo se movió frente al precio. Útil para entender el contexto detrás de la señal de hoy.",
  ciclo: "Todo gira en torno al halving de Bitcoin. Muestra dónde estás en el ciclo, compara los ciclos pasados (incluido qué hizo ETH en cada uno) y proyecta las fases alcista/bajista con sus fechas.",
  backtest: "La prueba de fiabilidad del modelo. Mide cuánto han acertado históricamente sus señales (hit-rate, profit factor) en los puntos de inflexión reales. Te dice si puedes confiar en la señal antes de arriesgar dinero.",
  sizing: "El manual de tamaños y protección. Por cada señal define cuánto comprar (LONG), cuánta cobertura, dónde poner el stop y dónde tomar ganancias, ajustado por el régimen de mercado. Decide el 'cuánto', no el 'en qué dirección'.",
  onchain: "Análisis on-chain ampliado: cohortes de holders, flujos de exchanges y actividad de ballenas. Para profundizar más allá de las métricas del resumen.",
  macro: "Contexto de mercado: catalizadores próximos (calendario) y termómetro de sentimiento. Abre con una conclusión accionable que cruza riesgo macro, posicionamiento y estructura.",
  cartera: "Tu mesa de operaciones. Simula posiciones y P&L, mide diversificación con la matriz de correlación, y el Plan de operación convierte una señal en una operación concreta: long/short, tamaño según tu riesgo y objetivos por plazo.",
  escenarios: "El simulador 'qué pasaría si'. Mueve variables (precio, métricas) y observa cómo cambian la señal y la temperatura — para fijar tu precio de salida y preparar decisiones antes de que el mercado las ejecute. Funciona para BTC y ETH.",
  alertas: "Cierra el ciclo de la disciplina. Lo esencial en lenguaje claro (4 preguntas), alertas que lideran con la acción, watchlist con traducción y un diario para registrar y aprender de tus decisiones.",
  reporte: "Informes del modelo. El semanal recopila cada lunes lo que pasó y lo que viene (con escenarios históricos); el on-chain reconstruye el análisis para cualquier temporalidad. Exportables a PDF.",
  guia: "Guía de uso paso a paso, en lenguaje sencillo: qué es Bambu, los 3 colores clave y cómo tomar una decisión en 6 pasos. Ideal para empezar.",
};

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="3" width="26" height="26" rx="7" fill="#3E7C57" />
      <path d="M12 8.5v15M20 8.5v15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 13h8M12 18.5h8" stroke="#A6D9B8" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

let assetSeq = 0;
function freshAsset() {
  assetSeq++;
  const id = "asset" + assetSeq;
  return { id, name: "Activo " + assetSeq, ticker: "AST" + assetSeq, type: "BTC", values: { ...DD.PRELOAD.BTC, price: 100, rpSTH: 98, rpLTH: 60 } };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [navOpen, setNavOpen] = React.useState(false);
  const [page, setPage] = React.useState(() => {
    const p = localStorage.getItem("bambu_page");
    return (p && p !== "ingreso" && p !== "blog" && p !== "mercado") ? p : "resumen";
  });
  const [assets, setAssets] = React.useState(() => {
    try { const s = localStorage.getItem("bambu_assets_v11"); if (s) return JSON.parse(s); } catch (e) {}
    return DD.freshAssets();
  });
  const [activeAsset, setActiveAsset] = React.useState(assets[0].id);
  const [snapshots, setSnapshots] = React.useState(() => {
    try { const s = localStorage.getItem("bambu_snaps"); if (s) return JSON.parse(s); } catch (e) {}
    return [...window.BambuHistory.SNAPSHOTS];
  });
  const [portfolio, setPortfolio] = React.useState(() => {
    try { const s = localStorage.getItem("bambu_pf"); if (s) return JSON.parse(s); } catch (e) {}
    return [
      { id: "p1", ticker: "BTC", side: "long", sizeUsd: 5000, entry: 72000 },
      { id: "p2", ticker: "ETH", side: "long", sizeUsd: 3000, entry: 2100 },
    ];
  });
  const [journal, setJournal] = React.useState(() => {
    try { const s = localStorage.getItem("bambu_journal"); if (s) return JSON.parse(s); } catch (e) {}
    return [{ id: "j0", date: "19 may 2026", regime: "BULL MARKET", text: "Mercado neutral cooling tras el pico de diciembre. Mantener cobertura mínima y vigilar funding." }];
  });
  const [watchlist, setWatchlist] = React.useState(() => {
    try { const s = localStorage.getItem("bambu_watch"); if (s) return JSON.parse(s); } catch (e) {}
    return ["mvrvLTHLTH", "nuplLTHLTH", "rsi1wLTH", "fundingSTH"];
  });

  React.useEffect(() => { localStorage.setItem("bambu_page", page); }, [page]);
  React.useEffect(() => { try { localStorage.setItem("bambu_assets_v11", JSON.stringify(assets)); } catch (e) {} }, [assets]);
  React.useEffect(() => { try { localStorage.setItem("bambu_snaps", JSON.stringify(snapshots)); } catch (e) {} }, [snapshots]);
  React.useEffect(() => { try { localStorage.setItem("bambu_pf", JSON.stringify(portfolio)); } catch (e) {} }, [portfolio]);
  React.useEffect(() => { try { localStorage.setItem("bambu_journal", JSON.stringify(journal)); } catch (e) {} }, [journal]);
  React.useEffect(() => { try { localStorage.setItem("bambu_watch", JSON.stringify(watchlist)); } catch (e) {} }, [watchlist]);

  const palette = t.palette || "sobria";
  const k = t.sensitivity || 27;
  const results = React.useMemo(() => assets.map(a => E.computeAsset(a, { k })), [assets, k]);
  const regime = React.useMemo(() => {
    const btc = assets.find(a => a.type === "BTC") || assets[0];
    return E.detectRegime(btc.values);
  }, [assets]);

  const onChange = (assetId, key, value) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, values: { ...a.values, [key]: value === "" ? "" : value } } : a));
  };
  const onAddAsset = () => {
    const na = freshAsset();
    setAssets(prev => [...prev, na]);
    setActiveAsset(na.id);
  };

  const onSaveSnapshot = (notes) => {
    const btc = results.find(r => r.asset.type === "BTC") || results[0];
    const eth = results.find(r => r.asset.type === "ETH");
    const now = new Date();
    const id = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(snapshots.length + 1).padStart(3, "0");
    const snap = {
      id, live: true,
      date: now.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
      regime,
      btcSTH: btc ? btc.sth.composite : null, btcLTH: btc ? btc.lth.composite : null,
      ethSTH: eth ? eth.sth.composite : null, ethLTH: eth ? eth.lth.composite : null,
      btcPx: btc ? btc.vals.price : null, ethPx: eth ? eth.vals.price : null,
      notes: notes || "Lectura manual",
    };
    setSnapshots(prev => [...prev.map(s => ({ ...s, live: false })), snap]);
  };

  const mt = marketTemp(results);
  const mz = E.zoneFor(mt);
  const mtCol = E.tempColor(mt, palette);
  const dataAsOf = React.useMemo(() => {
    const R = window.BambuRealData && window.BambuRealData.BTC;
    const iso = window.BambuDataDate || (R ? R.latestIso : "2026-06-28");
    return new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  }, []);
  const btc = results.find(r => r.asset.type === "BTC") || results[0];
  const eth = results.find(r => r.asset.type === "ETH");

  const view = () => {
    const P = page;
    if (!TITLES[P]) return null;
    switch (page) {
      case "resumen":  return <SectionResumen results={results} regime={regime} palette={palette} />;
      case "heatmap":  return <SectionHeatmap results={results} regime={regime} palette={palette} k={k} />;
      case "historico":return <SectionHistorico results={results} regime={regime} palette={palette} k={k}
                                snapshots={snapshots} onSaveSnapshot={onSaveSnapshot} />;
      case "ciclo":    return <SectionCiclo palette={palette} />;
      case "backtest": return <SectionBacktest palette={palette} k={k} assets={assets} />;
      case "sizing":   return <SectionSizing results={results} regime={regime} palette={palette} />;
      case "onchain":  return <SectionOnchain results={results} palette={palette} k={k} />;
      case "macro":    return <SectionMacro results={results} palette={palette} />;
      case "cartera":  return <SectionCartera results={results} regime={regime} palette={palette} portfolio={portfolio} setPortfolio={setPortfolio} />;
      case "escenarios":return <SectionEscenarios palette={palette} k={k} />;
      case "alertas":  return <SectionAlertas results={results} regime={regime} palette={palette} snapshots={snapshots} journal={journal} setJournal={setJournal} watchlist={watchlist} setWatchlist={setWatchlist} />;
      case "reporte":  return <SectionReporte results={results} regime={regime} palette={palette} />;
      case "guia":     return <SectionGuia palette={palette} />;
      default: return null;
    }
  };

  return (
    <div className={"app" + (t.density === "compact" ? " dense" : "") + (navOpen ? " nav-open" : "")}>
      {/* backdrop móvil */}
      <div className="nav-backdrop" onClick={() => setNavOpen(false)} />
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Bambu +</div>
            <div className="brand-sub">On-Chain Suite · Avanzado</div>
          </div>
        </div>
        <nav className="nav">
          {NAVGROUPS.map(g => (
            <React.Fragment key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(n => (
                <button key={n.id} className={"nav-item" + (page === n.id ? " active" : "")} onClick={() => { setPage(n.id); setNavOpen(false); }}>
                  <Icon d={ICONS[n.icon]} /> {n.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="nav-foot">
          Modelo de scoring v2.2<br />Pedro Iván Avellaneda<br />
          <span style={{ color: "#566359" }}>No es asesoramiento financiero.</span>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="nav-toggle" onClick={() => setNavOpen(o => !o)} aria-label="Menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="tb-title">{(TITLES[page] || ["Bambú", ""])[0]}{SECTION_HELP[page] && <HelpDot term={(TITLES[page] || ["Bambú"])[0]} def={SECTION_HELP[page]} />}<small>{(TITLES[page] || ["", ""])[1]}</small></div>
          <span className="tb-spacer" />
          <div className="tb-chip">
            <span className="k">Régimen</span>
            <span className="v" style={{ color: "var(--brand)" }}>{regime}</span>
          </div>
          <div className="tb-chip tb-hide-sm">
            <span className="k">BTC</span>
            <span className="v num">{E.fmt.usd(btc.vals.price)}</span>
          </div>
          {eth && <div className="tb-chip tb-hide-sm">
            <span className="k">ETH</span>
            <span className="v num">{E.fmt.usd(eth.vals.price)}</span>
          </div>}
          <div className="tb-chip tb-hide-sm" style={{ background: mixSoft(mtCol), borderColor: mixSoft(mtCol, .6) }}>
            <span className="k">Temp. mercado</span>
            <span className="v num" style={{ color: mtCol }}>{mt.toFixed(0)}° · {mz.label}</span>
          </div>
          <div className="tb-chip tb-hide-sm" title="Fecha del último dato on-chain real (ChartInspect)">
            <span className="k">Actualizado</span>
            <span className="v num">{dataAsOf}</span>
          </div>
        </header>
        <div className="content">{view()}</div>
      </div>

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Mapa de calor" />
        <TweakSelect label="Paleta térmica" value={palette}
          options={[
            { label: "Sobria · hielo→brasa", value: "sobria" },
            { label: "Térmica clásica", value: "termica" },
            { label: "Magma", value: "magma" },
          ]}
          onChange={v => setTweak("palette", v)} />
        <TweakSlider label="Sensibilidad térmica" value={k} min={15} max={40} step={1}
          onChange={v => setTweak("sensitivity", v)}
          hint="Cuánto mueve el composite a la temperatura" />
        <TweakSection label="Diseño" />
        <TweakRadio label="Densidad" value={t.density} options={["compact", "regular"]}
          onChange={v => setTweak("density", v)} />
        <div style={{ padding: "10px 4px 2px", display: "flex", gap: 6 }}>
          {DD.ZONES.map(z => (
            <div key={z.id} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 22, borderRadius: 5, background: E.tempColor(z.temp, palette) }} />
              <div style={{ fontSize: 8.5, marginTop: 3, color: "var(--ink-3)" }}>{z.label}</div>
            </div>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
