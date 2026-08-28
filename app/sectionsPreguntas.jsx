/* ============================================================
   BAMBÚ · Preguntas por activo y horizonte
   Cada horizonte decide cosas distintas, así que las preguntas
   también son distintas: el corto plazo decide CUÁNDO entrar o
   protegerse; el largo plazo decide CUÁNTO tener y CUÁNDO salir.
   Todas las lecturas van en la escala publicada 0-100 (posición
   frente al historial del propio activo).
   ============================================================ */

/* --- preguntas del corto plazo (semanas) --- */
function qsSTH(r, z, other, v, E) {
  const type = r.asset.type, tk = r.asset.ticker;
  const dSth = v.price && v.rpSTH ? (v.price / v.rpSTH - 1) * 100 : null;
  const gap = Math.abs(z.rank - other.rank);
  const out = [];

  out.push({
    q: "¿El que compró hace poco gana o pierde?",
    head: dSth == null ? "Sin dato" : dSth > 0 ? "En ganancia" : "Bajo el agua",
    num: v.rpSTH ? E.fmt.usd(v.rpSTH) : "—", unit: "su coste medio",
    tone: dSth == null ? "mid" : dSth > 0 ? "hot" : "cold",
    body: (dSth != null
      ? `Quien compró ${tk} en los últimos meses lo hizo a ${E.fmt.usd(v.rpSTH)} de media, así que hoy está un ${Math.abs(dSth).toFixed(0)}% ${dSth > 0 ? "en verde" : "en rojo"}. `
      : "") +
      (dSth != null && dSth < 0
        ? "Con el comprador reciente en pérdida hay manos débiles: cualquier caída puede acelerarse, pero también es la situación de la que nacen los suelos."
        : "Con el comprador reciente en ganancia hay menos riesgo de ventas por pánico, y a la vez más tentación de recoger beneficio."),
    go: "onchain", goLab: "Ver las métricas de corto plazo",
  });

  out.push({
    q: "¿Puede haber una sacudida esta semana?",
    head: v.rsi1d == null ? "Sin dato técnico" : v.rsi1d > 70 ? "Estirado al alza" : v.rsi1d < 30 ? "Estirado a la baja" : "Sin tensión técnica",
    num: v.rsi1d != null ? v.rsi1d.toFixed(0) : "—", unit: "RSI diario",
    tone: v.rsi1d == null ? "mid" : v.rsi1d > 70 ? "hot" : v.rsi1d < 30 ? "cold" : "mid",
    body: (v.rsi1d != null
      ? (v.rsi1d > 70 ? `El RSI en ${v.rsi1d.toFixed(0)} dice que el precio subió rápido y sin descanso. Un retroceso sería lo normal y no cambiaría la fase de fondo. `
        : v.rsi1d < 30 ? `El RSI en ${v.rsi1d.toFixed(0)} dice que el precio cayó rápido. Un rebote sería lo normal y tampoco cambiaría la fase de fondo. `
        : `El RSI en ${v.rsi1d.toFixed(0)} está en zona media: no hay un extremo técnico que fuerce un giro inmediato. `) : "") +
      (v.bb1d != null ? (v.bb1d > .9 ? "Además cotiza pegado a la banda superior, donde suele haber pausas."
        : v.bb1d < .1 ? "Además cotiza pegado a la banda inferior, donde suele haber rebotes." : "") : ""),
    go: "onchain", goLab: "Ver data técnica",
  });

  out.push({
    q: "¿Aprovecho para una compra puntual?",
    head: z.rank < 30 ? "Sí, es una ventana" : z.rank > 70 ? "No, mejor esperar" : "Solo si ya tocaba aportar",
    num: z.rank.toFixed(0), unit: "de 100 · corto plazo",
    tone: z.rank < 40 ? "cold" : z.rank > 60 ? "hot" : "mid",
    body: `El corto plazo está en ${z.rank.toFixed(0)} de 100 — ${z.label.toLowerCase()}. ` +
      (z.rank < 30 ? "Pocas semanas en el historial estuvieron más frías: es de las ventanas que suelen recompensar al que aporta."
        : z.rank > 70 ? "Comprar aquí es comprar caliente. Si tu plan pide aportar, mejor partirlo en varios tramos que hacerlo de golpe."
          : "Sin ventaja clara: cumple tu calendario de aportes y no fuerces movimientos extra.") +
      (gap >= 20 ? ` Ten en cuenta que el ciclo va por otro lado (${other.rank.toFixed(0)} de 100).` : ""),
    go: "plan", goLab: "Ir a mi plan de aportes",
  });

  out.push({
    q: "¿Qué nivel me diría que me equivoqué?",
    head: v.rpSTH ? "El coste del comprador reciente" : "Sin nivel calculable",
    num: v.rpSTH ? E.fmt.usd(v.rpSTH) : "—", unit: "nivel a vigilar",
    tone: "mid",
    body: (v.rpSTH
      ? `${E.fmt.usd(v.rpSTH)} es la frontera del corto plazo: por debajo, el comprador reciente entra en pérdida y aparece presión de venta; por encima, se calma. `
      : "") +
      (v.sthSopr != null
        ? `Hoy el SOPR de corto plazo está en ${v.sthSopr.toFixed(3)}, así que ${v.sthSopr < 1 ? "se está vendiendo en pérdida (agotamiento, no euforia)." : "se está vendiendo con beneficio (hay toma de ganancias)."}`
        : ""),
    go: "resumen", goLab: "Ver sostén y ruptura",
  });

  return out;
}

