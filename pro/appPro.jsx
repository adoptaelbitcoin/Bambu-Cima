/* ============================================================
   BAMBU CIMA · Decisión de capital para inversor intermedio
   Reutiliza el motor de Bambu + y responde preguntas concretas:
   cómo repartir capital entre Núcleo (LTH) y Táctica (STH), en BTC y ETH.
   ============================================================ */
const E = window.BambuEngine;
const DD = window.BambuData;
const PAL = "sobria";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const usd = v => E.fmt.usd(v);

function dataDate() {
  const R = window.BambuRealData && window.BambuRealData.BTC;
  const iso = window.BambuDataDate || (R ? R.latestIso : "2026-06-28");
  return new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

/* veredicto llano por temperatura */
function verdictWord(temp) {
  if (temp < 40) return { w: "ACUMULAR", plain: "barato", kind: "acc" };
  if (temp < 60) return { w: "MANTENER", plain: "neutral", kind: "neu" };
  return { w: "REDUCIR", plain: "caro", kind: "dist" };
}

/* modelo de asignación Núcleo (LTH) / Bolsa de oportunidad (STH) */
const PROFILES = {
  conservador: { tac: 0.15, label: "Conservador" },
  equilibrado: { tac: 0.30, label: "Equilibrado" },
  dinamico: { tac: 0.45, label: "Dinámico" },
};
function allocFor(res, profile, total, weight) {
  // weight = % del capital cripto en BTC (resto ETH)
  const tacFrac = PROFILES[profile].tac;
  const out = {};
  res.forEach(r => {
    const w = (r.asset.type === "BTC" ? weight : 100 - weight) / 100;
    const lthT = r.lth.temp, sthT = r.sth.temp, price = r.vals.price;
    const coreExpo = clamp(100 - lthT * 0.55, 45, 100) / 100;   // núcleo: expuesto casi siempre, baja en euforia
    const tacExpo = clamp(108 - sthT * 1.18, 0, 100) / 100;     // táctica: fuera en caliente, dentro en frío
    const coreCap = total * (1 - tacFrac) * w;
    const tacCap = total * tacFrac * w;
    out[r.asset.type] = {
      r, price,
      coreCap, tacCap,
      coreInv: coreCap * coreExpo, coreCash: coreCap * (1 - coreExpo), coreExpo,
      tacInv: tacCap * tacExpo, tacCash: tacCap * (1 - tacExpo), tacExpo,
      coreV: verdictWord(lthT), tacV: verdictWord(sthT),
      lthT, sthT,
    };
  });
  const coreTot = Object.values(out).reduce((a, x) => a + x.coreCap, 0);
  const tacTot = Object.values(out).reduce((a, x) => a + x.tacCap, 0);
  const investedTot = Object.values(out).reduce((a, x) => a + x.coreInv + x.tacInv, 0);
  return { out, coreTot, tacTot, investedTot, cashTot: total - investedTot };
}

/* ---------- primitivas UI ---------- */
function palGrad() {
  const stops = (DD.PALETTES[PAL] || DD.PALETTES.sobria).stops;
  return "linear-gradient(90deg," + stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
}
function TempBar({ temp, height = 10 }) {
  return (
    <div style={{ position: "relative", height, borderRadius: height, background: palGrad() }}>
      <div style={{ position: "absolute", left: `${temp}%`, top: -3, width: 4, height: height + 6, background: "#18211C", borderRadius: 3, transform: "translateX(-50%)", boxShadow: "0 0 0 2px #fff" }} />
    </div>
  );
}
function Donut({ core, tac }) {
  const tot = core + tac || 1, cFrac = core / tot;
  const R = 52, C = 2 * Math.PI * R, seg = C * cFrac;
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={R} fill="none" stroke="#B58A2E" strokeWidth="20" />
      <circle cx="65" cy="65" r={R} fill="none" stroke="#3E7C57" strokeWidth="20" strokeDasharray={`${seg} ${C - seg}`} transform="rotate(-90 65 65)" />
      <text x="65" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="#18211C" fontFamily="var(--sans)">{Math.round(cFrac * 100)}%</text>
      <text x="65" y="76" textAnchor="middle" fontSize="10" fill="#586259" fontFamily="var(--sans)">núcleo</text>
    </svg>
  );
}
const kindCol = { acc: "#2F6244", neu: "#8A9188", dist: "#B0402A" };
const kindBg = { acc: "var(--brand-soft)", neu: "var(--surface-3)", dist: "#FBEEE9" };

