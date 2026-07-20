/* ============================================================
   BAMBÚ · Secciones — Escenarios · Alertas & Diario
   ============================================================ */

/* ===================== ESCENARIOS ===================== */
function SectionEscenarios({ palette, k }) {
  const [whatTk, setWhatTk] = React.useState("BTC");
  const base = DD.PRELOAD[whatTk];
  const [sc, setSc] = React.useState({ price: base.price, nuplLTH: base.nuplLTH, rsi1w: base.rsi1w, mayer: base.mayer, funding: base.funding });
  React.useEffect(() => { const b = DD.PRELOAD[whatTk]; setSc({ price: b.price, nuplLTH: b.nuplLTH, rsi1w: b.rsi1w, mayer: b.mayer, funding: b.funding }); }, [whatTk]);
  const scAsset = { type: whatTk, values: { ...base, ...sc } };
  const r = E.computeAsset(scAsset, { k });
  const baseR = E.computeAsset({ type: whatTk, values: { ...base } }, { k });
  const pr = whatTk === "ETH" ? { min: 800, max: 10000, step: 50 } : { min: 20000, max: 200000, step: 1000 };

  // backtest interactivo
  const [th, setTh] = React.useState({ t1: 0.5, t2: 1.5, k });
  const stats = React.useMemo(() => recomputeStats(th), [th.t1, th.t2]);
  const baseStats = recomputeStats({ t1: 0.5, t2: 1.5 });

  // proyección de ciclo
  const C = window.BambuCycle;
  const cyc = C.cycles.find(c => c.current);
  const low = cyc.low.p;
  const roisPast = C.cycles.filter(c => !c.current).map(c => c.roi);
  const mults = [{ name: "Conservador", m: 3.5 }, { name: "Base", m: 5.5 }, { name: "Optimista", m: 8 }];
  const targets = mults.map(x => ({ ...x, price: low * x.m }));
  const curPrice = base.price, ath = cyc.high.p;
  const maxT = Math.max(...targets.map(t => t.price), ath) * 1.05;

  const Slider = ({ lab, keyName, min, max, step, val, set, fmt }) => (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{lab}</span>
        <span className="num" style={{ fontWeight: 600 }}>{fmt ? fmt(val) : val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} style={{ width: "100%", accentColor: "var(--brand)" }} />
    </div>
  );
  const Res = ({ hr, label }) => {
    const col = E.tempColor(hr.temp, palette);
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", flex: 1 }}>
        <div className="tiny muted">{label}</div>
        <div className="num" style={{ fontSize: 30, fontWeight: 600, color: col, lineHeight: 1.1 }}>{hr.temp.toFixed(0)}°</div>
        <div style={{ marginTop: 6 }}><SignalPill signal={hr.signal} /></div>
        <div className="tiny" style={{ marginTop: 6, fontWeight: 600, color: col }}>{hr.zone.label} · {hr.zone.phase}</div>
        <div className="tiny muted" style={{ marginTop: 4 }}>composite <span className="num">{E.fmt.signed(hr.composite)}</span></div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-head"><h1>¿Qué pasaría si?</h1><p>Simula condiciones de mercado para BTC y ETH, proyecta el objetivo de ciclo y ajusta los umbrales del modelo para ver su impacto.</p></div>

      {/* what-if */}
      <Card title={`Simulador what-if · ${whatTk}`} sub="Mueve las variables y observa cómo cambian señal y temperatura en tiempo real" right={
        <div className="seg">
          <button className={whatTk === "BTC" ? "on" : ""} onClick={() => setWhatTk("BTC")}>BTC</button>
          <button className={whatTk === "ETH" ? "on" : ""} onClick={() => setWhatTk("ETH")}>ETH</button>
        </div>
      }>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div>
            <Slider lab={`Precio ${whatTk} (USD)`} min={pr.min} max={pr.max} step={pr.step} val={sc.price} set={v => setSc({ ...sc, price: v })} fmt={v => E.fmt.usd(v)} />
            <Slider lab="NUPL LTH" min={-0.2} max={0.9} step={0.01} val={sc.nuplLTH} set={v => setSc({ ...sc, nuplLTH: v })} fmt={v => v.toFixed(2)} />
            <Slider lab="RSI 14 (1W)" min={20} max={90} step={1} val={sc.rsi1w} set={v => setSc({ ...sc, rsi1w: v })} />
            <Slider lab="Mayer Multiple" min={0.4} max={3} step={0.05} val={sc.mayer} set={v => setSc({ ...sc, mayer: v })} fmt={v => v.toFixed(2)} />
            <Slider lab="Funding 30d MA (%)" min={-0.05} max={0.06} step={0.001} val={sc.funding} set={v => setSc({ ...sc, funding: v })} fmt={v => v.toFixed(3)} />
            <button className="btn" style={{ marginTop: 12 }} onClick={() => { const b = DD.PRELOAD[whatTk]; setSc({ price: b.price, nuplLTH: b.nuplLTH, rsi1w: b.rsi1w, mayer: b.mayer, funding: b.funding }); }}>↺ Restablecer a hoy</button>
          </div>
          <div>
            <div className="tiny muted" style={{ marginBottom: 8 }}>Resultado del escenario · MVRV LTH se recalcula del precio = <span className="num">{(sc.price / base.rpLTH).toFixed(2)}x</span></div>
            <div style={{ display: "flex", gap: 12 }}><Res hr={r.sth} label={`${whatTk} · STH`} /><Res hr={r.lth} label={`${whatTk} · LTH`} /></div>
            <div className="tiny muted" style={{ marginTop: 12 }}>Línea base (hoy): STH <span className="num">{baseR.sth.temp.toFixed(0)}°</span> {baseR.sth.signal} · LTH <span className="num">{baseR.lth.temp.toFixed(0)}°</span> {baseR.lth.signal}</div>
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16, alignItems: "start" }}>
        {/* proyección de ciclo */}
        <Card title="Proyección de ciclo" sub={`Objetivos desde el suelo del ciclo (${E.fmt.usd(low)}) con retornos decrecientes · ${cyc.halvingLabel} ${C.fmtES(cyc.start)}`}>
          <div style={{ position: "relative", height: 38, marginTop: 30, marginBottom: 8 }}>
            <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 10, borderRadius: 6, background: `linear-gradient(90deg, ${E.tempColor(20, palette)}, ${E.tempColor(92, palette)})` }} />
            {targets.map((t, i) => (
              <div key={i} style={{ position: "absolute", left: (t.price / maxT * 100) + "%", top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
                <div className="tiny" style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="num tiny muted">{E.fmt.usd(t.price)}</div>
                <div style={{ width: 2, height: 12, background: "var(--ink-2)", margin: "2px auto 0" }} />
              </div>
            ))}
            <div style={{ position: "absolute", left: (curPrice / maxT * 100) + "%", top: 26, transform: "translateX(-50%)" }}>
              <div style={{ width: 3, height: 16, background: "var(--brand)", margin: "0 auto" }} />
              <div className="tiny" style={{ fontWeight: 700, color: "var(--brand)" }}>hoy</div>
            </div>
          </div>
          <table className="tbl" style={{ marginTop: 18 }}>
            <thead><tr><th>Ciclo · halving</th><th className="r">Suelo</th><th className="r">ATH</th><th className="r">ROI</th></tr></thead>
            <tbody>
              {C.cycles.map(c => (
                <tr key={c.n} className={c.current ? "today" : ""}>
                  <td style={{ fontWeight: 600 }}>Ciclo {c.dispN}{c.current ? " · actual" : ""}<div className="tiny muted">{c.halvingLabel} · {C.fmtES(c.start)}</div></td>
                  <td className="r num tiny">{E.fmt.usd(c.low.p)}<div className="muted">{C.fmtES(c.low.d)}</div></td>
                  <td className="r num tiny">{E.fmt.usd(c.high.p)}<div className="muted">{C.fmtES(c.high.d)}</div></td>
                  <td className="r num" style={{ fontWeight: 600 }}>{c.roi >= 100 ? Math.round(c.roi) : c.roi.toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted" style={{ marginTop: 8 }}>Los retornos por ciclo decrecen ({roisPast.map(x => (x >= 100 ? Math.round(x) : x.toFixed(0)) + "×").join(" → ")}). El ATH actual del ciclo es {E.fmt.usd(ath)}.</div>
        </Card>

        {/* backtest interactivo */}
        <Card title="Backtest interactivo" sub="Ajusta los umbrales de señal y recalcula el desempeño en vivo">
          <Slider lab="Umbral COMPRA / REDUCIR (±)" min={0.2} max={1.0} step={0.05} val={th.t1} set={v => setTh({ ...th, t1: v })} fmt={v => "±" + v.toFixed(2)} />
          <Slider lab="Umbral FUERTE (±)" min={1.0} max={2.2} step={0.05} val={th.t2} set={v => setTh({ ...th, t2: v })} fmt={v => "±" + v.toFixed(2)} />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            <ScStat lab="Hit-rate" val={(stats.hitRate * 100).toFixed(0) + "%"} base={(baseStats.hitRate * 100).toFixed(0) + "%"} good={stats.hitRate >= baseStats.hitRate} />
            <ScStat lab="Profit factor" val={isFinite(stats.pf) ? stats.pf.toFixed(1) : "∞"} base={isFinite(baseStats.pf) ? baseStats.pf.toFixed(1) : "∞"} good={stats.pf >= baseStats.pf} />
            <ScStat lab="Señales dir." val={stats.dir} base={baseStats.dir} />
          </div>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => setTh({ t1: 0.5, t2: 1.5, k })}>↺ Umbrales por defecto (±0.5 / ±1.5)</button>
          <div className="tiny muted" style={{ marginTop: 10 }}>Umbrales más estrictos reducen el número de señales pero suelen elevar el hit-rate. Por defecto el modelo acierta {(baseStats.hitRate * 100).toFixed(0)}%.</div>
        </Card>
      </div>
    </div>
  );
}
function ScStat({ lab, val, base, good }) {
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 10, padding: "11px 13px" }}>
      <div className="tiny muted">{lab}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 600, color: good === undefined ? "var(--ink)" : good ? "var(--brand)" : "#A83C26" }}>{val}</div>
      <div className="tiny muted">def. {base}</div>
    </div>
  );
}
function recomputeStats(th) {
  const bt = DD.BACKTEST.filter(d => !d.today);
  const sigOf = c => c >= th.t2 ? "COMPRA FUERTE" : c >= th.t1 ? "COMPRA" : c > -th.t1 ? "NEUTRAL" : c > -th.t2 ? "REDUCIR" : "VENTA FUERTE";
  let dir = 0, hits = 0, gw = 0, gl = 0;
  bt.forEach(d => {
    const s = sigOf(d.comp);
    if (s === "NEUTRAL") return;
    dir++;
    const bull = s.indexOf("COMPRA") >= 0;
    const correct = (bull && d.mov > 0) || (!bull && d.mov < 0);
    if (correct) { hits++; gw += Math.abs(d.mov); } else { gl += Math.abs(d.mov); }
  });
  return { dir, hits, hitRate: dir ? hits / dir : 0, pf: gl ? gw / gl : Infinity, gw, gl };
}

