/* ============================================================
   BAMBÚ · Ciclos de zona · backtest DCA por ciclo
   Para cada ciclo de halving se localizan las zonas de veredicto:
   · SUELO DE CICLO   → la lectura entra en acumulación (bajo 40)
   · TECHO DE CICLO   → la lectura entra en distribución (sobre 60)
   Con 1.000 USD por ciclo se compra en tramos semanales mientras
   dure el suelo y se vende en tramos mientras dure el techo.
   Todo se contrasta con comprar de golpe y aguantar.
   ============================================================ */

const CZ_CAPITAL = 1000;      // presupuesto por ciclo, en USD
const CZ_BUY_WEEKS = 26;      // tramos semanales en los que se reparte
/* Escalera de distribución: cada peldaño se desbloquea al cruzar su nivel de
   lectura, y vende una fracción creciente de la posición. Escalonar por NIVEL
   y no por semana evita que una racha plana en 61 consuma todo el cupo antes
   de que llegue el techo real: para vender más, el mercado tiene que calentarse
   de verdad. */
const CZ_ESCALERA = [
  { nivel: 62, parte: 0.10 },
  { nivel: 68, parte: 0.12 },
  { nivel: 74, parte: 0.15 },
  { nivel: 80, parte: 0.20 },
  { nivel: 86, parte: 0.25 },
  { nivel: 92, parte: 0.35 },
];
const CZ_SELL_TRANCHES = CZ_ESCALERA.length;
const CZ_SUELO_MARGEN = 0.25; // se compra hasta un 25% por encima del mínimo reciente
const CZ_TECHO_MARGEN = 0.15; // se vende desde un 15% por debajo del máximo reciente
const CZ_VENTANA = 52;        // semanas de la ventana móvil que define suelo y techo

/* ---------- lecturas semanales de un ciclo ---------- */
function czWeekly(type, hz, k) {
  const H = window.BambuHistory, E = window.BambuEngine, DD = window.BambuData;
  const R = window.BambuRealData[type];
  if (!R || !R.count) return [];
  k = k || 27;
  const out = [];
  for (let i = 0; i < R.count; i += 7) {
    const v = R.rowAt(i);
    if (v.price == null) continue;
    const res = E.computeAsset({ type, values: DD.valuesFor(type, v) }, { k });
    out.push({ i, iso: R.dates[i], px: v.price, rank: H.zoneOf(res[hz].temp, type, hz, k).rank });
  }
  /* Ventana móvil de 52 semanas sobre la serie COMPLETA, no reiniciada en cada
     halving: así al arrancar un ciclo la referencia refleja los precios del
     ciclo anterior. Con mínimo y máximo acumulados desde el inicio del ciclo,
     "cerca del máximo" era cierto desde la primera semana (el máximo era el
     precio de ese día) y "cerca del mínimo" quedaba falso para siempre. */
  out.forEach((d, j) => {
    const desde = Math.max(0, j - CZ_VENTANA + 1);
    let lo = Infinity, hi = -Infinity;
    for (let q = desde; q <= j; q++) { const p = out[q].px; if (p < lo) lo = p; if (p > hi) hi = p; }
    d.rollLo = lo; d.rollHi = hi;
    d.enSuelo = d.px <= lo * (1 + CZ_SUELO_MARGEN);
    d.enTecho = d.px >= hi * (1 - CZ_TECHO_MARGEN);
  });
  return out;
}

/* ---------- el backtest, ciclo a ciclo ----------
   Reglas fijadas de antemano, iguales en todos los ciclos y sin mirar el futuro:

   1. Cada ciclo arranca con 1.000 USD en efectivo.
   2. El veredicto define DÓNDE están el suelo y el techo del ciclo: las semanas
      en zona de acumulación forman la banda de suelo, las de distribución la
      banda de techo. El backtest opera dentro de esas bandas.
   3. Compra: mientras la semana esté en suelo, un tramo por semana, con un tope
      de 26 tramos POR EPISODIO de suelo. Al entrar en un suelo nuevo el cupo se
      renueva, porque un ciclo de cuatro años tiene más de una ventana.
   4. Venta: mientras la semana esté en techo, un octavo de la posición por
      semana, con un tope de 8 ventas POR EPISODIO. Sin ese tope, una racha
      caliente larga liquidaba el 100% y dejaba el capital fuera años.
   5. Lo cobrado vuelve al efectivo y puede reinvertirse en el siguiente suelo:
      es lo que hace un inversor de largo plazo con un plan escrito.
   6. Lo que no se vendió se valora al último precio del ciclo. */
