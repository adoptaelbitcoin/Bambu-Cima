/* ============================================================
   BAMBU GO · Decisión On-Chain
   Reutiliza el motor (BambuEngine) y los datos reales de Bambu +.
   Cuenta con gráficas y números por qué HOY es acumulación o
   distribución, y qué pasó en situaciones parecidas.
   ============================================================ */
const E = window.BambuEngine;
const DD = window.BambuData;
const PAL = "sobria";

function dataDate() {
  const R = window.BambuRealData && window.BambuRealData.BTC;
  const iso = window.BambuDataDate || (R ? R.latestIso : "2026-06-28");
  return new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}
/* Temperatura para un inversor de ciclo: el patrimonio (LTH) manda.
   STH solo matiza el timing del aporte (20/80). */
function assetTemp(r) { return r.sth.temp * 0.2 + r.lth.temp * 0.8; }

/* lecturas separadas: aporte (STH · semanas) y patrimonio (LTH · ciclo) */
function aporteRead(r) {
  const t = r.sth.temp;
  if (t < 40) return { w: "APORTA", kind: "acc", txt: "Está barato a semanas vista: buen momento para ejecutar tu aporte." };
  if (t < 62) return { w: "APORTA NORMAL", kind: "neu", txt: "Sin ventaja especial: ejecuta tu aporte con normalidad." };
  return { w: "ESPERA", kind: "dist", txt: "Está caro a corto plazo: guarda el aporte y espera un retroceso." };
}
function patrimonioRead(r) {
  const t = r.lth.temp;
  if (t < 40) return { w: "ACUMULA", kind: "acc", txt: "La estructura de ciclo está barata: etapa de construir posición." };
  if (t < 68) return { w: "MANTÉN", kind: "neu", txt: "Mitad de ciclo: conserva lo que tienes, sin prisa por vender." };
  return { w: "ASEGURA", kind: "dist", txt: "Zona alta del ciclo: ve pasando ganancias a USD por tramos." };
}

