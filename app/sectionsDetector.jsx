/* ============================================================
   BAMBÚ · Detector bidireccional de mercado · BTC + ETH
   Capa de detección basada en el SOPR:
   · el cruce de 1 da la DIRECCIÓN (ganancias / pérdidas)
   · el percentil histórico da la INTENSIDAD
   · el giro desde el extremo evita adelantarse a un fondo
     que todavía se profundiza
   El percentil se calcula por activo, sobre su propio histórico.
   ============================================================ */

const DET_BUY_P = 5;    // percentil de capitulación
const DET_SELL_P = 95;  // percentil de distribución
/* Banda muerta del giro, en puntos de percentil. Por debajo de este umbral el
   movimiento es ruido: el documento pide un rebote real (24-48 h), no cualquier
   signo positivo. */
const DET_VEL_DEAD = 1;      // puntos de percentil de giro desde el extremo
const DET_VEL_WIN = { sth: 10, lth: 21 };   // ventana en la que se busca el extremo

/* ---------- último dato real de un campo, con su antigüedad ----------
   Las series de CSV no se rellenan: null significa sin dato. Aquí se busca el
   último valor real y se declara de qué día es, para no presentar como lectura
   de hoy algo medido hace semanas. */
const DET_STALE_D = 7;   // a partir de aquí el dato deja de valer como confirmación
function detLast(type, field) {
  const R = window.BambuRealData[type];
  const col = R && R.cols[field];
  if (!col) return null;
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i] != null) return { v: col[i], iso: R.dates[i], edad: col.length - 1 - i, fresco: (col.length - 1 - i) <= DET_STALE_D };
  }
  return null;
}

/* ---------- percentil de un valor dentro de su propia serie ---------- */
const _detCache = {};
function detPctl(type, field, value) {
  if (value == null) return null;
  const ck = type + "|" + field;
  let v = _detCache[ck];
  if (!v) {
    const R = window.BambuRealData[type];
    const col = R && R.cols[field];
    if (!col) return null;
    v = col.filter(x => x != null).slice().sort((a, b) => a - b);
    if (v.length < 60) return null;
    _detCache[ck] = v;
  }
  let lo = 0, hi = v.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < value) lo = m + 1; else hi = m; }
  return (lo / v.length) * 100;
}

/* ---------- el giro ----------
   No es la pendiente de los días anteriores: en el fondo de una capitulación
   esa pendiente apunta siempre hacia abajo, así que nunca detectaría el rebote.
   Aquí se mide cuánto ha girado el percentil respecto a su extremo reciente:
   positivo = ya rebotó desde el mínimo · negativo = ya cedió desde el máximo.
   La ventana es de 3 días en el termómetro rápido y 7 en el lento. */
function detVelocityAt(type, field, i, days) {
  const R = window.BambuRealData[type];
  const rawKey = field + "Raw";
  const useRaw = !!(R && R.cols[rawKey]);
  const col = useRaw ? R.cols[rawKey] : (R && R.cols[field]);
  if (!col) return null;
  const f = useRaw ? rawKey : field;
  const step = days || 3;
  const pNow = col[i] == null ? null : detPctl(type, f, col[i]);
  if (pNow == null) return null;
  let min = pNow, max = pNow, vistos = 0;
  for (let k = Math.max(0, i - step); k < i; k++) {
    if (col[k] == null) continue;
    const p = detPctl(type, f, col[k]);
    if (p == null) continue;
    if (p < min) min = p;
    if (p > max) max = p;
    vistos++;
  }
  if (!vistos) return null;
  /* el giro dominante, en puntos de percentil desde el extremo de la ventana */
  const alza = pNow - min, baja = pNow - max;
  return alza >= -baja ? alza : baja;
}
function detVelocity(type, field, days) {
  const R = window.BambuRealData[type];
  const col = R && (R.cols[field + "Raw"] || R.cols[field]);
  if (!col) return null;
  /* último día con dato, no el último día de la serie */
  let i = -1; for (let k = col.length - 1; k >= 0; k--) if (col[k] != null) { i = k; break; }
  return i < 0 ? null : detVelocityAt(type, field, i, days);
}

/* ---------- amplitud de la capitulación ----------
   El SOPR dice a qué precio vendió la gente; esto dice cuánta está atrapada.
   Es lo que separa una corrección normal de una rendición de mercado. */