/* ===================== ALERTAS & DIARIO ===================== */
/* lectura en lenguaje natural a partir del score (−1 acumular … +1 distribuir invertido) */
function toneCol(tone, palette) { return E.tempColor({ buy: 16, neutral: 50, warn: 70, sell: 88 }[tone] ?? 50, palette); }
function scoreReading(sc) {
  if (sc == null) return null;
  if (sc >= 0.5) return ["Barato · favorable para acumular", "buy"];
  if (sc >= 0.15) return ["Algo barato", "buy"];
  if (sc > -0.15) return ["Neutral · sin sesgo", "neutral"];
  if (sc > -0.5) return ["Algo caro · cautela", "warn"];
  return ["Caro · favorable para reducir", "sell"];
}
/* las métricas esenciales: cada una responde una pregunta simple, con lectura del valor de hoy.
   Las 3 primeras son comunes; la 4ª depende del activo (BTC: mineros · ETH: toma de ganancias). */
const ESSENTIALS = {
  common: [
    { key: "mvrvZ", dec: 2, q: "¿Caro o barato?", sub: "Valoración del ciclo",
      read: v => v == null ? null : v < 0 ? ["Muy barato", "Zona de suelo histórico — acumular", "buy"] : v < 2 ? ["Barato", "Por debajo de la media — favorable", "buy"] : v < 5 ? ["Caro", "Ciclo maduro — no perseguir el precio", "warn"] : ["Extremo", "Zona de techo histórico — tomar ganancias", "sell"] },
    { key: "nuplLTH", dec: 2, q: "¿Euforia o miedo?", sub: "Ánimo de las manos firmes",
      read: v => v == null ? null : v < 0 ? ["Capitulación", "Manos firmes en pérdida — suelo, acumular", "buy"] : v < 0.5 ? ["Optimismo sano", "Sin excesos — mantener", "neutral"] : v < 0.75 ? ["Codicia", "Ganancias altas — empezar a vigilar", "warn"] : ["Euforia", "Zona de techo — distribuir", "sell"] },
    { key: "mayer", dec: 2, q: "¿Sobreextendido?", sub: "Precio vs media de 200 días",
      read: v => v == null ? null : v < 0.8 ? ["Sobrevendido", "Muy por debajo de su media — barato", "buy"] : v < 1.5 ? ["Normal", "En su rango habitual — neutral", "neutral"] : v < 2.4 ? ["Extendido", "Caro frente a la tendencia — cautela", "warn"] : ["Sobreextendido", "Riesgo de techo — reducir", "sell"] },
  ],
  BTC: { key: "puell", dec: 2, q: "¿Presión de mineros?", sub: "Rentabilidad de la minería",
    read: v => v == null ? null : v < 0.5 ? ["Mínima", "Mineros poco rentables — típico de suelos", "buy"] : v < 2 ? ["Normal", "Sin presión vendedora fuerte", "neutral"] : v < 4 ? ["Elevada", "Mineros rentables vendiendo", "warn"] : ["Extrema", "Zona de techo — distribuir", "sell"] },
  ETH: { key: "asopr", dec: 3, q: "¿Toma de ganancias?", sub: "Venta con beneficio (aSOPR)",
    read: v => v == null ? null : v < 1 ? ["Capitulación", "Se vende en pérdida — suelo, acumular", "buy"] : v < 1.02 ? ["Equilibrio", "Ni euforia ni pánico — neutral", "neutral"] : v < 1.05 ? ["Ganancias", "Toma de beneficios moderada — vigilar", "warn"] : ["Euforia", "Realización fuerte — distribuir", "sell"] },
};