function czCycleBacktest(type, hz, k) {
  const H = window.BambuHistory;
  const R = window.BambuRealData[type];
  if (!R || !H.CYCLE_ORIGINS) return [];
  const rows = czWeekly(type, hz, k);
  if (!rows.length) return [];
  const ORI = H.CYCLE_ORIGINS;
  const nowCycle = H.cycleIndexOf(window.BambuDataDate || R.latestIso);
  const primerDato = R.dates[0];
  const out = [];

  for (let c = 0; c < ORI.length; c++) {
    const ini = ORI[c], fin = c + 1 < ORI.length ? ORI[c + 1] : "9999-12-31";
    const seg = rows.filter(d => d.iso >= ini && d.iso < fin);
    if (seg.length < 26) continue;
    /* el activo tiene que existir durante todo el ciclo: si su primer dato es
       posterior al arranque, ese ciclo no es comparable y se descarta */
    const cubierto = primerDato <= ini;
    if (!cubierto) continue;

    const tramo = CZ_CAPITAL / CZ_BUY_WEEKS;
    let cash = CZ_CAPITAL, units = 0, invertido = 0, cobrado = 0;
    let compEp = 0, estado = null;               // cupo de compra del episodio
    let peldano = 0, peldanoMax = 0;             // peldaño en uso y máximo alcanzado
    const compras = [], ventas = [];
    /* por qué no se operó cada semana, para poder explicarlo sin inventar */
    let sinCupo = 0, sinUnidades = 0, sinEfectivo = 0, sinPeldano = 0;
    /* El veredicto dice CUÁNDO el mercado está frío o caliente; la ventana móvil
       de 52 semanas dice DÓNDE está el precio. Solo se opera cuando coinciden. */
    let sinLectura = 0, sinBanda = 0;

    seg.forEach(d => {
      const frio = d.rank < 40, caliente = d.rank > 60;
      const zona = (frio && d.enSuelo) ? "suelo" : (caliente && d.enTecho) ? "techo" : null;
      /* La transición de episodio se evalúa ANTES de la salida temprana: si se
         hace después, las semanas neutrales nunca dejan estado en null y dos
         suelos separados por una pausa cuentan como un episodio continuo, con
         lo que el cupo de compras se agota una sola vez para todo el ciclo. */
      if (zona !== estado) { estado = zona; compEp = 0; }
      if (!zona) { if (!frio && !caliente) sinLectura++; else sinBanda++; return; }
      /* un enfriamiento completo reinicia la escalera: puede formarse otro techo */
      if (frio && d.rank < 30) peldano = 0;

      if (zona === "suelo") {
        if (compEp >= CZ_BUY_WEEKS) { sinCupo++; return; }
        if (cash <= 0.01) { sinEfectivo++; return; }
        const usd = Math.min(tramo, cash);
        cash -= usd; invertido += usd; units += usd / d.px; compEp++;
        compras.push({ iso: d.iso, px: d.px, usd, rank: d.rank });
      } else {
        if (units <= 1e-12) { sinUnidades++; return; }
        /* Un solo peldaño por semana. Barrer todos los cruzados de golpe sumaba
           sus fracciones y liquidaba casi toda la posición en una sola semana,
           a mitad del rango del ciclo: exactamente el defecto que la escalera
           debía evitar. Subiendo de uno en uno, salir del todo exige que el
           mercado siga calentándose semana tras semana. */
        if (peldano >= CZ_ESCALERA.length || d.rank < CZ_ESCALERA[peldano].nivel) { sinPeldano++; return; }
        const parte = CZ_ESCALERA[peldano].parte;
        peldano++;
        if (peldano > peldanoMax) peldanoMax = peldano;
        const u = units * Math.min(1, parte);
        units -= u; const usd = u * d.px; cobrado += usd; cash += usd;
        ventas.push({ iso: d.iso, px: d.px, usd, rank: d.rank, peldano });
      }
    });

    const pxFin = seg[seg.length - 1].px, pxIni = seg[0].px;
    const abierta = units * pxFin;
    /* El efectivo cuenta al cierre: en un plan que recicla, lo cobrado en las
       ventas es parte del resultado y no una cifra a descontar. */
    const valorFinal = abierta + cash;
    /* invertido es despliegue BRUTO: incluye el capital inicial más lo cobrado
       en ventas y vuelto a comprar. Lo que exceda del capital es reinversión. */
    const reinvertido = Math.max(0, invertido - CZ_CAPITAL);
    const unidadesCompradas = compras.reduce((s, x) => s + x.usd / x.px, 0);
    const costeMedio = unidadesCompradas > 0 ? invertido / unidadesCompradas : null;
    const hold = CZ_CAPITAL * (pxFin / pxIni);
    /* DCA constante: el mismo capital repartido en tramos iguales a lo largo de
       todo el ciclo, sin mirar la lectura. Es la referencia comparable, porque
       comprar de golpe el primer día del ciclo parte de un mínimo casi perfecto
       (el halving ocurre tras el mercado bajista) y por construcción gana. */
    const dcaTramo = CZ_CAPITAL / seg.length;
    let dcaUnits = 0;
    seg.forEach(d => { dcaUnits += dcaTramo / d.px; });
    const dcaPlano = dcaUnits * pxFin;
    /* rango real del ciclo, para poder juzgar si la banda del veredicto acertó */
    const pxs = seg.map(d => d.px);
    const cycLo = Math.min(...pxs), cycHi = Math.max(...pxs);

    out.push({
      cycle: c, ini, fin: seg[seg.length - 1].iso, actual: c === nowCycle, semanas: seg.length,
      invertido, reinvertido, cash, unitsFin: units, costeMedio, cobrado, abierta, valorFinal,
      multiplo: CZ_CAPITAL > 0 ? valorFinal / CZ_CAPITAL : null,
      retorno: (valorFinal / CZ_CAPITAL - 1) * 100,
      hold, holdRet: (hold / CZ_CAPITAL - 1) * 100,
      dcaPlano, dcaRet: (dcaPlano / CZ_CAPITAL - 1) * 100,
      ventaja: ((valorFinal / hold) - 1) * 100,
      ventajaDca: ((valorFinal / dcaPlano) - 1) * 100,
      compras, ventas, pxIni, pxFin, cycLo, cycHi,
      semSuelo: compras.length, semTecho: ventas.length,
      semFuera: seg.length - compras.length - ventas.length,
      sinLectura, sinBanda, sinCupo, sinUnidades, sinEfectivo, sinPeldano, peldano: peldanoMax,
      sinOperar: compras.length === 0 && ventas.length === 0,
      sueloLo: compras.length ? Math.min(...compras.map(x => x.px)) : null,
      sueloHi: compras.length ? Math.max(...compras.map(x => x.px)) : null,
      techoLo: ventas.length ? Math.min(...ventas.map(x => x.px)) : null,
      techoHi: ventas.length ? Math.max(...ventas.map(x => x.px)) : null,
      ventaMedia: ventas.length ? ventas.reduce((s, x) => s + x.usd, 0) / ventas.reduce((s, x) => s + x.usd / x.px, 0) : null,
      /* dónde cayó el coste medio dentro del rango del ciclo: 0 = compró en el
         mínimo exacto, 100 = compró en el máximo */
      posCoste: costeMedio != null && cycHi > cycLo ? ((costeMedio - cycLo) / (cycHi - cycLo)) * 100 : null,
      posVenta: null,
    });
    const last = out[out.length - 1];
    if (last.ventaMedia != null && cycHi > cycLo) last.posVenta = ((last.ventaMedia - cycLo) / (cycHi - cycLo)) * 100;
  }
  return out;
}