function detBreadth(type) {
  const R = window.BambuRealData[type];
  if (!R) return null;
  const SP = detLast(type, "supplyP"), SL = detLast(type, "sthLoss"), NF = detLast(type, "netflow");
  const sp = SP && SP.v, sl = SL && SL.v, nf = NF && NF.v;
  /* Solo un dato fresco puede confirmar o rebajar el lote: una lectura de hace
     semanas no describe el presente, aunque sea el último valor disponible. */
  const spOk = SP && SP.fresco, slOk = SL && SL.fresco;
  return {
    supplyP: sp, supplyPct: sp == null ? null : detPctl(type, "supplyP", sp), supplyMeta: SP,
    sthLoss: sl, sthLossPct: sl == null ? null : detPctl(type, "sthLoss", sl), sthLossMeta: SL,
    netflow: nf, netflowPct: nf == null ? null : detPctl(type, "netflow", nf), netflowMeta: NF,
    confirmaSuelo: spOk && slOk && sp < 55 && sl > 55,
    confirmaTecho: spOk && slOk && sp > 90 && sl < 15,
    salida: NF && NF.fresco && nf < 0,
    /* si algún campo va con retraso, la interfaz lo declara */
    caducados: [SP, SL, NF].filter(x => x && !x.fresco).length,
  };
}

/* ---------- el detector, por activo y cohorte ---------- */
function detCohort(type, cohort) {
  const R = window.BambuRealData[type];
  if (!R) return null;
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const M = detLast(type, field);
  const v = M ? M.v : null;
  const pct = detPctl(type, field, v);
  const vel = detVelocity(type, field, DET_VEL_WIN[cohort]);
  const MA = detLast(type, "asopr");
  const aso = MA ? MA.v : null, asoP = detPctl(type, "asopr", aso);

  /* dirección: el cruce de 1 */
  const dir = v == null ? null : v < 1 ? "perdida" : v > 1 ? "ganancia" : "par";

  /* gatillos: dirección + intensidad + giro */
  const compraBase = v != null && v < 1 && pct != null && pct <= DET_BUY_P &&
                     (cohort === "sth" ? (aso != null && aso < 1) : true);
  const ventaBase = v != null && v > 1 && pct != null && pct >= DET_SELL_P &&
                    (cohort === "sth" ? (aso != null && aso > 1) : true);
  const giroAlza = vel != null && vel >= DET_VEL_DEAD;
  const perdiendoFuerza = vel != null && vel <= -DET_VEL_DEAD;
  const plano = vel != null && !giroAlza && !perdiendoFuerza;

  const br = detBreadth(type);
  let estado, nivel = 0, accion;
  /* Sin dato, o con un dato de semanas atrás, el detector no evalúa: decir
     "sin extremo" sería presentar como lectura algo que no se ha medido. */
  if (v == null) { estado = "SIN DATO"; nivel = null; accion = "No evaluable"; }
  else if (M && !M.fresco) { estado = "SIN DATO RECIENTE"; nivel = null; accion = "No evaluable · la fuente va con retraso"; }
  else if (compraBase && giroAlza) { estado = "CAPITULACIÓN CONFIRMADA"; nivel = 3; accion = "Lote pesado"; }
  else if (compraBase) { estado = "CAPITULACIÓN SIN GIRO"; nivel = 2; accion = "Esperar el rebote"; }
  else if (ventaBase && perdiendoFuerza) { estado = "DISTRIBUCIÓN CONFIRMADA"; nivel = -3; accion = "Venta agresiva"; }
  else if (ventaBase) { estado = "DISTRIBUCIÓN SIN AGOTAMIENTO"; nivel = -2; accion = "Empezar a soltar"; }
  else if (pct != null && pct <= 20) { estado = "ZONA BARATA"; nivel = 1; accion = "Acumular en tramos"; }
  else if (pct != null && pct >= 80) { estado = "ZONA CARA"; nivel = -1; accion = "Reducir en tramos"; }
  else { estado = "SIN EXTREMO"; nivel = 0; accion = "Sin ventaja: mantener"; }

  /* lote graduado por lo extremo del percentil */
  const lote = nivel > 0 ? (pct <= 2 ? 1 : pct <= 5 ? 0.7 : pct <= 12 ? 0.4 : 0.2)
             : nivel < 0 ? (pct >= 98 ? 1 : pct >= 95 ? 0.7 : pct >= 88 ? 0.4 : 0.2) : 0;
  const evaluable = nivel != null;

  /* cuántos días de histórico sostienen el percentil */
  const col = R.cols[field] || [];
  const n = col.filter(x => x != null).length;

  /* la amplitud refuerza o rebaja el lote, sin cambiar la dirección del gatillo */
  let loteAj = lote, aviso = null;
  if (evaluable && nivel > 0 && br) {
    if (br.confirmaSuelo) { loteAj = Math.min(1, lote * 1.3); aviso = "amplitud confirma: el mercado está mayoritariamente en pérdida"; }
    else if (br.supplyMeta && br.supplyMeta.fresco && br.supplyP > 80) { loteAj = lote * 0.6; aviso = "amplitud no acompaña: casi todo el mercado sigue en ganancia, la rendición no es general"; }
  } else if (evaluable && nivel < 0 && br) {
    if (br.confirmaTecho) { loteAj = Math.min(1, lote * 1.3); aviso = "amplitud confirma: casi todo el mercado está en ganancia"; }
    else if (br.supplyMeta && br.supplyMeta.fresco && br.supplyP < 70) { loteAj = lote * 0.6; aviso = "amplitud no acompaña: buena parte del mercado sigue en pérdida"; }
  }

  return { type, cohort, field, value: v, pct, vel, plano, dir, estado, nivel, accion, evaluable,
           meta: M, asoprMeta: MA,
           lote: loteAj, loteBase: lote, aviso, breadth: br,
           asopr: aso, asoprPct: asoP, muestras: n,
           robusto: n >= 700, giroAlza, perdiendoFuerza };
}

