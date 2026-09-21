/* ============================================================
   BAMBÚ · Secciones — Mercado en vivo · On-chain+ · Macro
   ============================================================ */
const SAMPLE_NOTE = <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-3)", fontWeight: 600 }}>datos de muestra</span>;

/* ---------- veredicto táctico: cruza estructura on-chain × sentimiento × liquidaciones ---------- */
function tacticalRead(structTemp, fgVal, mom7, liq, palette) {
  const cheap = structTemp < 42, expensive = structTemp > 58;
  const fear = fgVal < 42, greed = fgVal > 60;
  let stance, action, exec, temp, aligned;
  if (cheap && fear) { stance = "Ventana de acumulación"; action = "Comprar en el pánico: estructura barata y miedo se refuerzan."; exec = "Sí"; temp = 15; aligned = true; }
  else if (cheap) { stance = "Acumulación selectiva"; action = "Entrar escalonado: la estructura es barata pero el ánimo aún no capitula."; exec = "Con cautela"; temp = 32; aligned = false; }
  else if (expensive && greed) { stance = "Toma de ganancias"; action = "Reducir o cubrir: sobrevaloración estructural + euforia."; exec = "Sí, a la baja"; temp = 88; aligned = true; }
  else if (expensive) { stance = "Proteger posición"; action = "Caro pero sin euforia: ajusta stops, no persigas el precio."; exec = "No comprar"; temp = 70; aligned = false; }
  else { stance = "Esperar confirmación"; action = "Sin divergencia clara entre estructura y sentimiento: no fuerces la operación."; exec = "Esperar"; temp = 50; aligned = false; }

  const lo = liq.totalLong, sh = liq.totalShort;
  const liqNote = lo > sh * 1.3
    ? "Más liquidaciones de longs apiladas debajo: riesgo de mecha bajista. Entra escalonado, no de golpe."
    : sh > lo * 1.3
      ? "Predominan liquidaciones de shorts encima: si rompe al alza, hay combustible para un squeeze."
      : "Liquidaciones equilibradas a ambos lados: sin sesgo de mecha claro.";
  return { stance, action, exec, temp, aligned, liqNote };
}

