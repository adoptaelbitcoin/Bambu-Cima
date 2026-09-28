/* ============================================================
   BAMBÚ · Backtest del detector bidireccional · SOPR
   Un mismo motor para los dos horizontes: cohort "lth" (núcleo de
   ciclo) y cohort "sth" (táctico). Recorre el histórico, se detiene
   en cada día que disparó el gatillo y muestra las métricas que el
   detector tenía delante ESE día —percentil expansivo, solo con
   datos anteriores— más la lectura del otro horizonte y qué hizo
   el precio después. BTC y ETH.
   ============================================================ */
const BL_HORIZONS = [30, 90, 180];
const BL_SEP = 30;   // días mínimos entre disparos: un episodio, no un racimo

function blLote(kind, pct) {
  if (pct == null) return 0;
  return kind === "buy" ? (pct <= 2 ? 1 : pct <= 5 ? .7 : pct <= 10 ? .4 : pct <= 20 ? .2 : .1)
                        : (pct >= 98 ? 1 : pct >= 95 ? .7 : pct >= 90 ? .4 : pct >= 80 ? .2 : .1);
}
function blEstado(g) {
  if (!g.base) return { lab: "Distribución de ciclo", nivel: -2 };
  if (g.base === "buy") return g.giroAlza
    ? { lab: "Capitulación confirmada", nivel: 3 } : { lab: "Capitulación sin giro", nivel: 2 };
  return g.perdiendoFuerza
    ? { lab: "Distribución confirmada", nivel: -3 } : { lab: "Distribución sin agotamiento", nivel: -2 };
}

/* ---------- las filas: un disparo por episodio ---------- */
function blRows(type, cohort) {
  cohort = cohort || "lth";
  const R = window.BambuRealData[type];
  const trigger = window.detTriggerAt;
  if (!R || !trigger) return [];
  const otro = cohort === "lth" ? "sth" : "lth";
  const px = R.cols.price;
  const flowKey = type === "ETH" ? "lthNet30" : "netflow";
  const at = (key, i) => (R.cols[key] && R.cols[key][i] != null) ? R.cols[key][i] : null;
  const out = [];
  /* un contador por regla: si el medidor de ciclo disparó hace unos días, eso no
     debe silenciar un gatillo clásico posterior (en julio de 2025 pasaba justo
     eso y desaparecía la señal más fuerte del año) */
  let lastC = -999, lastR = -999;
  for (let i = 0; i < R.count; i++) {
    if (px[i] == null) continue;
    const g = trigger(type, cohort, i);
    if (!g || (!g.base && !g.ciclo)) continue;
    const okC = !!g.base && (i - lastC >= BL_SEP);
    const okR = !!g.ciclo && (i - lastR >= BL_SEP);
    if (!okC && !okR) continue;
    if (okC) lastC = i;
    if (okR) lastR = i;
    const kind = okC ? g.base : g.ciclo;
    let est = blEstado(okC ? g : { base: null });
    /* taxonomía del táctico: el gatillo se lee con el ciclo delante y su lado
       caliente no propone vender */
    if (cohort === "sth") {
      if (kind === "buy") est = g.cicloOk === false
        ? { lab: "Compra contra el ciclo", nivel: 0 }
        : (g.giroAlza ? { lab: "Compra táctica confirmada", nivel: 3 } : { lab: "Compra táctica sin giro", nivel: 2 });
      else est = { lab: "Corto plazo caliente", nivel: -1 };
    }
    /* la lectura del otro horizonte ese mismo día, con el percentil de entonces */
    const s = trigger(type, otro, i);
    const fwd = {}, mae = {};
    BL_HORIZONS.forEach(h => {
      const j = Math.min(i + h, R.count - 1);
      fwd[h] = (i + h < R.count && px[i + h] != null) ? (px[i + h] / px[i] - 1) * 100 : null;
      let peor = 0;
      for (let k = i + 1; k <= j; k++) {
        if (px[k] == null) continue;
        const ch = (px[k] / px[i] - 1) * 100;
        if (kind === "buy" ? ch < peor : ch > peor) peor = ch;
      }
      mae[h] = (i + h < R.count) ? peor : null;
    });
    out.push({
      type, cohort, i, iso: R.dates[i], px: px[i],
      kind, confirmado: okC && g.confirmado === g.base, estado: est.lab, nivel: est.nivel,
      clasico: okC, cicloR: okR, cicloOk: g.cicloOk,
      sopr: g.v, pct: g.pct, nHist: g.nHist, pctRoll: g.pctRoll, nRoll: g.nRoll, vel: g.vel, aso: g.aso,
      /* el gatillo clásico manda el lote; el medidor de ciclo sugiere la mitad,
         porque su lectura es de fase y no de extremo puntual. El táctico no
         propone tamaño en ningún estado: está por debajo de la base
         incondicional, así que es contexto y el ciclo decide el lote. */
      lote: cohort === "sth" ? 0
        : okC ? blLote(kind, g.pct) : blLote("sell", g.pctRoll) * 0.5,
      supplyP: at("supplyP", i), sthLoss: at("sthLoss", i), flow: at(flowKey, i),
      parSopr: s ? s.v : null, parPct: s ? s.pct : null, parBase: s ? s.base : null,
      fwd, mae,
    });
  }
  return out;
}

/* Las estadísticas nunca mezclan reglas: cada medidor se mide aparte, porque un
   acierto agregado de dos criterios distintos no dice de qué criterio es. */
function blStats(rows, kind, h, regla, pred) {
  const base = rows.filter(r => r.kind === kind && (regla === "ciclo" ? r.cicloR : r.clasico) && (!pred || pred(r)));
  const sel = base.filter(r => Number.isFinite(r.fwd[h]));
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return {
    kind,
    n: base.length,
    conRes: sel.length,
    conf: sel.filter(r => r.confirmado).length,
    med: med(sel.map(r => r.fwd[h])),
    aciertos: sel.filter(r => kind === "buy" ? r.fwd[h] > 0 : r.fwd[h] < 0).length,
    fallos: sel.filter(r => kind === "buy" ? r.fwd[h] <= 0 : r.fwd[h] >= 0).length,
    hit: sel.length ? sel.filter(r => kind === "buy" ? r.fwd[h] > 0 : r.fwd[h] < 0).length / sel.length * 100 : null,
    mae: med(sel.map(r => r.mae[h]).filter(Number.isFinite)),
  };
}