/* ---------- confluencia: ETH decide el activo, BTC confirma el momento ---------- */
function detConfluence(btc, eth) {
  if (!btc || !eth) return null;
  if (!btc.evaluable || !eth.evaluable) return { id: "nodata", t: "Confluencia no evaluable",
    d: `No se puede comparar los dos activos porque ${!btc.evaluable ? "BTC" : "ETH"} no tiene lectura reciente de SOPR. El detector no marca zona de suelo ni de techo de mercado hasta que la fuente se ponga al día.`, col: "#7A8A80" };
  const ambosCompra = btc.nivel >= 2 && eth.nivel >= 2;
  const ambosVenta = btc.nivel <= -2 && eth.nivel <= -2;
  const soloEth = eth.nivel >= 2 && btc.nivel < 2;
  const soloEthVenta = eth.nivel <= -2 && btc.nivel > -2;

  if (ambosCompra) return { id: "suelo", t: "Suelo confirmado por los dos activos",
    d: "BTC y ETH marcan capitulación al mismo tiempo. Es la lectura más fiable del detector: el suelo no es debilidad de un activo suelto, es rendición de mercado. Aquí tienen sentido los lotes más pesados.", col: "#2E6FAE" };
  if (ambosVenta) return { id: "techo", t: "Techo confirmado por los dos activos",
    d: "Distribución simultánea en BTC y ETH. Un techo creíble: los dos lados del mercado venden con beneficio a la vez.", col: "#C0492E" };
  if (soloEth) return { id: "sospecha", t: "ETH capitula pero BTC no acompaña",
    d: "Sospecha de debilidad relativa de ETH más que de suelo de mercado. Reduce el tamaño del lote o espera que BTC confirme.", col: "#B0642A" };
  if (soloEthVenta) return { id: "sospechaV", t: "ETH distribuye pero BTC no acompaña",
    d: "Puede ser agotamiento propio de ETH y no techo de mercado. Vende menos de lo que sugeriría ETH en solitario.", col: "#B0642A" };
  return { id: "sin", t: "Sin confluencia entre activos",
    d: "Ninguno de los dos está en extremo simultáneo. El detector no marca zona de suelo ni de techo de mercado: cada activo se lee por separado.", col: "#7A8A80" };
}

/* ---------- el gatillo, evaluado en un día cualquiera del histórico ----------
   Una sola definición del criterio: la usan el detector en vivo y el panel de
   validación, para que no puedan divergir. */
function detTriggerAt(type, cohort, i) {
  const R = window.BambuRealData[type];
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const col = R && R.cols[field];
  if (!col) return null;
  const v = col[i];
  if (v == null) return null;
  const pct = detPctl(type, field, v);
  if (pct == null) return null;

  /* misma función de giro que en vivo: una sola definición del criterio */
  const vel = detVelocityAt(type, cohort === "sth" ? "sthSopr" : "lthSopr", i, DET_VEL_WIN[cohort]);
  const giroAlza = vel != null && vel >= DET_VEL_DEAD;
  const perdiendoFuerza = vel != null && vel <= -DET_VEL_DEAD;

  /* aSOPR de ese mismo día: confirmación obligatoria en el termómetro táctico */
  const aso = R.cols.asopr ? R.cols.asopr[i] : null;
  const asoOkBuy = cohort === "sth" ? (aso != null && aso < 1) : true;
  const asoOkSell = cohort === "sth" ? (aso != null && aso > 1) : true;

  const compraBase = v < 1 && pct <= DET_BUY_P && asoOkBuy;
  const ventaBase = v > 1 && pct >= DET_SELL_P && asoOkSell;

  return {
    v, pct, vel, aso, giroAlza, perdiendoFuerza,
    base: compraBase ? "buy" : ventaBase ? "sell" : null,
    /* confirmado = el nivel 3, el único que dispara lote pesado */
    confirmado: (compraBase && giroAlza) ? "buy" : (ventaBase && perdiendoFuerza) ? "sell" : null,
  };
}

