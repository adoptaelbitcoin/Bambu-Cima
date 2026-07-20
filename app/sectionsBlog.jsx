/* ============================================================
   BAMBÚ · Blog / Informes on-chain · GENERADOR DINÁMICO
   Marco de tres patas (corto/mediano/largo) sobre datos reales.
   El usuario elige la temporalidad (meses) y se genera el informe.
   ============================================================ */

const BLOG_META = {
  BTC: { name: "Bitcoin", color: "#C77B3A" },
  ETH: { name: "Ethereum", color: "#3E6FB0" },
};

/* ---- utilidades de cómputo sobre datos reales ---- */
function blogSnap(type, iso) {
  const R = window.BambuRealData[type]; if (!R) return null;
  let i = R.indexOfIso(iso);
  if (i < 0) { for (let o = 1; o < 12 && i < 0; o++) { const d = new Date(new Date(iso + "T00:00:00Z").getTime() + o * 864e5).toISOString().slice(0, 10); i = R.dates.indexOf(d); } }
  if (i < 0) i = 0;
  const v = R.rowAt(i);
  const res = E.computeAsset({ type, values: v }, { k: 27 });
  return { i, iso: R.dates[i], ...v, sthTemp: res.sth.temp, lthTemp: res.lth.temp, sthSig: res.sth.signal, lthSig: res.lth.signal, comp_sth: res.sth.composite, comp_lth: res.lth.composite };
}
function extremes(type, i0) {
  const R = window.BambuRealData[type]; let hi = { p: -1, d: "" }, lo = { p: 1e15, d: "" };
  for (let i = i0; i < R.count; i++) { const p = R.price(i); if (p > hi.p) hi = { p, d: R.dates[i] }; if (p < lo.p) lo = { p, d: R.dates[i] }; }
  return { hi, lo };
}
function fmtMes(iso) { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }); }
function fmtDia(iso) { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); }
const pctVs = (a, b) => ((a / b - 1) * 100);