function MarketTactical({ structTemp, fgVal, fgLabel, mom7, liq, palette }) {
  const v = tacticalRead(structTemp, fgVal, mom7, liq, palette);
  const col = E.tempColor(v.temp, palette);
  const ink = E.inkColor(col, 3);                  // titulares
  const inkSm = E.inkColor(col, 4.5);              // texto normal
  const stops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const grad = "linear-gradient(90deg," + stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
  const sz = window.BambuHistory.zoneOf(structTemp, (results[0]&&results[0].asset?results[0].asset.type:"BTC"), "lth");
  const execCol = v.exec.startsWith("Sí") ? E.inkColor(E.tempColor(v.temp < 50 ? 18 : 88, palette), 3)
                : v.exec === "Con cautela" ? E.inkColor(E.tempColor(40, palette), 3) : "var(--ink-2)";
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `6px solid ${col}`, padding: 0, overflow: "hidden" }}>
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr 1.3fr", gap: 0 }}>
        <div style={{ padding: "18px 22px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".14em" }}>Lectura táctica · ahora mismo</div>
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em", color: ink, lineHeight: 1.08, marginTop: 6 }}>{v.stance}</div>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, color: "var(--ink-2)", lineHeight: 1.45 }}>{v.action}</div>
          {/* espectro con dos marcadores: estructura (on-chain) y sentimiento (F&G) */}
          <div style={{ marginTop: 16, height: 8, borderRadius: 5, background: grad, position: "relative" }}>
            <div style={{ position: "absolute", left: structTemp + "%", top: -4, width: 4, height: 16, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 2px #fff" }} title="Estructura on-chain" />
            <div style={{ position: "absolute", left: fgVal + "%", top: -4, width: 4, height: 16, background: "#fff", border: "2px solid #1B2420", borderRadius: 2, transform: "translateX(-50%)" }} title="Sentimiento (F&G)" />
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <span className="tiny muted"><span style={{ display: "inline-block", width: 9, height: 9, background: "#1B2420", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Estructura {structTemp.toFixed(0)} de 100</span>
            <span className="tiny muted"><span style={{ display: "inline-block", width: 9, height: 9, background: "#fff", border: "2px solid #1B2420", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Sentimiento {fgVal}</span>
          </div>
        </div>
        <div style={{ padding: "18px 22px", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>¿Ejecutar ahora?</div>
          <div style={{ fontSize: 23, fontWeight: 700, color: execCol, lineHeight: 1.1, marginTop: 4 }}>{v.exec}</div>
          <div className="tiny" style={{ marginTop: 6 }}>
            <span className="badge" style={{ background: mixSoft(v.aligned ? E.tempColor(v.temp, palette) : E.tempColor(50, palette)), color: v.aligned ? inkSm : "var(--ink-2)", fontWeight: 700 }}>
              {v.aligned ? "Estructura y ánimo alineados" : "Divergen → cautela"}
            </span>
          </div>
        </div>
        <div style={{ padding: "16px 22px", borderLeft: "1px solid var(--border)" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>Por qué</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              `Estructura on-chain ${structTemp.toFixed(0)} de 100 → ${sz.label} (${structTemp < 40 ? "barato frente a su historial" : structTemp > 60 ? "caro frente a su historial" : "en su rango habitual"}).`,
              `Sentimiento Fear & Greed ${fgVal} · ${fgLabel}.`,
              `Momentum BTC ${mom7 >= 0 ? "+" : ""}${(mom7 * 100).toFixed(1)}% en 7 días.`,
              v.liqNote,
            ].map((r, i) => <li key={i} style={{ fontSize: 11.5, lineHeight: 1.42, color: "var(--ink-2)", display: "flex", gap: 6 }}><span style={{ color: inkSm, fontWeight: 700 }}>›</span>{r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ===================== MERCADO EN VIVO ===================== */
function useLiveMarket() {
  const [state, setState] = React.useState({ status: "idle", data: null, ts: null, errors: [] });
  const load = React.useCallback(async () => {
    if (!window.BambuLive) return;
    setState(s => ({ ...s, status: "loading" }));
    try {
      const r = await window.BambuLive.fetchAll({ global: true });
      if (r.ok) setState({ status: "live", data: r, ts: r.ts, errors: r.errors });
      else setState({ status: "error", data: r, ts: r.ts, errors: r.errors.length ? r.errors : ["sin respuesta"] });
    } catch (e) {
      setState({ status: "error", data: null, ts: Date.now(), errors: [e.message] });
    }
  }, []);
  React.useEffect(() => {
    load();
    const iv = setInterval(load, 60000); // auto-refresco 60s
    return () => clearInterval(iv);
  }, [load]);
  return { ...state, reload: load };
}

function SectionMercado({ results, palette }) {
  const X = window.BambuExtras;
  const [cAsset, setCAsset] = React.useState("BTC");
  const live = useLiveMarket();
  const L = live.data;
  const isLive = live.status === "live" && L && L.markets;

  // precio/cambios: en vivo si hay datos, si no la muestra
  const sample = { BTC: X.changes("BTC"), ETH: X.changes("ETH") };
  const mk = sym => {
    if (isLive && L.markets[sym]) { const m = L.markets[sym]; return { last: m.price, d1: m.d1, d7: m.d7, d30: m.d30, mcap: m.mcap, vol: m.vol }; }
    return sample[sym];
  };
  const btc = mk("BTC"), eth = mk("ETH");

  // Fear & Greed: en vivo o muestra
  const fgSample = X.fearGreed();
  const fg = (isLive && L.fg && L.fg.value) ? { value: L.fg.value, label: window.BambuLive.fgLabelEs(L.fg.value), series: L.fg.series } : fgSample;
  const fgCol = E.tempColor(fg.value, palette);

  // dominancia: global real o muestra
  const domSample = X.dominanceSeries(); const dS = domSample[domSample.length - 1];
  const dom = (isLive && L.global && L.global.btc) ? { btc: L.global.btc, eth: L.global.eth, alts: 100 - L.global.btc - L.global.eth } : dS;
  const capBTC = btc.mcap || X.marketcap("BTC", btc.last), capETH = eth.mcap || X.marketcap("ETH", eth.last);
  const capTotal = (isLive && L.global && L.global.totalUsd) ? L.global.totalUsd : (capBTC + capETH) / (dom.btc + dom.eth) * 100;
  const liq = X.liquidations(cAsset);
  const donutData = [
    { label: "BTC", value: dom.btc, color: "#C77B3A" },
    { label: "ETH", value: dom.eth, color: "#3E6FB0" },
    { label: "Alts", value: dom.alts, color: "#9AA0A8" },
  ];

  const statusBadge = () => {
    if (live.status === "loading" && !L) return <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>conectando…</span>;
    if (isLive) return <span className="badge" style={{ background: "#E2EFE5", color: "#1B6535" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2C9A55", display: "inline-block", marginRight: 5 }} />En vivo · {new Date(live.ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>;
    return <span className="badge" style={{ background: "#F6ECE2", color: "#9A5A22" }} title={(live.errors || []).join(" · ")}>datos de muestra (sin conexión)</span>;
  };
  const tDelta = sym => cAsset === sym;

  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h1>Mercado en vivo</h1>
          <p>El pulso del mercado <strong>ahora mismo</strong>, traducido a una decisión táctica: cruza la estructura on-chain (¿barato o caro?) con el sentimiento, el momentum y las liquidaciones para decirte si es buen momento de ejecutar. Precio y % de CoinGecko · Fear &amp; Greed de Alternative.me.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {statusBadge()}
          <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={live.reload} disabled={live.status === "loading"}>↻ Actualizar</button>
        </div>
      </div>

      <MarketTactical structTemp={marketTemp(results)} fgVal={fg.value} fgLabel={fg.label} mom7={btc.d7} liq={liq} palette={palette} />

      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 16 }}>
        <DeltaStat lab="BTC" val={E.fmt.usd(btc.last)} delta={btc.d1} sub="24h" />
        <DeltaStat lab="ETH" val={E.fmt.usd(eth.last)} delta={eth.d1} sub="24h" />
        <DeltaStat lab="Cap. total" val={"$" + (capTotal / 1e12).toFixed(2) + "T"} delta={btc.d7} sub="7d" />
        <DeltaStat lab="Dominancia BTC" val={dom.btc.toFixed(1) + "%"} delta={(dom.btc - dS.btc) / dS.btc} sub="vs muestra" />
        <div className="card kpi"><div className="lab">Fear &amp; Greed{isLive && L.fg ? " · en vivo" : ""}</div><div className="num val" style={{ color: fgCol }}>{fg.value}</div><div className="meta"><span className="badge" style={{ background: mixSoft(fgCol), color: fgCol }}>{fg.label}</span></div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
        <Card title="Precio" sub="Velas diarias · 90 días (histórico de muestra)"
          right={<div className="seg"><button className={cAsset === "BTC" ? "on" : ""} onClick={() => setCAsset("BTC")}>BTC</button><button className={cAsset === "ETH" ? "on" : ""} onClick={() => setCAsset("ETH")}>ETH</button></div>}>
          <Candles data={X.candles(cAsset)} height={260} />
          <div className="legend" style={{ marginTop: 8 }}>
            {[["24h", cAsset === "BTC" ? btc.d1 : eth.d1], ["7d", cAsset === "BTC" ? btc.d7 : eth.d7], ["30d", cAsset === "BTC" ? btc.d30 : eth.d30]].map(([k, v]) => (
              <span key={k} className="li"><span className="muted">{k}</span> <span className="num" style={{ fontWeight: 600, color: v >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(v * 100)}</span></span>
            ))}
            {isLive && <span className="li" style={{ marginLeft: "auto" }}><span className="muted">precio actual</span> <span className="num" style={{ fontWeight: 600 }}>{E.fmt.usd(cAsset === "BTC" ? btc.last : eth.last)}</span></span>}
          </div>
        </Card>

        <Card title={"Fear & Greed Index" + (isLive && L.fg ? " · en vivo" : "")} sub="Termómetro de sentimiento del mercado">
          <div className="gauge-wrap">
            <ThermoGauge temp={fg.value} palette={palette} size={240} />
            <div className="gauge-read"><div className="gauge-temp" style={{ color: fgCol }}>{fg.value}</div><div className="gauge-zone" style={{ color: fgCol }}>{fg.label}</div></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <LineChart data={fg.series.map(s => ({ x: s.label, y: s.value }))} height={90} color={fgCol} fill yFmt={v => v.toFixed(0)} />
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.4fr", marginTop: 16, alignItems: "start" }}>
        <Card title={"Dominancia de mercado" + (isLive && L.global ? " · en vivo" : "")} sub="Reparto de capitalización">
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Donut data={donutData} centerLabel={dom.btc.toFixed(0) + "%"} centerSub="BTC" />
            <div style={{ flex: 1 }}>
              {donutData.map(x => (
                <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="dot" style={{ background: x.color }} /><span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{x.label}</span>
                  <span className="num" style={{ fontWeight: 600 }}>{x.value.toFixed(1)}%</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}><span className="muted tiny">Cap. total</span><span className="num tiny" style={{ fontWeight: 600 }}>${(capTotal / 1e12).toFixed(2)}T</span></div>
            </div>
          </div>
        </Card>

        <Card title="Mapa de liquidaciones" sub={`${cAsset} · longs (izq) vs shorts (der) por nivel de precio`}>
          <DivergingBars rows={liq.levels} height={300} currentPrice={liq.px} />
          <div className="legend" style={{ marginTop: 12, justifyContent: "center" }}>
            <span className="li"><span className="sw" style={{ background: "#3E7C57" }} />Liq. longs ${(liq.totalLong).toFixed(0)}M</span>
            <span className="li"><span className="sw" style={{ background: "#C0492E" }} />Liq. shorts ${(liq.totalShort).toFixed(0)}M</span>
            <span className="li muted">— precio actual {E.fmt.usd(liq.px)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ===================== ON-CHAIN + ===================== */
function SectionOnchain({ results, palette, k }) {
  const X = window.BambuExtras;
  const [view, setView] = React.useState("btc");
  const hasEth = results.some(r => r.asset.type === "ETH");
  const TabBar = () => (
    <div className="tabs" style={{ marginBottom: 18 }}>
      <button className={"tab" + (view === "btc" ? " active" : "")} onClick={() => setView("btc")}>BTC <span className="tk">STH · LTH</span></button>
      {hasEth && <button className={"tab" + (view === "eth" ? " active" : "")} onClick={() => setView("eth")}>ETH <span className="tk">STH · LTH</span></button>}
    </div>
  );
  if (view === "btc" || view === "eth") {
    const t = view === "btc" ? "BTC" : "ETH";
    return (
      <div className="fade-in">
        <div className="page-head"><h1>On-chain · {t}</h1><p>Mapa de calor de {t} por horizonte: identifica visualmente los momentos de <strong style={{ color: "#0E5A2F" }}>acumulación (verde)</strong> y <strong style={{ color: "#8E2A1A" }}>distribución (rojo)</strong>.</p></div>
        <TabBar />
        <OnchainHeat type={t} palette={palette} k={k} />
      </div>
    );
  }
  const ageColors = ["#C0492E", "#D69A40", "#C9C275", "#9AA0A8", "#7FA8B5", "#5B8FB0", "#3E6FB0", "#2E5A92"];
  const ageData = X.cohortsByAge.map((c, i) => ({ label: c.band, value: c.pct, color: ageColors[i] }));
  const sth = X.cohortsByAge.filter(c => c.sth).reduce((s, c) => s + c.pct, 0);
  const lth = 100 - sth;
  const flows = X.flowSeries("BTC");
  const wh = X.whales;
  const sc = X.stablecoins;
  const scColors = ["#3E7C57", "#3E6FB0", "#D69A40", "#9AA0A8"];

  return (
    <div className="fade-in">
      <div className="page-head"><h1>On-chain ampliado</h1><p>Cohortes de holders, flujos de exchanges y stablecoins, y comportamiento de ballenas. {SAMPLE_NOTE}</p></div>
      <TabBar />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <Card title="Supply por antigüedad" sub="Reparto de oferta según cuándo se movió por última vez">
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Donut data={ageData} centerLabel={lth + "%"} centerSub="LTH (>155d)" />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <span className="pill sig-buy2" style={{ flex: 1, justifyContent: "center" }}>LTH {lth}%</span>
                <span className="pill sig-neut" style={{ flex: 1, justifyContent: "center" }}>STH {sth}%</span>
              </div>
              {ageData.map(a => (
                <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                  <span className="dot" style={{ background: a.color }} /><span style={{ flex: 1, fontSize: 12 }}>{a.label}</span><span className="num tiny" style={{ fontWeight: 600 }}>{a.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Distribución por tamaño de wallet" sub="% de oferta en manos de cada cohorte">
          <div style={{ padding: "6px 0" }}>
            {X.cohortsByWallet.map((c, i) => (
              <BarRow key={c.band} label={c.band} value={c.pct} max={30} color={ageColors[i + 1] || "#3E7C57"} right={c.pct + "%"} />
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>Las ballenas (1k–10k BTC) concentran la mayor porción — vigilar sus movimientos como señal anticipada.</div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 16, alignItems: "start" }}>
        <Card title="Flujo neto de exchanges" sub="Negativo = salida a cold storage (acumulación) · BTC · 90d">
          <LineChart data={flows.map(f => ({ x: f.label, y: f.netflow }))} height={180} baseline={0} color="#3E7C57" yFmt={v => (v / 1000).toFixed(0) + "k"} />
        </Card>
        <Card title="Stablecoins · pólvora seca" sub="Capital listo para entrar">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut data={sc.list.map((s, i) => ({ label: s.name, value: s.capB, color: scColors[i] }))} size={150} centerLabel={"$" + sc.totalB + "B"} centerSub="total" />
            <div style={{ flex: 1 }}>
              {sc.list.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="dot" style={{ background: scColors[i] }} /><span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                  <span className="num tiny">${s.capB}B</span>
                  <span className="num tiny" style={{ width: 44, textAlign: "right", color: s.ch >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(s.ch)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Actividad de ballenas" sub="Direcciones de acumulación y grandes transacciones · BTC" style={{ marginTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
          <DeltaStat lab="Direcciones acumuladoras" val={E.fmt.num(wh.accumAddrCount, 0)} delta={wh.accumChange30 / 100} sub="30d" />
          <DeltaStat lab="Tx grandes (>$1M)" val={E.fmt.num(wh.largeTxCount, 0)} delta={wh.largeTxChange / 100} sub="7d" />
          <DeltaStat lab="Posición neta ballenas" val={E.fmt.num(wh.netPositionBTC, 0) + " BTC"} delta={wh.netPositionChange / 100} sub="30d" />
          <div className="card kpi"><div className="lab">Exchange Whale Ratio</div><div className="num val">{wh.exchangeWhaleRatio.toFixed(2)}</div><div className="meta muted">&gt;0.85 = riesgo venta</div></div>
        </div>
        <LineChart data={wh.series.map(s => ({ x: s.label, y: s.net }))} height={150} color="#3E7C57" fill yFmt={v => (v / 1000).toFixed(0) + "k"} />
      </Card>
    </div>
  );
}

/* ===================== MACRO & SENTIMIENTO ===================== */
/* ---------- conclusión decisoria: macro + sentimiento + estructura ---------- */
function macroVerdict(structTemp, s, cal) {
  const nearHigh = cal.filter(e => e.impact === "alto" && e.days <= 7);
  const next = cal.find(e => e.days >= 0) || cal[0];
  /* el posicionamiento apalancado ya no se finge: sin funding ni opciones
     conectados, la lectura de multitud se apoya en lo que sí se mide */
  const crowdedLong = s.social > 68;
  const fearful = s.social < 40;
  const cheap = structTemp < 45, expensive = structTemp > 58;
  let stance, action, temp, sesgo;
  if (nearHigh.length) {
    stance = "Gestionar el riesgo de evento";
    action = `Hay ${nearHigh.length} catalizador${nearHigh.length > 1 ? "es" : ""} de alto impacto en ≤7 días (empezando por ${nearHigh[0].event}). Baja el apalancamiento y evita abrir posiciones grandes nuevas hasta que pase la volatilidad.`;
    temp = 64; sesgo = "Volatilidad elevada a corto plazo";
  } else if (cheap && fearful) {
    stance = "El miedo juega a tu favor";
    action = "Sentimiento deprimido sobre una estructura barata: entorno contrarian favorable para acumular de forma escalonada mientras la mayoría duda.";
    temp = 20; sesgo = "Sesgo de acumulación";
  } else if (expensive && crowdedLong) {
    stance = "Euforia: proteger ganancias";
    action = "Posicionamiento sobrecalentado (funding alto, sesgo call, social elevado) sobre una estructura cara: momento de cubrir o tomar ganancias, no de perseguir el precio.";
    temp = 86; sesgo = "Sesgo de distribución";
  } else if (crowdedLong) {
    stance = "Posicionamiento cargado al largo";
    action = "El mercado está mayoritariamente largo y pagando funding: vulnerable a sacudidas. Mantén exposición pero ajusta stops y evita añadir apalancamiento.";
    temp = 60; sesgo = "Riesgo de long-squeeze";
  } else {
    stance = "Sin sesgo extremo";
    action = "Macro tranquilo y sentimiento neutral: opera con el plan del modelo y no sobrerreacciones al ruido de corto plazo.";
    temp = 50; sesgo = "Neutral";
  }
  return { stance, action, temp, sesgo, nearHigh, next, crowdedLong, fearful };
}

function SectionMacro({ results, palette }) {
  const X = window.BambuExtras;
  const cal = X.calendar();
  const s = X.sentiment;
  const impactColor = { alto: "#C0492E", medio: "#D69A40", bajo: "#9AA0A8" };
  const socialCol = E.tempColor(s.social, palette);          // relleno
  const socialInk = E.inkColor(socialCol, 3);                 // tinta de titular
  const socialInkSm = E.inkColor(socialCol, 4.5, "#F2F4F5");  // tinta sobre la insignia

  /* La estructura se mide en la escala publicada: cada horizonte contra su propia
   distribución y se promedian los ranks, igual que el termómetro y marketVerdict.
   Con la temperatura cruda la conclusión salía invertida ("barato" a 50 crudo
   cuando el mercado está en 62 de 100). */
  const structTemp = (results && results.length && window.BambuHistory && window.BambuHistory.zoneOf)
    ? results.reduce((acc, r) => acc + (window.BambuHistory.zoneOf(r.sth.temp, r.asset.type, "sth", 27).rank + window.BambuHistory.zoneOf(r.lth.temp, r.asset.type, "lth", 27).rank) / 2, 0) / results.length
    : ((results && results.length) ? marketTemp(results) : 50);
  const mv = macroVerdict(structTemp, s, cal);
  const mvCol = E.tempColor(mv.temp, palette);       // relleno del borde
  const mvInk = E.inkColor(mvCol, 3);                // tinta del titular
  const mvInkSm = E.inkColor(mvCol, 4.5);            // tinta de apoyo
  const reasons = [
    mv.next ? `Próximo catalizador: ${mv.next.event} en ${mv.next.days}d (impacto ${mv.next.impact}).` : null,
    `Sentimiento agregado ${s.social} · ${s.socialLabel}.`,
    s.dispersion == null ? null
      : `Dispersión entre los cuatro percentiles: ${s.dispersion} puntos (${s.dispersion <= 20 ? "coinciden" : s.dispersion <= 40 ? "acuerdo parcial" : "se contradicen"}).`,
    `Estructura on-chain ${structTemp.toFixed(0)} de 100 → ${structTemp < 40 ? "barato frente a su historial" : structTemp > 60 ? "caro frente a su historial" : "en su rango habitual"}.`,
  ].filter(Boolean);

  return (
    <div className="fade-in">
      <div className="page-head"><h1>Macro &amp; sentimiento</h1><p>Eventos de mercado próximos y termómetro de sentimiento agregado, con una <strong>conclusión accionable</strong> que cruza el riesgo macro, el posicionamiento y la estructura. {SAMPLE_NOTE}</p></div>

      {/* conclusión decisoria */}
      <div className="card" style={{ marginBottom: 16, borderLeft: `6px solid ${mvCol}`, padding: 0, overflow: "hidden" }}>
        <div className="grid" style={{ gridTemplateColumns: "1.7fr 1.3fr", gap: 0 }}>
          <div style={{ padding: "18px 22px" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".14em" }}>Conclusión · qué hacer con esto</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", color: mvInk, lineHeight: 1.1, marginTop: 6 }}>{mv.stance}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 7, color: "var(--ink-2)", lineHeight: 1.5 }}>{mv.action}</div>
            <div style={{ marginTop: 12 }}>
              <span className="badge" style={{ background: mixSoft(mvCol), color: mvInkSm, fontWeight: 700, letterSpacing: ".04em" }}>{mv.sesgo}</span>
            </div>
          </div>
          <div style={{ padding: "16px 22px", borderLeft: "1px solid var(--border)" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 }}>En qué se apoya</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {reasons.map((r, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ink-2)", display: "flex", gap: 6 }}><span style={{ color: mvInkSm, fontWeight: 700 }}>›</span>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
        <Card title="Calendario económico" sub="Próximos catalizadores macro y cripto" pad={false}>
          <table className="tbl">
            <thead><tr><th>En</th><th>Fecha</th><th>Evento</th><th className="c">Impacto</th><th className="c">Tipo</th></tr></thead>
            <tbody>
              {cal.map((e, i) => (
                <tr key={i}>
                  <td className="num" style={{ fontWeight: 600, color: e.days <= 7 ? "var(--brand)" : "var(--ink)" }}>{e.days}d</td>
                  <td className="tiny" style={{ whiteSpace: "nowrap" }}>{window.BambuCycle.fmtES(e.date)}</td>
                  <td style={{ fontWeight: 500 }}>{e.event}</td>
                  <td className="c"><span className="badge" style={{ background: mixSoft(impactColor[e.impact]), color: impactColor[e.impact] }}>{e.impact}</span></td>
                  <td className="c tiny muted">{e.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={<>Sentimiento agregado <HelpDot term="Qué mide el sentimiento" def="La cifra grande resume la temperatura del modelo de BTC: 55% del corto plazo y 45% del ciclo. Los cuatro componentes de abajo son métricas reales y distintas, y cada uno es el percentil de esa métrica sobre toda su serie: 70 significa que solo el 30% de los días del histórico tuvo un valor más alto. La escala no la elige nadie, la fija el propio dato. Por eso pueden discrepar entre sí, y esa discrepancia es la información útil: cuando las cuatro apuntan a lo mismo, la lectura es más fiable; cuando se abren, el mercado está en transición." /></>} sub="Cuatro percentiles independientes sobre datos on-chain de BTC" pad={false}>
          {/* cifra y barra, sin el hueco muerto del semicírculo */}
          <div style={{ padding: "16px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div className="num" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: socialInk, letterSpacing: "-.02em" }}>{s.social}<span style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-3)" }}> /100</span></div>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <span className="badge" style={{ background: mixSoft(socialCol), color: socialInkSm, fontWeight: 700 }}>{s.socialLabel}</span>
              </div>
            </div>
            <div style={{ position: "relative", height: 12, borderRadius: 6, marginTop: 12, overflow: "hidden",
                          background: `linear-gradient(90deg, ${(DD.PALETTES[palette] || DD.PALETTES.sobria).stops.map(st => `${st[1]} ${st[0]}%`).join(", ")})` }}>
              <div style={{ position: "absolute", left: s.social + "%", top: -2, transform: "translateX(-50%)", width: 3, height: 16, background: "var(--ink)", borderRadius: 2 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span className="tiny muted">0 · miedo extremo</span>
              <span className="tiny muted">100 · euforia</span>
            </div>
          </div>

          {/* componentes: cuatro métricas reales, cada una con su valor de origen */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 18px" }}>
            {s.sources.map(src => {
              if (src.value == null) return (
                <div key={src.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: .6 }}>
                  <span style={{ flex: 1, minWidth: 118, fontSize: 12.5, fontWeight: 500 }}>{src.name}</span>
                  <span className="tiny muted" style={{ fontStyle: "italic" }}>sin dato</span>
                </div>
              );
              const col = E.tempColor(src.value, palette);
              const ink = E.inkColor(col, 4.5);
              const sesgo = src.value >= 58 ? "empuja al alza" : src.value <= 42 ? "empuja a la baja" : "neutral";
              return (
                <div key={src.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span style={{ flex: 1, minWidth: 118, fontSize: 12.5, fontWeight: 500 }}>{src.name}
                    {src.raw != null && <span className="tiny muted num"> · {src.raw.toFixed(src.dec)}</span>}</span>
                  <div style={{ flex: 1.1, minWidth: 70, height: 8, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: src.value + "%", height: "100%", background: col }} />
                  </div>
                  <span className="num" style={{ width: 26, textAlign: "right", fontSize: 13, fontWeight: 700, color: ink }}>{src.value}</span>
                  <span className="tiny muted" style={{ width: 92, textAlign: "right" }}>{sesgo}</span>
                </div>
              );
            })}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid var(--border)" }}>
            <div style={{ padding: "11px 18px" }}>
              <div className="tiny muted">Dispersión entre percentiles</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 17 }}>{s.dispersion == null ? "—" : s.dispersion + " pts"}</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>{s.dispersion == null ? "sin base" : s.dispersion <= 20 ? "las cuatro coinciden" : s.dispersion <= 40 ? "acuerdo parcial" : "se contradicen · mercado en transición"}</div>
            </div>
            <div style={{ padding: "11px 18px", borderLeft: "1px solid var(--border)" }}>
              <div className="tiny muted">Corto · ciclo</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 17 }}>{s.sthTemp == null ? "—" : s.sthTemp.toFixed(0)} · {s.lthTemp == null ? "—" : s.lthTemp.toFixed(0)}</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>de dónde sale la cifra grande</div>
            </div>
          </div>

          <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
            <div className="tiny" style={{ lineHeight: 1.5, color: "var(--ink-2)" }}>Cada componente es el <b>percentil</b> de su propia serie completa de BTC{s.sources[0] && s.sources[0].nHist ? ` (${s.sources[0].nHist} días)` : ""}: la escala la fija el histórico del dato, no un corte elegido a mano. Sin conectar: {s.sinConectar.join(" · ")} —no se estiman desde la cadena, así que no entran en la cifra.</div>
          </div>

          {/* la conclusión: sentimiento contra cadena */}
          <div style={{ padding: "13px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2, #F2F6F2)" }}>
            <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, color: E.inkColor(socialCol, 4.5, "#FAFBF8"), marginBottom: 5 }}>Qué implica</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
              {(() => {
                const brecha = s.social - structTemp;
                const coincide = Math.abs(brecha) < 12;
                /* las dos cifras miden lo mismo con reglas distintas: la de arriba es
                   la temperatura cruda de hoy, structTemp es su percentil frente al
                   histórico de los dos activos. Cuando se separan, el valor absoluto
                   y el valor relativo discrepan, y manda el relativo. */
                if (coincide) return `La temperatura de hoy (${s.social}) y su percentil frente al histórico (${structTemp.toFixed(0)}) coinciden, así que la lectura del día gana fiabilidad: el valor absoluto y el relativo cuentan la misma historia.`;
                if (brecha > 0) return `La temperatura de hoy (${s.social}) va ${nplu(brecha, "punto")} por encima de su percentil histórico (${structTemp.toFixed(0)}): la lectura parece caliente en términos absolutos, pero frente a su propia historia el mercado ha estado más caro muchas veces. Manda el percentil.`;
                return `La temperatura de hoy (${s.social}) va ${nplu(brecha, "punto")} por debajo de su percentil histórico (${structTemp.toFixed(0)}): en términos absolutos la lectura es templada, pero frente a su propia historia el mercado está más arriba de lo que parece. Manda el percentil.`;
              })()}
            </div>
          </div>
        </Card>
      </div>

      {/* eventos ya ocurridos y su efecto real medido */}
      <div style={{ marginTop: 16 }}>
        <Card title={<>Qué pasó con los últimos eventos <HelpDot term="Eventos recientes y su efecto" def="Cada evento macro o cripto ya ocurrido, con el movimiento real del precio de BTC en los 3 días siguientes. Sirve para ver qué tipo de noticia mueve de verdad al mercado en este régimen: si los CPI vienen ayudando y los vencimientos de opciones perjudicando, el próximo de esa clase merece más atención. Ayudó = subió más de 1,5% · Perjudicó = cayó más de 1,5% · Neutral = se movió menos." /></>} sub="Efecto real en BTC a 3 días del evento" pad={false}>
          <table className="tbl">
            <thead><tr><th>Hace</th><th>Fecha</th><th>Evento</th><th className="c">BTC 3d</th><th className="c">Efecto</th><th className="c">Tipo</th></tr></thead>
            <tbody>
              {X.recentEvents().map((e, i) => {
                const col = e.effect === "ayudó" ? "#2F7D5B" : e.effect === "perjudicó" ? "#C0492E" : "#9AA0A8";
                return (
                  <tr key={i}>
                    <td className="num tiny muted" style={{ whiteSpace: "nowrap" }}>{e.days}d</td>
                    <td className="tiny" style={{ whiteSpace: "nowrap" }}>{window.BambuCycle.fmtES(e.date)}</td>
                    <td style={{ fontWeight: 500 }}>{e.event}</td>
                    <td className="c num" style={{ fontWeight: 600, color: col }}>{e.chg == null ? "—" : (e.chg > 0 ? "+" : "") + e.chg.toFixed(1) + "%"}</td>
                    <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col, fontWeight: 600 }}>{e.effect}</span></td>
                    <td className="c tiny muted">{e.type}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="tiny muted" style={{ padding: "10px 14px", lineHeight: 1.5 }}>Cómo leerlo: si una clase de evento viene <b>perjudicando</b> de forma repetida, conviene no aumentar posición justo antes del siguiente de ese tipo; si viene <b>ayudando</b>, el mercado está absorbiendo bien esa noticia. Nada de esto garantiza el próximo resultado.</div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { SectionMercado, SectionOnchain, SectionMacro });