/* ---------- histórico de disparos del detector ---------- */
function detHistory(type, cohort, limit) {
  const R = window.BambuRealData[type];
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const col = R && R.cols[field], px = R && R.cols.price;
  if (!col || !px) return [];
  const out = []; let last = -999;
  const horizons = [30, 90, 180];
  for (let i = 30; i < R.count; i++) {
    if (px[i] == null) continue;
    const g = detTriggerAt(type, cohort, i);
    if (!g || !g.base) continue;
    if (i - last < 30) continue;          // un disparo por mes, para no contar el mismo evento
    const fwd = {};
    horizons.forEach(h => { const j = i + h; fwd[h] = (j < R.count && px[j] != null) ? (px[j] / px[i] - 1) * 100 : null; });
    out.push({ i, iso: R.dates[i], v: g.v, pct: g.pct, px: px[i], kind: g.base,
               confirmado: g.confirmado === g.base, vel: g.vel, aso: g.aso, fwd });
    last = i;
  }
  return limit ? out.slice(-limit) : out;
}

function detStats(hist, h, soloConfirmados) {
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const sel = k => hist.filter(x => x.kind === k && Number.isFinite(x.fwd[h]) && (!soloConfirmados || x.confirmado));
  const buys = sel("buy"), sells = sel("sell");
  return {
    buy: { n: buys.length, med: med(buys.map(x => x.fwd[h])), hit: buys.length ? buys.filter(x => x.fwd[h] > 0).length / buys.length * 100 : null },
    sell: { n: sells.length, med: med(sells.map(x => x.fwd[h])), hit: sells.length ? sells.filter(x => x.fwd[h] < 0).length / sells.length * 100 : null },
  };
}

/* ============================================================
   LA SECCIÓN
   ============================================================ */