/* ---- generador del informe ---- */
function generarInforme(type, startIso) {
  const R = window.BambuRealData[type]; if (!R) return null;
  const meta = BLOG_META[type];
  const s0 = blogSnap(type, startIso);
  const now = blogSnap(type, R.latestIso);
  const ex = extremes(type, s0.i);
  const dd = pctVs(now.price, ex.hi.p);           // caída desde el máximo del periodo
  const chg = pctVs(now.price, s0.price);          // cambio total del periodo
  const distLTH = pctVs(now.price, now.rpLTH);     // vs coste base LTH
  const distSTH = pctVs(now.price, now.rpSTH);     // vs coste base STH
  const mvrvZdelta = (now.mvrvZ - s0.mvrvZ);
  const months = Math.round((R.indexOfIso(now.iso) - s0.i) / 30.4);

  const up = chg >= 0;
  const lthUnder = now.nuplLTH < 0;
  const sthUnder = now.nuplSTH < 0;
  const dir = up ? "apreciación" : "corrección";
  const macroFase = dd < -25 ? "fase bajista (markdown)" : dd < -10 ? "consolidación correctiva" : up ? "fase expansiva" : "lateralización";

  // titulares
  const titulares = type === "BTC"
    ? [
        `${meta.name} ${up ? "consolida" : "purga"} su ciclo: el MVRV Z-Score ${mvrvZdelta < 0 ? "retrocede" : "avanza"} a ${now.mvrvZ.toFixed(2)} ${dd < -20 ? "sin romper la estructura macro" : "en rango medio del ciclo"}`,
        `${dd < 0 ? `Una ${dir} del ${Math.abs(dd).toFixed(0)}% desde máximos` : "Recuperación de momentum"}: el comportamiento de las manos firmes ${now.lthSopr < 1 ? "señala agotamiento vendedor" : "modera la toma de ganancias"}`,
        `De ${fmtMes(s0.iso)} a ${fmtMes(now.iso)}: anatomía on-chain de ${type} en ${months} meses de ${macroFase}`,
      ]
    : [
        `${meta.name} ${lthUnder ? "entra en capitulación estructural" : "redefine su suelo de ciclo"}: el NUPL de largo plazo ${lthUnder ? "se vuelve negativo" : "se comprime"} a ${now.nuplLTH.toFixed(2)}`,
        `${type} cotiza ${distLTH < 0 ? "bajo" : "sobre"} el coste base de sus tenedores de largo plazo: lectura on-chain de un ${dd < -25 ? "suelo en construcción" : "rango de acumulación"}`,
        `De ${fmtMes(s0.iso)} a ${fmtMes(now.iso)}: una ${dir} del ${Math.abs(chg).toFixed(0)}% ${dd < -40 ? "restablece las condiciones de máximo valor del ciclo" : "reconfigura la estructura del activo"}`,
      ];

  const lead = `${meta.name} cierra ${fmtMes(now.iso)} cotizando en torno a los ${E.fmt.usd(now.price)}, ${up ? "un " + chg.toFixed(0) + "% por encima" : "un " + Math.abs(chg).toFixed(0) + "% por debajo"} del nivel de ${fmtMes(s0.iso)} y ${Math.abs(dd).toFixed(0)}% ${dd < 0 ? "por debajo" : "por encima"} del ${dd < 0 ? "máximo" : "mínimo"} de ${E.fmt.usd(dd < 0 ? ex.hi.p : ex.lo.p)} registrado el ${fmtDia(dd < 0 ? ex.hi.d : ex.lo.d)}. ` +
    `${dd < -20 ? `La ${dir}, lejos de constituir una ruptura estructural, ha drenado el sobrecalentamiento del ciclo: el MVRV Z-Score ${mvrvZdelta < 0 ? "retrocedió desde " + s0.mvrvZ.toFixed(2) + " hasta " + now.mvrvZ.toFixed(2) : "se sitúa en " + now.mvrvZ.toFixed(2)}` : `El MVRV Z-Score se ubica en ${now.mvrvZ.toFixed(2)}`} y el SOPR de los tenedores de largo plazo ${now.lthSopr < 1 ? "ha caído por debajo de la unidad (" + now.lthSopr.toFixed(2) + "), señal de que la presión vendedora de las manos firmes se ha agotado" : "se mantiene en " + (now.lthSopr || 1).toFixed(2) + ", reflejando una toma de ganancias contenida"}. ` +
    `${lthUnder ? "El precio cotiza por debajo del coste base de los tenedores de largo plazo (" + E.fmt.usd(now.rpLTH) + "), situando al conjunto de las manos firmes en pérdidas no realizadas —una condición de capitulación que históricamente ha coincidido con suelos de ciclo de alta convexidad." : "El coste base de los tenedores de largo plazo se sitúa en " + E.fmt.usd(now.rpLTH) + ", " + (distLTH > 0 ? "un " + distLTH.toFixed(0) + "% por debajo del precio actual, lo que preserva ganancias estructurales para las manos firmes." : "por encima del precio, presionando a la cohorte hacia terreno negativo.")}`;

  // 3 patas
  const fases = [
    { plazo: "Corto plazo · 1 a 4 semanas", temp: now.sthTemp, sig: now.sthSig, body: [
      `La acción de las últimas semanas estuvo condicionada por el comportamiento de los **tenedores de corto plazo (STH)**, cuyo coste base se sitúa en ${E.fmt.usd(now.rpSTH)}. El precio cotiza un **${Math.abs(distSTH).toFixed(0)}% ${distSTH < 0 ? "por debajo" : "por encima"}** de ese nivel, ${distSTH < 0 ? "una desconexión que históricamente precede a rebotes técnicos" : "lo que confirma un sesgo de rentabilidad para los compradores recientes"}.`,
      `El **RSI diario en ${now.rsi1d.toFixed(0)}** describe una condición de **${now.rsi1d < 30 ? "sobreventa extrema" : now.rsi1d > 70 ? "sobrecompra" : "momentum neutral"}**. El **STH-SOPR en ${(now.sthSopr || 1).toFixed(2)}** ${now.sthSopr < 1 ? "confirma que las monedas recientes se realizan en pérdida (capitulación de corto plazo)" : "indica realización con ganancia moderada"}.`,
      `En el mercado de derivados, el desapalancamiento ${now.rsi1d < 35 ? "ha sido saludable: el funding se ha normalizado y el exceso especulativo se ha drenado" : "se mantiene contenido"}. El **Exchange Netflow** se mantiene en sesgo ${up ? "mixto" : "negativo"}, ${up ? "sin presión vendedora dominante" : "indicando migración del inventario hacia almacenamiento en frío pese a la volatilidad"}.`,
    ] },
    { plazo: "Mediano plazo · >4 semanas a 3 meses", temp: Math.round((now.sthTemp + now.lthTemp) / 2), sig: now.comp_lth >= 0.25 ? now.lthSig : now.sthSig, body: [
      `La tendencia intermedia describe un **${macroFase}** que ha recorrido ${months} meses desde el inicio del periodo analizado. La zona de **${E.fmt.usd(Math.min(now.rpLTH, ex.lo.p))}–${E.fmt.usd(now.rpSTH)}** funciona como rango estructural de referencia.`,
      `El **Mayer Multiple en ${now.mayer.toFixed(2)}** (precio sobre su media de 200 días) sitúa a ${type} **${now.mayer < 1 ? "por debajo de su tendencia, en zona de descuento" : "por encima de su tendencia"}**, nivel asociado históricamente con ${now.mayer < 0.8 ? "fases avanzadas de mercado bajista" : now.mayer > 1.5 ? "sobreextensión de techo" : "rango medio de ciclo"}.`,
      `La **resistencia inmediata se ubica en el coste base de los STH (${E.fmt.usd(now.rpSTH)})**: recuperar ese nivel sería la primera confirmación de un cambio de momentum de mediano plazo. El soporte primario coincide con el mínimo del periodo (${E.fmt.usd(ex.lo.p)}).`,
    ] },
    { plazo: "Largo plazo · >6 meses · ciclo macro", temp: now.lthTemp, sig: now.lthSig, body: [
      `La estructura macro **${dd < -25 ? "sigue respetando el patrón histórico de ciclo" : "mantiene su sesgo estructural"}**. El **NUPL de los LTH en ${now.nuplLTH.toFixed(2)}** ${lthUnder ? "marca el punto de mayor estrés del ciclo: las manos firmes están, en agregado, bajo el agua —condición que en ciclos previos ha ofrecido el mejor binomio rentabilidad-riesgo" : "indica que los tenedores de largo plazo conservan ganancias no realizadas " + (now.nuplLTH > 0.5 ? "elevadas (cautela)" : "modestas, coherente con una transición hacia acumulación")}.`,
      `El **MVRV Z-Score en ${now.mvrvZ.toFixed(2)}** ${now.mvrvZ < 0 ? "refuerza la lectura de infravaloración estructural respecto al coste agregado de la red" : now.mvrvZ > 5 ? "advierte de sobrevaloración de ciclo" : "ubica al activo en un rango medio-bajo del ciclo"}.`,
      `El **precio realizado de los LTH ${now.rpLTH > s0.rpLTH ? "ha seguido ascendiendo hasta " + E.fmt.usd(now.rpLTH) + " durante el periodo, prueba de que las manos firmes han absorbido oferta" : "se sitúa en " + E.fmt.usd(now.rpLTH)}**, ${now.rpLTH > s0.rpLTH ? "comportamiento típico de la fase final de un markdown" : "reflejando la rotación de oferta del periodo"}.`,
    ] },
  ];

  const metricas = [
    { k: "MVRV Z-Score", v: now.mvrvZ.toFixed(2), tone: now.mvrvZ < 1.5 ? "buy" : now.mvrvZ > 6 ? "sell" : "neut",
      t: `${now.mvrvZ < 0 ? "Negativo: precio bajo el coste agregado de la red. Infravaloración estructural." : now.mvrvZ < 2 ? "Rango bajo-medio: zona históricamente saludable para acumular." : now.mvrvZ > 6 ? "Sobrecalentamiento de ciclo: zona de distribución." : "Rango medio del ciclo."} Desde ${s0.mvrvZ.toFixed(2)} en ${fmtMes(s0.iso)}.` },
    { k: "SOPR (LTH / STH)", v: `${(now.lthSopr || 1).toFixed(2)} / ${(now.sthSopr || 1).toFixed(2)}`, tone: (now.lthSopr < 1 && now.sthSopr < 1) ? "buy" : "neut",
      t: `${now.lthSopr < 1 ? "LTH-SOPR bajo 1: las manos firmes dejaron de tomar ganancias." : "LTH-SOPR sobre 1: toma de ganancias activa."} ${now.sthSopr < 1 ? "STH-SOPR bajo 1: capitulación de corto plazo." : "STH-SOPR sobre 1: realización en ganancia."}` },
    { k: "Precio vs coste LTH", v: `${distLTH > 0 ? "+" : ""}${distLTH.toFixed(0)}%`, tone: distLTH < 0 ? "buy" : distLTH > 80 ? "sell" : "neut",
      t: `${type} (${E.fmt.usd(now.price)}) cotiza ${distLTH < 0 ? "por debajo" : "por encima"} del coste base de los LTH (${E.fmt.usd(now.rpLTH)}). ${distLTH < 0 ? "Oferta transfiriéndose a descuento: sello de acumulación de fondo." : "Las manos firmes conservan ganancias estructurales."}` },
  ];

  const conclusion = `El diferencial entre la ${dd < -20 ? "solidez macroestructural y la debilidad del precio de corto plazo" : "lectura de las métricas agregadas y la acción reciente del precio"} es el rasgo definitorio del momento actual de ${meta.name}. ` +
    `Los datos on-chain describen un mercado que ${now.mvrvZ < 2 && now.lthSopr < 1.2 ? "ha purgado su exceso —MVRV-Z normalizado, manos firmes en hold— mientras la acción del precio aún refleja el pesimismo reciente" : now.mvrvZ > 5 ? "muestra signos de sobrecalentamiento que aconsejan prudencia" : "transita un rango intermedio sin sesgo extremo"}. ` +
    `${lthUnder ? "El precio por debajo del coste base de los tenedores de largo plazo y un NUPL agregado negativo son, paradójicamente, las condiciones que históricamente han ofrecido el mejor binomio rentabilidad-riesgo para el inversor de horizonte largo." : dd < -20 ? "Históricamente, esta divergencia ha caracterizado las fases finales de acumulación de un ciclo bajista, no los techos." : "La lectura aconseja una gestión disciplinada, priorizando los datos objetivos sobre el sentimiento."}` +
    (type === "ETH" ? " No obstante, la mayor beta de ETH frente a Bitcoin implica que el activo seguirá amplificando tanto las correcciones como las recuperaciones del líder del mercado." : "");

  const riesgos = type === "BTC"
    ? [
        "**Deterioro macroeconómico:** un endurecimiento monetario inesperado o un shock de liquidez global podría prolongar el " + macroFase + " más allá de la media histórica, invalidando la proyección de suelo cercano.",
        `**Quiebre del precio realizado de los LTH:** una pérdida sostenida de la zona de ${E.fmt.usd(now.rpLTH)} (coste base de las manos firmes) señalaría que la acumulación estructural se rompe, abriendo la puerta a una sobreextensión bajista.`,
      ]
    : [
        "**Rotación estructural de capital:** un desplazamiento permanente de la narrativa hacia Bitcoin u otros ecosistemas podría mantener a ETH en infravaloración un periodo prolongado pese a las métricas de suelo.",
        "**Presión de oferta de staking:** una salida masiva de oferta bloqueada en staking en un entorno de precios deprimidos añadiría presión vendedora estructural capaz de retrasar la formación del suelo.",
      ];

  return { meta, type, startIso: s0.iso, endIso: now.iso, months, titulares, dek: `${fmtMes(s0.iso)} → ${fmtMes(now.iso)} · ${dd < 0 ? Math.abs(dd).toFixed(0) + "% desde el máximo del periodo" : "rango del periodo"}`, lead, fases, metricas, conclusion, riesgos, now, s0, ex };
}