function verdictOf(r, regime) {
  const mt = assetTemp(r);
  const zone = E.zoneFor(mt);
  const comp = (50 - mt) / 27;
  const sig = E.signalFor(comp);
  const reg = DD.REGIMES[regime];
  const capPct = DD.BASE_WEIGHT * DD.SIGNALS[sig].long * reg.mult * 100;
  let stance, action, plain, kind;
  if (mt < 20)      { stance = "ACUMULAR";  kind = "acc"; action = "Comprar con convicción"; plain = "El mercado está muy barato frente a su historia on-chain."; }
  else if (mt < 40) { stance = "ACUMULAR";  kind = "acc"; action = "Comprar poco a poco, en tramos"; plain = "El mercado está barato: zona de acumulación."; }
  else if (mt < 60) { stance = "ESPERAR";   kind = "neu"; action = "Mantener y esperar confirmación"; plain = "Ni caro ni barato: sin ventaja estadística clara."; }
  else if (mt < 80) { stance = "REDUCIR";   kind = "dist"; action = "Tomar ganancias, aligerar posición"; plain = "El mercado empieza a estar caro: zona de distribución."; }
  else              { stance = "REDUCIR";   kind = "dist"; action = "Vender / postura defensiva"; plain = "El mercado está muy caro (euforia)."; }
  return { mt, zone, sig, capPct, stance, action, plain, kind, reg };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* evidencia on-chain: cada fila = un dato real + su lugar frente a extremos históricos */
function evidenceOf(r) {
  const v = r.vals, tk = r.asset.ticker, rows = [];
  const fu = E.fmt.usd, f1 = x => x.toFixed(1);

  if (v.price && v.rpLTH) {
    const dist = (v.price / v.rpLTH - 1) * 100;
    rows.push({
      name: "Precio vs. coste real de los holders", metric: "MVRV largo plazo",
      help: "Compara el precio de hoy con el precio medio al que compraron quienes acumulan a largo plazo. Por encima = el mercado paga una prima; por debajo = cotiza con descuento.",
      temp: clamp(50 + dist * 0.5, 4, 96),
      big: (dist >= 0 ? "+" : "") + f1(dist) + "%",
      text: <>El precio de {tk} ({fu(v.price)}) está <b>{dist >= 0 ? `un ${f1(dist)}% por encima` : `un ${f1(Math.abs(dist))}% por debajo`}</b> del precio medio al que compraron quienes acumulan a largo plazo ({fu(v.rpLTH)}). Cuanto más por encima, más caro paga el mercado; por debajo, descuento.</>,
      scaleLo: "−40% (suelo)", scaleHi: "+150% (techo)",
    });
  }
  if (v.mvrvZ != null) {
    const z = v.mvrvZ;
    rows.push({
      name: "MVRV-Z · sobre/infravaloración", metric: "MVRV Z-Score",
      help: "Mide cuánto se aleja el precio de su valor real registrado en la cadena. Por debajo de 0 han estado los suelos históricos; por encima de 5, los techos de euforia.",
      temp: clamp(15 + z * 11, 4, 96), big: f1(z),
      text: <>El <b>MVRV-Z está en {f1(z)}</b>. Mide cuánto se aleja el precio de su valor real registrado en la cadena. Por debajo de <b>0</b> han estado los suelos históricos; por encima de <b>5</b>, los techos de euforia.</>,
      scaleLo: "0 (suelo)", scaleHi: "6+ (techo)",
    });
  }
  if (v.nuplLTH != null) {
    const p = v.nuplLTH * 100;
    rows.push({
      name: "Ganancia latente de los holders", metric: "NUPL largo plazo",
      help: "Cuánta ganancia acumulan los holders de largo plazo sin haber vendido. Cerca de 0% domina el miedo (suele ser suelo); por encima del 75%, la euforia (suele ser techo).",
      temp: clamp(p, 4, 96), big: f1(p) + "%",
      text: <>Los tenedores de largo plazo acumulan una <b>ganancia no realizada del {f1(p)}%</b>. Cerca de <b>0%</b> domina el miedo (suele coincidir con suelos); por encima del <b>75%</b> aparece la euforia (suele coincidir con techos).</>,
      scaleLo: "0% (miedo)", scaleHi: "75%+ (euforia)",
    });
  }
  if (v.lthSopr != null) {
    const s = v.lthSopr;
    rows.push({
      name: "Presión de toma de ganancias", metric: "SOPR largo plazo",
      help: "Indica si las monedas antiguas que se mueven se venden con ganancia o con pérdida. Valores muy altos = toma masiva de ganancias, típica de fases avanzadas del ciclo.",
      temp: clamp(50 + (s - 1) * 25, 4, 96), big: s >= 1 ? "+" + f1((s - 1) * 100) + "%" : "pérdida",
      text: <>Las monedas antiguas que se mueven se venden {s >= 1 ? <>con una <b>ganancia media del {f1((s - 1) * 100)}%</b></> : <><b>en pérdida</b></>} (SOPR {f1(s)}). Valores muy altos = toma masiva de ganancias, típica de fases avanzadas del ciclo.</>,
      scaleLo: "1.0 (equilibrio)", scaleHi: "2.5+ (distribución)",
    });
  }
  if (v.netflow != null) {
    const nf = v.netflow, salen = nf < 0;
    rows.push({
      name: "Flujo neto en exchanges", metric: "Exchange netflow",
      help: "Si entran o salen monedas de los exchanges. Las salidas indican que se guardan en frío (acumulación, menos venta); las entradas suelen preceder a ventas.",
      temp: clamp(50 + nf * 0.004, 4, 96), big: E.fmt.num(nf, 0),
      text: <>En los últimos días <b>{salen ? "salieron" : "entraron"} monedas {salen ? "de" : "a"} los exchanges</b>. Las salidas indican que se mueven a almacenamiento en frío (acumulación, menos presión de venta); las entradas suelen preceder ventas.</>,
      scaleLo: "salidas (alcista)", scaleHi: "entradas (bajista)",
    });
  }
  return rows;
}

/* argumentos por horizonte: 4 drivers reales en lenguaje llano */
function horizonArgs(r, which) {
  const v = r.vals, f1 = x => x.toFixed(1), fu = E.fmt.usd, rows = [];
  if (which === "STH") {
    if (v.price && v.rpSTH) {
      const d = (v.price / v.rpSTH - 1) * 100;
      rows.push({ label: "Precio vs. coste reciente", val: (d >= 0 ? "+" : "") + f1(d) + "%", temp: clamp(50 + d * 1.5, 4, 96),
        note: <>Quienes compraron en las últimas semanas están <b>{d >= 0 ? "en ganancia" : "en pérdida"}</b> (coste medio {fu(v.rpSTH)}). En pérdida = suelen rendirse y marcar suelo local.</> });
    }
    if (v.sthSopr != null) {
      const s = v.sthSopr;
      rows.push({ label: "Venta de manos recientes", val: "SOPR " + f1(s), temp: clamp(50 + (s - 1) * 300, 4, 96),
        note: <>Las monedas jóvenes que se mueven se venden {s >= 1 ? <>con <b>ganancia</b></> : <>con <b>pérdida</b></>}. Por debajo de 1 indica capitulación de corto plazo.</> });
    }
    if (v.rsi1d != null) {
      rows.push({ label: "Momentum diario (RSI)", val: Math.round(v.rsi1d), temp: clamp(v.rsi1d, 4, 96),
        note: <>RSI en {Math.round(v.rsi1d)}: {v.rsi1d < 35 ? <><b>sobreventa</b>, rebote probable</> : v.rsi1d > 65 ? <><b>sobrecompra</b>, riesgo de corrección</> : "momentum neutral"}.</> });
    }
    if (v.funding != null) {
      const fp = v.funding * 100;
      rows.push({ label: "Apalancamiento (funding)", val: (fp >= 0 ? "+" : "") + f1(fp) + "%", temp: clamp(50 + fp * 30, 4, 96),
        note: <>El coste de estar apalancado en largo es <b>{fp >= 0 ? "positivo" : "negativo"}</b>. Muy positivo = exceso de euforia con riesgo de purga.</> });
    }
  } else {
    if (v.mvrvZ != null) {
      rows.push({ label: "MVRV-Z (valoración)", val: f1(v.mvrvZ), temp: clamp(15 + v.mvrvZ * 11, 4, 96),
        note: <>Distancia entre precio y valor real en cadena. Bajo 0 = suelos históricos; sobre 5 = techos.</> });
    }
    if (v.nuplLTH != null) {
      const p = v.nuplLTH * 100;
      rows.push({ label: "Ganancia latente (NUPL)", val: f1(p) + "%", temp: clamp(p, 4, 96),
        note: <>Los holders de largo plazo ganan un <b>{f1(p)}%</b> sin realizar. Cerca de 0 = miedo (suelo); sobre 75% = euforia (techo).</> });
    }
    if (v.lthSup != null) {
      rows.push({ label: "Oferta en manos fuertes", val: f1(v.lthSup) + "%", temp: clamp(90 - v.lthSup, 4, 96),
        note: <>El <b>{f1(v.lthSup)}%</b> de las monedas lleva meses sin moverse. Cuando sube, los pacientes acumulan; cuando cae, distribuyen a nuevos compradores.</> });
    }
    if (v.mayer != null) {
      rows.push({ label: "Precio vs. media 200d", val: "×" + f1(v.mayer), temp: clamp((v.mayer - 0.6) * 55, 4, 96),
        note: <>El precio está <b>{v.mayer >= 1 ? f1(v.mayer) + "×" : f1(v.mayer) + "×"}</b> su media de 200 días. Bajo 1 = históricamente barato; sobre 2.4 = recalentado.</> });
    }
  }
  return rows;
}
function horizonConclusion(temp, which) {
  const plazo = which === "STH" ? "A semanas vista" : "En el horizonte de meses";
  if (temp < 25) return `${plazo}, ${which === "STH" ? "el corto plazo está muy barato: ventaja táctica para entrar." : "la estructura de fondo está en zona de acumulación profunda."}`;
  if (temp < 45) return `${plazo}, hay descuento: se puede ${which === "STH" ? "entrar por tramos" : "acumular con paciencia"}.`;
  if (temp < 60) return `${plazo}, sin ventaja clara: mejor esperar confirmación.`;
  if (temp < 78) return `${plazo}, empieza a estar caro: ${which === "STH" ? "no perseguir el precio" : "conviene ir tomando ganancias"}.`;
  return `${plazo}, hay euforia: ${which === "STH" ? "alto riesgo de corrección brusca." : "zona de distribución, proteger capital."}`;
}

/* ---------- barra de temperatura ---------- */
function palGrad() {
  const stops = (DD.PALETTES[PAL] || DD.PALETTES.sobria).stops;
  return "linear-gradient(90deg," + stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
}
function TempBar({ temp, height = 12 }) {
  return (
    <div style={{ position: "relative", height, borderRadius: height, background: palGrad() }}>
      <div style={{ position: "absolute", left: `${temp}%`, top: -3, width: 5, height: height + 6, background: "#18211C", borderRadius: 3, transform: "translateX(-50%)", boxShadow: "0 0 0 2.5px #fff" }} />
    </div>
  );
}
function MiniScale({ temp, lo, hi }) {
  const col = E.tempColor(temp, PAL);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 7, borderRadius: 7, background: palGrad() }}>
        <div style={{ position: "absolute", left: `${temp}%`, top: -2.5, width: 3.5, height: 12, background: "#18211C", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 1.5px #fff" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{lo}</span>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{hi}</span>
      </div>
    </div>
  );
}
function HeatChip({ temp }) {
  const col = E.tempColor(temp, PAL);
  const lab = temp < 33 ? "Frío" : temp < 55 ? "Templado" : temp < 72 ? "Cálido" : "Caliente";
  return <span className="num" style={{ fontSize: 12, fontWeight: 600, color: col, background: E.mix(col, "#FFFFFF", .84), border: `1px solid ${E.mix(col, "#FFFFFF", .6)}`, borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap" }}>{Math.round(temp)}° · {lab}</span>;
}

/* ---------- aviso por Telegram (opción abierta) ---------- */
function TelegramBox() {
  const [open, setOpen] = React.useState(false);
  const [id, setId] = React.useState(() => { try { return localStorage.getItem("bambus_tg") || ""; } catch (e) { return ""; } });
  const save = v => { setId(v); try { localStorage.setItem("bambus_tg", v); } catch (e) {} };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "12px 20px", borderRadius: 11, border: "1.5px solid var(--border-2)", background: "var(--card)", color: "var(--ink-2)" }}>Recibir aviso por Telegram</button>
      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, width: 300, background: "var(--card)", border: "1px solid var(--border-2)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Aviso semanal por Telegram</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.5 }}>Deja tu usuario y activaremos el envío automático del resumen semanal en cuanto esté disponible.</div>
          <input value={id} onChange={e => save(e.target.value)} placeholder="@tuusuario" style={{ fontFamily: "var(--mono)", fontSize: 13, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border-2)", width: "100%", background: "var(--card)", color: "var(--ink)" }} />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>Próximamente · se guarda en este dispositivo.</div>
        </div>
      )}
    </div>
  );
}