/* chip de score (positivo = compra/frío, negativo = venta/caliente) */
function ScoreChip({ score }) {
  if (score == null || isNaN(score)) return <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>—</span>;
  const col = E.tempColor(clamp(50 - score * 25, 4, 96), PAL);
  return <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: col, background: E.mix(col, "#FFFFFF", .85), border: `1px solid ${E.mix(col, "#FFFFFF", .6)}`, borderRadius: 6, padding: "2px 7px" }}>{E.fmt.signed(score)}</span>;
}

/* desglose completo de un horizonte: composite + grupos + cada métrica con su valor y score */
function MetricBreakdown({ hr, label }) {
  const col = E.tempColor(hr.temp, PAL);
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 12, padding: "14px 15px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span className="num" style={{ fontSize: 12, color: "var(--ink-2)" }}>Convicción {E.fmt.signed(hr.composite)}</span>
        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: col }}>{Math.round(hr.temp)}°</span>
      </div>
      <div style={{ marginBottom: 10 }}><TempBar temp={hr.temp} height={7} /></div>
      {hr.groups.map(g => (
        <div key={g.id} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{g.name}</span>
            <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{(g.weight * 100).toFixed(0)}%</span>
            <span style={{ flex: 1 }} />
            <ScoreChip score={g.sectionScore} />
          </div>
          {g.metrics.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "var(--ink-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.m.label}</span>
              <span className="num" style={{ color: "var(--ink)", fontWeight: 600 }}>{c.value == null || isNaN(c.value) ? "—" : E.fmt.num(c.value, 2)}{c.m.unit ? " " + c.m.unit : ""}</span>
              {c.m.noscore ? <span style={{ fontSize: 10.5, color: "var(--ink-3)", width: 44, textAlign: "right" }}>ref</span> : <span style={{ width: 44, textAlign: "right" }}><ScoreChip score={c.score} /></span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- iconos ---------- */
const PICONS = {
  resumen: "M3 13h4l2 6 4-14 2 8h6", plan: "M3 7h18v12H3zM3 11h18M8 15h4",
  dca: "M12 3v4M12 17v4M5 12h14M8 8l-3 4 3 4M16 8l3 4-3 4",
  heatmap: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", macro: "M12 3v18M5 8l7-5 7 5M5 12h14",
  ciclo: "M21 12a9 9 0 1 1-3-6.7M21 4v4h-4", onchain: "M4 19V5m0 14h16M8 15l3-4 3 2 4-6",
  backtest: "M4 4v16h16M8 14l3-4 3 3 4-6", reporte: "M7 3h10l3 3v15H7zM14 3v4h4M10 13h6M10 17h6",
  salida: "M14 4h5v16h-5M10 8l4 4-4 4M14 12H3",
  guia: "M12 7a3 3 0 1 1 2 5c-1 .6-2 1-2 2M12 18h.01",
};
function PIcon({ id }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={PICONS[id] || PICONS.plan} /></svg>; }

/* ---------- App ---------- */
function App() {
  const assets = React.useMemo(() => DD.freshAssets(), []);
  const results = React.useMemo(() => assets.map(a => E.computeAsset(a, { k: 27 })), [assets]);
  const regime = React.useMemo(() => E.detectRegime((assets.find(a => a.type === "BTC") || assets[0]).values), [assets]);
  const [page, setPage] = React.useState(() => localStorage.getItem("bpro_page") || "resumen");
  const [navOpen, setNavOpen] = React.useState(false);
  const [total, setTotal] = React.useState(() => +(localStorage.getItem("bpro_total") || 100000));
  const [profile, setProfile] = React.useState(() => localStorage.getItem("bpro_profile") || "equilibrado");
  const [weight, setWeight] = React.useState(() => +(localStorage.getItem("bpro_weight") || 70));
  const [range, setRange] = React.useState(1460);
  React.useEffect(() => { localStorage.setItem("bpro_page", page); }, [page]);
  React.useEffect(() => { localStorage.setItem("bpro_total", total); }, [total]);
  React.useEffect(() => { localStorage.setItem("bpro_profile", profile); }, [profile]);
  React.useEffect(() => { localStorage.setItem("bpro_weight", weight); }, [weight]);

  const alloc = React.useMemo(() => allocFor(results, profile, total, weight), [results, profile, total, weight]);
  const [holdings, setHoldings] = React.useState(() => {
    try { const s = localStorage.getItem("bpro_holdings"); if (s) return JSON.parse(s); } catch (e) {}
    let h = {}; try { const e = JSON.parse(localStorage.getItem("bambus_ledger_v1") || "[]"); e.forEach(x => { h[x.asset] = (h[x.asset] || 0) + (x.side === "buy" ? x.units : -x.units); }); } catch (e) {}
    return { BTC: +(h.BTC || 0).toFixed(4), ETH: +(h.ETH || 0).toFixed(4) };
  });
  React.useEffect(() => { try { localStorage.setItem("bpro_holdings", JSON.stringify(holdings)); } catch (e) {} }, [holdings]);
  const date = dataDate();
  const btc = results.find(r => r.asset.type === "BTC"), eth = results.find(r => r.asset.type === "ETH");

  const NAV = [
    { label: "Empieza aquí", items: [
      { id: "resumen", label: "Resumen" },
    ]},
    { label: "El mercado hoy", items: [
      { id: "heatmap", label: "Heatmap de zonas" },
      { id: "macro", label: "Macro & sentimiento" },
    ]},
    { label: "El ciclo", items: [
      { id: "ciclo", label: "Ciclo Halving+" },
    ]},
    { label: "Los datos", items: [
      { id: "onchain", label: "On-chain+" },
    ]},
    { label: "Valida y decide", items: [
      { id: "backtest", label: "Backtest & Stats" },
      { id: "reporte", label: "Reporte 360" },
    ]},
    { label: "Tu estructura", items: [
      { id: "plan", label: "DCA inteligente" },
      { id: "salida", label: "Plan de salida" },
    ]},
    { label: "Ayuda", items: [
      { id: "guia", label: "Cómo usar Bambu" },
    ]},
  ];
  const TITLES = {
    resumen: ["Resumen ejecutivo", "Tu punto de partida · la lectura de hoy"],
    plan: ["DCA inteligente", "Tus aportes y tu capital estructurados con la regla probada del backtest"],
    salida: ["Plan de salida", "Decide hoy, con la cabeza fría, cómo tomarás ganancias"],
    heatmap: ["Heatmap de zonas", "Mapa térmico acumulación → distribución"],
    macro: ["Macro & sentimiento", "El contexto general y su lectura concluyente"],
    ciclo: ["Ciclo Halving+", "Dónde estás en el ciclo y qué esperar"],
    onchain: ["On-chain+", "Cohortes, flujos y ballenas en detalle"],
    backtest: ["Backtest & Stats", "Qué tan fiable ha sido el modelo"],
    reporte: ["Reporte 360", "Tu informe completo, semanal y on-chain"],
    guia: ["Cómo usar Bambu", "Guía paso a paso"],
  };

  const Sub = ({ children }) => <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 2px 16px", maxWidth: "68ch", lineHeight: 1.55 }}>{children}</p>;
  const fld = { fontFamily: "var(--mono)", fontSize: 15, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)", width: "100%" };
  const seg = on => ({ flex: 1, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13, padding: "8px 6px", borderRadius: 9, border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" });

  /* ---- sleeve panel (núcleo o táctica) dentro de la tarjeta de activo ---- */
  const Sleeve = ({ tag, sub, cap, inv, cash, expo, vw, extra }) => (
    <div style={{ flex: 1, minWidth: 220, background: "var(--surface-3)", borderRadius: 12, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{tag}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: kindCol[vw.kind], background: kindBg[vw.kind], borderRadius: 100, padding: "3px 10px" }}>{vw.w}</span>
      </div>
      <div className="num" style={{ fontSize: 23, fontWeight: 700, marginTop: 8, lineHeight: 1 }}>{usd(inv)}</div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3 }}>invertido de {usd(cap)} · {Math.round(expo * 100)}% expuesto</div>
      <div style={{ margintop: 8, height: 7, borderRadius: 5, background: "var(--border-2)", overflow: "hidden", marginTop: 9 }}>
        <div style={{ width: `${expo * 100}%`, height: "100%", background: kindCol[vw.kind] }} />
      </div>
      <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 7 }}>Reserva en liquidez: {usd(cash)}</div>
      {extra}
    </div>
  );

  const AssetPlan = ({ type }) => {
    const a = alloc.out[type]; if (!a) return null;
    const stop = E.sizing(a.r.sth.signal, regime, a.price).stopUsd;
    return (
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{a.r.asset.name}</span>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{type} · {usd(a.price)}</span>
          <span style={{ flex: 1 }} />
          <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{usd(a.coreCap + a.tacCap)}</span>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Sleeve tag="Núcleo" sub="guardar por años" cap={a.coreCap} inv={a.coreInv} cash={a.coreCash} expo={a.coreExpo} vw={a.coreV} />
          <Sleeve tag="Bolsa de oportunidad" sub="compra barato · asegura caro" cap={a.tacCap} inv={a.tacInv} cash={a.tacCash} expo={a.tacExpo} vw={a.tacV}
            extra={a.tacInv > 1 ? <div className="num" style={{ fontSize: 11.5, color: "#B0402A", marginTop: 5 }}>Red de seguridad: si cae bajo {usd(stop)}, revisa el plan</div> : null} />
        </div>
        {(() => {
          const recInv = a.coreInv + a.tacInv;
          const units = holdings[type] || 0, have = units * a.price, gap = recInv - have;
          const thr = Math.max(50, recInv * 0.05);
          const st = gap > thr ? { w: "Añade", c: "acc", amt: gap } : gap < -thr ? { w: "Reduce", c: "dist", amt: -gap } : { w: "Alineado", c: "neu", amt: 0 };
          const fld2 = { fontFamily: "var(--mono)", fontSize: 14, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)", width: "100%" };
          return (
            <div style={{ marginTop: 12, background: "var(--surface-3)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Tu posición vs. el plan</span>
                <window.HelpS title="Tu posición vs. el plan" text={`Compara lo que YA tienes en ${type} con lo que el plan recomienda tener invertido hoy. Te dice si añadir, reducir o si ya estás alineado. Escribe cuántas unidades tienes (se recuerda en tu dispositivo).`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
                <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)", marginBottom: 4 }}>Tienes ({type})</div><input style={fld2} type="number" value={units || ""} onChange={e => setHoldings(h => ({ ...h, [type]: parseFloat(e.target.value) || 0 }))} placeholder="0.00" /></div>
                <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)" }}>Valor hoy</div><div className="num" style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{usd(have)}</div></div>
                <div><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-3)" }}>El plan pide</div><div className="num" style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: "var(--brand-2)" }}>{usd(recInv)}</div></div>
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: kindBg[st.c], border: `1px solid ${E.mix(kindCol[st.c], "#fff", .55)}`, borderRadius: 10, padding: "11px 14px" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: kindCol[st.c] }}>{st.w === "Alineado" ? "Estás alineado con el plan" : `${st.w} ${usd(st.amt)} en ${type}`}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{st.w === "Añade" ? "vas por debajo del objetivo" : st.w === "Reduce" ? "vas por encima del objetivo" : "sin cambios"}</span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  /* ---- páginas ---- */
  const pagePlan = (
    <div>
      {/* controles */}
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.4fr", gap: 18, alignItems: "start" }}>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Capital a invertir (USD)</label>
            <input style={fld} type="number" value={total} onChange={e => setTotal(Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Perfil de riesgo</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {Object.keys(PROFILES).map(k => <button key={k} onClick={() => setProfile(k)} style={seg(profile === k)}>{PROFILES[k].label}</button>)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>Define cuánto va a la bolsa de oportunidad: {Math.round(PROFILES[profile].tac * 100)}%.</div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Reparto BTC / ETH</label>
              <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>{weight}/{100 - weight}</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={weight} onChange={e => setWeight(+e.target.value)} style={{ width: "100%", marginTop: 10, accentColor: "#3E7C57" }} />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{weight}% en Bitcoin · {100 - weight}% en Ethereum.</div>
          </div>
        </div>
      </div>

      {/* resumen del reparto */}
      <div style={{ background: "linear-gradient(150deg,#16241C,#1E3A2C)", color: "#E7ECE6", borderRadius: 16, padding: "20px 22px", marginBottom: 16, boxShadow: "var(--shadow-lg)", display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <Donut core={alloc.coreTot} tac={alloc.tacTot} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9FC4A9" }}>Tu reparto recomendado hoy</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 10 }}>
            <div><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#3E7C57" }} /><span style={{ fontSize: 13, color: "#C2D2C6" }}>Núcleo · largo plazo</span></div><div className="num" style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 3 }}>{usd(alloc.coreTot)}</div></div>
            <div><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#C9A227" }} /><span style={{ fontSize: 13, color: "#C2D2C6" }}>Bolsa de oportunidad</span></div><div className="num" style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 3 }}>{usd(alloc.tacTot)}</div></div>
          </div>
          <div className="num" style={{ fontSize: 12.5, color: "#A8BCAD", marginTop: 12 }}>Invertido ahora: {usd(alloc.investedTot)} · en liquidez esperando: {usd(alloc.cashTot)}</div>
        </div>
      </div>

      <h2 className="ssec-h">Desglose por activo</h2>
      <Sub>Para cada moneda, cuánto tener en el <b>núcleo</b> (lo que guardas por años) y cuánto en la <b>bolsa de oportunidad</b> (dinero que espera en USD para comprar barato y asegurar en caro). Las etiquetas dicen la acción de hoy; la tabla de abajo justifica cada número.</Sub>
      <AssetPlan type="BTC" />
      <AssetPlan type="ETH" />

      {/* justificación numérica del reparto */}
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", overflow: "hidden", marginTop: 4 }}>
        <div style={{ padding: "14px 18px 6px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>Cómo se calcula cada exposición <window.HelpS title="Cómo se calcula" text="Cada sleeve parte de tu capital y perfil. La exposición (% invertido) sale de la temperatura on-chain: el núcleo baja solo en euforia; la táctica entra en frío y sale en caliente. Temperatura, convicción y señal son las medidas del modelo que justifican el %." /></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr>{["Activo", "Sleeve", "Temp.", "Convicción", "Señal", "Exposición", "USD invertido"].map((h, i) => <th key={i} style={{ textAlign: i > 1 ? "right" : "left", fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600, padding: "8px 12px" }}>{h}</th>)}</tr></thead>
            <tbody>
              {["BTC", "ETH"].map(tk => {
                const a = alloc.out[tk]; if (!a) return null;
                const rows = [
                  ["Núcleo", a.lthT, a.r.lth.composite, a.r.lth.signal, a.coreExpo, a.coreInv],
                  ["Oportunidad", a.sthT, a.r.sth.composite, a.r.sth.signal, a.tacExpo, a.tacInv],
                ];
                return rows.map((row, i) => (
                  <tr key={tk + i}>
                    <td style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", fontWeight: 600 }}>{i === 0 ? tk : ""}</td>
                    <td style={{ padding: "9px 12px", borderTop: "1px solid var(--border)" }}>{row[0]}</td>
                    <td className="num" style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", textAlign: "right", color: E.tempColor(row[1], PAL), fontWeight: 700 }}>{Math.round(row[1])}°</td>
                    <td className="num" style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{E.fmt.signed(row[2])}</td>
                    <td style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", textAlign: "right", fontSize: 11 }}>{(DD.SIGNALS[row[3]] || {}).short || row[3]}</td>
                    <td className="num" style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", textAlign: "right", fontWeight: 700 }}>{Math.round(row[4] * 100)}%</td>
                    <td className="num" style={{ padding: "9px 12px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{usd(row[5])}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.6, marginTop: 10 }}>El núcleo se mantiene casi siempre invertido y solo se reduce en euforia extrema; la bolsa de oportunidad compra en zonas frías y asegura ganancias en zonas calientes. Ajusta capital, perfil y reparto arriba. No es asesoramiento financiero.</div>
    </div>
  );

  /* ---- plan de salida persistente ---- */
  const [exitPlan, setExitPlan] = React.useState(() => {
    try { const s = localStorage.getItem("bpro_exit_v1"); if (s) return JSON.parse(s); } catch (e) {}
    const seed = {};
    [btc, eth].filter(Boolean).forEach(r => { const p = r.vals.price; seed[r.asset.type] = [
      { mult: 1.5, pct: 20 }, { mult: 2.2, pct: 30 }, { mult: 3.0, pct: 30 },
    ].map(x => ({ price: Math.round(p * x.mult), pct: x.pct, done: false })); });
    return seed;
  });
  React.useEffect(() => { try { localStorage.setItem("bpro_exit_v1", JSON.stringify(exitPlan)); } catch (e) {} }, [exitPlan]);

  const pageSalida = (
    <div>
      <Sub>Define hoy, con la cabeza fría, a qué precios venderás parte de tu posición. El plan queda <b>guardado</b> y Bambu lo vigila: cuando el precio alcance un nivel o el ciclo entre en zona de asegurar (más de 75° de largo plazo), aquí lo verás marcado. Vender por tramos evita la trampa de “esperar un poco más”.</Sub>
      {[btc, eth].filter(Boolean).map(r => {
        const tk2 = r.asset.type, p = r.vals.price, lvls = exitPlan[tk2] || [];
        const lthT = r.lth.temp;
        const setL = (i, k, val) => setExitPlan(ep => { const c = { ...ep, [tk2]: ep[tk2].map((x, j) => j === i ? { ...x, [k]: val } : x) }; return c; });
        const totPct = lvls.reduce((a, x) => a + (+x.pct || 0), 0);
        return (
          <div key={tk2} style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{r.asset.name}</span>
              <span className="num" style={{ fontSize: 12, color: "var(--ink-3)" }}>ahora {usd(p)}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: lthT > 75 ? "#B0402A" : "var(--ink-3)", background: lthT > 75 ? "#FBEEE9" : "var(--surface-3)", borderRadius: 100, padding: "3px 10px" }}>{lthT > 75 ? "CICLO EN ZONA DE ASEGURAR" : `ciclo en ${Math.round(lthT)}° · aún no toca`}</span>
            </div>
            {lvls.map((l, i) => {
              const prog = clamp(p / (l.price || 1) * 100, 0, 100);
              const hit = p >= (l.price || Infinity);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--border)" : "none", opacity: l.done ? .55 : 1 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-3)", width: 52 }}>Nivel {i + 1}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: "var(--ink-3)", fontSize: 12 }}>$</span><input type="number" value={l.price || ""} onChange={e => setL(i, "price", parseFloat(e.target.value) || 0)} style={{ width: 86, fontFamily: "var(--mono)", fontSize: 13, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)" }} /></span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><input type="number" value={l.pct || ""} onChange={e => setL(i, "pct", parseFloat(e.target.value) || 0)} style={{ width: 48, fontFamily: "var(--mono)", fontSize: 13, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)" }} /><span style={{ color: "var(--ink-3)", fontSize: 12 }}>% a vender</span></span>
                  <div style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden", minWidth: 60 }}><div style={{ width: `${prog}%`, height: "100%", background: hit ? "#B0402A" : "var(--brand)" }} /></div>
                  <span className="num" style={{ fontSize: 11.5, width: 56, textAlign: "right", color: hit ? "#B0402A" : "var(--ink-3)" }}>{hit ? "ALCANZADO" : Math.round(prog) + "%"}</span>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-2)", cursor: "pointer" }}><input type="checkbox" checked={!!l.done} onChange={e => setL(i, "done", e.target.checked)} style={{ accentColor: "#3E7C57" }} />vendido</label>
                </div>
              );
            })}
            <div style={{ fontSize: 11.5, color: totPct > 100 ? "#B0402A" : "var(--ink-3)", marginTop: 8 }}>Venderás en total el <b>{totPct}%</b> de tu posición{totPct > 100 ? " — supera el 100%, ajusta los niveles" : "; el resto sigue en el núcleo"}.</div>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.6 }}>Regla del modelo: además de tus niveles de precio, empieza a asegurar cuando la lectura de largo plazo supere los 75°, aunque el precio no haya llegado. Tu plan se guarda en este dispositivo. No es asesoramiento financiero.</div>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "plan": return (
        <div>
          {/* 1) el plan de aportes DCA inteligente, con su evidencia del backtest */}
          {window.DcaPlan ? <window.DcaPlan results={results} pro={true} /> : null}
          {/* 2) la estructura de capital, para alinear el patrimonio con la misma regla */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "30px 0 14px" }}>
            <span className="diamond" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>Tu estructura de capital</h2>
            <span style={{ flex: 1 }} />
            <span className="tiny muted">alinea tu patrimonio con la misma regla</span>
          </div>
          {pagePlan}
        </div>
      );
      case "salida": return pageSalida;
      case "resumen": return <SectionResumen results={results} regime={regime} palette={PAL} />;
      case "heatmap": return <SectionHeatmap results={results} regime={regime} palette={PAL} k={27} />;
      case "ciclo": return <SectionCiclo palette={PAL} />;
      case "onchain": return <SectionOnchain results={results} palette={PAL} k={27} />;
      case "macro": return <SectionMacro results={results} palette={PAL} />;
      case "backtest": return (
        <div>
          <SectionBacktest palette={PAL} k={27} assets={assets} />
          {/* diversificación: qué se mueve con BTC y qué no */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "30px 0 0" }}>
            <span className="diamond" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>Diversificación y correlaciones</h2>
            <span style={{ flex: 1 }} />
            <span className="tiny muted">qué protege de verdad tu cartera</span>
          </div>
          {window.CorrBlock ? <window.CorrBlock /> : null}
        </div>
      );
      case "reporte": return <SectionReporte results={results} regime={regime} palette={PAL} />;
      case "guia": return (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Guía de decisión de Bambu Cima, con imágenes reales y explicación de cada sección.</span>
            <span style={{ flex: 1 }} />
            <a href="Como usar Bambu Cima.html" target="_blank" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-2)", textDecoration: "none", border: "1px solid var(--border-2)", borderRadius: 9, padding: "7px 13px", background: "var(--card)" }}>Abrir en pestaña nueva ↗</a>
          </div>
          <div style={{ border: "1px solid var(--border-2)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)", background: "#EDEDE4" }}>
            <iframe src="Como usar Bambu Cima.html" title="Cómo usar Bambu Cima" style={{ display: "block", width: "100%", height: "calc(100vh - 190px)", minHeight: 520, border: "none" }} />
          </div>
        </div>
      );
      default: return pagePlan;
    }
  };

  const mt = (btc.sth.temp * 0.4 + btc.lth.temp * 0.6);
  return (
    <div className={"sapp" + (navOpen ? " nav-open" : "")}>
      <div className="snav-backdrop" onClick={() => setNavOpen(false)} />
      <aside className="ssidebar">
        <div className="sbrand">
          <span className="sbrand-logo"><svg width="19" height="19" viewBox="0 0 32 32" fill="none"><path d="M13 7v18M19 7v18" stroke="#EDE7D2" strokeWidth="2.4" strokeLinecap="round" /><path d="M13 13h6M13 19h6" stroke="#EAD98A" strokeWidth="2.4" strokeLinecap="round" /></svg></span>
          <div>
            <div className="sbrand-name">Bambu<span className="pro-badge">CIMA</span></div>
            <div className="sbrand-sub">Decisión de capital</div>
          </div>
        </div>
        <nav className="snav">
          {NAV.map(g => (
            <React.Fragment key={g.label}>
              <div className="snav-label">{g.label}</div>
              {g.items.map(n => (
                <button key={n.id} className={"snav-item" + (page === n.id ? " active" : "")} onClick={() => { setPage(n.id); setNavOpen(false); }}>
                  <PIcon id={n.id} /> {n.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="snav-foot">Datos reales al {date}<br />Modelo v2.2 · Pedro Iván Avellaneda<br /><span style={{ color: "#566359" }}>No es asesoramiento financiero.</span></div>
      </aside>
      <div className="smain">
        <header className="stopbar">
          <button className="snav-toggle" onClick={() => setNavOpen(o => !o)} aria-label="Menú"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
          <div className="stb-title">{(TITLES[page] || ["Bambu Cima"])[0]}<small>{(TITLES[page] || ["", ""])[1]}</small></div>
          <span style={{ flex: 1 }} />
          <div className="stb-chip stb-hide"><span className="k">Régimen</span><span className="v" style={{ color: "var(--brand)" }}>{regime}</span></div>
          <div className="stb-chip stb-hide"><span className="k">BTC</span><span className="v num">{usd(btc.vals.price)}</span></div>
          {eth && <div className="stb-chip stb-hide"><span className="k">ETH</span><span className="v num">{usd(eth.vals.price)}</span></div>}
        </header>
        <div className="scontent">
          <div className="spage" key={page}>{renderPage()}</div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