function InformeOnchain({ palette }) {
  const [active, setActive] = React.useState("BTC");
  const R = window.BambuRealData[active];
  const latest = R ? R.latestIso : "2026-06-10";
  // opciones de temporalidad (meses hacia atrás desde el último dato)
  const monthsBack = m => { const d = new Date(latest + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - m); return d.toISOString().slice(0, 10); };
  const PRESETS = [{ m: 7, l: "1 semana" }, { m: 30, l: "1 mes" }, { m: 90, l: "3 meses" }, { m: 180, l: "6 meses" }, { m: 244, l: "8 meses (desde oct 2025)" }, { m: 365, l: "12 meses" }, { m: 548, l: "18 meses" }];
  const [meses, setMeses] = React.useState(244);
  const [customStart, setCustomStart] = React.useState("");
  const startIso = customStart || monthsBack(meses);
  const minIso = R ? R.dates[0] : "2015-01-01";

  const r = React.useMemo(() => generarInforme(active, startIso), [active, startIso]);
  if (!r) return <div className="content"><div className="page-head"><h1>Blog</h1><p>Sin datos.</p></div></div>;
  const toneColor = t => t === "buy" ? E.tempColor(20, palette) : t === "sell" ? E.tempColor(85, palette) : E.tempColor(50, palette);

  const doPrint = () => { document.body.classList.add("printing"); setTimeout(() => { window.print(); document.body.classList.remove("printing"); }, 80); };

  return (
    <div className="fade-in">
      {/* controles */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px", flexWrap: "wrap" }}>
        <div className="tabs">
          {Object.keys(BLOG_META).map(k => (
            <button key={k} className={"tab" + (active === k ? " active" : "")} onClick={() => setActive(k)}>
              {BLOG_META[k].name} <span className="tk">{k}</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span className="tiny muted">Temporalidad:</span>
        <select className="inp" style={{ textAlign: "left", width: 190, fontFamily: "var(--sans)" }} value={customStart ? "custom" : meses}
          onChange={e => { if (e.target.value === "custom") setCustomStart(monthsBack(meses)); else { setCustomStart(""); setMeses(+e.target.value); } }}>
          {PRESETS.map(p => <option key={p.m} value={p.m}>Últimos {p.l}</option>)}
          <option value="custom">Desde fecha…</option>
        </select>
        {customStart && <input type="date" className="inp" style={{ width: 150, fontFamily: "var(--mono)", fontSize: 12 }} min={minIso} max={latest} value={customStart} onChange={e => setCustomStart(e.target.value)} />}
        <button className="btn primary no-print" onClick={doPrint}>⤓ Exportar informe a PDF</button>
      </div>

      <article id="blog-article" style={{ maxWidth: 1000 }}>
        <div className="card card-pad" style={{ padding: 30, borderTop: `4px solid ${r.meta.color}`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: mixSoft(r.meta.color), color: r.meta.color, letterSpacing: ".06em" }}>INFORME ON-CHAIN · {r.type}</span>
            <span className="tiny muted">{fmtDia(r.startIso)} → {fmtDia(r.endIso)} · {r.months} meses</span>
          </div>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Titular principal</div>
          <h2 style={{ fontSize: 27, lineHeight: 1.18, letterSpacing: "-.02em", margin: "0 0 8px", fontWeight: 700, textWrap: "balance" }}>{r.titulares[0]}</h2>
          <div style={{ fontSize: 14.5, color: r.meta.color, fontWeight: 600, marginBottom: 16 }}>{r.dek}</div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--ink)", margin: 0, fontWeight: 500 }}>{r.lead}</p>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Titulares alternativos</div>
            <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {r.titulares.slice(1).map((t, i) => <li key={i} style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{t}</li>)}
            </ol>
          </div>
        </div>

        <Card title="Dinámica del ciclo · marco de las tres patas" sub="Lectura del modelo por horizonte temporal sobre el periodo seleccionado" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {r.fases.map((f, i) => {
              const col = E.tempColor(f.temp, palette);
              return (
                <div key={i} style={{ padding: "16px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: col, flex: "none" }} />
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{f.plazo}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <span className="num" style={{ fontWeight: 700, color: col }}>{f.temp.toFixed(0)}°</span>
                    <SignalPill signal={f.sig} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingLeft: 42 }}>
                    {f.body.map((p, j) => <p key={j} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }} dangerouslySetInnerHTML={{ __html: mdBold(p) }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Razonamiento · métricas on-chain clave" sub="Estado actual y lectura de las métricas fundamentales" style={{ marginBottom: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {r.metricas.map((m, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", borderLeft: `4px solid ${toneColor(m.tone)}` }}>
                <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>{m.k}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, color: toneColor(m.tone), margin: "4px 0 8px" }}>{m.v}</div>
                <div className="tiny" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>{m.t}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <Card title="Conclusión · perspectiva editorial">
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--ink)" }}>{r.conclusion}</p>
          </Card>
          <Card title="Riesgos a la tesis estructural">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {r.riesgos.map((rk, i) => (
                <div key={i} style={{ display: "flex", gap: 11 }}>
                  <span style={{ width: 22, height: 22, flex: "none", borderRadius: 6, background: mixSoft(E.tempColor(85, palette)), color: E.tempColor(85, palette), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }} dangerouslySetInnerHTML={{ __html: mdBold(rk) }} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="tiny muted" style={{ margin: "20px 2px 0", lineHeight: 1.5 }}>
          Informe generado por el modelo Bambú v2.2 sobre métricas públicas on-chain · periodo {fmtDia(r.startIso)} – {fmtDia(r.endIso)}. No constituye asesoramiento financiero ni recomendación de inversión. · Pedro Iván Avellaneda
        </div>
      </article>
    </div>
  );
}

function mdBold(s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>'); }

Object.assign(window, { InformeOnchain, generarInforme });