/* ---------- iconos de navegación ---------- */
const SICONS = {
  hoy: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2M21 4v4h-4", dca: "M12 3v4M12 17v4M5 12h14M8 8l-3 4 3 4M16 8l3 4-3 4",
  resumen: "M3 13h4l2 6 4-14 2 8h6", ciclo: "M4 19V5m0 14h16M8 16l3-5 3 3 4-8",
  explorar: "M4 5h16M4 12h16M4 19h9", momentos: "M12 8v4l3 2M21 12a9 9 0 1 1-9-9",
  simulador: "M9 7h6M9 12h6M9 17h4M6 3h12v18H6z", operaciones: "M3 7h18v12H3zM3 11h18M8 15h3",
  backtest: "M4 4v16h16M8 14l3-4 3 3 4-6", guia: "M12 7a3 3 0 1 1 2 5c-1 .6-2 1-2 2M12 18h.01",
};
function SIcon({ id }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={SICONS[id] || SICONS.resumen} /></svg>;
}

/* ---------- app (shell tipo Bambu +) ---------- */
function App() {
  const assets = React.useMemo(() => DD.freshAssets(), []);
  const results = React.useMemo(() => assets.map(a => E.computeAsset(a, { k: 27 })), [assets]);
  const regime = React.useMemo(() => E.detectRegime((assets.find(a => a.type === "BTC") || assets[0]).values), [assets]);
  const LOCK = window.BAMBU_S_LOCK || null;
  const [tk, setTk] = React.useState(() => LOCK || localStorage.getItem("bambus_tk") || "BTC");
  const [range, setRange] = React.useState(() => +(localStorage.getItem("bambus_range") || 1460));
  const [page, setPage] = React.useState(() => localStorage.getItem("bambus_page") || "hoy");
  const [navOpen, setNavOpen] = React.useState(false);
  React.useEffect(() => { if (!LOCK) localStorage.setItem("bambus_tk", tk); }, [tk]);
  React.useEffect(() => { localStorage.setItem("bambus_range", range); }, [range]);
  React.useEffect(() => { localStorage.setItem("bambus_page", page); }, [page]);

  const r = results.find(x => x.asset.type === tk) || results[0];
  const v = verdictOf(r, regime);
  const col = E.tempColor(v.mt, PAL);
  const ev = evidenceOf(r);
  const date = dataDate();
  const prices = React.useMemo(() => { const o = {}; results.forEach(x => o[x.asset.type] = x.vals.price); return o; }, [results]);
  const temps = React.useMemo(() => { const o = {}; results.forEach(x => o[x.asset.type] = assetTemp(x)); return o; }, [results]);
  const sim = window.similarCases(tk, v.sig, v.mt);
  const RANGES = [{ d: 730, l: "2 años" }, { d: 1460, l: "4 años" }, { d: 999999, l: "Máximo" }];

  const NAV = [
    { label: "Esta semana", items: [
      { id: "hoy", label: "¿Qué hago esta semana?" },
    ]},
    { label: "El análisis", items: [
      { id: "resumen", label: "La oportunidad de hoy" },
      { id: "ciclo", label: "Dónde estamos" },
      { id: "explorar", label: "Explora los datos" },
    ]},
    { label: "El contexto", items: [
      { id: "momentos", label: "Momentos parecidos" },
      { id: "simulador", label: "¿Y si invierto hoy?" },
      ...(LOCK ? [] : [{ id: "comparador", label: "BTC vs. ETH" }]),
    ]},
    { label: "Tu plan", items: [
      { id: "dca", label: "Plan de aportes (DCA)" },
      { id: "operaciones", label: "Mi cartera" },
    ]},
    { label: "Validación", items: [
      { id: "backtest", label: "Backtesting" },
    ]},
    { label: "Ayuda", items: [
      { id: "guia", label: "Cómo usar Bambu Go" },
    ]},
  ];
  const iconOf = { comparador: "momentos" };
  const TITLES = {
    hoy: ["¿Qué hago esta semana?", "Tu única decisión semanal · revisa una vez y descansa"],
    dca: ["Plan de aportes (DCA)", "Cómo soltar tu aporte según lo caro o barato que esté"],
    resumen: ["La oportunidad de hoy", `Lectura consolidada del modelo para ${r.asset.ticker}`],
    ciclo: ["Dónde estamos en el ciclo", "Precio coloreado por temperatura + corto vs largo plazo"],
    explorar: ["Explora los datos on-chain", `La historia real de cada métrica de ${r.asset.ticker}`],
    momentos: ["Momentos parecidos", "Qué pasó después en situaciones análogas"],
    comparador: ["BTC vs. ETH", "Cuál está más barata ahora mismo"],
    simulador: ["¿Y si invierto hoy?", "Proyección basada en la historia real"],
    operaciones: ["Mi cartera", "Ganancias y pérdidas de tus inversiones"],
    backtest: ["Backtesting", "Cuánto acierta el modelo en cada horizonte"],
    guia: ["Cómo usar Bambu Go", "Guía rápida de los elementos y cómo decidir"],
  };
  const goldChip = { d: 730 };

  const Sub = ({ children }) => <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 2px 16px", maxWidth: "66ch", lineHeight: 1.55 }}>{children}</p>;
  const RangeBtns = () => (
    <div style={{ display: "flex", gap: 5 }}>
      {RANGES.map(x => { const on = x.d === range; return <button key={x.d} onClick={() => setRange(x.d)} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 9, border: on ? "1px solid var(--brand)" : "1px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" }}>{x.l}</button>; })}
    </div>
  );

  /* ---- páginas ---- */
  const pageVerdict = (
    <div className="fade" key={tk + "v"} style={{ background: "var(--card)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", overflow: "hidden", borderTop: `5px solid ${col}` }}>
      <div style={{ padding: "24px 26px 22px" }}>
        <div style={{ fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-3)" }}>La oportunidad de hoy · {r.asset.ticker}</div>
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-.03em", color: col, lineHeight: 1.02, marginTop: 6 }}>{v.stance}</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{v.action}</div>
        <div style={{ fontSize: 14.5, color: "var(--ink-2)", marginTop: 8 }}>{v.plain}</div>
        <div style={{ marginTop: 20 }}>
          <TempBar temp={v.mt} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: E.tempColor(8, PAL), letterSpacing: ".04em" }}>BARATO · acumular</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: E.tempColor(92, PAL), letterSpacing: ".04em" }}>CARO · reducir</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: "1px solid var(--border)" }}>
        <Answer lab="Temperatura" val={`${Math.round(v.mt)}°`} sub={v.zone.label} col={col} />
        <Answer lab="Fase del ciclo" val={v.zone.phase.split(" ")[0]} sub={v.zone.phase.split(" ").slice(1).join(" ") || "\u00A0"} border />
        <Answer lab="Cuánto invertir" val={`${v.capPct.toFixed(1)}%`} sub="de tu capital" col={col} border />
      </div>
    </div>
  );

  const pageEvidence = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ev.map((e, i) => (
        <div key={i} style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "16px 18px", borderLeft: `4px solid ${E.tempColor(e.temp, PAL)}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14.5, display: "inline-flex", alignItems: "center", gap: 7 }}>{e.name}{e.help && <window.HelpS title={e.name} text={e.help} />}</span>
            <span style={{ flex: 1 }} />
            <span className="num" style={{ fontSize: 18, fontWeight: 700, color: E.tempColor(e.temp, PAL) }}>{e.big}</span>
          </div>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>{e.metric}</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{e.text}</div>
          <MiniScale temp={e.temp} lo={e.scaleLo} hi={e.scaleHi} />
        </div>
      ))}
    </div>
  );

  const pageMomentos = sim.cases.length > 0 ? (
    <div>
      {sim.avg != null && (
        <div style={{ background: v.kind === "dist" ? "#FBEEE9" : "var(--brand-soft)", border: `1px solid ${v.kind === "dist" ? "#EBC9BC" : "#CFE3D3"}`, borderRadius: 14, padding: "16px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>En promedio, los <b>90 días siguientes</b> el precio se movió</div>
          <div className="num" style={{ fontSize: 34, fontWeight: 700, color: sim.avg >= 0 ? "var(--brand-2)" : "#B0402A", lineHeight: 1.1, marginTop: 2 }}>{sim.avg >= 0 ? "+" : ""}{sim.avg.toFixed(0)}%</div>
        </div>
      )}
      <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        {sim.cases.slice(0, 6).map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.evt}</div>
              <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.date.replace(/^\w+\s/, "")} · {E.fmt.usd(c.price)}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: E.tempColor(c.temp, PAL) }}>{Math.round(c.temp)}°</span>
            <span className="num" style={{ fontSize: 16, fontWeight: 700, minWidth: 78, textAlign: "right", color: c.mov >= 0 ? "var(--brand-2)" : "#B0402A" }}>{c.mov >= 0 ? "+" : ""}{c.mov.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, padding: "0 2px" }}>Movimiento del precio en los 90 días posteriores a cada fecha. Rendimientos pasados no garantizan resultados futuros.</div>
    </div>
  ) : <div style={{ color: "var(--ink-3)" }}>Sin casos análogos suficientes.</div>;

  const pageHorizonte = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <HorizonCard r={r} which="STH" lab="Corto plazo" tag="próximas semanas" hr={r.sth} />
      <HorizonCard r={r} which="LTH" lab="Largo plazo" tag="meses / años" hr={r.lth} />
    </div>
  );

  const pageGuia = (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Guía ilustrada, pantalla por pantalla, con imágenes reales de la app.</span>
        <span style={{ flex: 1 }} />
        <a href="Como usar Bambu Go.html" target="_blank" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-2)", textDecoration: "none", border: "1px solid var(--border-2)", borderRadius: 9, padding: "7px 13px", background: "var(--card)" }}>Abrir en pestaña nueva ↗</a>
      </div>
      <div style={{ border: "1px solid var(--border-2)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)", background: "#EDEDE4" }}>
        <iframe src="Como usar Bambu Go.html" title="Cómo usar Bambu Go" style={{ display: "block", width: "100%", height: "calc(100vh - 190px)", minHeight: 520, border: "none" }} />
      </div>
    </div>
  );

  const contextBox = (
    <div style={{ marginTop: 20, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)" }}>Contexto del ciclo</div>
        <span style={{ fontWeight: 700, color: "var(--brand-2)", fontSize: 15 }}>{regime}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>· ajuste de tamaño ×{v.reg.mult.toFixed(2)}</span>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "8px 0 0", lineHeight: 1.55 }}>{v.reg.action}</p>
    </div>
  );

  const dayReads = results.map(rr => ({ rr, dv: verdictOf(rr, regime), ap: aporteRead(rr), pa: patrimonioRead(rr) }));
  const anyAcc = dayReads.some(d => d.ap.kind === "acc" || d.pa.kind === "acc");
  const anyDist = dayReads.some(d => d.pa.kind === "dist");
  const hoyTone = anyDist ? "dist" : anyAcc ? "acc" : "neu";
  const hoyCol = hoyTone === "acc" ? E.tempColor(24, PAL) : hoyTone === "dist" ? E.tempColor(86, PAL) : "#7C877E";
  const hoyHead = hoyTone === "dist" ? "Semana de asegurar ganancias" : anyAcc ? "Buena semana para aportar" : "Esta semana no hagas nada";
  const hoySub = hoyTone === "dist" ? "El ciclo está en zona alta. Si tienes ganancias, pasa una parte a USD por tramos, sin prisa." : anyAcc ? "Hay descuento. Ejecuta tu aporte del periodo; el resto de la semana, desconecta." : "Todo en orden. Mantén tu plan y vuelve el próximo lunes: mirar cada día no mejora un plan de años.";
  const pageHoy = (
    <div>
      <div className="fade" style={{ background: "var(--card)", borderRadius: 18, boxShadow: "var(--shadow-lg)", borderTop: `6px solid ${hoyCol}`, padding: "30px 28px" }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-3)" }}>Esta semana · {date}</div>
        <div style={{ fontSize: "clamp(30px,5vw,44px)", fontWeight: 700, letterSpacing: "-.02em", color: hoyCol, lineHeight: 1.05, marginTop: 6 }}>{hoyHead}</div>
        <div style={{ fontSize: 16, color: "var(--ink-2)", marginTop: 8, maxWidth: "52ch" }}>{hoySub}</div>
      </div>
      <div id="hoy-card" style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "20px 22px", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--brand)", display: "grid", placeItems: "center" }}><svg width="15" height="15" viewBox="0 0 32 32" fill="none"><path d="M13 7v18M19 7v18" stroke="#EDE7D2" strokeWidth="2.6" strokeLinecap="round" /><path d="M13 13h6M13 19h6" stroke="#EAD98A" strokeWidth="2.6" strokeLinecap="round" /></svg></span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Tu resumen de la semana</span>
          <span style={{ flex: 1 }} />
          <span className="num" style={{ fontSize: 12, color: "var(--ink-3)" }}>{date}</span>
        </div>
        {dayReads.map(({ rr, ap, pa }, i) => {
          const pill = (read) => {
            const c = read.kind === "acc" ? E.tempColor(24, PAL) : read.kind === "dist" ? E.tempColor(86, PAL) : "#7C877E";
            return <span style={{ fontSize: 11.5, fontWeight: 700, color: c, background: E.mix(c, "#fff", .85), borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap" }}>{read.w}</span>;
          };
          return (
            <div key={i} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{rr.asset.name}</span>
                <span className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{E.fmt.usd(rr.vals.price)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Tu próximo aporte</span>{pill(ap)}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>{ap.txt}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Tu patrimonio</span>{pill(pa)}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>{pa.txt}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}><b>Esta semana:</b> {hoyHead.toLowerCase()}. {hoySub}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "12px 20px", borderRadius: 11, border: "none", background: "var(--brand)", color: "#fff" }}>Descargar / imprimir tarjeta</button>
        <TelegramBox />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 12, lineHeight: 1.6 }}>Una revisión a la semana basta: la lectura de tu patrimonio se mueve a ritmo de meses, no de días. Si dice que no hagas nada, no lo hagas — el largo plazo premia la paciencia. No es asesoramiento financiero.</div>
    </div>
  );

  const renderPage = () => {
    switch (page) {
      case "hoy": return pageHoy;
      case "dca": return <><Sub>Fija tu aporte periódico y Bambu te dice cómo soltarlo según lo caro o barato que esté: en zonas baratas, más rápido; en caras, más despacio y asegurando ganancias.</Sub><window.DcaPlan results={results} /></>;
      case "resumen": return <><Sub>La conclusión del modelo para {r.asset.ticker} hoy, con la exposición sugerida y los cinco datos on-chain que la justifican. Toca el «?» de cada uno.</Sub>{pageVerdict}<h2 className="ssec-h" style={{ marginTop: 26 }}>Por qué salió esta lectura</h2><Sub>Cinco datos reales de la cadena de {r.asset.ticker}. Cada barra sitúa el dato de hoy entre su suelo y su techo históricos.</Sub>{pageEvidence}</>;
      case "ciclo": return <><div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}><Sub>El precio de {r.asset.ticker} coloreado por su temperatura on-chain: azul = suelo, rojo = techo. El punto es hoy.</Sub><span style={{ flex: 1 }} /><RangeBtns /></div><div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 18px 14px" }}><window.PriceHeatChart type={tk} days={range} /></div><h2 className="ssec-h" style={{ marginTop: 26 }}>Corto vs. largo plazo</h2><Sub>El corto plazo (STH) es timing; el largo plazo (LTH) es la estructura de fondo, que manda.</Sub>{pageHorizonte}{contextBox}</>;
      case "explorar": return <><Sub>La gráfica del precio arriba y, debajo, el indicador que elijas para compararlo. Toca el «?» de cada indicador para entenderlo.</Sub><window.MetricExplorer type={tk} /></>;
      case "momentos": return <><Sub>Momentos del pasado en que {r.asset.ticker} tuvo una lectura como la de hoy ({v.stance === "ESPERAR" ? "temperatura similar" : v.sig.toLowerCase()}), y cuánto se movió el precio los 90 días siguientes. Historia real, no una promesa.</Sub>{pageMomentos}</>;
      case "comparador": return <><Sub>Cuál de las dos está más barata hoy y cómo se movió la temperatura de cada una.</Sub><window.Comparator results={results} verdictOf={verdictOf} regime={regime} days={range} /></>;
      case "simulador": return <><Sub>Escribe cuánto invertirías y mueve el horizonte. Bambu Go proyecta un rango a partir de momentos históricos parecidos al de hoy.</Sub><window.InvestSimulator type={tk} sig={v.sig} temp={v.mt} price={r.vals.price} /></>;
      case "operaciones": return <><Sub>Registra tus compras y ventas de BTC, ETH y cualquier otra moneda. Bambu Go calcula tu precio medio, el valor actual y tus ganancias y pérdidas. En BTC y ETH te dice, además, si operas en zona fría o caliente.</Sub><window.Ledger prices={prices} temps={temps} /></>;
      case "backtest": return <><Sub>Cuánto ha acertado el modelo en los puntos de inflexión reales de BTC y ETH desde 2013, con la señal STH y LTH en cada uno. El backtesting interactivo completo está en Bambu +.</Sub><div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "16px 18px 14px", marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>Zonas de acumulación y distribución sobre el precio</div><div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 10 }}>Las franjas azules marcan cuándo el modelo señaló acumular y las rojas cuándo señaló distribuir. Fíjate cómo las azules caen en suelos y las rojas en techos.</div><window.SignalZonesChart type={tk} days={range} /><div style={{ display: "flex", gap: 5, marginTop: 12 }}>{RANGES.map(x => { const on = x.d === range; return <button key={x.d} onClick={() => setRange(x.d)} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 9, border: on ? "1px solid var(--brand)" : "1px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" }}>{x.l}</button>; })}</div></div><window.BacktestProof defaultType={tk} /><div style={{ marginTop: 26 }}><window.BacktestTeaser type={tk} /></div></>;
      case "guia": return <><Sub>En un minuto: qué mirar, en qué orden y cómo decidir. Sin ser experto.</Sub>{pageGuia}</>;
      default: return null;
    }
  };

  return (
    <div className={"sapp" + (navOpen ? " nav-open" : "")}>
      <div className="snav-backdrop" onClick={() => setNavOpen(false)} />
      <aside className="ssidebar">
        <div className="sbrand">
          <span className="sbrand-logo"><svg width="19" height="19" viewBox="0 0 32 32" fill="none"><path d="M13 7v18M19 7v18" stroke="#EDE7D2" strokeWidth="2.4" strokeLinecap="round" /><path d="M13 13h6M13 19h6" stroke="#EAD98A" strokeWidth="2.4" strokeLinecap="round" /></svg></span>
          <div>
            <div className="sbrand-name">Bambu Go{LOCK ? " · " + LOCK : ""}</div>
            <div className="sbrand-sub">{LOCK ? r.asset.name + " · On-Chain" : "Decisión On-Chain"}</div>
          </div>
        </div>
        <nav className="snav">
          {NAV.map(g => (
            <React.Fragment key={g.label}>
              <div className="snav-label">{g.label}</div>
              {g.items.map(n => (
                <button key={n.id} className={"snav-item" + (page === n.id ? " active" : "")} onClick={() => { setPage(n.id); setNavOpen(false); }}>
                  <SIcon id={iconOf[n.id] || n.id} /> {n.label}
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
          <div className="stb-title">{(TITLES[page] || ["Bambu Go"])[0]}<small>{(TITLES[page] || ["", ""])[1]}</small></div>
          <span style={{ flex: 1 }} />
          {!LOCK && (
            <div className="stoggle">
              {results.map(x => <button key={x.asset.id} className={x.asset.type === tk ? "on" : ""} onClick={() => setTk(x.asset.type)}>{x.asset.ticker}</button>)}
            </div>
          )}
          <div className="stb-chip stb-hide"><span className="k">Temperatura</span><span className="v" style={{ color: col }}>{Math.round(v.mt)}° · {v.zone.label}</span></div>
          <div className="stb-chip stb-hide"><span className="k">{r.asset.ticker}</span><span className="v num">{E.fmt.usd(r.vals.price)}</span></div>
        </header>
        <div className="scontent">
          <div className="spage fade" key={page + tk}>
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

function Answer({ lab, val, sub, col, border }) {
  return (
    <div style={{ padding: "15px 16px", borderLeft: border ? "1px solid var(--border)" : "none" }}>
      <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{lab}</div>
      <div className="num" style={{ fontSize: 25, fontWeight: 700, color: col || "var(--ink)", lineHeight: 1.1, marginTop: 5 }}>{val}</div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
function HorizonCard({ r, which, lab, tag, hr }) {
  const col = E.tempColor(hr.temp, PAL);
  const args = horizonArgs(r, which);
  return (
    <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{lab}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{tag}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "8px 0 10px" }}>
        <span className="num" style={{ fontSize: 30, fontWeight: 700, color: col, lineHeight: 1 }}>{Math.round(hr.temp)}°</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: col }}>{hr.zone.label}</span>
      </div>
      <TempBar temp={hr.temp} height={9} />
      <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, margin: "12px 0 0" }}>{horizonConclusion(hr.temp, which)}</p>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {args.map((a, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: E.tempColor(a.temp, PAL), flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
              <span style={{ flex: 1 }} />
              <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: E.tempColor(a.temp, PAL) }}>{a.val}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 3, paddingLeft: 16 }}>{a.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
