/* ============================================================
   BAMBÚ · Historial de resúmenes diarios (desde 2017)
   Reconstruye, para cada día, la lectura que Bambu habría dado:
   temperatura STH/LTH, zona y veredicto — con los datos reales.
   ============================================================ */

const HIST_START = "2017-01-01";

/* El régimen de mercado se mide sobre BTC (Mayer y EMA semanal), así que se
   resuelve una vez por fecha y lo comparten las dos tablas. */
function regimeAt(iso, valsBtc) {
  const E = window.BambuEngine, B = window.BambuRealData && window.BambuRealData.BTC;
  if (valsBtc) return E.detectRegime(valsBtc);
  if (!B) return "BULL MARKET";
  const i = B.indexOfIso(iso);
  return E.detectRegime(i >= 0 ? B.rowAt(i) : B.latest);
}

/* ---------- agregado por año ----------
   La tira de contadores que había aquí ponía la exposición media del año al lado
   del retorno de ESE MISMO año, y esa comparación está mal planteada: la señal
   de ciclo tiene horizonte de uno a cuatro años. Medida así parecía fallar casi
   siempre; medida contra lo que vino después, acierta. 2022 cerró con 88% de
   exposición media y −65% en el año, y el siguiente hizo +155%. 2021 cerró con
   16% y +57%, y el siguiente −65%. La tabla de abajo hace la comparación
   correcta y deja las dos columnas a la vista para que se pueda juzgar.

   Sobre el cálculo: esta tabla se apoya en H.rangeComposites, que la
   calibración de bandas ya tiene en caché, en vez de recorrer la serie llamando
   a computeAsset día a día. Esa segunda pasada costaba unos ocho segundos de
   hilo bloqueado por cada combinación de activo y perfil, cuatro en total. El
   precio es que la serie va muestreada (una de cada tres jornadas en BTC), así
   que los porcentajes de la tabla son de la muestra y se declara en su pie; las
   tres tarjetas de arriba siguen usando el año completo, día a día. */
const _histYears = {};
function histYears(type, hz) {
  hz = hz || "lth";
  const ck = type + "|" + hz;
  if (_histYears[ck]) return _histYears[ck];
  const E = window.BambuEngine, H = window.BambuHistory, R = window.BambuRealData[type];
  if (!E || !H || !R) return [];
  const px = R.cols.price;
  const fwd = (i, d) => (i >= 0 && i + d < R.count && px[i] != null && px[i + d] != null)
    ? (px[i + d] / px[i] - 1) * 100 : null;
  /* días reales por año: se cuentan sobre las fechas, sin calcular nada */
  const diasY = {};
  for (let i = 0; i < R.count; i++) {
    const iso = R.dates[i];
    if (iso >= HIST_START && px[i] != null) diasY[iso.slice(0, 4)] = (diasY[iso.slice(0, 4)] || 0) + 1;
  }
  const byY = {};
  H.rangeComposites(type, 27, 99999, 2000).forEach(d => {
    const iso = d.iso;
    if (!iso || iso < HIST_START) return;
    const t = hz === "lth" ? d.lthTemp : d.sthTemp;
    if (t == null || d.price == null) return;
    const rk = H.zoneOf(t, type, hz, 27).rank;
    const reg = regimeAt(iso, null);
    (byY[iso.slice(0, 4)] = byY[iso.slice(0, 4)] || []).push({ i: R.indexOfIso(iso), iso, rk, reg, exp: E.exposureFor(rk, reg), px: d.price });
  });
  return _histYears[ck] = Object.keys(byY).sort().map(y => {
    const a = byY[y], n = a.length, last = a[n - 1];
    const exps = a.map(x => x.exp);
    const regs = {};
    a.forEach(x => regs[x.reg] = (regs[x.reg] || 0) + 1);
    const regTop = Object.keys(regs).sort((p, q) => regs[q] - regs[p])[0];
    return { year: y, n: diasY[y] || n, nMuestra: n,
      acum: a.filter(x => x.rk < 40).length / n * 100,
      neu: a.filter(x => x.rk >= 40 && x.rk <= 60).length / n * 100,
      dist: a.filter(x => x.rk > 60).length / n * 100,
      expMed: exps.reduce((s, v) => s + v, 0) / n,
      expIni: a[0].exp, expFin: last.exp,
      expMin: Math.min.apply(null, exps), expMax: Math.max.apply(null, exps),
      regTop, regPct: regs[regTop] / n * 100,
      ret: (last.px / a[0].px - 1) * 100,
      f180: fwd(last.i, 180), f365: fwd(last.i, 365),
      cerrado: last.i >= 0 && last.i + 365 < R.count };
  });
}