/* ---------- por qué un episodio no acertó ----------
   El diagnóstico sale de los propios campos del disparo, en orden de relevancia:
   primero si acertó en otro horizonte (llegar temprano no es equivocarse),
   luego si la intensidad estaba en el borde del umbral, si faltó el giro, si la
   amplitud no acompañaba y si el aviso venía solo del medidor de ciclo. */
function blPorQue(r, h) {
  const v = r.fwd[h];
  if (v == null || (r.kind === "buy" ? v > 0 : v < 0)) return null;
  const partes = [];
  const otros = BL_HORIZONS.filter(x => x !== h && r.fwd[x] != null && (r.kind === "buy" ? r.fwd[x] > 0 : r.fwd[x] < 0));
  if (otros.length) {
    const tempr = otros.every(x => x > h), tard = otros.every(x => x < h);
    partes.push(`el precio le dio la razón a ${otros.join(" y ")} días${tempr ? ": llegó temprano para este horizonte" : tard ? ": el efecto ya había pasado a este plazo" : ", pero no a este plazo"}`);
  }
  if (r.kind === "buy" && r.pct != null && r.pct > 7)
    partes.push(`percentil ${r.pct.toFixed(0)}, en el borde del umbral y no en el extremo`);
  if (r.kind === "sell" && r.clasico && r.pct != null && r.pct < 95)
    partes.push(`percentil ${r.pct.toFixed(0)}, apenas dentro de la franja de venta`);
  const giro = r.vel != null && r.vel >= 1, cede = r.vel != null && r.vel <= -1;
  if (r.kind === "buy" && !giro) partes.push("entró sin giro: la caída aún se profundizaba");
  if (r.kind === "sell" && !cede) partes.push("vendió sin agotamiento: la subida aún tenía fuerza");
  if (r.kind === "buy" && r.supplyP != null && r.supplyP > 80)
    partes.push(`amplitud en contra: ${r.supplyP.toFixed(0)}% del mercado seguía en ganancia, no era rendición general`);
  if (r.kind === "sell" && r.supplyP != null && r.supplyP < 70)
    partes.push(`amplitud en contra: ${r.supplyP.toFixed(0)}% en ganancia, lejos del reparto general de un techo`);
  if (r.cohort === "sth" && r.parPct != null && (r.kind === "buy" ? r.parPct > 60 : r.parPct < 40))
    partes.push(`el ciclo iba en contra: núcleo LTH en percentil ${r.parPct.toFixed(0)}`);
  if (!r.clasico) partes.push("aviso de fase del medidor de ciclo, no gatillo clásico");
  return partes.length ? partes.join(" · ") : "gatillo limpio: la señal fue correcta y el mercado no la acompañó en este plazo";
}