/* --- preguntas del largo plazo (ciclo) --- */
function qsLTH(r, z, other, v, E, regime, capPct, mv, tkLabel) {
  const type = r.asset.type, tk = r.asset.ticker;
  const dLth = v.price && v.rpLTH ? (v.price / v.rpLTH - 1) * 100 : null;
  const reg = DD.REGIMES[regime];
  const gap = Math.abs(z.rank - other.rank);
  const out = [];

  out.push({
    q: "¿En qué punto del ciclo estamos?",
    head: z.phase,
    num: z.rank.toFixed(0), unit: "de 100 · ciclo",
    tone: z.rank < 40 ? "cold" : z.rank > 60 ? "hot" : "mid",
    body: `Frente a su propio historial, ${tk} está en la posición ${z.rank.toFixed(0)} de 100 — ${z.label.toLowerCase()}. ` +
      (dLth != null ? `Cotiza un ${Math.abs(dLth).toFixed(0)}% ${dLth > 0 ? "por encima" : "por debajo"} del coste medio de quien lo tiene desde hace años (${E.fmt.usd(v.rpLTH)}). ` : "") +
      `El régimen detectado es ${regime}` + (reg ? `, que ajusta el tamaño de cada compra a ×${reg.mult.toFixed(2)}.` : "."),
    go: "ciclo", goLab: "Ver el ciclo completo",
  });

  out.push({
    q: "¿Los que llevan años ya están vendiendo?",
    head: v.lthSopr == null ? "Sin dato" : v.lthSopr < 1 ? "No, aún no" : "Sí, han empezado",
    num: v.nuplLTH != null ? (v.nuplLTH * 100).toFixed(0) + "%" : "—", unit: "ganancia sin realizar",
    tone: v.nuplLTH == null ? "mid" : v.nuplLTH > .5 ? "hot" : v.nuplLTH < .25 ? "cold" : "mid",
    body: (v.nuplLTH != null
      ? `Los tenedores de ciclo acumulan un ${(v.nuplLTH * 100).toFixed(0)}% de ganancia que todavía no han tocado. ${v.nuplLTH < .25 ? "Lejos aún de los niveles donde históricamente venden en masa." : v.nuplLTH < .5 ? "Zona intermedia: queda margen, pero ya existe incentivo a vender." : "Nivel alto: en ciclos anteriores aquí empezó la distribución."} `
      : "") +
      (v.lthSopr != null
        ? `Su SOPR está en ${v.lthSopr.toFixed(2)}: ${v.lthSopr < 1 ? "venden en pérdida, lo que suele verse en suelos y no en techos." : "venden con beneficio, señal de que la distribución está en marcha."}`
        : ""),
    go: "heatmap", goLab: "Ver métrica por métrica",
  });

  const posMix = mv ? mv.pos : z.rank;
  out.push({
    q: `¿Cuánto de mi capital debería estar en ${tk}?`,
    head: mv ? mv.action : z.action,
    num: capPct.toFixed(1) + "%", unit: "expuesto · igual que el veredicto",
    tone: posMix < 40 ? "cold" : posMix > 60 ? "hot" : "mid",
    body: `Es la misma cifra que la Exposición sugerida del veredicto: de cada 100 que destines a cripto, hoy conviene tener ${capPct.toFixed(1)} en ${tk} y el resto esperando en efectivo. Sale de la lectura global ${posMix.toFixed(0)} de 100, que promedia los dos horizontes. ` +
      (posMix < 40 ? "Es una franja para construir posición, repartida en varias compras."
        : posMix > 60 ? "Es una franja para asegurar parte de lo ganado, no para aumentar."
          : "Sin ventaja clara: sostener lo que ya tienes y no forzar movimientos.") +
      (gap >= 20 ? ` El ciclo va en ${z.rank.toFixed(0)} y el corto plazo en ${other.rank.toFixed(0)}: hay recorrido de fondo, pero el momento de ejecutar puede no ser hoy.` : ""),
    go: "plan", goLab: "Ir a mi plan de aportes",
  });

  out.push({
    q: "¿Cuándo empiezo a asegurar ganancias?",
    head: z.rank > 60 ? "Ya toca, por tramos" : z.rank > 40 ? "Prepara los niveles" : "Todavía no",
    num: z.rank > 60 ? "Ahora" : (80 - z.rank).toFixed(0), unit: z.rank > 60 ? "por tramos" : "puntos hasta la zona alta",
    tone: z.rank > 60 ? "hot" : z.rank < 40 ? "cold" : "mid",
    body: (z.rank > 80 ? "La lectura está en la franja donde los ciclos anteriores hicieron techo: la prioridad es vender por tramos, no acertar el máximo. "
      : z.rank > 60 ? "Entrando en la franja alta: es el momento de empezar a soltar por tramos, sin esperar la cifra redonda. "
        : `Faltan ${(80 - z.rank).toFixed(0)} puntos para la franja de distribución (80 de 100). `) +
      "Deja los niveles y los porcentajes escritos hoy, mientras la cabeza está fría: el plan de salida es lo que evita decidir con el precio en la cara.",
    go: "salida", goLab: "Definir mi plan de salida",
  });

  return out;
}