/* Dirección del año con banda neutral declarada: con un corte binario en 60,
   2020 cerraba con el 56% de exposición media —más de la mitad del capital
   dentro— y quedaba clasificado como "pidió estar fuera", así que al subir el
   mercado después se etiquetaba como fallo. Cuatro puntos de diferencia con un
   umbral elegido a mano no son una dirección equivocada: son ausencia de
   dirección, y los años ambiguos salen del recuento en vez de inflar un lado. */
const HY_IN = 60, HY_OUT = 45;
function hyVerdict(y) {
  if (y.f365 == null) return { lab: "sin horizonte", ok: null };
  if (y.expMed > HY_OUT && y.expMed < HY_IN) return { lab: "sin dirección clara", ok: null };
  const dentro = y.expMed >= HY_IN;
  const ok = dentro === (y.f365 > 0);
  return { lab: ok ? "apuntaba bien" : "apuntaba en contra", ok };
}

/* El veredicto sale del motor (E.verdictFromRank), no de cortes propios:
   con su propia escalera esta tabla contradecía al Resumen en los bordes. */
function SectionHistorial({ palette }) {
  const E = window.BambuEngine, RD = window.BambuRealData;
  const [type, setType] = React.useState("BTC");
  const R = RD && RD[type];
  const years = React.useMemo(() => {
    if (!R) return [];
    const endY = Number((R.latestIso || "2026").slice(0, 4));
    const out = []; for (let y = endY; y >= 2017; y--) out.push(y);
    return out;
  }, [R]);
  const [year, setYear] = React.useState(() => (R ? Number(R.latestIso.slice(0, 4)) : 2026));
  const [q, setQ] = React.useState("todos");

  const rows = React.useMemo(() => {
    if (!R || !E) return [];
    const out = [];
    for (let i = 0; i < R.count; i++) {
      const iso = R.dates[i];
      if (iso < HIST_START) continue;
      if (Number(iso.slice(0, 4)) !== year) continue;
      const vals = R.rowAt(i);
      const res = E.computeAsset({ type, values: DD.valuesFor(type, vals) }, { k: 27 });
      /* las columnas y el veredicto viven en la escala publicada 0-100 */
      const rS = window.BambuHistory.zoneOf(res.sth.temp, type, "sth", 27);
      const rL = window.BambuHistory.zoneOf(res.lth.temp, type, "lth", 27);
      const vS = E.verdictFromRank(rS.rank), vL = E.verdictFromRank(rL.rank);
      const prev = i > 0 ? R.cols.price[i - 1] : null;
      /* el régimen se define sobre BTC, así que la fila de ETH toma el de BTC
         de esa misma fecha: usar el de ETH inclinaría la exposición con un
         régimen que el modelo no reconoce */
      const regime = regimeAt(iso, type === "BTC" ? vals : null);
      out.push({
        iso, label: R.labelEs(iso), price: vals.price,
        chg: prev ? ((vals.price - prev) / prev) * 100 : null,
        sthTemp: rS.rank, lthTemp: rL.rank,
        sthZone: rS.label, lthZone: rL.label,
        regime,
        expL: E.exposureFor(rL.rank, regime), expS: E.exposureFor(rS.rank, regime),
        stanceS: vS.w, shortS: vS.short, stanceL: vL.w, shortL: vL.short,
        stance: vL.w, short: vL.short, mt: (rS.rank + rL.rank) / 2,
      });
    }
    return out.reverse();
  }, [R, type, year, E]);

  /* El perfil elegido decide qué veredicto gobierna filtro y estadísticas:
     un inversor de ciclo y uno táctico miran la misma tabla buscando cosas
     distintas. */
  const [perfil, setPerfil] = React.useState("lth");
  const vOf = r => perfil === "sth" ? r.stanceS : r.stanceL;
  const filtered = React.useMemo(() => q === "todos" ? rows : rows.filter(r => vOf(r) === q), [rows, q, perfil]);

  const stanceCol = s => s === "ACUMULAR" ? "#2F7D5B" : s === "REDUCIR/DISTRIBUIR" ? "#C0492E" : "#7A8A80";
  const years10 = React.useMemo(() => histYears(type, perfil), [type, perfil]);
  /* Las tarjetas del año elegido usan el año completo, día a día: esas filas ya
     están calculadas para la tabla de abajo, así que no cuesta nada y evita
     presentar como exacto un dato muestreado. */
  const yr = React.useMemo(() => {
    if (!rows.length || !R) return null;
    const a = rows.slice().reverse();          // del 1 de enero al cierre
    const n = a.length, last = a[n - 1];
    const rk = r => perfil === "sth" ? r.sthTemp : r.lthTemp;
    const ex = r => perfil === "sth" ? r.expS : r.expL;
    const exps = a.map(ex);
    const regs = {};
    a.forEach(r => regs[r.regime] = (regs[r.regime] || 0) + 1);
    const regTop = Object.keys(regs).sort((p, q) => regs[q] - regs[p])[0];
    const px = R.cols.price, i0 = R.indexOfIso(last.iso);
    const fwd = d => (i0 >= 0 && i0 + d < R.count && px[i0] != null && px[i0 + d] != null)
      ? (px[i0 + d] / px[i0] - 1) * 100 : null;
    return { year: String(year), n,
      acum: a.filter(r => rk(r) < 40).length / n * 100,
      neu: a.filter(r => rk(r) >= 40 && rk(r) <= 60).length / n * 100,
      dist: a.filter(r => rk(r) > 60).length / n * 100,
      expMed: exps.reduce((s, v) => s + v, 0) / n,
      expIni: ex(a[0]), expFin: ex(last),
      expMin: Math.min.apply(null, exps), expMax: Math.max.apply(null, exps),
      regTop, regPct: regs[regTop] / n * 100,
      ret: a[0].price ? (last.price / a[0].price - 1) * 100 : null,
      f180: fwd(180), f365: fwd(365) };
  }, [rows, perfil, year, R]);
  const baseLab = perfil === "sth" ? "de la bolsa táctica" : "de todo el capital";
  const sgn = v => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(0) + "%";

  const exportCsv = () => {
    const head = ["Fecha", "Precio USD", "Var %", "Lectura LTH /100", "Lectura STH /100", "Zona LTH", "Zona STH",
      "Exposicion LTH % capital", "Exposicion STH % bolsa tactica", "Regimen",
      "Veredicto ciclo (LTH)", "Veredicto corto (STH)", "Accion"];
    const body = filtered.map(r => [r.iso, r.price != null ? r.price.toFixed(2) : "", r.chg != null ? r.chg.toFixed(2) : "",
      r.lthTemp.toFixed(1), r.sthTemp.toFixed(1), r.lthZone, r.sthZone,
      r.expL.toFixed(0), r.expS.toFixed(0), r.regime,
      r.stanceL, r.stanceS, perfil === "sth" ? r.shortS : r.shortL]);
    const csv = [head, ...body].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bambu-historial-${type}-${year}.csv`; a.click();
  };

  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>Historial de lecturas <HelpDot term="Historial de lecturas diarias" def="Para cada día desde 2017, Bambu reconstruye con los datos reales de ese día qué lectura habría dado: la temperatura de corto (STH) y de largo plazo (LTH), la zona y el veredicto (acumular, mantener, reducir o distribuir). Sirve para dos cosas: ver con tus propios ojos que el modelo marcaba zonas frías en los suelos y calientes en los techos, y repasar qué decía el sistema el día que tú compraste o vendiste." /></h1>
          <p>Qué habría dicho Bambu cada día, con los datos de ese día · desde 1 de enero de 2017. Elige el perfil para que las estadísticas y el filtro respondan a tu horizonte.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="seg">
            {["BTC", "ETH"].map(t => <button key={t} className={"seg-btn" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t}</button>)}
          </div>
          <div className="seg">
            <button className={"seg-btn" + (perfil === "lth" ? " on" : "")} onClick={() => setPerfil("lth")}>Ciclo</button>
            <button className={"seg-btn" + (perfil === "sth" ? " on" : "")} onClick={() => setPerfil("sth")}>Corto plazo</button>
          </div>
          <select className="sel" value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="sel" value={q} onChange={e => setQ(e.target.value)}>
            <option value="todos">Todos los veredictos</option>
            <option value="ACUMULAR">Solo acumular</option>
            <option value="MANTENER">Solo mantener</option>
            <option value="REDUCIR/DISTRIBUIR">Solo reducir/distribuir</option>
          </select>
          <button className="btn-ghost" onClick={exportCsv}>Exportar CSV</button>
        </div>
      </div>

      {/* tres lecturas del año: cómo se repartió, dónde estuvo el capital y qué vino después */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", marginBottom: 16 }}>
        <div className="card" style={{ padding: "14px 16px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>Cómo se repartió {year} <span style={{ textTransform: "none", letterSpacing: 0 }}>· {perfil === "sth" ? "corto plazo" : "ciclo"}</span></div>
          <div style={{ display: "flex", height: 13, borderRadius: 7, overflow: "hidden", margin: "11px 0 9px", background: "var(--surface-3)" }}>
            {yr && [["#2F7D5B", yr.acum], ["#7A8A80", yr.neu], ["#C0492E", yr.dist]].map(([c, v], k) =>
              v > 0 ? <div key={k} style={{ width: v + "%", background: c }} /> : null)}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {yr && [["Acumulación", yr.acum, "#2F7D5B"], ["Neutral", yr.neu, "#7A8A80"], ["Distribución", yr.dist, "#C0492E"]].map(([l, v, c]) => (
              <span key={l} className="tiny" style={{ color: "var(--ink-2)" }}>
                <b className="num" style={{ color: E.inkColor(c, 4.5), fontSize: 14 }}>{v.toFixed(0)}%</b> {l}
              </span>
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.45 }}>{yr ? `${yr.n} días con lectura · régimen dominante ${yr.regTop.toLowerCase()} el ${yr.regPct.toFixed(0)}% del año` : "—"}</div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>Dónde pidió estar el capital <HelpDot term="Exposición a lo largo del año" def="La media anual sola engaña: estar al 88% todos los días no es lo mismo que promediar 88% oscilando entre 20% y 100%. Por eso se muestran el primer día, el último y el recorrido completo. En el perfil de ciclo la cifra es sobre todo el capital; en el táctico, sobre la bolsa táctica. Lo que se mueve es la diferencia con lo que ya estuviera invertido." /></div>
          {yr
            ? <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "9px 0 4px", flexWrap: "wrap" }}>
                  <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{yr.expIni.toFixed(0)}%</span>
                  <span className="tiny muted">→</span>
                  <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{yr.expFin.toFixed(0)}%</span>
                  <span className="tiny muted">del 1 de enero al cierre del año</span>
                </div>
                <div className="tiny" style={{ color: "var(--ink-2)" }}>Recorrido <b className="num">{yr.expMin.toFixed(0)}–{yr.expMax.toFixed(0)}%</b> · media <b className="num">{yr.expMed.toFixed(0)}%</b> · {baseLab}</div>
                <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.45 }}>{yr.expMax - yr.expMin < 25 ? "Poco recorrido: el año entero cayó en la misma parte del ciclo." : "Recorrido amplio: el año cruzó zonas distintas del ciclo."}</div>
              </>
            : <div className="tiny muted" style={{ marginTop: 10 }}>—</div>}
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".1em" }}>Lo que vino después <HelpDot term="Por qué no se compara con el retorno del mismo año" def="La señal de ciclo tiene horizonte de uno a cuatro años, así que enfrentarla al cambio de precio del mismo año calendario mide la ventana equivocada. 2022 cerró con el 88% de exposición media y −65% en el año, y los 365 días siguientes dieron +155%. 2021 cerró con el 16% y +57%, y los 365 siguientes −65%. Aquí se muestran las dos ventanas para que se puedan juzgar por separado." /></div>
          {yr
            ? <>
                <div style={{ display: "flex", gap: 18, margin: "9px 0 4px", flexWrap: "wrap" }}>
                  {[["180d después", yr.f180], ["365d después", yr.f365]].map(([l, v]) => (
                    <div key={l}>
                      <div className="num" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: v == null ? "var(--ink-3)" : E.inkColor(v > 0 ? "#2F7D5B" : "#C0492E", 4.5) }}>{sgn(v)}</div>
                      <div className="tiny muted">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="tiny" style={{ color: "var(--ink-2)" }}>Desde el cierre del año · dentro del año el precio hizo <b className="num">{sgn(yr.ret)}</b></div>
                <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.45 }}>{hyVerdict(yr).ok == null ? (yr.f365 == null ? "Sin horizonte completo todavía: este año no se puede juzgar." : "Exposición media en la franja ambigua: el año no pidió una dirección clara.") : hyVerdict(yr).ok ? "La exposición del año apuntaba en la dirección correcta." : "La exposición del año apuntaba en contra de lo que vino."}</div>
              </>
            : <div className="tiny muted" style={{ marginTop: 10 }}>—</div>}
        </div>
      </div>

      <Card title={`Lectura día a día · ${type} · ${year}`} sub={`${filtered.length} días${q === "todos" ? "" : " · filtrado"} · del más reciente al más antiguo`} pad={false}>
        <div style={{ maxHeight: 620, overflow: "auto" }}>
          <table className="tbl">
            <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--card)" }}>
              <tr>
                <th>Fecha</th>
                <th className="c">Precio <HelpDot term="Precio" def="Cierre de ese día en dólares, el mismo que usó el modelo para calcular la lectura. No es el precio de hoy: es el que había cuando Bambu habría dado este veredicto." /></th>
                <th className="c">Var <HelpDot term="Variación diaria" def="Cuánto se movió el precio frente al cierre del día anterior, en porcentaje. Sirve para situar la lectura: un veredicto frío en un día de caída fuerte no significa lo mismo que en un día plano." /></th>
                <th className="c">LTH /100 <HelpDot term="Temperatura de largo plazo" def="La lectura del ciclo en una escala de 0 a 100, donde 0 es el extremo frío y 100 el caliente. Resume las métricas de largo plazo de ese día —SOPR de holders veteranos, NUPL, MVRV-Z, Mayer— en un solo número. Por debajo de 35 hay zona de acumulación; por encima de 65, de distribución." /></th>
                <th className="c">STH /100 <HelpDot term="Temperatura de corto plazo" def="Lo mismo en la escala de 0 a 100, pero con las métricas de los compradores recientes: SOPR de corto plazo, NUPL, distancia al precio realizado. Mide si el mercado está sobrecalentado o exhausto en semanas, no en años." /></th>
                <th className="c">Exp. LTH <HelpDot term="Exposición sugerida del ciclo" def="Qué parte de TODO el capital habría pedido el modelo ese día, de 0 a 100. Sale del percentil de la lectura de largo plazo: en el extremo frío pide estar dentro del todo y en el caliente, fuera del todo. El régimen de mercado de ese día inclina la cifra unos puntos en la zona media, sin mover los extremos. No es una orden de comprar o vender: es el destino, y lo que se mueve es la diferencia con lo que ya estuviera invertido." /></th>
                <th className="c">Exp. STH <HelpDot term="Exposición sugerida táctica" def="La misma curva aplicada a la lectura de corto plazo, pero sobre la bolsa táctica y no sobre la cartera entera. Sirve para mover ese tramo, no para decidir el peso del capital total: el backtest del termómetro táctico no encontró ventaja medida en compras frente a comprar un día al azar." /></th>
                <th className="c">Ciclo · LTH <HelpDot term="Zona del ciclo" def="La traducción en palabras de la temperatura de largo plazo: frío, neutral o caliente. Es la que manda en la decisión, porque marca en qué parte del ciclo estaba el mercado ese día." /></th>
                <th className="c">Corto · STH <HelpDot term="Zona de corto plazo" def="La misma traducción para el termómetro táctico. Sirve de contexto, no de decisión: afina el momento dentro de lo que ya dijo el ciclo, y por sí solo no tiene ventaja medida sobre comprar un día al azar." /></th>
                <th>Qué decía <HelpDot term="El veredicto del día" def="La acción que el modelo habría propuesto con los datos de ese día: acumular, mantener, reducir o distribuir. Se reconstruye con el histórico disponible hasta esa fecha, sin usar nada posterior, para que la lectura sea la que de verdad se pudo ver entonces." /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sc = E.tempColor(r.sthTemp, palette), lc = E.tempColor(r.lthTemp, palette);
                const vcL = stanceCol(r.stanceL), vcS = stanceCol(r.stanceS);
                return (
                  <tr key={r.iso}>
                    <td className="tiny" style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{r.label}</td>
                    <td className="c num">{r.price == null ? "—" : "$" + r.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                    <td className="c num tiny" style={{ color: r.chg == null ? "var(--ink-3)" : r.chg >= 0 ? "#2F7D5B" : "#C0492E" }}>{r.chg == null ? "—" : (r.chg > 0 ? "+" : "") + r.chg.toFixed(1) + "%"}</td>
                    <td className="c"><span className="badge num" style={{ background: mixSoft(lc), color: lc, fontWeight: 700 }}>{r.lthTemp.toFixed(0)}</span></td>
                    <td className="c"><span className="badge num" style={{ background: mixSoft(sc), color: sc, fontWeight: 700 }}>{r.sthTemp.toFixed(0)}</span></td>
                    <td className="c num" style={{ fontWeight: 700, color: E.inkColor(lc, 4.5) }}>{r.expL.toFixed(0)}%</td>
                    <td className="c num" style={{ color: "var(--ink-2)" }}>{r.expS.toFixed(0)}%</td>
                    <td className="c"><span className="badge" style={{ background: mixSoft(vcL), color: vcL, fontWeight: 700, whiteSpace: "nowrap" }}>{r.stanceL}</span></td>
                    <td className="c"><span className="badge" style={{ background: mixSoft(vcS), color: vcS, fontWeight: 700, whiteSpace: "nowrap" }}>{r.stanceS}</span></td>
                    <td className="tiny muted">{perfil === "sth" ? r.shortS : r.shortL}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tiny muted" style={{ padding: "10px 14px", lineHeight: 1.5 }}>
          Cómo leerlo: cada fila es la lectura que el modelo habría dado <b>ese día</b>, calculada solo con los datos disponibles hasta entonces. Compara los años de suelo (mayoría de días fríos) con los de techo (mayoría calientes).
          Las dos columnas de exposición recorren el rango completo: <b>Exp. LTH</b> es sobre todo el capital y <b>Exp. STH</b> sobre la bolsa táctica. Resultados pasados no garantizan resultados futuros.
        </div>
      </Card>

      {/* la comparación que de verdad juzga la curva de exposición */}
      <Card title="Exposición del año frente a lo que vino después"
            sub={`Un año por fila · perfil ${perfil === "sth" ? "de corto plazo" : "de ciclo"} · la media de exposición contra el retorno del mismo año y el de los 365 días siguientes`}
            pad={false} style={{ marginTop: 20 }}>
        <table className="tbl">
          <thead><tr>
            <th>Año</th><th className="c">Reparto del año</th><th className="r">Exp. media</th><th className="c">Recorrido</th>
            <th className="r">Exp. al cierre</th><th className="r">{type} en el año</th><th className="r">365d después</th><th>Veredicto</th>
          </tr></thead>
          <tbody>
            {years10.slice().reverse().map(y0 => {
              /* la fila del año seleccionado reutiliza el objeto exacto, calculado
                 día a día: mostrar 95/5/0 en la tarjeta y 94/6/0 en la tabla para
                 el mismo año obliga al lector a decidir a cuál creer */
              const y = (yr && y0.year === yr.year) ? { ...y0, ...yr } : y0;
              const v = hyVerdict(y);
              return (
                <tr key={y.year} style={{ background: y.year === String(year) ? "var(--surface-2, #F2F6F2)" : undefined }}>
                  <td className="num" style={{ fontWeight: 700 }}>{y.year}<div className="tiny muted" style={{ fontWeight: 400 }}>{y.n} días</div></td>
                  <td>
                    <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", minWidth: 110, background: "var(--surface-3)" }}>
                      {[["#2F7D5B", y.acum], ["#7A8A80", y.neu], ["#C0492E", y.dist]].map(([c, v], k) => v > 0 ? <div key={k} style={{ width: v + "%", background: c }} /> : null)}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>{y.acum.toFixed(0)}/{y.neu.toFixed(0)}/{y.dist.toFixed(0)}</div>
                  </td>
                  <td className="num r" style={{ fontWeight: 700 }}>{y.expMed.toFixed(0)}%</td>
                  <td className="num c tiny">{y.expMin.toFixed(0)}–{y.expMax.toFixed(0)}%</td>
                  <td className="num r">{y.expFin.toFixed(0)}%</td>
                  <td className="num r" style={{ color: E.inkColor(y.ret > 0 ? "#2F7D5B" : "#C0492E", 4.5) }}>{sgn(y.ret)}</td>
                  <td className="num r" style={{ fontWeight: 700, color: y.f365 == null ? "var(--ink-3)" : E.inkColor(y.f365 > 0 ? "#2F7D5B" : "#C0492E", 4.5) }}>{sgn(y.f365)}</td>
                  <td className="tiny" style={{ fontSize: v.ok == null ? 12 : undefined, color: v.ok == null ? "var(--ink-2)" : E.inkColor(v.ok ? "#2F7D5B" : "#C0492E", 4.5), fontWeight: 600, whiteSpace: "nowrap" }}>
                    {v.lab}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="tiny" style={{ padding: "12px 16px", lineHeight: 1.55, color: "var(--ink-2)", borderTop: "1px solid var(--border)" }}>
          <b>Reparto</b> es el porcentaje de días del año en acumulación / neutral / distribución según el perfil elegido arriba.
          El <b>veredicto</b> compara una sola cosa: si el año pidió estar mayoritariamente dentro (exposición media ≥{HY_IN}%) y los 365 días siguientes subieron, o si pidió estar fuera (≤{HY_OUT}%) y bajaron.
          Los años cuya exposición media cae entre {HY_OUT} y {HY_IN} quedan como <b>sin dirección clara</b> y no cuentan para ningún lado: con medio capital dentro no hay dirección que acertar o fallar, y forzarlos a un lado por unos pocos puntos inflaría el resultado.
          Es una prueba gruesa y con pocas observaciones —una por año—, no una medida de rentabilidad: no hay trayectoria, ni costes, ni comparación con un DCA.
          Y los umbrales de la curva se eligieron con toda la serie delante, así que ningún año de esta tabla es del todo fuera de muestra.
          Los porcentajes de esta tabla se calculan sobre la serie muestreada que ya usa la calibración de bandas —una de cada tres jornadas— para no recalcular quince años en cada cambio de perfil; la fila del año seleccionado y las tres tarjetas de arriba usan el año completo, día a día.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SectionHistorial });