function SectionAlertas({ results, regime, palette, snapshots, journal, setJournal, watchlist, setWatchlist }) {
  const H = window.BambuHistory;
  const [alAsset, setAlAsset] = React.useState("BTC");
  const catalog = React.useMemo(() => H.metricCatalog(alAsset).filter(m => !m.noscore), [alAsset]);
  const btc = results.find(r => r.asset.type === "BTC") || results[0];
  const aRes = results.find(r => r.asset.ticker === alAsset) || btc;
  const aVals = aRes.vals;
  const essList = [...ESSENTIALS.common, ESSENTIALS[alAsset]].filter(Boolean);
  const assetSeg = (
    <div className="seg">
      {results.map(r => <button key={r.asset.ticker} className={alAsset === r.asset.ticker ? "on" : ""} onClick={() => setAlAsset(r.asset.ticker)}>{r.asset.ticker}</button>)}
    </div>
  );
  const now = window.BambuCycle.computeNow();
  const [filter, setFilter] = React.useState("todas");
  const [draft, setDraft] = React.useState("");

  // construir alertas · cada una lidera con la ACCIÓN, la métrica es el porqué
  const alerts = [];
  results.forEach(r => {
    [["STH", r.sth], ["LTH", r.lth]].forEach(([h, hr]) => {
      if (hr.zone.id === "caliente") alerts.push({ cat: "zona", sev: "alta", act: "Reduce o cubre posición", t: `${r.asset.ticker}·${h} en zona CALIENTE`, m: "El mercado está caro (distribución). No es momento de comprar; protege ganancias." });
      else if (hr.zone.id === "fria") alerts.push({ cat: "zona", sev: "buena", act: "Considera acumular", t: `${r.asset.ticker}·${h} en zona FRÍA`, m: "El mercado está barato (acumulación). Oportunidad estructural de compra escalonada." });
      if (Math.abs(hr.composite) >= 1) alerts.push({ cat: "senal", sev: hr.composite > 0 ? "buena" : "alta", act: hr.composite > 0 ? "Señal de compra fuerte" : "Señal de venta fuerte", t: `Convicción alta en ${r.asset.ticker}·${h}`, m: `El modelo da ${hr.signal} (índice ${E.fmt.signed(hr.composite)}). Cuanto más extremo, más fiable.` });
    });
  });
  if (snapshots.length >= 2) {
    const a = snapshots[snapshots.length - 1], b = snapshots[snapshots.length - 2];
    const sigC = c => E.signalFor(c);
    if (a.btcLTH != null && b.btcLTH != null && sigC(a.btcLTH) !== sigC(b.btcLTH))
      alerts.push({ cat: "cambio", sev: "media", act: "Revisa tu plan", t: "Cambió la postura de BTC·LTH", m: `La señal pasó de ${sigC(b.btcLTH)} a ${sigC(a.btcLTH)} entre tus lecturas guardadas. Reevalúa exposición.` });
  }
  if (now.daysUntil <= 200) alerts.push({ cat: "halving", sev: "media", act: "Prepara el ciclo", t: `Faltan ${now.daysUntil} días para el halving`, m: `El catalizador estructural se acerca (${window.BambuCycle.fmtES(now.nextH.date)} · ciclo al ${(now.progress * 100).toFixed(0)}%). Históricamente precede a la fase de expansión.` });
  if (btc.vals.funding > 0.02) alerts.push({ cat: "senal", sev: "alta", act: "Baja apalancamiento", t: "Funding elevado · euforia apalancada", m: `El coste de mantener largos (${btc.vals.funding}%) está alto: hay exceso de apalancamiento alcista y riesgo de corrección brusca.` });
  if (btc.vals.mvrvZ > 5) alerts.push({ cat: "senal", sev: "alta", act: "Toma ganancias", t: "MVRV Z-Score en zona de techo", m: "La valoración está en niveles que históricamente han marcado techos de ciclo. Prioriza proteger capital sobre buscar más subida." });
  if (!alerts.length) alerts.push({ cat: "zona", sev: "info", act: "Mantén disciplina", t: "Sin alertas activas", m: "El mercado está en rango neutral. No fuerces operaciones; sigue tu plan." });

  const sevStyle = { alta: ["#F6E4DE", "#A83C26"], media: ["#F6ECE2", "#9A5A22"], buena: ["#E7F1E9", "#1F6B3D"], info: ["#EEF0EC", "#5A635A"] };
  const cats = [["todas", "Todas"], ["zona", "Zonas"], ["senal", "Señales"], ["cambio", "Cambios"], ["halving", "Halving"]];
  const shown = alerts.filter(a => filter === "todas" || a.cat === filter);

  // watchlist helpers
  const addWatch = key => { if (!watchlist.includes(key)) setWatchlist([...watchlist, key]); };
  const rmWatch = key => setWatchlist(watchlist.filter(k => k !== key));
  const valScore = m => { const v = H.mValue(alAsset, m.key, aVals); return { v, sc: m.score ? m.score(v) : null }; };

  const addEntry = () => { if (!draft.trim()) return; setJournal([{ id: "j" + Date.now(), date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }), text: draft.trim(), regime }, ...journal]); setDraft(""); };

  return (
    <div className="fade-in">
      <div className="page-head"><h1>Alertas &amp; diario</h1><p>Avisos accionables del modelo, lo esencial en lenguaje claro, métricas en seguimiento y bitácora de decisiones.</p></div>

      {/* lo esencial · preguntas que mueven la decisión */}
      <Card title="Lo esencial · responde 4 preguntas" sub={`Sin tecnicismos: qué dice el mercado de ${alAsset} hoy, traducido a una lectura y una acción`} right={assetSeg} style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {essList.map(es => {
            const v = aVals[es.key];
            const rd = es.read(v);
            const col = rd ? toneCol(rd[2], palette) : "var(--ink-3)";
            return (
              <div key={es.key} style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "13px 14px", borderTop: `4px solid ${col}` }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{es.q}</div>
                <div className="tiny muted" style={{ marginTop: 1 }}>{es.sub}</div>
                <div className="num" style={{ fontSize: 23, fontWeight: 700, color: col, marginTop: 10, lineHeight: 1 }}>{rd ? rd[0] : "—"}</div>
                <div className="tiny" style={{ color: col, fontWeight: 600, marginTop: 3 }}>{es.key.toUpperCase()} = <span className="num">{v != null ? v.toFixed(es.dec) : "—"}</span></div>
                <div className="tiny muted" style={{ marginTop: 7, lineHeight: 1.45 }}>{rd ? rd[1] : "Sin dato"}</div>
              </div>
            );
          })}
        </div>
        <div className="tiny muted" style={{ marginTop: 11, lineHeight: 1.5 }}>Si solo miras cuatro cosas, mira estas: <strong>valoración</strong> (¿caro o barato?), <strong>ánimo</strong> (¿euforia o miedo?), <strong>extensión</strong> (¿se alejó de su media?) y {alAsset === "ETH" ? <><strong>realización</strong> (¿se vende con ganancia?)</> : <><strong>mineros</strong> (¿presión de venta?)</>}. Cuando varias coinciden, la lectura es más fiable.</div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
        {/* alertas */}
        <Card title="Centro de alertas" sub="Generadas en vivo desde el estado actual del modelo"
          right={<select className="inp" style={{ width: 130, textAlign: "left", fontFamily: "var(--sans)" }} value={filter} onChange={e => setFilter(e.target.value)}>{cats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {shown.map((a, i) => {
              const [bg, fg] = sevStyle[a.sev] || sevStyle.info;
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "11px 13px", borderRadius: 9, background: "var(--surface-3)", borderLeft: `4px solid ${fg}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: fg, marginTop: 5, flex: "none" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: fg }}>{a.act}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 1 }}>{a.t}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{a.m}</div>
                  </div>
                  <span className="badge" style={{ background: bg, color: fg, alignSelf: "flex-start" }}>{a.sev}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* watchlist */}
        <Card title="Watchlist" sub={`Métricas fijadas · valor ${alAsset} y qué significa hoy`}
          right={assetSeg}>
          <select className="inp" style={{ width: "100%", textAlign: "left", fontFamily: "var(--sans)", marginBottom: 10 }} value="" onChange={e => e.target.value && addWatch(e.target.value)}>
            <option value="">+ Añadir métrica…</option>
            {catalog.filter(m => !watchlist.includes(m.key + m.horizon)).map(m => <option key={m.key + m.horizon} value={m.key + m.horizon}>{m.label} · {m.horizon}</option>)}
          </select>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {watchlist.map(key => {
              const m = catalog.find(x => (x.key + x.horizon) === key); if (!m) return null;
              const { v, sc } = valScore(m);
              const gl = window.BambuGlossary && window.BambuGlossary[m.key];
              const rd = scoreReading(sc);
              const rcol = rd ? toneCol(rd[1], palette) : "var(--ink-3)";
              return (
                <div key={key} style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.label}</div>
                      <div className="mono tiny muted">{m.tech} · {m.horizon}</div>
                    </div>
                    <span className="num" style={{ fontWeight: 600 }}>{fmtVal(v, m.unit)}</span>
                    <ScoreChip score={sc} palette={palette} />
                    <button className="btn ghost" style={{ padding: "2px 7px", color: "var(--ink-3)" }} onClick={() => rmWatch(key)}>✕</button>
                  </div>
                  {rd && <div className="tiny" style={{ marginTop: 6, fontWeight: 600, color: rcol }}>Hoy: {rd[0]}</div>}
                  {gl && <div className="tiny muted" style={{ marginTop: 3, lineHeight: 1.45 }}>{gl.def}</div>}
                </div>
              );
            })}
            {!watchlist.length && <div className="muted tiny" style={{ textAlign: "center", padding: 16 }}>Añade métricas para vigilarlas aquí. Cada una mostrará qué es y qué significa su valor de hoy.</div>}
          </div>
        </Card>
      </div>

      {/* diario */}
      <Card title="Diario de operaciones" sub="Registra tu lectura del mercado y decisiones del comité" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input className="inp" placeholder="Escribe tu nota: contexto, decisión, niveles vigilados…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addEntry()} style={{ flex: 1, textAlign: "left", fontFamily: "var(--sans)" }} />
          <button className="btn primary" onClick={addEntry}>+ Anotar</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {journal.map(e => (
            <div key={e.id} style={{ display: "flex", gap: 12, padding: "11px 13px", borderRadius: 9, background: "var(--surface-3)" }}>
              <div style={{ flex: "none", width: 92 }}>
                <div className="tiny" style={{ fontWeight: 600 }}>{e.date}</div>
                <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", fontSize: 9.5, marginTop: 4 }}>{e.regime}</span>
              </div>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{e.text}</div>
              <button className="btn ghost" style={{ padding: "2px 7px", color: "var(--ink-3)", alignSelf: "flex-start" }} onClick={() => setJournal(journal.filter(x => x.id !== e.id))}>✕</button>
            </div>
          ))}
          {!journal.length && <div className="muted tiny" style={{ textAlign: "center", padding: 16 }}>Aún no hay anotaciones.</div>}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SectionEscenarios, SectionAlertas, recomputeStats });