function askQuestions(results, regime, k, assetType, horizon) {
  const H = window.BambuHistory, E = window.BambuEngine;
  k = k || 27;
  const r = results.find(x => x.asset.type === assetType) || results[0];
  if (!r) return { qs: [], meta: null };
  const type = r.asset.type, v = r.asset.values || {};
  const zSth = H.zoneOf(r.sth.temp, type, "sth", k);
  const zLth = H.zoneOf(r.lth.temp, type, "lth", k);
  const z = horizon === "sth" ? zSth : zLth;
  const other = horizon === "sth" ? zLth : zSth;
  /* La exposición sale de marketVerdict, la MISMA función que alimenta el
     veredicto del Resumen: dos cifras distintas de "cuánto tener" en la misma
     pantalla es el peor fallo posible en una herramienta de decisión. */
  const mv = window.marketVerdict ? window.marketVerdict([r], regime) : null;
  const capPct = mv ? mv.capPct : 0;
  const qs = horizon === "sth" ? qsSTH(r, z, other, v, E) : qsLTH(r, z, other, v, E, regime, capPct, mv, r.asset.ticker);
  return { qs, meta: { r, z, other, zSth, zLth, gap: Math.abs(zSth.rank - zLth.rank), price: v.price, mv } };
}

/* ============================================================
   Bloque compacto para el Resumen: las mismas cuatro preguntas,
   plegadas. Cada una muestra su titular y su cifra; al abrirla
   aparece la conclusión razonada y el enlace al detalle.
   ============================================================ */