function SectionDetector({ palette }) {
  const E = window.BambuEngine;
  const [hz, setHz] = React.useState(90);
  const [hcoh, setHcoh] = React.useState("sth");
  const [htype, setHtype] = React.useState("BTC");

  const D = React.useMemo(() => ({
    BTC: { sth: detCohort("BTC", "sth"), lth: detCohort("BTC", "lth") },
    ETH: { sth: detCohort("ETH", "sth"), lth: detCohort("ETH", "lth") },
  }), []);
  const conf = React.useMemo(() => detConfluence(D.BTC.sth, D.ETH.sth), [D]);
  const hist = React.useMemo(() => detHistory(htype, hcoh), [htype, hcoh]);
  const st = React.useMemo(() => detStats(hist, hz, false), [hist, hz]);
  const stC = React.useMemo(() => detStats(hist, hz, true), [hist, hz]);

  const COL = n => n == null ? "#8C9389" : n >= 2 ? "#2E6FAE" : n === 1 ? "#4E86B8" : n === 0 ? "#7A8A80" : n === -1 ? "#C98A2E" : "#C0492E";
  const fmtIso = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
  const pct1 = v => v == null ? "—" : v.toFixed(1);
  const sgn = v => v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1) + "%";

  /* un dato de amplitud: si va con retraso se apaga y se declara su fecha, en
     lugar de afirmar algo del presente con una medición de semanas atrás */
  const Amp = ({ lab, val, meta, extra, col }) => {
    const viejo = meta && !meta.fresco;
    return (
      <span className="tiny muted" style={{ opacity: viejo ? .62 : 1 }}>
        {lab} <b className="num" style={{ color: viejo ? "var(--ink-3)" : (col || "var(--ink)") }}>{val}</b>
        {viejo
          ? <span className="num" style={{ fontStyle: "italic" }}> · dato del {fmtIso(meta.iso)}, hace {meta.edad} días</span>
          : extra ? <span className="num"> · {extra}</span> : null}
      </span>
    );
  };

  /* tarjeta de un termómetro */
  const Termo = ({ d, lab, sub }) => {
    if (!d) return null;
    const col = COL(d.nivel);
    const pos = d.pct == null ? 50 : d.pct;
    /* un solo interruptor para toda la tarjeta */
    const off = !d.evaluable;
    const dim = off ? { opacity: .5 } : null;
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden", borderTop: `4px solid ${col}` }}>
        <div style={{ padding: "16px 18px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{lab}</span>
            <span className="tiny muted">{sub}</span>
            {!d.robusto && <span className="badge" style={{ background: mixSoft("#B0642A"), color: "#B0642A", fontWeight: 700 }}>histórico corto</span>}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={dim}>
              <div className="tiny muted">SOPR</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: off ? "var(--ink-3)" : d.dir === "perdida" ? "#2E6FAE" : "#C0492E" }}>{d.value == null ? "—" : d.value.toFixed(3)}</div>
              <div className="tiny" style={{ fontWeight: 600, color: off ? "var(--ink-3)" : d.dir === "perdida" ? "#2E6FAE" : "#C0492E" }}>
                {d.value == null ? "sin dato en la fuente"
                  : off ? <span style={{ fontStyle: "italic" }}>dato del {fmtIso(d.meta.iso)}, hace {d.meta.edad} días</span>
                  : d.dir === "perdida" ? "vende en pérdida" : d.dir === "ganancia" ? "vende con beneficio" : "en equilibrio"}
              </div>
            </div>
            <div style={dim}>
              <div className="tiny muted">Percentil</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, color: col, lineHeight: 1 }}>{pct1(d.pct)}</div>
              <div className="tiny muted">{off ? "no evaluable" : "de su propio histórico"}</div>
            </div>
            <div style={dim}>
              <div className="tiny muted">Giro</div>
              <div className="num" style={{ fontSize: 19, fontWeight: 700, color: (off || d.vel == null || d.plano) ? "var(--ink-3)" : d.giroAlza ? "#2F7D5B" : "#C0492E" }}>{d.vel == null ? "—" : (d.vel > 0 ? "+" : "") + d.vel.toFixed(2)}</div>
              <div className="tiny muted">pts de giro · {off ? "no evaluable" : d.vel == null ? "—" : d.plano ? "plano · sin giro" : d.giroAlza ? "girando al alza" : "perdiendo fuerza"}</div>
            </div>
          </div>
          {/* barra de percentil con las dos franjas de gatillo */}
          <div style={{ position: "relative", height: 30, marginTop: 14 }}>
            <div style={{ position: "absolute", inset: "10px 0 auto", height: 9, background: "var(--surface-3)", borderRadius: 5 }} />
            <div style={{ position: "absolute", left: 0, width: DET_BUY_P + "%", top: 10, height: 9, background: mixSoft("#2E6FAE", .45), borderRadius: "5px 0 0 5px" }} />
            <div style={{ position: "absolute", right: 0, width: (100 - DET_SELL_P) + "%", top: 10, height: 9, background: mixSoft("#C0492E", .45), borderRadius: "0 5px 5px 0" }} />
            {!off && <div style={{ position: "absolute", left: pos + "%", top: 4, transform: "translateX(-50%)", width: 3, height: 21, background: col, borderRadius: 2 }} />}
            <div className="tiny muted num" style={{ position: "absolute", left: 0, top: 21 }}>≤{DET_BUY_P} compra</div>
            <div className="tiny muted num" style={{ position: "absolute", right: 0, top: 21 }}>≥{DET_SELL_P} venta</div>
          </div>
        </div>
        {/* amplitud: cuánta gente está atrapada, no solo a qué precio vendió */}
        {d.breadth && (d.breadth.supplyP != null || d.breadth.netflow != null) &&
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "10px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2, #F2F6F2)" }}>
            {d.breadth.supplyP != null &&
              <Amp lab="Oferta en ganancia" val={d.breadth.supplyP.toFixed(1) + "%"} meta={d.breadth.supplyMeta}
                   extra={d.breadth.supplyMeta && d.breadth.supplyMeta.fresco ? "pct " + pct1(d.breadth.supplyPct) : null} />}
            {d.breadth.sthLoss != null &&
              <Amp lab="Compradores recientes en pérdida" val={d.breadth.sthLoss.toFixed(1) + "%"} meta={d.breadth.sthLossMeta} />}
            {d.breadth.netflow != null &&
              <Amp lab="Flujo de exchange" val={(d.breadth.netflow > 0 ? "+" : "") + d.breadth.netflow.toFixed(0) + " " + d.type}
                   meta={d.breadth.netflowMeta}
                   col={d.breadth.netflowMeta && d.breadth.netflowMeta.fresco ? (d.breadth.netflow < 0 ? "#2E6FAE" : "#C0492E") : null}
                   extra={d.breadth.netflowMeta && d.breadth.netflowMeta.fresco ? (d.breadth.netflow < 0 ? "salen monedas" : "entran monedas") : null} />}
          </div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 18px", background: mixSoft(col, .9), borderTop: "1px solid var(--border)" }}>
          <span className="badge" style={{ background: "var(--surface, var(--card, #fff))", color: col, fontWeight: 700 }}>{d.estado}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{d.accion}</span>
          {d.lote > 0 && <span className="tiny muted">lote sugerido: <b className="num" style={{ color: col }}>{(d.lote * 100).toFixed(0)}%</b> del tramo</span>}
          <span style={{ flex: 1 }} />
          {d.cohort === "sth" && d.asopr != null &&
            <span className="tiny muted">aSOPR {d.asopr.toFixed(3)} · pct {pct1(d.asoprPct)}</span>}
        </div>
        {d.aviso &&
          <div className="tiny" style={{ padding: "9px 18px", borderTop: "1px solid var(--border)", lineHeight: 1.5, color: "var(--ink-2)" }}>
            <b style={{ color: col }}>Ajuste por amplitud:</b> {d.aviso}. Lote base {(d.loteBase * 100).toFixed(0)}% → <b className="num">{(d.lote * 100).toFixed(0)}%</b>.
          </div>}
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Detector bidireccional <HelpDot term="Cómo funciona el detector" def="El SOPR gira alrededor de 1: por encima el mercado vende con beneficio, por debajo vende en pérdida. El cruce de 1 da la dirección. El percentil histórico da la intensidad: un SOPR bajo en percentil 3 es mucho más raro que uno en percentil 25. Y el giro evita adelantarse a un extremo que todavía se profundiza: mide cuánto ha rebotado el percentil desde su punto más bajo de los últimos días, así que solo cuenta cuando el suelo ya se está formando y no cuando aún se hunde. Los tres juntos forman el gatillo: dirección, intensidad y giro." /></h1>
        <p>El termómetro del SOPR para BTC y ETH · la dirección la da el cruce de 1, la intensidad el percentil y el momento el giro</p>
      </div>

      {/* confluencia primero: es la lectura que manda */}
      {conf &&
        <div className="card" style={{ padding: "18px 22px", marginBottom: 16, borderLeft: `5px solid ${conf.col}` }}>
          <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, color: conf.col, marginBottom: 7 }}>Confluencia entre activos</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.3 }}>{conf.t}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 6, maxWidth: 860 }}>{conf.d}</div>
          <div className="tiny muted" style={{ marginTop: 9, lineHeight: 1.5 }}>
            Regla del detector: <b>ETH decide el activo, BTC confirma el momento.</b> Como BTC lidera el ciclo, su lectura sirve de confirmación macro para las decisiones sobre ETH.
          </div>
        </div>}

      {/* los cuatro termómetros */}
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Termómetro táctico · STH</h2>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Termo d={D.BTC.sth} lab="Bitcoin · corto plazo" sub="rápido · táctico" />
        <Termo d={D.ETH.sth} lab="Ethereum · corto plazo" sub="rápido · táctico · mayor beta" />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Termómetro de núcleo · LTH</h2>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Termo d={D.BTC.lth} lab="Bitcoin · ciclo" sub="lento · núcleo" />
        <Termo d={D.ETH.lth} lab="Ethereum · ciclo" sub={"lento · núcleo" + (D.ETH.lth && !D.ETH.lth.robusto ? " · percentil menos robusto" : "")} />
      </div>

      {/* diferencias entre activos, declaradas */}
      <Card title="Dónde BTC y ETH no son iguales" sub="El detector aplica la misma lógica, pero la fiabilidad del dato no es la misma" pad={false} style={{ marginBottom: 20 }}>
        <table className="tbl">
          <thead><tr><th>Aspecto</th><th>Bitcoin</th><th>Ethereum</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 600 }}>Profundidad de histórico</td>
              <td className="num">{D.BTC.sth ? D.BTC.sth.muestras : "—"} días de SOPR<div className="tiny muted">percentiles robustos</div></td>
              <td className="num">{D.ETH.sth ? D.ETH.sth.muestras : "—"} días de SOPR<div className="tiny muted">menos historia</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>SOPR de ciclo (LTH)</td>
              <td className="num">{D.BTC.lth ? D.BTC.lth.muestras + " días" : "—"}<div className="tiny muted">nativo y completo</div></td>
              <td className="num">{D.ETH.lth ? D.ETH.lth.muestras + " días" : "—"}<div className="tiny" style={{ color: D.ETH.lth && D.ETH.lth.robusto ? (D.ETH.lth.evaluable ? "#2F7D5B" : "#B0642A") : "#B0642A", fontWeight: 600 }}>
                {!D.ETH.lth ? "—"
                  : !D.ETH.lth.robusto ? "percentil frágil: tratar como orientación"
                  : !D.ETH.lth.evaluable ? `histórico completo, pero la fuente va ${D.ETH.lth.meta.edad} días por detrás`
                  : "histórico completo: percentil operativo"}</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Amplitud del mercado</td>
              <td className="num">{D.BTC.sth && D.BTC.sth.breadth ? D.BTC.sth.breadth.supplyP.toFixed(1) + "% en ganancia" : "—"}<div className="tiny muted">oferta en ganancia y manos débiles</div></td>
              <td className="num">{D.ETH.sth && D.ETH.sth.breadth ? D.ETH.sth.breadth.supplyP.toFixed(1) + "% en ganancia" : "—"}<div className="tiny muted">disponible en los dos activos</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Flujo de exchange</td>
              <td className="num">{D.BTC.sth && D.BTC.sth.breadth && D.BTC.sth.breadth.netflow != null ? "disponible" : "—"}<div className="tiny muted">disparador táctico de suelo</div></td>
              <td className="tiny" style={{ color: "#B0642A", fontWeight: 600 }}>pendiente<div className="tiny muted" style={{ fontWeight: 400 }}>falta el netflow de ETH</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Pi Cycle</td>
              <td>Válido · marcó techos históricos<div className="tiny muted">sirve de confirmación secundaria</div></td>
              <td>Débil · prestado<div className="tiny muted">solo dato de apoyo, nunca gatillo</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Ancla de ciclo</td>
              <td>Halving · Puell y ciclos de 4 años<div className="tiny muted">calibra si un percentil bajo es suelo de ciclo o corrección</div></td>
              <td>Sin halving<div className="tiny muted">sus ciclos siguen a los de BTC</div></td></tr>
            <tr><td style={{ fontWeight: 600 }}>Rol en el mercado</td>
              <td>Lidera el ciclo</td>
              <td>Sigue a BTC con mayor amplitud<div className="tiny muted">el filtro de giro importa más aquí</div></td></tr>
          </tbody>
        </table>
      </Card>

      {/* histórico de disparos */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Qué pasó las otras veces</h2>
        <span style={{ flex: 1 }} />
        <div className="seg">{["BTC", "ETH"].map(t => <button key={t} className={"seg-btn" + (htype === t ? " on" : "")} onClick={() => setHtype(t)}>{t}</button>)}</div>
        <div className="seg">
          <button className={"seg-btn" + (hcoh === "sth" ? " on" : "")} onClick={() => setHcoh("sth")}>STH</button>
          <button className={"seg-btn" + (hcoh === "lth" ? " on" : "")} onClick={() => setHcoh("lth")}>LTH</button>
        </div>
        <div className="seg">{[30, 90, 180].map(h => <button key={h} className={"seg-btn" + (hz === h ? " on" : "")} onClick={() => setHz(h)}>{h}d</button>)}</div>
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", margin: "0 0 14px", maxWidth: 940 }}>
        Se separan las dos reglas para que se vea qué aporta cada filtro. El <b>gatillo base</b> exige dirección e intensidad
        {hcoh === "sth" ? ", más la confirmación del aSOPR" : ""}. El <b>gatillo confirmado</b> añade el giro
        —al menos {DET_VEL_DEAD} punto de percentil de rebote desde el extremo de los últimos {DET_VEL_WIN[hcoh]} días— y es el único que en vivo dispara lote pesado.
        Exigir el giro mejora mucho el resultado, pero deja <b>muy pocos episodios</b>: donde la muestra baja de cinco, la cifra se apaga y se marca como corta, porque una mediana de dos casos no demuestra nada.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {[["Compra", "#2E6FAE", "subió", st.buy, stC.buy], ["Venta", "#C0492E", "cayó", st.sell, stC.sell]].map(([lab, col, verb, sB, sC]) => (
          <div key={lab} className="card" style={{ padding: 0, overflow: "hidden", borderTop: `4px solid ${col}` }}>
            <div style={{ padding: "14px 18px 10px", fontSize: 14, fontWeight: 700 }}>Gatillos de {lab.toLowerCase()}</div>
            {sB.n === 0
              ? <div className="tiny muted" style={{ padding: "0 18px 14px" }}>Sin disparos de este tipo en el histórico disponible de {htype}-{hcoh.toUpperCase()}.</div>
              : <table className="tbl">
                  <thead><tr><th>Regla</th><th className="c">Episodios</th><th className="r">Mediana a {hz}d</th><th className="r">Acertó</th></tr></thead>
                  <tbody>
                    {[["Base", sB, "dirección + intensidad" + (hcoh === "sth" ? " + aSOPR" : "")],
                      ["Confirmado", sC, "base + giro desde el extremo"]].map(([r, s, expl]) => (
                      <tr key={r} style={r === "Confirmado" ? { background: mixSoft(col, .93) } : null}>
                        <td style={{ fontWeight: r === "Confirmado" ? 700 : 500 }}>{r}<div className="tiny muted" style={{ fontWeight: 400 }}>{expl}</div></td>
                        <td className="c num">{s.n}{s.n > 0 && s.n < 5 && <div className="tiny" style={{ color: "#B0642A", fontWeight: 600 }}>muestra corta</div>}</td>
                        <td className="r num" style={{ fontWeight: 700, color: s.med == null ? "var(--ink-3)" : s.n < 5 ? "var(--ink-3)" : col }}>{sgn(s.med)}</td>
                        <td className="r num" style={{ fontWeight: 700, color: s.n > 0 && s.n < 5 ? "var(--ink-3)" : "var(--ink)" }}>{s.hit == null ? "—" : s.hit.toFixed(0) + "%"}<div className="tiny muted" style={{ fontWeight: 400 }}>el precio {verb}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        ))}
      </div>

      {hist.length > 0 &&
        <Card title={`Disparos del detector · ${htype} · ${hcoh.toUpperCase()}`} sub={`${hist.length} episodios (${hist.filter(x => x.confirmado).length} confirmados por giro), con al menos 30 días entre uno y el siguiente`} pad={false} style={{ marginBottom: 16 }}>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table className="tbl">
              <thead style={{ position: "sticky", top: 0, background: "var(--surface, var(--card, #fff))", zIndex: 2 }}>
                <tr><th>Fecha</th><th className="c">Gatillo</th><th className="c">Regla</th><th className="r">SOPR</th><th className="c">Percentil</th><th className="r">Giro</th><th className="r">Precio</th>
                  <th className="r">30d</th><th className="r">90d</th><th className="r">180d</th></tr>
              </thead>
              <tbody>
                {hist.slice().reverse().map((x, i) => {
                  const col = x.kind === "buy" ? "#2E6FAE" : "#C0492E";
                  const cell = h => {
                    const v = x.fwd[h];
                    if (!Number.isFinite(v)) return <td className="r tiny muted">—</td>;
                    const bien = x.kind === "buy" ? v > 0 : v < 0;
                    return <td className="r num" style={{ fontWeight: 600, color: bien ? "#2F7D5B" : "#C0492E" }}>{sgn(v)}</td>;
                  };
                  return (
                    <tr key={i}>
                      <td className="tiny" style={{ whiteSpace: "nowrap" }}>{fmtIso(x.iso)}</td>
                      <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col, fontWeight: 700 }}>{x.kind === "buy" ? "COMPRA" : "VENTA"}</span></td>
                      <td className="c tiny" style={{ fontWeight: x.confirmado ? 700 : 400, color: x.confirmado ? col : "var(--ink-3)" }}>{x.confirmado ? "confirmado" : "base"}</td>
                      <td className="r num">{x.v.toFixed(3)}</td>
                      <td className="c num tiny">{x.pct.toFixed(1)}</td>
                      <td className="r num tiny" style={{ color: x.vel == null ? "var(--ink-3)" : "var(--ink-2)" }}>{x.vel == null ? "—" : (x.vel > 0 ? "+" : "") + x.vel.toFixed(2)}</td>
                      <td className="r num">{E.fmt.usd(x.px)}</td>
                      {cell(30)}{cell(90)}{cell(180)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>}

      {/* frescura de los datos: qué es lectura de hoy y qué no */}
      {(() => {
        const campos = [];
        [["BTC", "supplyP", "Oferta en ganancia"], ["BTC", "sthLoss", "Compradores recientes en pérdida"], ["BTC", "netflow", "Flujo de exchange"],
         ["ETH", "supplyP", "Oferta en ganancia"], ["ETH", "sthLoss", "Compradores recientes en pérdida"],
         ["ETH", "lthSopr", "SOPR de ciclo"], ["ETH", "cdd", "CDD"], ["ETH", "rhodl", "RHODL"]].forEach(([t, f, lab]) => {
          const L = detLast(t, f);
          if (L && !L.fresco) campos.push({ t, lab, iso: L.iso, edad: L.edad });
        });
        if (!campos.length) return null;
        return (
          <div style={{ background: "#FBF1E9", border: "1px solid #E8D4BF", borderRadius: 11, padding: "13px 17px", marginBottom: 16 }}>
            <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, color: "#8C5A22", marginBottom: 7 }}>Datos con retraso en la fuente</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#6B4A25" }}>
              Estos campos no tienen dato de hoy, así que el detector muestra el último medido y <b>no los usa para confirmar ni para ajustar el lote</b>:
              {campos.map((c, i) => (
                <span key={i}> {i > 0 ? "· " : ""}<b>{c.t} {c.lab}</b> ({fmtIso(c.iso)}, hace {c.edad} días)</span>
              ))}.
            </div>
          </div>
        );
      })()}

      <div className="tiny muted" style={{ lineHeight: 1.6, maxWidth: 940 }}>
        <b>Advertencias.</b> Los umbrales están calibrados sobre el histórico y el pasado no garantiza el futuro.
        Los campos servidos por CSV no se rellenan: donde no hay dato queda vacío, y si el último medido tiene más de {DET_STALE_D} días la interfaz lo declara y lo excluye de las confirmaciones.
        {(() => {
          const bs = D.BTC.sth, es = D.ETH.sth, el = D.ETH.lth;
          const nB = bs ? bs.muestras : 0, nE = Math.min(es ? es.muestras : 0, el ? el.muestras : 0);
          const retraso = [D.ETH.sth, D.ETH.lth].filter(x => x && x.meta && !x.meta.fresco).map(x => x.meta.edad);
          const partes = [];
          if (nE && nB) partes.push(`ETH tiene ${nE.toLocaleString("de-DE")} días de histórico frente a los ${nB.toLocaleString("de-DE")} de BTC, así que sus percentiles descansan sobre menos ciclos: refuérzalos con la confluencia entre activos`);
          if (retraso.length) partes.push(`y su limitación de hoy no es la profundidad sino el retraso de la fuente, que va ${Math.max(...retraso)} días por detrás`);
          return partes.length ? " " + partes.join(", ") + ". " : null;
        })()}
        El detector se revisa con cadencia <b>semanal</b>, con un horizonte de 2 a 8 semanas; no está pensado para operar intradía.
        No es asesoramiento financiero.
      </div>
    </div>
  );
}

Object.assign(window, { SectionDetector, detCohort, detConfluence, detHistory, detPctl });