/* Motivo dominante de que no se ejecutara una operación, derivado del contador
   mayoritario en lugar de una cadena de condiciones escrita a mano: así el
   mensaje siempre cita la causa real y no puede quedar obsoleto al cambiar la
   mecánica. */
function czMotivo(c) {
  const cand = [
    { n: c.sinUnidades, t: "las semanas de techo llegaron antes de que hubiera posición que vender" },
    { n: c.sinLectura, t: "la lectura se mantuvo en la franja intermedia y no marcó techo" },
    { n: c.sinBanda, t: "la lectura alcanzó zonas calientes pero el precio no estaba cerca del máximo de las últimas 52 semanas" },
    { n: c.sinPeldano, t: "la lectura entró en zona de techo pero nunca cruzó el primer peldaño de la escalera (" + CZ_ESCALERA[0].nivel + ")" },
    { n: c.sinCupo, t: "el cupo de compras del episodio ya estaba agotado" },
    { n: c.sinEfectivo, t: "no quedaba efectivo disponible" },
  ].filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  return cand.length ? { txt: cand[0].t, n: cand[0].n } : null;
}

function SectionCiclosZona({ palette, k }) {
  const H = window.BambuHistory, E = window.BambuEngine;
  k = k || 27;
  const [type, setType] = React.useState("BTC");
  const [hz, setHz] = React.useState("lth");
  const [abierto, setAbierto] = React.useState(null);
  const cy = React.useMemo(() => czCycleBacktest(type, hz, k), [type, hz, k]);

  const fmt = v => v == null ? "—" : E.fmt.usd(v);
  const fmtIso = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
  const pct = v => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(0) + "%";
  const COL = { buy: "#2E6FAE", sell: "#C0492E", ok: "#2F7D5B" };
  const HZL = hz === "lth" ? "ciclo · LTH" : "corto plazo · STH";
  const cerrados = cy.filter(c => !c.actual);
  /* un ciclo en el que el plan no tomó ninguna decisión no puede contar como
     derrota frente al DCA: se separa y se declara */
  const operados = cerrados.filter(c => !c.sinOperar);
  const abstenidos = cerrados.filter(c => c.sinOperar);

  /* agregado de los ciclos cerrados */
  const agg = operados.length ? {
    n: operados.length,
    capital: operados.length * CZ_CAPITAL,
    valor: operados.reduce((s, c) => s + c.valorFinal, 0),
    hold: operados.reduce((s, c) => s + c.hold, 0),
    dca: operados.reduce((s, c) => s + c.dcaPlano, 0),
    gano: operados.filter(c => c.ventajaDca != null && c.ventajaDca > 0).length,
  } : null;
  if (agg) {
    agg.ret = (agg.valor / agg.capital - 1) * 100;
    agg.holdRet = (agg.hold / agg.capital - 1) * 100;
    agg.desplegado = cerrados.reduce((s, c) => s + c.invertido, 0);
    agg.dcaRet = (agg.dca / agg.capital - 1) * 100;
  }

  const exportCsv = () => {
    const head = ["Activo", "Horizonte", "Ciclo", "Desde", "Hasta", "Capital USD", "Comprado total USD", "Reinvertido USD", "Compras", "Coste medio",
      "Suelo min", "Suelo max", "Ventas", "Precio medio venta", "Techo min", "Techo max", "Cobrado USD",
      "Posicion abierta USD", "Efectivo USD", "Valor final USD", "Multiplo",
      "Ciclo min", "Ciclo max", "Coste en % del rango", "Venta en % del rango", "Comprar y aguantar USD", "Ventaja %"];
    const body = cy.map(c => [type, hz.toUpperCase(), "Ciclo " + c.cycle, c.ini, c.fin, CZ_CAPITAL, c.invertido.toFixed(2), c.reinvertido.toFixed(2),
      c.compras.length, c.costeMedio ? c.costeMedio.toFixed(2) : "", c.sueloLo ? c.sueloLo.toFixed(2) : "", c.sueloHi ? c.sueloHi.toFixed(2) : "",
      c.ventas.length, c.ventaMedia ? c.ventaMedia.toFixed(2) : "", c.techoLo ? c.techoLo.toFixed(2) : "", c.techoHi ? c.techoHi.toFixed(2) : "",
      c.cobrado.toFixed(2), c.abierta.toFixed(2), c.cash.toFixed(2), c.valorFinal.toFixed(2),
      c.multiplo ? c.multiplo.toFixed(2) : "", c.cycLo.toFixed(2), c.cycHi.toFixed(2),
      c.posCoste != null ? c.posCoste.toFixed(1) : "", c.posVenta != null ? c.posVenta.toFixed(1) : "",
      c.hold.toFixed(2), c.ventaja != null ? c.ventaja.toFixed(2) : ""]);
    const csv = [head, ...body].map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bambu-ciclos-dca-${type}-${hz}.csv`; a.click();
  };

  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>Ciclos de zona <HelpDot term="Qué prueba esta pestaña" def="Para cada ciclo de halving se localizan las zonas que marcó el veredicto: suelo de ciclo cuando la lectura entra en acumulación, techo de ciclo cuando entra en distribución. Con 1.000 USD por ciclo se simula comprar en tramos semanales mientras dure el suelo y vender en tramos mientras dure el techo, exactamente como haría un inversor de largo plazo con un plan escrito. El resultado se compara con comprar de golpe el primer día del ciclo y aguantar." /></h1>
          <p>Qué habría pasado invirtiendo {fmt(CZ_CAPITAL)} por ciclo, comprando en el suelo y vendiendo en el techo que marcó el modelo</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="seg">
            {["BTC", "ETH"].map(t => <button key={t} className={"seg-btn" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t}</button>)}
          </div>
          <div className="seg">
            <button className={"seg-btn" + (hz === "lth" ? " on" : "")} onClick={() => setHz("lth")}>Ciclo · LTH</button>
            <button className={"seg-btn" + (hz === "sth" ? " on" : "")} onClick={() => setHz("sth")}>Corto · STH</button>
          </div>
          <button className="btn" onClick={exportCsv}>Exportar CSV</button>
        </div>
      </div>

      {/* las reglas, antes de los resultados */}
      <Card title="Las reglas del backtest" sub="Fijadas de antemano, iguales para todos los ciclos y sin mirar el futuro" style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {[
            ["01", `Cada ciclo empieza con ${fmt(CZ_CAPITAL)} en efectivo`, "Presupuesto idéntico en los cuatro ciclos, para que sean comparables."],
            ["02", "El veredicto dice cuándo, el precio dice dónde", `Solo se opera cuando coinciden las dos cosas: la lectura de ${HZL} en zona extrema Y el precio dentro de la banda. Suelo: hasta un ${(CZ_SUELO_MARGEN * 100).toFixed(0)}% por encima del mínimo de las últimas ${CZ_VENTANA} semanas. Techo: desde un ${(CZ_TECHO_MARGEN * 100).toFixed(0)}% por debajo del máximo de ese mismo periodo. La ventana es móvil y no se reinicia en el halving, así que al arrancar un ciclo refleja los precios del anterior.`],
            ["03", `Compra ${fmt(CZ_CAPITAL / CZ_BUY_WEEKS)} por semana en suelo`, `Tope de ${CZ_BUY_WEEKS} compras por episodio de suelo; el cupo se renueva en cada suelo nuevo. Lo cobrado en las ventas vuelve al efectivo y se reinvierte.`],
            ["04", "Venta en escalera, por nivel de lectura", `Cada tramo se desbloquea al cruzar su peldaño (${CZ_ESCALERA.map(p => p.nivel).join(", ")}) y vende del ${(CZ_ESCALERA[0].parte * 100).toFixed(0)}% al ${(CZ_ESCALERA[CZ_ESCALERA.length - 1].parte * 100).toFixed(0)}% de la posición. Una racha plana vende un solo tramo: para vender más, el mercado tiene que calentarse.`],
            ["05", "Lo que queda se valora al cierre", "El resultado es la posición no vendida al último precio del ciclo más el efectivo. En un plan que recicla, lo cobrado en las ventas es parte del resultado."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div className="num" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>{n}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{t}</div>
              <div className="tiny muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* agregado */}
      {agg &&
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
          <KPI lab="Ciclos con operaciones" mono val={agg.n} meta={<span className="tiny muted">{abstenidos.length ? `${abstenidos.length} sin operar, fuera del cómputo` : "sin contar el actual"}</span>} />
          <KPI lab="Capital total" mono val={fmt(agg.capital)} meta={<span className="tiny muted">{fmt(CZ_CAPITAL)} por ciclo</span>} />
          <KPI lab="Valor final" mono val={fmt(agg.valor)} valStyle={{ color: COL.ok }} meta={<span className="tiny muted">{pct(agg.ret)} sobre el capital</span>} />
          <KPI lab={<>DCA constante <HelpDot term="DCA constante" def="El mismo capital repartido en tramos iguales durante todo el ciclo, sin mirar la lectura. Es la referencia comparable: mide qué aporta el veredicto frente a aportar a ciegas con la misma disciplina." /></>} mono val={fmt(agg.dca)} meta={<span className="tiny muted">{pct(agg.dcaRet)} sin usar el modelo</span>} />
          <KPI lab="Comprar y aguantar" mono val={fmt(agg.hold)} meta={<span className="tiny muted">{pct(agg.holdRet)} · listón favorable</span>} />
          <KPI lab="Ciclos donde ganó al DCA" mono val={agg.gano + " de " + agg.n} valStyle={{ color: agg.gano >= agg.n / 2 ? COL.ok : "var(--ink)" }} meta={<span className="tiny muted">comparación comparable</span>} />
        </div>}

      {/* ciclo a ciclo */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cy.map(c => {
          const gana = c.ventajaDca != null && c.ventajaDca > 0;
          const open = abierto === c.cycle;
          return (
            <Card key={c.cycle} pad={false}
              title={<>Ciclo {c.cycle} · {fmtIso(c.ini)} → {c.actual ? "en curso" : fmtIso(c.fin)} {c.actual && <span className="badge" style={{ background: mixSoft("#B0642A"), color: "#B0642A", fontWeight: 700, marginLeft: 6 }}>SIN CERRAR</span>}
              {c.sinOperar && <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-3)", fontWeight: 700, marginLeft: 6 }}>SIN OPERACIONES</span>}</>}
              sub={`${c.semanas} semanas · ${c.compras.length} compras en suelo · ${c.ventas.length} ventas en techo`}>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 1, background: "var(--border)", borderBottom: "1px solid var(--border)" }}>
                {[
                  ["Comprado en total", fmt(c.invertido), c.reinvertido > 1 ? `incluye ${fmt(c.reinvertido)} reinvertidos de ventas` : `del capital de ${fmt(CZ_CAPITAL)}`, null],
                  ["Coste medio", fmt(c.costeMedio), c.posCoste != null ? `en el ${c.posCoste.toFixed(0)}% del rango del ciclo` : "sin compras", COL.buy],
                  ["Cobrado en ventas", fmt(c.cobrado), c.posVenta != null ? `vendió en el ${c.posVenta.toFixed(0)}% del rango` : "sin ventas", COL.sell],
                  ["Posición sin vender", fmt(c.abierta), c.unitsFin > 0 ? `${c.unitsFin.toFixed(c.unitsFin < 1 ? 4 : 2)} ${type}` : (c.compras.length ? "todo vendido" : "nunca se compró"), null],
                  ["Efectivo al cierre", fmt(c.cash), c.cash < 1 ? "presupuesto agotado" : (c.cobrado > 1 ? "procedente de las ventas" : "capital sin desplegar"), null],
                  ["Valor final", fmt(c.valorFinal), c.multiplo ? `${c.multiplo.toFixed(2)}× el capital` : "—", COL.ok],
                  ["DCA constante", fmt(c.dcaPlano), pct(c.dcaRet) + " sin usar el modelo", null],
                  ["Comprar y aguantar", fmt(c.hold), pct(c.holdRet) + " desde " + fmt(c.pxIni), null],
                ].map(([l, v, m, col], i) => (
                  <div key={l} style={{ padding: "14px 18px", background: "var(--card)" }}>
                    <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>{l}</div>
                    <div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 3, color: col || "var(--ink)" }}>{v}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{m}</div>
                  </div>
                ))}
              </div>

              {/* dónde estuvieron las bandas frente al rango real del ciclo */}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "12px 18px", borderBottom: "1px solid var(--border)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <div>
                  <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>Rango real del ciclo</div>
                  <div className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>{fmt(c.cycLo)} – {fmt(c.cycHi)}</div>
                  <div className="tiny muted">{c.semSuelo} compras · {c.semTecho} ventas · escalera hasta el peldaño {c.peldano} de {CZ_ESCALERA.length}{c.sinCupo > 0 ? " · " + c.sinCupo + " semanas con el cupo de compra agotado" : ""}</div>
                </div>
                {c.sueloLo != null &&
                  <div>
                    <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700, color: COL.buy }}>Banda de suelo · donde compró</div>
                    <div className="num" style={{ fontWeight: 600, color: COL.buy }}>{fmt(c.sueloLo)} – {fmt(c.sueloHi)}</div>
                  </div>}
                {c.techoLo != null &&
                  <div>
                    <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700, color: COL.sell }}>Banda de techo · donde vendió</div>
                    <div className="num" style={{ fontWeight: 600, color: COL.sell }}>{fmt(c.techoLo)} – {fmt(c.techoHi)}</div>
                  </div>}
              </div>

              {/* veredicto del ciclo */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "13px 18px",
                            background: c.sinOperar ? "var(--surface-2, #F2F6F2)" : mixSoft(gana ? COL.ok : COL.sell, .9) }}>
                {c.sinOperar
                  ? <div>
                      <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700 }}>Resultado</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink-3)" }}>Sin operaciones</div>
                    </div>
                  : <>
                      <div>
                        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700 }}>Frente al DCA constante</div>
                        <div className="num" style={{ fontSize: 24, fontWeight: 700, color: gana ? COL.ok : COL.sell }}>{pct(c.ventajaDca)}</div>
                      </div>
                      <div>
                        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700 }}>Frente a comprar y aguantar</div>
                        <div className="num" style={{ fontSize: 19, fontWeight: 700, color: "var(--ink-3)" }}>{pct(c.ventaja)}</div>
                      </div>
                    </>}
                <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                  {c.sinOperar
                    ? `El plan no operó en este ciclo, así que no cuenta ni a favor ni en contra: ${czMotivo(c) ? czMotivo(c).txt + " (" + czMotivo(c).n + " de " + c.semanas + " semanas)" : "nunca coincidieron la lectura y la banda de precio"}.`
                    : c.compras.length === 0
                    ? `El plan solo vendió en este ciclo: la lectura y el precio nunca coincidieron en zona de suelo, así que no hubo compras.`
                    : c.ventas.length === 0
                      ? `Se compró en el suelo pero no hubo ventas: ${czMotivo(c) ? czMotivo(c).txt + " (" + czMotivo(c).n + " de " + c.semanas + " semanas)" : "la lectura nunca entró en zona de techo"}. Todo sigue en posición, valorado a ${fmt(c.pxFin)}.`
                      : gana
                        ? `Comprar a un coste medio de ${fmt(c.costeMedio)} y repartir las ventas a ${fmt(c.ventaMedia)} de media batió al DCA constante: el veredicto concentró las compras en la parte baja del rango del ciclo.`
                        : `El plan quedó por detrás del DCA constante: vender en tramos a ${fmt(c.ventaMedia)} de media dejó capital fuera del mercado durante parte de la subida.`}
                  {c.actual && " El ciclo no ha terminado, así que esta cifra cambiará."}
                </div>
                {(c.compras.length + c.ventas.length) > 0 &&
                  <button className="btn" onClick={() => setAbierto(open ? null : c.cycle)}>{open ? "Ocultar operaciones" : "Ver las operaciones"}</button>}
              </div>

              {/* detalle de operaciones */}
              {open &&
                <div style={{ maxHeight: 360, overflow: "auto", borderTop: "1px solid var(--border)" }}>
                  <table className="tbl">
                    <thead style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 2 }}>
                      <tr><th>Fecha</th><th className="c">Operación</th><th className="c">Lectura</th><th className="r">Precio</th><th className="r">Importe</th></tr>
                    </thead>
                    <tbody>
                      {[...c.compras.map(x => ({ ...x, k: "buy" })), ...c.ventas.map(x => ({ ...x, k: "sell" }))]
                        .sort((a, b) => a.iso < b.iso ? -1 : 1)
                        .map((o, i) => {
                          const col = o.k === "buy" ? COL.buy : COL.sell;
                          return (
                            <tr key={i}>
                              <td className="tiny" style={{ whiteSpace: "nowrap" }}>{fmtIso(o.iso)}</td>
                              <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col, fontWeight: 700 }}>{o.k === "buy" ? "COMPRA" : "VENTA"}</span></td>
                              <td className="c num tiny">{o.rank.toFixed(0)}{o.peldano ? <span className="tiny muted"> · pel. {o.peldano}</span> : null}</td>
                              <td className="r num">{fmt(o.px)}</td>
                              <td className="r num" style={{ fontWeight: 600, color: col }}>{o.k === "buy" ? "−" : "+"}{fmt(o.usd)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>}
            </Card>
          );
        })}
      </div>

      <div className="tiny muted" style={{ marginTop: 16, lineHeight: 1.6, maxWidth: 940 }}>
        <b>Por qué el veredicto no basta por sí solo.</b> La lectura de 0 a 100 mide si el mercado está frío o caliente <i>respecto al rango de este ciclo</i>, así que por diseño reparte las semanas a ambos lados de su punto medio: usarla sola como disparador hacía que el plan vendiera a mitad de camino del rango y volviera a comprar poco después, en bucle.
        Añadir la condición de precio —comprar solo cerca del mínimo que el ciclo lleve marcado, vender solo cerca del máximo— es lo que convierte una lectura de temperatura en un <b>suelo y un techo de ciclo</b>. Las dos referencias se construyen únicamente con el pasado, así que el plan sigue sin mirar el futuro.
        <br /><br />
        <b>Por qué hay dos referencias de resultado, y cuál importa.</b> La comparación honesta es la del <b>DCA constante</b>: el mismo capital, la misma disciplina de aportar por tramos, pero sin mirar la lectura. Esa es la que aísla lo que aporta el veredicto, y es la cifra grande de cada ciclo.
        <br /><br />
        <b>Comprar y aguantar aparece como contexto, no como listón justo.</b> Cada ciclo de halving arranca <i>después</i> del mercado bajista, así que el primer día del ciclo está casi en el mínimo: invertirlo todo ahí es, por construcción, un punto de entrada excelente que solo se conoce a posteriori. Cualquier estrategia que mantenga algo de efectivo pierde contra ese listón, y por eso la cifra se muestra en pequeño y en gris.
        <br /><br />
        <b>Lo que el backtest no cubre.</b> Las reglas son idénticas en todos los ciclos y ninguna mira el futuro, pero no hay comisiones ni impuestos, se usa el precio de cierre semanal, y el ciclo en curso seguirá cambiando hasta que termine. Los ciclos anteriores a la existencia del activo se descartan en lugar de rellenarse. Rendimientos pasados no garantizan resultados futuros.
      </div>
    </div>
  );
}

Object.assign(window, { SectionCiclosZona, czCycleBacktest, czWeekly });