/* ---------- descarga: la tabla entera de los dos activos ---------- */
function blCsv(all, cohort) {
  const lth = cohort === "lth";
  const head = ["activo", "fecha", "regla", "gatillo", "confirmado", "estado",
    lth ? "lth_sopr" : "sth_sopr", "percentil_historico", "dias_historial"]
    .concat(lth ? ["percentil_ventana_4a", "dias_ventana"] : [])
    .concat(["giro_pts", "asopr", "precio_usd", "lote_sugerido_pct", "oferta_en_ganancia_pct", "sth_en_perdida_pct",
      "flujo_btc_o_delta_oferta_lth_eth",
      lth ? "percentil_tactico_sth" : "percentil_nucleo_lth", lth ? "sth_sopr" : "lth_sopr",
      "fwd_30d_pct", "fwd_90d_pct", "fwd_180d_pct", "en_contra_90d_pct", "acerto_30d", "acerto_90d", "acerto_180d", "motivo_fallo_90d"]);
  const n = (v, d) => v == null ? "" : v.toFixed(d == null ? 2 : d).replace(".", ",");
  const lines = [head.join(";")];
  all.forEach(r => lines.push([r.type, r.iso, r.clasico && r.cicloR ? "clasico+ciclo" : r.clasico ? "clasico" : "ciclo",
    r.kind === "buy" ? "compra" : "venta", r.confirmado ? "si" : "no", r.estado,
    n(r.sopr, 5), n(r.pct, 2), r.nHist == null ? "" : r.nHist]
    .concat(lth ? [n(r.pctRoll, 2), r.nRoll == null ? "" : r.nRoll] : [])
    .concat([n(r.vel, 2), n(r.aso, 4), n(r.px, 2), n(r.lote * 100, 0),
      n(r.supplyP, 2), n(r.sthLoss, 2), n(r.flow, 3), n(r.parPct, 2), n(r.parSopr, 5),
      n(r.fwd[30]), n(r.fwd[90]), n(r.fwd[180]), n(r.mae[90])])
    .concat([30, 90, 180].map(h => r.fwd[h] == null ? "" : ((r.kind === "buy" ? r.fwd[h] > 0 : r.fwd[h] < 0) ? "si" : "no")))
    .concat([(blPorQue(r, 90) || "").replace(/;/g, ",")]).join(";")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bambu-backtest-detector-" + cohort + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- la base incondicional: sin ella, el acierto engaña ----------
   Un 76% de acierto suena a precisión hasta que se mira que comprar un día al
   azar también acaba en positivo el 66% de las veces a 180 días. Lo que mide la
   señal es la diferencia, no el número absoluto. */
const _blBase = {};
function blBase(type, h, desde) {
  const ck = type + "|" + h + "|" + (desde || "");
  if (_blBase[ck]) return _blBase[ck];
  const R = window.BambuRealData[type];
  if (!R) return null;
  const px = R.cols.price, n = R.count, a = [];
  for (let i = 0; i < n - h; i++) {
    if (desde && R.dates[i] < desde) continue;
    if (px[i] == null || px[i + h] == null) continue;
    a.push((px[i + h] / px[i] - 1) * 100);
  }
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  return _blBase[ck] = { n: a.length, med: s[Math.floor(s.length / 2)], pos: a.filter(x => x > 0).length / a.length * 100 };
}

/* ---------- ciclos representados: el n efectivo ----------
   14 episodios repartidos en 4 ciclos no son 14 observaciones independientes:
   son 4 regímenes con varios disparos dentro. */
const BL_CICLOS = [["2009-01-01", "2014-01-01"], ["2014-01-01", "2018-01-01"], ["2018-01-01", "2022-01-01"], ["2022-01-01", "2030-01-01"]];
function blCiclos(rows) {
  return BL_CICLOS.filter(([a, b]) => rows.some(r => r.iso >= a && r.iso < b)).length;
}

/* ---------- cartera frente a DCA, ciclo por ciclo ----------
   Agregar los quince años en una sola cifra no mide la señal: mide que disparó
   mucho en 2011, con BTC a 3 dólares. En un activo que multiplicó por miles,
   cualquier concentración temprana gana. Por eso cada ciclo se compara consigo
   mismo: mismas fechas, mismo capital, un DCA cada 30 días dentro de la ventana. */
function blCartera(rows, type) {
  const R = window.BambuRealData[type];
  if (!R) return null;
  const px = R.cols.price;
  const TRAMO = 1000;
  return BL_CICLOS.map(([a, b]) => {
    const compras = rows.filter(r => r.kind === "buy" && r.lote > 0 && r.iso >= a && r.iso < b);
    if (!compras.length) return { tramo: a.slice(0, 4) + "–" + b.slice(0, 4), vacio: true };
    let usd = 0, coins = 0;
    compras.forEach(r => { const amt = TRAMO * r.lote; usd += amt; coins += amt / r.px; });
    let i0 = R.dates.indexOf(compras[0].iso), i1 = -1;
    for (let i = 0; i < R.count; i++) { if (px[i] != null && R.dates[i] < b) i1 = i; }
    /* el DCA arranca el d\u00eda de la primera se\u00f1al del ciclo, no el d\u00eda 1 del ciclo:
       si empezara antes, la comparaci\u00f3n medir\u00eda qui\u00e9n madrug\u00f3 m\u00e1s, no qui\u00e9n\n       compr\u00f3 mejor */
    const fechas = [];
    for (let i = i0; i >= 0 && i <= i1; i += 30) if (px[i] != null) fechas.push(i);
    if (!fechas.length) return { tramo: a.slice(0, 4) + "–" + b.slice(0, 4), vacio: true };
    const amt2 = usd / fechas.length;
    let coins2 = 0;
    fechas.forEach(i => { coins2 += amt2 / px[i]; });
    const coste = usd / coins, costeDca = usd / coins2;
    if (!isFinite(coste) || !isFinite(costeDca) || costeDca <= 0) return { tramo: a.slice(0, 4) + "–" + b.slice(0, 4), vacio: true };
    return { tramo: a.slice(0, 4) + "–" + b.slice(0, 4), nSig: compras.length, nDca: fechas.length, usd,
             coste, costeDca, ventaja: (coste / costeDca - 1) * 100,
             desde: R.dates[i0], hasta: R.dates[i1] };
  });
}

function SectionBackSopr({ cohort }) {
  const E = window.BambuEngine;
  const lth = cohort === "lth";
  const [hz, setHz] = React.useState(90);
  const [filtro, setFiltro] = React.useState("todos");
  const [era, setEra] = React.useState("todo");
  const [orden, setOrden] = React.useState({ k: "iso", dir: 1 });
  const pedir = k => setOrden(o => o.k === k ? { k, dir: -o.dir } : { k, dir: k === "iso" ? 1 : -1 });
  const rowsAll = React.useMemo(() => ({ BTC: blRows("BTC", cohort), ETH: blRows("ETH", cohort) }), [cohort]);
  const rows = React.useMemo(() => era === "todo" ? rowsAll
    : { BTC: rowsAll.BTC.filter(r => r.iso >= "2019-01-01"), ETH: rowsAll.ETH.filter(r => r.iso >= "2019-01-01") }, [rowsAll, era]);
  const D = React.useMemo(() => ({
    BTC: { sth: window.detCohort("BTC", "sth"), lth: window.detCohort("BTC", "lth") },
    ETH: { sth: window.detCohort("ETH", "sth"), lth: window.detCohort("ETH", "lth") },
  }), []);
  const all = React.useMemo(() => [...rows.BTC, ...rows.ETH].sort((a, b) => a.iso < b.iso ? -1 : 1), [rows]);

  const soprLab = lth ? "LTH-SOPR" : "STH-SOPR";
  const parLab = lth ? "Term. táctico" : "Núcleo de ciclo";
  const parSoprLab = lth ? "STH-SOPR" : "LTH-SOPR";
  /* una sola definición de los grupos: la usan las estadísticas de cada bloque y
     el panel de dentro/fuera de muestra, para que no puedan discrepar */
  const defGrupos = lth
    ? [{ id: "buy", lab: "Compras · clásico", kind: "buy", regla: "clasico", niv: 2, hitSub: "precio arriba" },
       { id: "sellC", lab: "Ventas · clásico", kind: "sell", regla: "clasico", niv: -2, hitSub: "precio abajo" },
       { id: "sellR", lab: "Ventas · ciclo 4 años", kind: "sell", regla: "ciclo", niv: -2, hitSub: "precio abajo" }]
    : [{ id: "buyOk", lab: "Compras · ciclo a favor", kind: "buy", regla: "clasico", niv: 2, pred: r => r.cicloOk !== false, hitSub: "precio arriba" },
       { id: "buyNo", lab: "Compras · contra el ciclo", kind: "buy", regla: "clasico", niv: 0, pred: r => r.cicloOk === false, hitSub: "precio arriba" },
       { id: "sellC", lab: "Corto plazo caliente", kind: "sell", regla: "clasico", niv: -1, hitSub: "precio abajo" }];

  const COL = n => n == null ? "#8C9389" : n >= 2 ? "#2E6FAE" : n <= -2 ? "#C0492E" : n === -1 ? "#B0642A" : "#7A8A80";
  const INK = (n, bg) => E.inkColor(COL(n), 4.5, bg);
  const fmtIso = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const num = (v, d) => v == null ? "—" : v.toFixed(d == null ? 1 : d);
  const sgn = v => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1) + "%";

  const Stat = ({ lab, val, sub, col }) => (
    <div style={{ minWidth: 96 }}>
      <div className="tiny muted">{lab}</div>
      <div className="num" style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: col || "var(--ink)" }}>{val}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );

  const Bloque = ({ type }) => {
    const rs = rows[type].filter(r => filtro === "todos" ? true : filtro === "confirmados" ? r.confirmado
      : filtro === "ciclo" ? r.cicloR : r.kind === filtro);
    const buy = blStats(rows[type], "buy", hz, "clasico");
    const sellC = blStats(rows[type], "sell", hz, "clasico");
    const sellR = lth ? blStats(rows[type], "sell", hz, "ciclo") : null;
    const buyOk = lth ? null : blStats(rows[type], "buy", hz, "clasico", r => r.cicloOk !== false);
    const buyNo = lth ? null : blStats(rows[type], "buy", hz, "clasico", r => r.cicloOk === false);
    const base = blBase(type, hz, rowsAll[type].length ? rowsAll[type][0].iso : null);
    const pp = (a, b) => (a == null || b == null) ? "—" : (a - b > 0 ? "+" : "") + (a - b).toFixed(1) + " pp";
    const grupos = defGrupos.map(g => ({ ...g, s: blStats(rows[type], g.kind, hz, g.regla, g.pred),
      eps: rows[type].filter(r => r.kind === g.kind && (g.regla === "ciclo" ? r.cicloR : r.clasico) && (!g.pred || g.pred(r))) }));
    const flowLab = type === "ETH" ? "Δ oferta LTH 30d" : "Flujo exchange";
    /* una sola definición por columna: rótulo, alineación, valor para ordenar y
       celda. Así el orden no puede discrepar de lo que se ve. */
    const pctCell = r => <>{num(r.pct, 1)}<span className="tiny muted"> · {r.nHist}d</span></>;
    const cols = [
      { k: "iso", lab: "Fecha", cls: "", v: r => r.iso, cell: r => <span className="num" style={{ fontWeight: 600 }}>{fmtIso(r.iso)}</span> },
      { k: "kind", lab: "Gatillo", cls: "c", v: r => r.kind === "buy" ? 1 : 0,
        cell: r => <span className="badge" style={{ background: mixSoft(COL(r.nivel)), color: INK(r.nivel, mixSoft(COL(r.nivel))), fontWeight: 700 }}>{r.kind === "buy" ? "compra" : "venta"}</span> },
      { k: "px", lab: "Precio", cls: "num r", v: r => r.px, cell: r => E.fmt.usd(r.px) },
      { k: "estado", lab: "Estado", cls: "tiny", v: r => r.estado, style: r => ({ color: INK(r.nivel), fontWeight: 600 }), cell: r => r.estado },
      { k: "sopr", lab: soprLab, cls: "num r", v: r => r.sopr, style: () => ({ fontWeight: 700 }), cell: r => num(r.sopr, 3) },
    ];
    if (lth) cols.push({ k: "regla", lab: "Regla", cls: "c tiny", v: r => r.clasico && r.cicloR ? 2 : r.clasico ? 1 : 0,
      style: r => ({ fontWeight: 600, color: r.clasico && r.cicloR ? "var(--ink)" : r.clasico ? "var(--ink-2)" : E.inkColor("#B0642A", 4.5) }),
      cell: r => r.clasico && r.cicloR ? "clásico + ciclo" : r.clasico ? "clásico" : "ciclo 4a" });
    cols.push({ k: "pct", lab: "Pctl hist.", cls: "num c", v: r => r.pct, cell: pctCell });
    if (lth) cols.push({ k: "pctRoll", lab: "Pctl 4 años", cls: "num c", v: r => r.pctRoll,
      style: r => ({ fontWeight: r.cicloR ? 700 : 400, color: r.cicloR ? E.inkColor("#C0492E", 4.5) : "var(--ink-2)" }),
      cell: r => r.pctRoll == null ? "—" : num(r.pctRoll, 1) });
    cols.push(
      { k: "vel", lab: "Giro", cls: "num r", v: r => r.vel,
        style: r => ({ color: r.vel == null ? "var(--ink-3)" : r.vel > 0 ? "#2F7D5B" : "#C0492E" }),
        cell: r => r.vel == null ? "—" : (r.vel > 0 ? "+" : "") + r.vel.toFixed(2) },
      { k: "aso", lab: "aSOPR", cls: "num r", v: r => r.aso, cell: r => num(r.aso, 3) },
      { k: "lote", lab: "Lote", cls: "num r", v: r => r.lote, cell: r => (r.lote * 100).toFixed(0) + "%" },
      { k: "supplyP", lab: "Oferta en gan.", cls: "num r", v: r => r.supplyP, cell: r => r.supplyP == null ? "—" : num(r.supplyP, 1) + "%" },
      { k: "sthLoss", lab: "STH en pérdida", cls: "num r", v: r => r.sthLoss, cell: r => r.sthLoss == null ? "—" : num(r.sthLoss, 1) + "%" },
      { k: "flow", lab: flowLab, cls: "num r", v: r => r.flow,
        cell: r => r.flow == null ? "—" : type === "ETH" ? (r.flow > 0 ? "+" : "") + num(r.flow, 2) + "%" : (r.flow > 0 ? "+" : "") + num(r.flow, 0) },
      { k: "parPct", lab: parLab, cls: "num c", v: r => r.parPct, cell: r => <>{r.parPct == null ? "—" : num(r.parPct, 1)}{lth
        ? (r.parBase && <span className="tiny" style={{ color: r.parBase === "buy" ? "#2E6FAE" : "#C0492E", fontWeight: 700 }}> · {r.parBase === "buy" ? "frío" : "caliente"}</span>)
        : (r.parPct != null && (r.kind === "buy"
            /* en compras el ciclo frío es lo que valida la señal; en el corto plazo
               caliente el juicio se invierte, así que ahí solo se declara la
               temperatura del ciclo sin llamarla a favor ni en contra */
            ? <span className="tiny" style={{ color: r.cicloOk ? E.inkColor("#2F7D5B", 4.5) : E.inkColor("#B0642A", 4.5), fontWeight: 700 }}> · {r.cicloOk ? "a favor" : "en contra"}</span>
            : <span className="tiny" style={{ color: r.parPct >= 60 ? E.inkColor("#C0492E", 4.5) : "var(--ink-2)", fontWeight: 700 }}> · ciclo {r.parPct >= 60 ? "caliente" : "frío"}</span>))}</> },
      { k: "parSopr", lab: parSoprLab, cls: "num r", v: r => r.parSopr, cell: r => num(r.parSopr, 3) },
    );
    BL_HORIZONS.forEach(h => cols.push({ k: "f" + h, lab: h + "d", cls: "num r", v: r => r.fwd[h],
      style: r => ({ color: r.fwd[h] == null ? "var(--ink-3)" : r.fwd[h] > 0 ? "#2F7D5B" : "#C0492E" }),
      cell: r => sgn(r.fwd[h]) }));
    cols.push(
      { k: "mae90", lab: "En contra 90d", cls: "num r", v: r => r.mae[90], style: () => ({ color: "var(--ink-3)" }), cell: r => sgn(r.mae[90]) },
      { k: "ok", lab: `Acertó a ${hz}d`, cls: "c", v: r => r.fwd[hz] == null ? null : ((r.kind === "buy" ? r.fwd[hz] > 0 : r.fwd[hz] < 0) ? 1 : 0),
        cell: r => {
          const x = r.fwd[hz];
          if (x == null) return <span className="tiny muted">sin horizonte</span>;
          const ok = r.kind === "buy" ? x > 0 : x < 0;
          return <span className="badge" style={{ background: mixSoft(ok ? "#2F7D5B" : "#C0492E"), color: E.inkColor(ok ? "#2F7D5B" : "#C0492E", 4.5, mixSoft(ok ? "#2F7D5B" : "#C0492E")), fontWeight: 700 }}>{ok ? "sí" : "no"}</span>;
        } },
      { k: "why", lab: "Por qué no acertó", cls: "tiny", v: r => blPorQue(r, hz) || "",
        style: () => ({ whiteSpace: "normal", minWidth: 230, maxWidth: 300, lineHeight: 1.45, fontSize: 12, color: "var(--ink-2)" }),
        cell: r => blPorQue(r, hz) || "" },
    );
    const colOrden = cols.find(c => c.k === orden.k) || cols[0];
    const ordenadas = rs.slice().sort((a, b) => {
      const x = colOrden.v(a), y = colOrden.v(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;          // los vacíos siempre al final
      if (y == null) return -1;
      if (x === y) return a.iso < b.iso ? -1 : 1;
      return (x > y ? 1 : -1) * orden.dir;
    });
    return (
      <Card title={`${type} · disparos del ${lth ? "núcleo LTH" : "termómetro táctico STH"}`}
            sub={`${rows[type].length} episodios entre ${rows[type].length ? fmtIso(rows[type][0].iso) : "—"} y ${rows[type].length ? fmtIso(rows[type][rows[type].length - 1].iso) : "—"}`
              + (lth ? ` · ${rows[type].filter(r => r.clasico).length} del gatillo clásico · ${rows[type].filter(r => r.cicloR).length} del medidor de ciclo` : " · separación mínima de 30 días entre disparos")}
            pad={false} style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface-2, #F2F6F2)" }}>
          {grupos.map(({ id, lab, s, niv, hitSub, eps }) => (
            <div key={id} style={{ borderLeft: `3px solid ${COL(niv)}`, paddingLeft: 13 }}>
              <div className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: INK(niv, "#F2F6F2"), marginBottom: 2 }}>{lab} · {s.n} episodios</div>
              <div className="tiny muted" style={{ marginBottom: 8 }}>n efectivo: {blCiclos(eps)} de 4 ciclos · base del mismo horizonte al lado</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <Stat lab={`Mediana a ${hz}d`} val={sgn(s.med)}
                      /* en una venta batir a la base es quedar por DEBAJO de ella:
                         la ventaja se orienta según el lado, igual que el acierto */
                      sub={base ? `base ${sgn(base.med)} · ventaja ${s.kind === "sell" ? pp(base.med, s.med) : pp(s.med, base.med)}` : "del precio después"} col={INK(niv, "#F2F6F2")} />
                <Stat lab="Acertó" val={s.hit == null ? "—" : num(s.hit, 0) + "%"}
                      sub={s.conRes ? (base ? `base ${num(s.kind === "sell" ? 100 - base.pos : base.pos, 0)}% · ventaja ${pp(s.hit, s.kind === "sell" ? 100 - base.pos : base.pos)}` : `${s.aciertos} sí · ${s.fallos} no`) : hitSub} />
                <Stat lab="En contra" val={sgn(s.mae)} sub="peor tramo, mediana" />
              </div>
            </div>
          ))}
        </div>
        {rs.length === 0
          ? <div className="tiny muted" style={{ padding: "16px 18px" }}>Sin disparos de este tipo en el histórico de {type}.</div>
          : <div style={{ maxHeight: 520, overflow: "auto" }}>
              <table className="tbl" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--surface, var(--card, #fff))", zIndex: 2 }}>
                  <tr>
                    {cols.map(c => (
                      <th key={c.k} className={c.cls.indexOf("c") >= 0 ? "c" : c.cls.indexOf("r") >= 0 ? "r" : ""}
                          onClick={() => pedir(c.k)} title="Ordenar por esta columna"
                          style={{ cursor: "pointer", userSelect: "none", color: orden.k === c.k ? "var(--ink)" : undefined }}>
                        {c.lab}<span className="num" style={{ opacity: orden.k === c.k ? 1 : .25, marginLeft: 4 }}>{orden.k === c.k ? (orden.dir === 1 ? "↑" : "↓") : "↕"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map(r => (
                    <tr key={r.iso}>
                      {cols.map(c => (
                        <td key={c.k} className={c.cls} style={c.style ? c.style(r) : undefined}>{c.cell(r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </Card>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Backtest {lth ? "LTH" : "STH"} SOPR <HelpDot term="Qué mide esta pestaña"
          def={lth
            ? "Recorre todo el histórico disponible y se detiene en cada día en que el SOPR de los holders de largo plazo disparó el gatillo del detector: dirección (cruce de 1), intensidad (percentil) y giro. Para cada uno de esos días muestra los valores exactos que el detector tenía delante, incluida la lectura del termómetro táctico de corto plazo del mismo día, y qué hizo el precio después. El percentil es expansivo: se calcula solo con los datos anteriores a ese día, porque en marzo de 2019 el detector no podía conocer la distribución de 2026."
            : "Lo mismo que el backtest de ciclo, pero sobre el SOPR de los holders de corto plazo: el termómetro táctico. Aquí el gatillo exige además que el aSOPR confirme —por debajo de 1 para comprar, por encima para vender—, y el giro se mide en una ventana de 10 días en vez de 21, porque el corto plazo se agota antes. Cada fila trae la lectura del núcleo de ciclo de ese mismo día, para ver si los dos horizontes coincidían. El percentil es expansivo: solo con los datos anteriores a ese día."} /></h1>
        <p>{lth
          ? "Cada disparo del SOPR de ciclo desde el inicio de la serie · dos medidores en paralelo, el gatillo clásico y la distribución de ciclo · BTC y ETH"
          : "Cada disparo del SOPR de corto plazo desde el inicio de la serie · dirección, intensidad, giro y confirmación del aSOPR · BTC y ETH"}</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div className="seg">
          {[30, 90, 180].map(h => (
            <button key={h} className={"seg-btn" + (hz === h ? " on" : "")} onClick={() => setHz(h)}>{h}d</button>
          ))}
        </div>
        <div className="seg">
          {[["todos", "Todos"], ["buy", "Compras"], ["sell", "Ventas"]]
            .concat(lth ? [["ciclo", "Solo ciclo 4a"]] : [])
            .concat([["confirmados", "Confirmados"]]).map(([id, lab]) => (
            <button key={id} className={"seg-btn" + (filtro === id ? " on" : "")} onClick={() => setFiltro(id)}>{lab}</button>
          ))}
        </div>
        <div className="seg">
          {[["todo", "Toda la serie"], ["2019", "Desde 2019"]].map(([id, lab]) => (
            <button key={id} className={"seg-btn" + (era === id ? " on" : "")} onClick={() => setEra(id)}>{lab}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => blCsv(all, cohort)}>Descargar CSV · {all.length} episodios</button>
      </div>

      <Bloque type="BTC" />
      <Bloque type="ETH" />

      {/* dentro y fuera de muestra: lo más parecido a una prueba honesta */}
      <Card title="Dentro y fuera de muestra" sub="Umbrales calibrados con la serie completa delante · el tramo desde 2021 es lo más cercano a una prueba fuera de muestra" pad={false} style={{ marginBottom: 20 }}>
        <div className="tiny" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", lineHeight: 1.55, color: "var(--ink-2)" }}>
          Los cortes de este detector —percentil 10 y 90, banda muerta del giro en 1 punto{lth ? ", ventana móvil de 4 años, percentil 95" : ", filtro de ciclo en 60"}, separación de 30 días— se eligieron con toda la serie delante, incluido 2025.
          Eso infla cualquier resultado. La partición de abajo no lo arregla, pero lo declara: a la izquierda el tramo con el que se ajustó la intuición, a la derecha el que menos la ha visto.
          Si las dos columnas se parecen, la regla es estable. Si la derecha se hunde, estaba ajustada al pasado.
        </div>
        <table className="tbl">
          <thead><tr><th>Activo · grupo</th><th className="c">Episodios hasta 2020</th><th className="r">Mediana a {hz}d</th><th className="r">Acertó</th><th className="c">Episodios desde 2021</th><th className="r">Mediana a {hz}d</th><th className="r">Acertó</th></tr></thead>
          <tbody>
            {["BTC", "ETH"].map(t => defGrupos.map(g => {
              const dentro = blStats(rowsAll[t].filter(r => r.iso < "2021-01-01"), g.kind, hz, g.regla, g.pred);
              const fuera = blStats(rowsAll[t].filter(r => r.iso >= "2021-01-01"), g.kind, hz, g.regla, g.pred);
              const cae = dentro.hit != null && fuera.hit != null && fuera.hit < dentro.hit - 15;
              return (
                <tr key={t + g.id}>
                  <td className="tiny" style={{ fontWeight: 600 }}>{t} · {g.lab}</td>
                  <td className="num c">{dentro.n}</td>
                  <td className="num r">{sgn(dentro.med)}</td>
                  <td className="num r">{dentro.hit == null ? "—" : num(dentro.hit, 0) + "%"}</td>
                  <td className="num c">{fuera.n}</td>
                  <td className="num r">{sgn(fuera.med)}</td>
                  <td className="num r" style={{ fontWeight: 700, color: fuera.hit == null ? "var(--ink-3)" : cae ? E.inkColor("#C0492E", 4.5) : E.inkColor("#2F7D5B", 4.5) }}>{fuera.hit == null ? "—" : num(fuera.hit, 0) + "%"}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </Card>

      {/* la prueba que de verdad importa: la secuencia, no la señal */}
      <Card title="Cartera frente a DCA" sub="Los lotes aplicados como secuencia de compras, contra repartir el mismo capital cada 30 días · ciclo por ciclo" pad={false} style={{ marginBottom: 20 }}>
        <table className="tbl">
          <thead><tr><th>Activo · ciclo</th><th className="c">Compras</th><th className="r">Capital</th><th className="r">Coste medio · señal</th><th className="r">Coste medio · DCA</th><th className="c">Tramos DCA</th><th className="r">Ventaja en coste</th></tr></thead>
          <tbody>
            {["BTC", "ETH"].map(t => (blCartera(rowsAll[t], t) || []).map(k => (
              <tr key={t + k.tramo}>
                <td className="tiny" style={{ fontWeight: 600 }}>{t} · {k.tramo}</td>
                {k.vacio
                  ? <td className="tiny muted" colSpan={6}>sin compras con tamaño asignado en este ciclo</td>
                  : <>
                      <td className="num c">{k.nSig}</td>
                      <td className="num r">{E.fmt.usd(k.usd)}</td>
                      <td className="num r" style={{ fontWeight: 700 }}>{E.fmt.usd(k.coste)}</td>
                      <td className="num r">{E.fmt.usd(k.costeDca)}</td>
                      <td className="num c">{k.nDca}</td>
                      <td className="num r" style={{ fontWeight: 700, color: k.ventaja < 0 ? E.inkColor("#2F7D5B", 4.5) : E.inkColor("#C0492E", 4.5) }}>{(k.ventaja > 0 ? "+" : "") + k.ventaja.toFixed(1)}%</td>
                    </>}
              </tr>
            )))}
          </tbody>
        </table>
        <div className="tiny" style={{ padding: "12px 18px", lineHeight: 1.55, color: "var(--ink-2)", borderTop: "1px solid var(--border)" }}>
          Un tramo base de 1.000 $ multiplicado por el lote que sugirió el detector ese día, contra repartir ese mismo capital en tramos iguales cada 30 días, dentro del mismo ciclo y arrancando el día de la primera señal. <b>Signo negativo es comprar más barato que el DCA.</b>
          No hay cifra agregada de los quince años a propósito: en un activo que multiplicó por miles, cualquier concentración temprana la ganaría sin mérito de la señal. Comparar dentro del ciclo es lo único que aisla lo que aporta.
          Las ventas no están simuladas: exige reglas de ejecución —qué parte se vende, si se recompra y cuándo— que el detector no define todavía.
          {!lth && " Y el termómetro táctico ya no propone lote, así que aquí no hay secuencia que simular: está por debajo de la base incondicional."}
        </div>
      </Card>

      <Card title="Dónde BTC y ETH no son iguales" sub="El detector aplica la misma lógica, pero la fiabilidad del dato no es la misma" pad={false} style={{ marginBottom: 20 }}>
        <table className="tbl">
          <thead><tr><th>Aspecto</th><th>Bitcoin</th><th>Ethereum</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>Profundidad de histórico</td>
              <td className="num">{D.BTC.sth ? D.BTC.sth.muestras : "—"} días de SOPR<div className="tiny muted">percentiles robustos</div></td>
              <td className="num">{D.ETH.sth ? D.ETH.sth.muestras : "—"} días de SOPR<div className="tiny muted">menos historia</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>SOPR de {lth ? "ciclo (LTH)" : "corto plazo (STH)"}</td>
              <td className="num">{D.BTC[cohort] ? D.BTC[cohort].muestras + " días" : "—"}<div className="tiny muted">nativo y completo</div></td>
              <td className="num">{D.ETH[cohort] ? D.ETH[cohort].muestras + " días" : "—"}<div className="tiny" style={{ color: D.ETH[cohort] && D.ETH[cohort].robusto ? (D.ETH[cohort].evaluable ? "#2F7D5B" : "#B0642A") : "#B0642A", fontWeight: 600 }}>
                {!D.ETH[cohort] ? "—"
                  : !D.ETH[cohort].robusto ? "percentil frágil: tratar como orientación"
                  : !D.ETH[cohort].evaluable ? `histórico completo, pero la fuente va ${D.ETH[cohort].meta.edad} días por detrás`
                  : "histórico completo: percentil operativo"}</div></td></tr>
            {lth &&
              <tr><td style={{ fontWeight: 600 }}>Medidor de ciclo (ventana 4 años)</td>
                <td className="num">{rows.BTC.filter(r => r.cicloR).length} episodios<div className="tiny muted">base sobrada para la ventana móvil</div></td>
                <td className="num">{rows.ETH.filter(r => r.cicloR).length} {rows.ETH.filter(r => r.cicloR).length === 1 ? "episodio" : "episodios"}<div className="tiny" style={{ color: E.inkColor("#B0642A", 4.5), fontWeight: 600 }}>la ventana tarda en tener base<div className="tiny muted" style={{ fontWeight: 400 }}>su histórico empieza en 2015</div></div></td></tr>}
            <tr><td style={{ fontWeight: 600 }}>Amplitud del mercado</td>
              <td className="num">{D.BTC.sth && D.BTC.sth.breadth && D.BTC.sth.breadth.supplyP != null ? D.BTC.sth.breadth.supplyP.toFixed(1) + "% en ganancia" : "—"}<div className="tiny muted">oferta en ganancia y manos débiles</div></td>
              <td className="num">{D.ETH.sth && D.ETH.sth.breadth && D.ETH.sth.breadth.supplyP != null ? D.ETH.sth.breadth.supplyP.toFixed(1) + "% en ganancia" : "—"}<div className="tiny muted">disponible en los dos activos</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Flujo de exchange</td>
              <td className="num">{D.BTC.sth && D.BTC.sth.breadth && D.BTC.sth.breadth.netflow != null ? "disponible" : "—"}<div className="tiny muted">disparador táctico de suelo</div></td>
              <td className="tiny" style={{ color: E.inkColor("#3E7C57", 4.5), fontWeight: 600 }}>sustituido<div className="tiny muted" style={{ fontWeight: 400 }}>Δ oferta LTH 30d · no hay netflow de ETH</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Ancla de ciclo</td>
              <td>Halving · Puell y ciclos de 4 años<div className="tiny muted">calibra si un percentil bajo es suelo de ciclo o corrección</div></td>
              <td>Sin halving<div className="tiny muted">sus ciclos siguen a los de BTC</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Rol en el mercado</td>
              <td>Lidera el ciclo</td>
              <td>Sigue a BTC con mayor amplitud<div className="tiny muted">el filtro de giro importa más aquí</div></td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Cómo leer la tabla" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {lth
            ? <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Las dos reglas</div>
                <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
                  El <b>gatillo clásico</b> compara el SOPR con todo el histórico y dispara venta en el percentil 90. El <b>medidor de ciclo</b> lo compara con sus propios cuatro años anteriores y dispara en el percentil 95.
                  La razón: la amplitud del LTH-SOPR se reduce en cada ciclo. En BTC el percentil 90 de toda la serie corresponde a un valor de 8,4, y el de los últimos cuatro años a 2,5, porque la cola alta la fijaron 2011 y 2017.
                  Por eso el techo de octubre de 2025 marcó percentil 69 contra toda la serie y 87 contra cuatro años, y el gatillo clásico dio una sola señal en todo el año.
                </p>
                <p className="tiny muted" style={{ lineHeight: 1.55, margin: "8px 0 0" }}>
                  Es una única regla aplicada a toda la serie, no un ajuste para el último ciclo: cada ciclo se juzga con su propia amplitud y los futuros se ajustan solos.
                  El medidor de ciclo es un aviso de fase, más frecuente y algo menos preciso, y por eso sugiere la mitad del lote del gatillo clásico: reducir por tramos, no vender de golpe.
                  Solo actúa en el lado de venta, porque el suelo del SOPR no se desplaza entre ciclos.
                  Las estadísticas de arriba nunca mezclan las dos reglas.
                </p>
              </div>
            : <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Qué cambia frente al de ciclo</div>
                <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
                  El gatillo táctico exige una condición más: el <b>aSOPR</b> tiene que confirmar la dirección, por debajo de 1 para comprar y por encima para vender. Sin esa confirmación el día no cuenta como disparo.
                  El <b>giro</b> se mide en una ventana de 10 días en lugar de 21, porque el corto plazo se agota antes.
                  Aquí no hay medidor de ventana móvil: el STH-SOPR se comprime entre ciclos, pero probé la ventana de 4 años y empeora el resultado —ventas desde 2019 con mediana +11% a 30 días y 36% de acierto—, así que no se aplica.
                </p>
                <p className="tiny muted" style={{ lineHeight: 1.55, margin: "8px 0 0" }}>
                  Lo que sí discrimina es el <b>ciclo</b>. Desde 2019, las compras tácticas con el núcleo LTH en percentil 60 o menos aciertan el 82% a 30 días con mediana +2,7%; con el núcleo por encima de 60, el 30% y mediana −2,8%. Por eso las compras van separadas en dos grupos y las de contra el ciclo no proponen tamaño.
                  El lado caliente no propone vender: como señal de venta acierta entre el 36% y el 50% según el plazo, así que se declara como aviso de no añadir.
                  Y la señal caduca: a 180 días acierta el 29% incluso con el ciclo a favor. Su vida útil son 30 a 90 días.
                </p>
                <p className="tiny muted" style={{ lineHeight: 1.55, margin: "8px 0 0" }}>
                  El botón <b>Desde 2019</b> existe porque el agregado de toda la serie lo arrastra 2011-2018, cuando el mercado era mucho más delgado y las compras tácticas acertaban el 25%. No se oculta ese tramo: se puede mirar con y sin él.
                </p>
              </div>}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Lo que disparó el gatillo</div>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
              <b>{soprLab}</b> por debajo de 1 significa que {lth ? "las manos firmes vendieron" : "los compradores recientes vendieron"} en pérdida; por encima, con beneficio.
              El <b>percentil</b> dice lo raro que era ese valor con el histórico que existía hasta ese día, y junto a él van los días de historial que lo sostenían.
              El <b>giro</b> mide cuántos puntos de percentil ha rebotado desde el extremo de {lth ? "las tres semanas" : "los diez días"} previos: es lo que separa un estado confirmado de uno que aún se profundiza.
            </p>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: "8px 0 0" }}>
              El día que se registra es el primero del episodio, que casi siempre es el propio extremo, y ahí el giro dominante apunta todavía en contra. Por eso hay pocos episodios marcados como confirmados: el sello llega días después, dentro del mismo episodio, y esta tabla no lo recoge.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>La amplitud</div>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
              <b>Oferta en ganancia</b> y <b>STH en pérdida</b> dicen cuánta gente estaba atrapada, no solo a qué precio vendió: es lo que distingue una corrección de una rendición.
              En BTC el <b>flujo de exchange</b> completa la foto; en ETH no existe ese dato, así que va el <b>Δ de oferta de largo plazo a 30 días</b>, que responde a la misma pregunta por la vía estructural.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{lth ? "El termómetro táctico" : "El núcleo de ciclo"}</div>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
              {lth
                ? "El percentil del SOPR de corto plazo del mismo día. Cuando el núcleo dispara compra y el táctico también estaba frío, los dos horizontes coincidían; si el táctico estaba caliente, el ciclo llamaba a comprar mientras el corto plazo aún se pagaba caro."
                : "El percentil del SOPR de ciclo del mismo día. Una compra táctica con el núcleo también frío es una compra a favor de la estructura; con el núcleo caliente es una compra contra el ciclo, y ahí el plazo importa: suele funcionar a 30 días y fallar a 180."}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>El resultado</div>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
              <b>30d, 90d y 180d</b> es lo que hizo el precio después. <b>En contra</b> es el peor recorrido dentro de los 90 días siguientes: para una compra, la caída máxima que hubo que aguantar antes de que la zona diera resultado. Los episodios más recientes no tienen horizonte completo y aparecen vacíos.
            </p>
            {lth &&
              <p className="tiny muted" style={{ lineHeight: 1.55, margin: "8px 0 0" }}>
                Un límite de la métrica que ningún umbral corrige: el SOPR de ciclo marca la <b>fase de distribución</b>, y esa fase adelanta al techo de precio entre dos y cuatro meses. En 2021 disparó en marzo y abril, con el techo de precio en noviembre; en 2025, en julio y agosto, con el techo en octubre. No es una señal de máximo, es una señal de que las manos firmes están repartiendo.
              </p>}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Por qué no acertó</div>
            <p className="tiny muted" style={{ lineHeight: 1.55, margin: 0 }}>
              El diagnóstico de la última columna no es un comentario escrito a mano: se compone de los propios campos del disparo, en este orden.
              Si el episodio sí acertó en otro horizonte, lo declara —llegar temprano no es equivocarse, y es el caso más frecuente.
              Después mira si el percentil estaba en el borde del umbral en vez de en el extremo, si faltó el giro en una compra o el agotamiento en una venta, si la amplitud del mercado iba en contra ese día{lth ? ", y si el aviso venía solo del medidor de ciclo" : ", y si el núcleo de ciclo apuntaba en dirección contraria"}.
              Cuando no se cumple ninguna de esas condiciones lo dice también: el gatillo fue limpio y el mercado no acompañó en ese plazo.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SectionBackLTH() { return <SectionBackSopr cohort="lth" />; }
function SectionBackSTH() { return <SectionBackSopr cohort="sth" />; }

Object.assign(window, { SectionBackSopr, SectionBackLTH, SectionBackSTH, blRows, blStats, blPorQue });