function PreguntasBloque({ results, regime, palette, onGo, k }) {
  const types = [...new Set(results.map(r => r.asset.type))];
  const [asset, setAsset] = React.useState(types[0] || "BTC");
  const [horizon, setHorizon] = React.useState("lth");
  const [open, setOpen] = React.useState(0);
  const act = types.includes(asset) ? asset : types[0];
  const { qs, meta } = askQuestions(results, regime, k, act, horizon);
  const COL = { cold: "#2E6FAE", mid: "#7A8A80", hot: "#C0492E" };
  if (!qs.length) return null;

  return (
    <Card
      title={<>Tus preguntas <HelpDot term="Tus preguntas" def="Las cuatro preguntas que decide un inversor, respondidas con los datos del día. Cambian según el horizonte: el largo plazo responde cuánto tener y cuándo empezar a soltar; el corto plazo, cuándo conviene ejecutar y qué nivel vigilar. Abre cualquiera para ver la conclusión razonada." /></>}
      sub="Abre cada pregunta para ver la conclusión y el dato que la sostiene"
      pad={false} style={{ marginBottom: 16 }}>

      {/* selectores + lectura actual */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
        <div className="seg">
          {types.map(t => <button key={t} className={"seg-btn" + (act === t ? " on" : "")} onClick={() => { setAsset(t); setOpen(0); }}>{t}</button>)}
        </div>
        <div className="seg">
          {[["lth", "Largo plazo"], ["sth", "Corto plazo"]].map(([id, lab]) =>
            <button key={id} className={"seg-btn" + (horizon === id ? " on" : "")} onClick={() => { setHorizon(id); setOpen(0); }}>{lab}</button>)}
        </div>
        <span style={{ flex: 1 }} />
        {meta &&
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Precio {act}</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{E.fmt.usd(meta.price)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Lectura {horizon === "sth" ? "corto" : "ciclo"}</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: COL[meta.z.rank < 40 ? "cold" : meta.z.rank > 60 ? "hot" : "mid"] }}>{meta.z.rank.toFixed(0)} <span className="tiny muted" style={{ fontWeight: 500 }}>/100</span></div>
            </div>
          </div>}
      </div>

      {/* aviso de divergencia, mismo umbral que el resto de la suite */}
      {meta && meta.gap >= 20 &&
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FBF1E9", borderBottom: "1px solid #E8D4BF", padding: "10px 18px" }}>
          <span style={{ color: "#B0642A", fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>!</span>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6B4A25" }}>
            <b>Los dos horizontes no coinciden.</b> Ciclo en {meta.zLth.rank.toFixed(0)} de 100 y corto plazo en {meta.zSth.rank.toFixed(0)}.
            {meta.zSth.rank > meta.zLth.rank
              ? " El recorrido de fondo puede seguir, pero entrar hoy es entrar recalentado: reparte en tramos."
              : " El corto plazo da un alivio que no cambia la fase de ciclo."}
          </div>
        </div>}

      {/* preguntas plegables */}
      <div>
        {qs.map((q, i) => {
          const col = COL[q.tone], isOpen = open === i;
          return (
            <div key={horizon + act + i} style={{ borderBottom: i < qs.length - 1 ? "1px solid var(--border)" : "none" }}>
              <button onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", background: isOpen ? "var(--surface-2, #F2F6F2)" : "transparent", border: "none", borderLeft: `3px solid ${isOpen ? col : "transparent"}`, textAlign: "left", cursor: "pointer", fontFamily: "var(--sans)" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", width: 16 }}>0{i + 1}</span>
                <span style={{ flex: 1, minWidth: 140, fontSize: 14.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{q.q}</span>
                <span className="num" style={{ fontSize: 15, fontWeight: 700, color: col, whiteSpace: "nowrap" }}>{q.num}</span>
                <span className="badge" style={{ background: mixSoft(col), color: col, fontWeight: 700, whiteSpace: "nowrap" }}>{q.head}</span>
                <span style={{ color: "var(--ink-3)", fontSize: 12, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .14s", display: "inline-block" }}>›</span>
              </button>
              {isOpen &&
                <div style={{ padding: "2px 18px 15px 49px", background: "var(--surface-2, #F2F6F2)", borderLeft: `3px solid ${col}` }}>
                  <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, marginBottom: 5 }}>Conclusión</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>{q.body}</p>
                  <div className="tiny muted" style={{ marginTop: 8 }}>{q.unit}: <span className="num" style={{ color: col, fontWeight: 700 }}>{q.num}</span></div>
                  {onGo &&
                    <button onClick={() => onGo(q.go)} style={{ marginTop: 10, background: "transparent", border: "none", padding: 0, fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--brand)", cursor: "pointer" }}>
                      {q.goLab} →
                    </button>}
                </div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SectionPreguntas({ results, regime, palette, onGo, k }) {
  const types = [...new Set(results.map(r => r.asset.type))];
  const [asset, setAsset] = React.useState(types[0] || "BTC");
  const [horizon, setHorizon] = React.useState("lth");
  const act = types.includes(asset) ? asset : types[0];
  const { qs, meta } = askQuestions(results, regime, k, act, horizon);
  const COL = { cold: "#2E6FAE", mid: "#7A8A80", hot: "#C0492E" };
  const HZ = [["lth", "Largo plazo", "El ciclo · meses y años"], ["sth", "Corto plazo", "Semanas"]];

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Tus preguntas <HelpDot term="Preguntas por activo y horizonte" def="Cada horizonte decide cosas distintas, así que las preguntas cambian con él. El largo plazo responde cuánto tener y cuándo empezar a soltar; el corto plazo, cuándo conviene ejecutar y qué nivel vigilar. Elige el activo y el horizonte, y las cuatro tarjetas se recalculan con los datos del día." /></h1>
        <p>Elige activo y horizonte: las preguntas cambian porque las decisiones son distintas</p>
      </div>

      {/* selectores */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700, marginBottom: 6 }}>Activo</div>
          <div className="seg">
            {types.map(t => <button key={t} className={"seg-btn" + (act === t ? " on" : "")} onClick={() => setAsset(t)}>{t}</button>)}
          </div>
        </div>
        <div>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700, marginBottom: 6 }}>Horizonte</div>
          <div className="seg">
            {HZ.map(([id, lab]) => <button key={id} className={"seg-btn" + (horizon === id ? " on" : "")} onClick={() => setHorizon(id)}>{lab}</button>)}
          </div>
        </div>
        {meta &&
          <div style={{ flex: 1, minWidth: 220, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Precio {act}</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{window.BambuEngine.fmt.usd(meta.price)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tiny muted">Lectura {horizon === "sth" ? "corto" : "ciclo"}</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: COL[meta.z.rank < 40 ? "cold" : meta.z.rank > 60 ? "hot" : "mid"] }}>{meta.z.rank.toFixed(0)} <span className="tiny muted" style={{ fontWeight: 500 }}>de 100</span></div>
            </div>
          </div>}
      </div>

      {/* aviso de divergencia entre horizontes: el mismo umbral en toda la suite */}
      {meta && meta.gap >= 20 &&
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start", background: "#FBF1E9", border: "1px solid #E8D4BF", borderRadius: 11, padding: "12px 16px", marginBottom: 16 }}>
          <span style={{ color: "#B0642A", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>!</span>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "#6B4A25" }}>
            <b>Los dos horizontes no coinciden.</b> El ciclo marca {meta.zLth.rank.toFixed(0)} de 100 y el corto plazo {meta.zSth.rank.toFixed(0)}.
            {meta.zSth.rank > meta.zLth.rank
              ? " El recorrido de fondo puede seguir, pero entrar hoy es entrar recalentado: reparte en tramos."
              : " El corto plazo da un alivio que no cambia la fase de ciclo: no lo confundas con un giro."}
          </div>
        </div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {qs.map((q, i) => {
          const col = COL[q.tone];
          return (
            <div key={horizon + act + i} className="card" style={{ padding: 0, overflow: "hidden", borderTop: `4px solid ${col}` }}>
              <div style={{ padding: "20px 22px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-3)" }}>0{i + 1}</span>
                  <h2 style={{ margin: 0, fontSize: 18.5, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.28 }}>{q.q}</h2>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <div className="num" style={{ fontSize: 30, fontWeight: 700, color: col, lineHeight: 1 }}>{q.num}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{q.unit}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: col, lineHeight: 1.3 }}>{q.head}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 14 }}>{q.body}</p>
              </div>
              {onGo &&
                <button onClick={() => onGo(q.go)} style={{ width: "100%", border: "none", borderTop: "1px solid var(--border)", background: "var(--surface-2, #F2F6F2)", padding: "12px 22px", textAlign: "left", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "var(--brand)", cursor: "pointer" }}>
                  {q.goLab} →
                </button>}
            </div>
          );
        })}
      </div>

      {/* guía de la escala: fija y memorizable */}
      <Card title="La escala de Bambu" sub="Una sola cifra de 0 a 100 · cortes fijos, iguales para BTC y ETH y para los dos horizontes" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", height: 34, borderRadius: 9, overflow: "hidden", border: "1px solid var(--border)" }}>
          {window.BambuHistory.FIXED_BANDS.map(z => {
            const c = E.tempColor(z.temp, palette);
            return (
              <div key={z.id} style={{ flex: 1, background: mixSoft(c, .62), display: "grid", placeItems: "center", borderRight: "1px solid rgba(255,255,255,.6)" }}>
                <span className="num" style={{ fontSize: 11, fontWeight: 700, color: c }}>{z.min}–{z.max}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: 7 }}>
          {window.BambuHistory.FIXED_BANDS.map(z => {
            const c = E.tempColor(z.temp, palette);
            return <div key={z.id} style={{ flex: 1, textAlign: "center", padding: "0 4px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: c, letterSpacing: ".03em", lineHeight: 1.3 }}>{z.label}</div>
            </div>;
          })}
        </div>
        <div className="tiny muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
          La cifra no es un precio ni un porcentaje de subida: es <strong>la posición del mercado frente a su propio historial</strong>. Un 15 significa que muy pocos días estuvieron más fríos que hoy; un 85, que muy pocos estuvieron más calientes. Cada horizonte se mide contra su propia historia, así que un 25 en el ciclo y un 82 en el corto plazo pueden convivir: significa recorrido de fondo con una entrada recalentada. Los cortes son siempre los mismos: <strong>bajo 20 se acumula, sobre 80 se distribuye</strong>.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SectionPreguntas, PreguntasBloque, askQuestions });
