/* ============================================================
   BAMBÚ · Detector bidireccional de mercado · BTC + ETH
   Capa de detección basada en el SOPR:
   · el cruce de 1 da la DIRECCIÓN (ganancias / pérdidas)
   · el percentil histórico da la INTENSIDAD
   · el giro desde el extremo evita adelantarse a un fondo
     que todavía se profundiza
   El percentil se calcula por activo, sobre su propio histórico.
   ============================================================ */

const DET_BUY_P = 10;   // percentil de capitulación
const DET_SELL_P = 90;  // percentil de distribución
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

/* ---------- percentil de un valor dentro de su propia serie ----------
   Dos modos, y la diferencia es la honestidad del backtest:
   · detPctl(type, field, value)     → contra TODA la serie. Válido solo para
     la lectura de HOY, que es el último día y no tiene futuro.
   · detPctlAt(type, field, i)       → contra los datos ANTERIORES al día i.
     Es el que usa el backtest: en marzo de 2019 el detector no podía conocer
     la distribución de 2020-2026, y medir con ella infla el resultado. */
const DET_MIN_HIST = 365;   // días mínimos previos para que el percentil valga
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

/* percentil expansivo, calculado de una sola pasada y memoizado por índice.
   La ventana de velocidad consulta índices hacia atrás en cada día evaluado, así
   que un estado incremental que se reinicia al retroceder volvería el backtest
   cuadrático: aquí se resuelve toda la serie una vez y se cachea. */
const _detExp = {};
function _detExpBuild(type, field) {
  const R = window.BambuRealData[type];
  const col = R && R.cols[field];
  if (!col) return null;
  const out = new Array(col.length).fill(null);
  const sorted = [];
  for (let i = 0; i < col.length; i++) {
    const value = col[i];
    /* percentil con lo acumulado ANTES de este día */
    if (value != null && sorted.length >= DET_MIN_HIST) {
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < value) lo = m + 1; else hi = m; }
      out[i] = { pct: (lo / sorted.length) * 100, n: sorted.length };
    }
    if (value != null) {
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < value) lo = m + 1; else hi = m; }
      sorted.splice(lo, 0, value);
    }
  }
  return out;
}
function detPctlAt(type, field, i) {
  const ck = type + "|" + field;
  let arr = _detExp[ck];
  if (arr === undefined) arr = _detExp[ck] = _detExpBuild(type, field);
  return arr ? (arr[i] || null) : null;
}

/* ---------- el giro ----------
   No es la pendiente de los días anteriores: en el fondo de una capitulación
   esa pendiente apunta siempre hacia abajo, así que nunca detectaría el rebote.
   Aquí se mide cuánto ha girado el percentil respecto a su extremo reciente:
   positivo = ya rebotó desde el mínimo · negativo = ya cedió desde el máximo.
   La ventana es de 3 días en el termómetro rápido y 7 en el lento. */
function detVelocityAt(type, field, i, days, expansivo) {
  const R = window.BambuRealData[type];
  const rawKey = field + "Raw";
  const useRaw = !!(R && R.cols[rawKey]);
  const col = useRaw ? R.cols[rawKey] : (R && R.cols[field]);
  if (!col) return null;
  const f = useRaw ? rawKey : field;
  const step = days || 3;
  /* En modo expansivo cada percentil se mide solo con los datos anteriores a su
     propio día: la magnitud del giro se compara con DET_VEL_DEAD, así que usar
     la distribución completa cambiaba la bandera de confirmado. */
  const P = k => {
    if (col[k] == null) return null;
    if (!expansivo) return detPctl(type, f, col[k]);
    const r = detPctlAt(type, f, k);
    return r == null ? null : r.pct;
  };
  /* ventana en orden ASCENDENTE y el día i al final: detPctlAt mantiene estado
     incremental y reiniciarlo en cada paso sería cuadrático. */
  let min = Infinity, max = -Infinity, vistos = 0;
  for (let k = Math.max(0, i - step); k < i; k++) {
    const p = P(k);
    if (p == null) continue;
    if (p < min) min = p;
    if (p > max) max = p;
    vistos++;
  }
  const pNow = P(i);
  if (pNow == null || !vistos) return null;
  if (pNow < min) min = pNow;
  if (pNow > max) max = pNow;
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
  /* tramos alineados con el umbral de gatillo (${DET_BUY_P}/${DET_SELL_P}):
     el extremo del extremo pesa completo y el borde del umbral, un quinto. */
  const lote = nivel > 0 ? (pct <= 2 ? 1 : pct <= 5 ? 0.7 : pct <= 10 ? 0.4 : pct <= 20 ? 0.2 : 0.1)
             : nivel < 0 ? (pct >= 98 ? 1 : pct >= 95 ? 0.7 : pct >= 90 ? 0.4 : pct >= 80 ? 0.2 : 0.1) : 0;
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
  /* percentil con los datos ANTERIORES a este día: es lo que el detector podía
     saber en ese momento. Con la serie completa el backtest miraba el futuro. */
  const pctInfo = detPctlAt(type, field, i);
  if (pctInfo == null) return null;
  const pct = pctInfo.pct;

  /* misma función de giro que en vivo: una sola definición del criterio */
  const vel = detVelocityAt(type, cohort === "sth" ? "sthSopr" : "lthSopr", i, DET_VEL_WIN[cohort], true);
  const giroAlza = vel != null && vel >= DET_VEL_DEAD;
  const perdiendoFuerza = vel != null && vel <= -DET_VEL_DEAD;

  /* aSOPR de ese mismo día: confirmación obligatoria en el termómetro táctico */
  const aso = R.cols.asopr ? R.cols.asopr[i] : null;
  const asoOkBuy = cohort === "sth" ? (aso != null && aso < 1) : true;
  const asoOkSell = cohort === "sth" ? (aso != null && aso > 1) : true;

  const compraBase = v < 1 && pct <= DET_BUY_P && asoOkBuy;
  const ventaBase = v > 1 && pct >= DET_SELL_P && asoOkSell;

  return {
    v, pct, nHist: pctInfo.n, vel, aso, giroAlza, perdiendoFuerza,
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
    const fwd = {}, mae = {};
    horizons.forEach(h => {
      const j = Math.min(i + h, R.count - 1);
      fwd[h] = (i + h < R.count && px[i + h] != null) ? (px[i + h] / px[i] - 1) * 100 : null;
      /* peor recorrido EN CONTRA dentro del horizonte: para una compra es la
         caída máxima; para una venta, la subida máxima. Es lo que el inversor
         tuvo que aguantar antes de que la zona diera resultado. */
      let peor = 0;
      for (let k = i + 1; k <= j; k++) {
        if (px[k] == null) continue;
        const ch = (px[k] / px[i] - 1) * 100;
        if (g.base === "buy" ? ch < peor : ch > peor) peor = ch;
      }
      mae[h] = (i + h < R.count) ? peor : null;
    });
    out.push({ i, iso: R.dates[i], v: g.v, pct: g.pct, nHist: g.nHist, px: px[i], kind: g.base,
               confirmado: g.confirmado === g.base, vel: g.vel, aso: g.aso, fwd, mae });
    last = i;
  }
  return limit ? out.slice(-limit) : out;
}

function detStats(hist, h, soloConfirmados) {
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const sel = k => hist.filter(x => x.kind === k && Number.isFinite(x.fwd[h]) && (!soloConfirmados || x.confirmado));
  const buys = sel("buy"), sells = sel("sell");
  return {
    buy: { n: buys.length, med: med(buys.map(x => x.fwd[h])), hit: buys.length ? buys.filter(x => x.fwd[h] > 0).length / buys.length * 100 : null,
           mae: med(buys.map(x => x.mae && x.mae[h]).filter(x => Number.isFinite(x))) },
    sell: { n: sells.length, med: med(sells.map(x => x.fwd[h])), hit: sells.length ? sells.filter(x => x.fwd[h] < 0).length / sells.length * 100 : null,
            mae: med(sells.map(x => x.mae && x.mae[h]).filter(x => Number.isFinite(x))) },
  };
}



/* ============================================================
   OPERACIÓN POR ZONAS · el STH como rotación táctica
   Validado en BTC: entra cuando el corto plazo está frío y el
   ciclo no está caliente, cierra cuando el corto plazo vuelve a
   calentarse. Sin tope de tiempo: cerrar por reloj empeoró el
   resultado en todas las pruebas (las salidas por plazo pierden
   entre un 7% y un 68%, las salidas por zona ganan un 32-37%).
   ============================================================ */

const ZN = {
  sth: { in: 25, out: 75, lthMax: 50, lab: "Rotación táctica · STH" },
  lth: { in: 10, out: 80, lthMax: null, lab: "Núcleo de ciclo · LTH" },
};
/* activos donde el esquema está validado. ETH no lo está: 54% de acierto,
   +6,4% de mediana y una operación de −75%. No se ofrece hasta tener umbrales
   propios contrastados. */
const ZN_OK = ["BTC"];

function znPctl(type, field, i) { const q = detPctlAt(type, field, i); return q ? q.pct : null; }

/* recorre la serie abriendo y cerrando operaciones según las zonas */
function znTrades(type, cohort) {
  const R = window.BambuRealData[type];
  if (!R) return null;
  const cfg = ZN[cohort];
  const px = R.cols.price, sth = R.cols.sthSopr, lth = R.cols.lthSopr;
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const col = cohort === "sth" ? sth : lth;
  if (!col || !px) return null;

  const trades = [];
  let i = 0, abierta = null;
  while (i < R.count) {
    if (!abierta) {
      let e = -1, pIn = null, lIn = null;
      for (let k = i; k < R.count; k++) {
        if (col[k] == null || px[k] == null) continue;
        const p = znPctl(type, field, k);
        if (p == null || p > cfg.in) continue;
        if (cfg.lthMax != null) {
          const l = lth[k] == null ? null : znPctl(type, "lthSopr", k);
          if (l == null || l > cfg.lthMax) continue;   // ciclo caliente: no se entra
          lIn = l;
        }
        e = k; pIn = p; break;
      }
      if (e < 0) break;
      abierta = { iIn: e, iso: R.dates[e], px: px[e], pctIn: pIn, lthIn: lIn };
      i = e + 1;
      continue;
    }
    /* buscar el cierre */
    let s = -1, pOut = null;
    for (let k = i; k < R.count; k++) {
      if (col[k] == null || px[k] == null) continue;
      const p = znPctl(type, field, k);
      if (p == null || p < cfg.out) continue;
      s = k; pOut = p; break;
    }
    if (s < 0) break;   // sigue abierta hasta hoy
    let peor = 0, mejor = 0;
    for (let k = abierta.iIn + 1; k <= s; k++) {
      if (px[k] == null) continue;
      const ch = (px[k] / abierta.px - 1) * 100;
      if (ch < peor) peor = ch;
      if (ch > mejor) mejor = ch;
    }
    trades.push({ ...abierta, iOut: s, isoOut: R.dates[s], pxOut: px[s], pctOut: pOut,
                  dias: s - abierta.iIn, ret: (px[s] / abierta.px - 1) * 100, mae: peor, mfe: mejor });
    abierta = null;
    i = s + 1;
  }
  /* posición viva: la que quedó sin cerrar al final de la serie */
  let viva = null;
  if (abierta) {
    const last = R.count - 1;
    let peor = 0;
    for (let k = abierta.iIn + 1; k <= last; k++) {
      if (px[k] == null) continue;
      const ch = (px[k] / abierta.px - 1) * 100;
      if (ch < peor) peor = ch;
    }
    viva = { ...abierta, dias: last - abierta.iIn, pxHoy: px[last],
             ret: (px[last] / abierta.px - 1) * 100, mae: peor,
             pctHoy: znPctl(type, field, last), falta: cfg.out };
  }
  return { trades, viva, cfg };
}

/* ¿qué pasa si se fuerza el cierre por plazo? Se mide sobre la MISMA config
   que el panel muestra, para no citar números de otra estrategia. */
function znTopeTest(type, cohort) {
  const R = window.BambuRealData[type];
  const cfg = ZN[cohort];
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const col = R && R.cols[field], px = R && R.cols.price, lth = R && R.cols.lthSopr;
  if (!col || !px) return null;
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const out = [];
  for (const tope of [120, 180, 270, 365]) {
    const zona = [], plazo = [];
    let i = 0;
    while (i < R.count) {
      let en = -1;
      for (let k = i; k < R.count; k++) {
        if (col[k] == null || px[k] == null) continue;
        const p = znPctl(type, field, k); if (p == null || p > cfg.in) continue;
        if (cfg.lthMax != null) { const l = lth[k] == null ? null : znPctl(type, "lthSopr", k); if (l == null || l > cfg.lthMax) continue; }
        en = k; break;
      }
      if (en < 0) break;
      const lim = Math.min(R.count - 1, en + tope);
      let s = -1;
      for (let k = en + 1; k <= lim; k++) {
        if (col[k] == null || px[k] == null) continue;
        const p = znPctl(type, field, k); if (p == null || p < cfg.out) continue;
        s = k; break;
      }
      if (s >= 0) { zona.push((px[s] / px[en] - 1) * 100); i = s + 1; }
      else { let f = lim; while (f > en && px[f] == null) f--; if (f <= en) break; plazo.push((px[f] / px[en] - 1) * 100); i = f + 1; }
    }
    out.push({ tope, zona: med(zona), plazo: med(plazo), nZona: zona.length, nPlazo: plazo.length });
  }
  const zs = out.map(x => x.zona).filter(Number.isFinite);
  const ps = out.map(x => x.plazo).filter(Number.isFinite);
  return { filas: out, zonaMin: zs.length ? Math.min(...zs) : null, zonaMax: zs.length ? Math.max(...zs) : null,
           plazoMin: ps.length ? Math.min(...ps) : null, plazoMax: ps.length ? Math.max(...ps) : null };
}

function znStats(trades) {
  if (!trades || !trades.length) return null;
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const rets = trades.map(t => t.ret);
  const gan = rets.filter(x => x > 0);
  return {
    n: trades.length,
    hit: (gan.length / trades.length) * 100,
    medRet: med(rets), medDias: med(trades.map(t => t.dias)), medMae: med(trades.map(t => t.mae)),
    sobre20: (rets.filter(x => x >= 20).length / trades.length) * 100,
    perdedoras: rets.filter(x => x < 0).length,
    peor: Math.min(...rets), mejor: Math.max(...rets),
    /* capital compuesto reinvirtiendo cada cierre */
    compuesto: (trades.reduce((a, t) => a * (1 + t.ret / 100), 1) - 1) * 100,
  };
}

/* estado de HOY: el detector deja de ser sin memoria y dice qué toca hacer
   según si hay una operación abierta o no */
function znEstado(type, cohort) {
  const z = znTrades(type, cohort);
  if (!z) return null;
  const R = window.BambuRealData[type];
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const cfg = z.cfg;
  const M = detLast(type, field);
  const pHoy = M ? znPctl(type, field, R.dates.indexOf(M.iso)) : null;
  const lHoy = detLast(type, "lthSopr") ? znPctl(type, "lthSopr", R.dates.indexOf(detLast(type, "lthSopr").iso)) : null;

  if (!M || !M.fresco) return { estado: "SIN DATO RECIENTE", accion: "No evaluable", col: "#8C9389",
    txt: `La serie de ${field === "sthSopr" ? "SOPR de corto plazo" : "SOPR de ciclo"} va ${M ? nplu(M.edad, "día") : "—"} por detrás, así que no se puede evaluar la zona.`, pHoy, lHoy, viva: z.viva };

  if (z.viva) {
    const falta = cfg.out - (pHoy == null ? 0 : pHoy);
    return { estado: "POSICIÓN ABIERTA", accion: pHoy >= cfg.out ? "Cerrar ahora" : "Mantener", col: pHoy >= cfg.out ? "#C0492E" : "#2E6FAE",
      txt: pHoy >= cfg.out
        ? `El corto plazo alcanzó el percentil ${pHoy.toFixed(0)}, que es la zona de cierre. Toca vender el tramo abierto.`
        : `Llevas ${nplu(z.viva.dias, "día")} dentro desde ${E.fmt.usd(z.viva.px)}, con un ${z.viva.ret > 0 ? "+" : ""}${z.viva.ret.toFixed(1)}% de recorrido. El cierre llega cuando el percentil suba a ${cfg.out}: faltan ${nplu(falta, "punto")}.`,
      pHoy, lHoy, viva: z.viva };
  }
  /* sin posición */
  const frio = pHoy != null && pHoy <= cfg.in;
  const cicloOk = cfg.lthMax == null || (lHoy != null && lHoy <= cfg.lthMax);
  if (frio && cicloOk) return { estado: "ZONA DE ENTRADA", accion: "Abrir tramo", col: "#2E6FAE",
    txt: `El corto plazo está en el percentil ${pHoy.toFixed(0)} (zona de entrada, ≤${cfg.in})${lHoy != null ? ` y el ciclo en ${lHoy.toFixed(0)}, por debajo del techo de ${cfg.lthMax}` : ""}. Es la configuración que el histórico premia.`, pHoy, lHoy, viva: null };
  if (frio && !cicloOk) return { estado: "ENTRADA BLOQUEADA", accion: "No entrar", col: "#B0642A",
    txt: `El corto plazo está frío (percentil ${pHoy.toFixed(0)}) pero el ciclo está en ${lHoy == null ? "sin lectura" : lHoy.toFixed(0)}, por encima del techo de ${cfg.lthMax}. Cuando el ciclo ya está caliente, una zona fría de corto plazo suele ser el aviso de que empieza el bajista, no una oportunidad.`, pHoy, lHoy, viva: null };
  return { estado: "FUERA, ESPERANDO", accion: "Esperar", col: "#7A8A80",
    txt: `Sin posición abierta y el corto plazo en el percentil ${pHoy == null ? "—" : pHoy.toFixed(0)}, por encima de la zona de entrada (≤${cfg.in}). No hay nada que hacer: un percentil alto sin posición abierta no es una venta, solo significa esperar.`, pHoy, lHoy, viva: null };
}

/* ============================================================
   ÓPTICA DE INVERSOR · acumulación escalonada
   La pregunta de un especulador es "¿subió a 90 días?". La de un
   inversor es distinta: "si compro un tramo cada vez que el SOPR
   entra en zona de acumulación, ¿a qué precio medio acabo, y
   cuánto vale eso al final del ciclo?".
   El acierto a plazo fijo es irrelevante para quien acumula: lo
   que importa es el coste medio frente a lo que habría pagado
   comprando a ciegas, y el resultado al cierre del ciclo.
   ============================================================ */

const INV_SOPR_MAX = 0.989;   // umbral de acumulación pedido por el inversor
const INV_TRAMO = 100;        // USD por tramo

/* ciclos de halving, para valorar cada acumulación en su propio ciclo */
const INV_CICLOS = [
  { n: 1, ini: "2012-11-28", fin: "2016-07-08" },
  { n: 2, ini: "2016-07-09", fin: "2020-05-10" },
  { n: 3, ini: "2020-05-11", fin: "2024-04-19" },
  { n: 4, ini: "2024-04-20", fin: "9999-12-31" },
];

/* Simula la acumulación escalonada de un inversor:
   · cada día que el SOPR está bajo el umbral, compra un tramo
   · separación mínima entre compras para no cargar todo en tres días
   · al cierre del ciclo valora la posición y la compara con el DCA ciego */
function invAccumulate(type, cohort, umbral, sepDias) {
  const R = window.BambuRealData[type];
  const field = cohort === "sth" ? "sthSopr" : "lthSopr";
  const col = R && R.cols[field], px = R && R.cols.price;
  if (!col || !px) return null;
  const U = umbral == null ? INV_SOPR_MAX : umbral;
  const SEP = sepDias == null ? 7 : sepDias;

  const out = INV_CICLOS.map(c => {
    const i0 = R.dates.findIndex(x => x >= c.ini);
    if (i0 < 0) return null;
    /* si la serie empieza mucho después del inicio del ciclo, todo lo que se
       calcule aquí es de una fracción: hay que declararlo, no rotularlo como
       ciclo completo (en ETH el "ciclo 1" solo tiene 337 de 1318 días). */
    const faltan = Math.round((new Date(R.dates[i0] + "T00:00:00Z") - new Date(c.ini + "T00:00:00Z")) / 86400000);
    const parcial = faltan > 30;
    let iFin = R.count - 1;
    for (let k = i0; k < R.count; k++) if (R.dates[k] > c.fin) { iFin = k - 1; break; }
    if (iFin <= i0 + 30) return null;

    /* compras en zona de acumulación */
    const compras = []; let last = -999;
    let techoPx = 0, techoIso = null;
    for (let k = i0; k <= iFin; k++) {
      if (px[k] != null && px[k] > techoPx) { techoPx = px[k]; techoIso = R.dates[k]; }
      if (col[k] == null || px[k] == null) continue;
      if (col[k] >= U) continue;
      if (k - last < SEP) continue;
      compras.push({ i: k, iso: R.dates[k], px: px[k], sopr: col[k] });
      last = k;
    }
    if (!compras.length) return { ...c, compras: [], sinZona: true, parcial, faltan };

    const invertido = compras.length * INV_TRAMO;
    const units = compras.reduce((s, x) => s + INV_TRAMO / x.px, 0);
    const costeMedio = invertido / units;

    /* referencia 1 · DCA ciego: el mismo número de tramos repartido por igual
       en todo el ciclo, sin mirar ninguna métrica */
    const paso = Math.max(1, Math.floor((iFin - i0) / compras.length));
    const ciego = [];
    for (let k = i0; k <= iFin && ciego.length < compras.length; k += paso) if (px[k] != null) ciego.push(px[k]);
    const unitsCiego = ciego.reduce((s, p) => s + INV_TRAMO / p, 0);
    const costeCiego = ciego.length ? (ciego.length * INV_TRAMO) / unitsCiego : null;

    /* referencia 2 · el precio medio de TODO el ciclo */
    let sum = 0, n = 0;
    for (let k = i0; k <= iFin; k++) if (px[k] != null) { sum += px[k]; n++; }
    const medioCiclo = n ? sum / n : null;

    /* referencia 3 · DCA ciego DENTRO de la misma ventana en que el gatillo
       estuvo activo. Separa dos efectos que el DCA de ciclo completo mezcla:
       lo que aporta la señal, y lo que aporta empezar antes. El gatillo no
       puede disparar en el arranque de un ciclo —exige compradores recientes
       en pérdida, y tras un suelo casi nadie lo está—, así que compararlo con
       un calendario que arranca el día 0 lo penaliza por algo que no es la
       calidad de la señal. */
    const iA = compras[0].i, iB = compras[compras.length - 1].i;
    const pasoV = Math.max(1, Math.floor((iB - iA) / Math.max(1, compras.length - 1)));
    const ventana = [];
    for (let k = iA; k <= iB && ventana.length < compras.length; k += pasoV) if (px[k] != null) ventana.push(px[k]);
    const unitsVentana = ventana.reduce((s, p) => s + INV_TRAMO / p, 0);
    const costeVentana = ventana.length ? (ventana.length * INV_TRAMO) / unitsVentana : null;
    /* posición media de las compras dentro del ciclo, para explicar el desfase */
    const posMedia = compras.reduce((s, x) => s + (x.i - i0) / (iFin - i0), 0) / compras.length * 100;
    /* arranque medido desde donde EMPIEZAN LOS DATOS, no desde el inicio
       declarado del ciclo: con cobertura parcial lo segundo daba "día 1". */
    const arranque = (iA - i0);
    const arranqueReal = parcial ? null : arranque;

    /* referencia 4 · CALENDARIO BASE + REFUERZO: aporta un tramo cada 30 días
       haga lo que haga el mercado, y añade medio tramo extra cuando el SOPR
       entra en zona. Es la estrategia que un inversor puede ejecutar de verdad,
       y la única forma de saber si la señal aporta sobre un plan que ya corre. */
    const baseCada = 30, extraPeso = 0.5;
    let bUsd = 0, bUnits = 0, bTramos = 0, bExtras = 0;
    for (let k = i0; k <= iFin; k++) {
      if (px[k] == null) continue;
      if ((k - i0) % baseCada === 0) { bUsd += INV_TRAMO; bUnits += INV_TRAMO / px[k]; bTramos++; }
    }
    let lastX = -999;
    for (let k = i0; k <= iFin; k++) {
      if (px[k] == null || col[k] == null || col[k] >= U) continue;
      if (k - lastX < SEP) continue;
      bUsd += INV_TRAMO * extraPeso; bUnits += (INV_TRAMO * extraPeso) / px[k]; bExtras++; lastX = k;
    }
    const costeMixto = bUnits > 0 ? bUsd / bUnits : null;
    /* y el mismo calendario base SIN refuerzo, para aislar lo que aporta */
    let sUsd = 0, sUnits = 0;
    for (let k = i0; k <= iFin; k++) {
      if (px[k] == null) continue;
      if ((k - i0) % baseCada === 0) { sUsd += INV_TRAMO; sUnits += INV_TRAMO / px[k]; }
    }
    const costeSolo = sUnits > 0 ? sUsd / sUnits : null;

    const pxFin = px[iFin];
    const valorFin = units * pxFin;
    const valorTecho = units * techoPx;

    return {
      ...c, sinZona: false, compras, invertido, units, costeMedio,
      costeCiego, costeVentana, medioCiclo, posMedia, arranque, arranqueReal, parcial, faltan,
      costeMixto, costeSolo, bTramos, bExtras, pxFin, iniPx: px[i0],
      valorFin, valorTecho, techoPx, techoIso,
      /* lo único que le importa a quien acumula */
      ventajaCiego: costeCiego ? (1 - costeMedio / costeCiego) * 100 : null,
      ventajaVentana: costeVentana ? (1 - costeMedio / costeVentana) * 100 : null,
      /* lo accionable: ¿el refuerzo mejora el calendario base? */
      ventajaRefuerzo: (costeMixto && costeSolo) ? (1 - costeMixto / costeSolo) * 100 : null,
      ventajaMedio: medioCiclo ? (1 - costeMedio / medioCiclo) * 100 : null,
      multFin: valorFin / invertido,
      multTecho: valorTecho / invertido,
      abierto: c.fin === "9999-12-31",
      dias: iFin - i0 + 1,
    };
  }).filter(Boolean);
  return out;
}


/* ¿el refuerzo mejora el calendario base a ALGÚN umbral? Se barre una rejilla
   para no sugerir una búsqueda que no lleva a ninguna parte. */
function invBarridoRefuerzo(type, cohort) {
  const out = [];
  for (const u of [0.989, 0.97, 0.95, 0.92]) {
    const acc = invAccumulate(type, cohort, u, 7) || [];
    const val = acc.filter(c => !c.sinZona && !c.abierto && !c.parcial);
    if (!val.length) continue;
    out.push({ u, n: val.length,
      refuerzo: val.filter(c => c.ventajaRefuerzo > 0).length,
      sola: val.filter(c => c.ventajaVentana > 0).length,
      tramosMin: Math.min(...val.map(c => c.compras.length)) });
  }
  return out;
}

/* percentil del umbral en la serie: cuántos días quedan por debajo */
function invUmbralInfo(type, cohort, umbral) {
  const R = window.BambuRealData[type];
  const col = R && R.cols[cohort === "sth" ? "sthSopr" : "lthSopr"];
  if (!col) return null;
  const vals = col.filter(x => x != null);
  const bajo = vals.filter(x => x < (umbral == null ? INV_SOPR_MAX : umbral)).length;
  return { n: vals.length, bajo, pct: vals.length ? (bajo / vals.length) * 100 : null };
}

/* ============================================================
   LA SECCIÓN
   ============================================================ */
function SectionDetector({ palette }) {
  const E = window.BambuEngine;
  const [hz, setHz] = React.useState(90);
  const [hcoh, setHcoh] = React.useState("sth");
  const [htype, setHtype] = React.useState("BTC");
  /* operación por zonas */
  const [zcoh, setZcoh] = React.useState("sth");
  const ztype = "BTC";
  const zTrades = React.useMemo(() => znTrades(ztype, zcoh), [ztype, zcoh]);
  const zStats = React.useMemo(() => zTrades ? znStats(zTrades.trades) : null, [zTrades]);
  const zEst = React.useMemo(() => znEstado(ztype, zcoh), [ztype, zcoh]);
  const zTope = React.useMemo(() => znTopeTest(ztype, zcoh), [ztype, zcoh]);
  /* panel de inversor */
  const [itype, setItype] = React.useState("BTC");
  const [ihz, setIhz] = React.useState("sth");
  const [iu, setIu] = React.useState(INV_SOPR_MAX);
  const acc = React.useMemo(() => invAccumulate(itype, ihz, iu, 7), [itype, ihz, iu]);
  const uInfo = React.useMemo(() => invUmbralInfo(itype, ihz, iu), [itype, ihz, iu]);

  const D = React.useMemo(() => ({
    BTC: { sth: detCohort("BTC", "sth"), lth: detCohort("BTC", "lth") },
    ETH: { sth: detCohort("ETH", "sth"), lth: detCohort("ETH", "lth") },
  }), []);
  const conf = React.useMemo(() => detConfluence(D.BTC.sth, D.ETH.sth), [D]);
  const hist = React.useMemo(() => detHistory(htype, hcoh), [htype, hcoh]);
  const st = React.useMemo(() => detStats(hist, hz, false), [hist, hz]);
  const stC = React.useMemo(() => detStats(hist, hz, true), [hist, hz]);

  const COL = n => n == null ? "#8C9389" : n >= 2 ? "#2E6FAE" : n === 1 ? "#4E86B8" : n === 0 ? "#7A8A80" : n === -1 ? "#C98A2E" : "#C0492E";
  /* tinta: el mismo matiz oscurecido hasta el mínimo de contraste. COL() se
     queda para rellenos (fondos con mixSoft, barras, borde de la tarjeta). */
  const INK = (n, ratio, bg) => E.inkColor(COL(n), ratio || 4.5, bg);
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
            {!d.robusto && <span className="badge" style={{ background: mixSoft("#B0642A"), color: E.inkColor("#B0642A", 4.5, mixSoft("#B0642A")), fontWeight: 700 }}>histórico corto</span>}
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
              <div className="num" style={{ fontSize: 26, fontWeight: 700, color: INK(d.nivel, 3), lineHeight: 1 }}>{pct1(d.pct)}</div>
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
          <span className="badge" style={{ background: "var(--surface, var(--card, #fff))", color: INK(d.nivel), fontWeight: 700 }}>{d.estado}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK(d.nivel, 4.5, "#F2F3F2") }}>{d.accion}</span>
          {d.lote > 0 && <span className="tiny muted">lote sugerido: <b className="num" style={{ color: INK(d.nivel, 4.5, "#F2F3F2") }}>{(d.lote * 100).toFixed(0)}%</b> del tramo</span>}
          <span style={{ flex: 1 }} />
          {d.cohort === "sth" && d.asopr != null &&
            <span className="tiny muted">aSOPR {d.asopr.toFixed(3)} · pct {pct1(d.asoprPct)}</span>}
        </div>
        {d.aviso &&
          <div className="tiny" style={{ padding: "9px 18px", borderTop: "1px solid var(--border)", lineHeight: 1.5, color: "var(--ink-2)" }}>
            <b style={{ color: INK(d.nivel) }}>Ajuste por amplitud:</b> {d.aviso}. Lote base {(d.loteBase * 100).toFixed(0)}% → <b className="num">{(d.lote * 100).toFixed(0)}%</b>.
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
          <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, color: E.inkColor(conf.col, 4.5), marginBottom: 7 }}>Confluencia entre activos</div>
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
              <td className="tiny" style={{ color: E.inkColor("#B0642A", 4.5), fontWeight: 600 }}>pendiente<div className="tiny muted" style={{ fontWeight: 400 }}>falta el netflow de ETH</div></td></tr>
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



      {/* OPERACIÓN POR ZONAS · entra frío, cierra caliente */}
      {ZN_OK.indexOf(ztype) >= 0 && zEst && zStats ?
        <Card title={<>Operación por zonas <HelpDot term="Cómo funciona la rotación por zonas" def="Compras cuando el corto plazo entra en zona fría y cierras cuando vuelve a zona caliente. No hay plazo: el trade dura lo que dure, porque cerrar por reloj empeoró el resultado en todas las pruebas. El filtro de ciclo evita entrar cuando el largo plazo ya está caliente, que es cuando una zona fría de corto plazo suele avisar del bajista en lugar de una oportunidad." /></>}
              sub={`${zcoh === "sth" ? "Entrada percentil ≤25 con ciclo ≤50 · cierre en ≥75" : "Entrada percentil ≤10 · cierre en ≥80"} · sin tope de tiempo`}
              pad={false} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
            <div className="seg">
              <button className={"seg-btn" + (zcoh === "sth" ? " on" : "")} onClick={() => setZcoh("sth")}>Rotación táctica</button>
              <button className={"seg-btn" + (zcoh === "lth" ? " on" : "")} onClick={() => setZcoh("lth")}>Núcleo de ciclo</button>
            </div>
            <span style={{ flex: 1 }} />
            <span className="tiny muted">validado en BTC · ETH pendiente de umbrales propios</span>
          </div>

          {/* qué toca hacer hoy */}
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", borderLeft: `5px solid ${zEst.col}` }}>
            <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".11em", fontWeight: 700, color: E.inkColor(zEst.col, 4.5), marginBottom: 6 }}>Qué toca hacer hoy</div>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
              <span className="badge" style={{ background: mixSoft(zEst.col), color: E.inkColor(zEst.col, 4.5, mixSoft(zEst.col)), fontWeight: 700 }}>{zEst.estado}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: E.inkColor(zEst.col, 4.5) }}>{zEst.accion}</span>
              {zEst.pHoy != null && <span className="tiny muted">corto plazo percentil <b className="num" style={{ color: "var(--ink)" }}>{zEst.pHoy.toFixed(0)}</b>{zEst.lHoy != null && <> · ciclo <b className="num" style={{ color: "var(--ink)" }}>{zEst.lHoy.toFixed(0)}</b></>}</span>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 880 }}>{zEst.txt}</div>
          </div>

          {/* lo que dio históricamente */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {[
              ["Operaciones", zStats.n, `una cada ${nplu(Math.round(365 * 15 / zStats.n / 30), "mes", "meses")}`, null],
              ["Acierto", zStats.hit.toFixed(0) + "%", `${zStats.n - zStats.perdedoras} de ${zStats.n} en verde`, "#2F7D5B"],
              ["Ganancia mediana", "+" + zStats.medRet.toFixed(1) + "%", `${zStats.sobre20.toFixed(0)}% superó el 20%`, "#2F7D5B"],
              ["Duración", nplu(zStats.medDias, "día"), "mediana por operación", null],
              ["Caída intermedia", zStats.medMae.toFixed(1) + "%", "lo que hay que aguantar", "#C0492E"],
              [zStats.peor > 0 ? "Operación menos favorable" : "Peor operación",
                (zStats.peor > 0 ? "+" : "") + zStats.peor.toFixed(1) + "%",
                zStats.perdedoras === 0 ? "ninguna en pérdida" : `${nplu(zStats.perdedoras, "operación", "operaciones")} en pérdida`,
                zStats.peor > 0 ? "#2F7D5B" : "#C0492E"],
            ].map(([l, v, m, c], i) => (
              <div key={l} style={{ padding: "13px 16px", borderLeft: i ? "1px solid var(--border)" : "none" }}>
                <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>{l}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: c ? E.inkColor(c, 4.5) : "var(--ink)" }}>{v}</div>
                <div className="tiny muted" style={{ marginTop: 2 }}>{m}</div>
              </div>
            ))}
          </div>

          {/* las operaciones, una a una */}
          <div style={{ maxHeight: 330, overflow: "auto" }}>
            <table className="tbl">
              <thead style={{ position: "sticky", top: 0, background: "var(--surface, var(--card, #fff))", zIndex: 2 }}>
                <tr><th>Entrada</th><th className="c">Pctl</th><th className="r">Precio</th><th>Cierre</th><th className="c">Pctl</th><th className="r">Precio</th><th className="r">Días</th><th className="r">Resultado</th><th className="r">En contra</th></tr>
              </thead>
              <tbody>
                {zTrades.trades.slice().reverse().map((t, i) => {
                  const ok = t.ret > 0;
                  return (
                    <tr key={i}>
                      <td className="tiny" style={{ whiteSpace: "nowrap" }}>{fmtIso(t.iso)}</td>
                      <td className="c num tiny">{t.pctIn.toFixed(0)}</td>
                      <td className="r num">{E.fmt.usd(t.px)}</td>
                      <td className="tiny" style={{ whiteSpace: "nowrap" }}>{fmtIso(t.isoOut)}</td>
                      <td className="c num tiny">{t.pctOut.toFixed(0)}</td>
                      <td className="r num">{E.fmt.usd(t.pxOut)}</td>
                      <td className="r num tiny">{t.dias}</td>
                      <td className="r num" style={{ fontWeight: 700, color: E.inkColor(ok ? "#2F7D5B" : "#C0492E", 4.5) }}>{ok ? "+" : ""}{t.ret.toFixed(1)}%</td>
                      <td className="r num tiny" style={{ color: E.inkColor("#C0492E", 4.5) }}>{t.mae.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="tiny muted" style={{ padding: "13px 18px", lineHeight: 1.6, borderTop: "1px solid var(--border)" }}>
            <b>Por qué sin tope de tiempo.</b>{" "}
            {zTope && zTope.plazoMax != null
              ? <>Probado a 120, 180, 270 y 365 días sobre esta misma configuración: las salidas por zona dan entre {zTope.zonaMin.toFixed(1)}% y {zTope.zonaMax.toFixed(1)}%, y las salidas forzadas por plazo entre {zTope.plazoMin.toFixed(1)}% y {zTope.plazoMax.toFixed(1)}%.{" "}
                  {zTope.plazoMax < 0
                    ? "Cerrar porque pasaron unos meses convierte una caída temporal en una pérdida definitiva."
                    : zTope.zonaMin > zTope.plazoMax
                      ? "Las salidas por plazo también ganan, pero dejan sobre la mesa la mayor parte del recorrido: esperar la zona multiplica el resultado."
                      : "Con esta configuración el plazo no penaliza de forma clara, así que la ventaja de esperar la zona es menor."}</>
              : <>Con esta configuración ninguna operación llegó a necesitar un cierre por plazo: la zona de salida siempre apareció antes.</>}
            <br /><br />
            <b>{zTrades.cfg.lthMax != null ? "Lo que el filtro de ciclo hace y lo que no." : "Sin filtro de ciclo."}</b>{" "}
            {zTrades.cfg.lthMax != null
              ? <>Exigir que el ciclo esté por debajo del percentil {zTrades.cfg.lthMax} descarta las entradas de menor recorrido y sube el acierto, pero <b>no elimina el riesgo de bajista</b>.</>
              : <>Esta configuración entra por la propia lectura de ciclo, así que no lleva filtro adicional: la señal de entrada ya es el ciclo.</>}
            {zStats.perdedoras > 0
              ? <> La peor operación fue del {zStats.peor.toFixed(1)}%, y {nplu(zStats.perdedoras, "operación", "operaciones")} de {zStats.n} {plu(zStats.perdedoras, "acabó", "acabaron")} en pérdida. Ese riesgo se dimensiona con el tamaño de la posición, no con la señal.</>
              : <> Ninguna de las {nplu(zStats.n, "operación", "operaciones")} acabó en pérdida, y la menos favorable aun así ganó un {zStats.peor.toFixed(1)}%. Con una muestra de este tamaño eso no se puede prometer: significa que el patrón no falló todavía, no que no pueda fallar.</>}
            <br /><br />
            <b>Muestra.</b> {nplu(zStats.n, "operación", "operaciones")} en unos 15 años de historia.
            {zStats.n < 8 ? " Son muy pocas para sostener una conclusión: trátalo como un indicio del patrón de ciclo, no como una estrategia contrastada." : " Es suficiente para ver un patrón, no para prometer un resultado."}
            {zTrades.viva && <> Hay además <b>una operación abierta</b> desde {fmtIso(zTrades.viva.iso)} que no cuenta en estas cifras.</>}
          </div>
        </Card>
        : null}

      {/* ÓPTICA DE INVERSOR · lo que le pasa a quien acumula por tramos */}
      <Card title={<>Si acumulas por tramos <HelpDot term="Por qué esta tabla y no el acierto" def="El acierto a 90 días es la pregunta de quien especula: entra, espera y sale. Quien acumula no hace eso. Compra un tramo cada vez que el mercado entra en zona de acumulación y su única pregunta es a qué precio medio acabó, comparado con lo que habría pagado comprando a ciegas o al precio medio del ciclo. Esta tabla responde eso, ciclo por ciclo." /></>}
            sub={`Un tramo de ${E.fmt.usd(INV_TRAMO)} cada vez que el SOPR de ${ihz === "sth" ? "corto plazo" : "ciclo"} baja de ${iu.toFixed(3)}, con 7 días mínimos entre compras`}
            pad={false} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="seg">{["BTC", "ETH"].map(t => <button key={t} className={"seg-btn" + (itype === t ? " on" : "")} onClick={() => setItype(t)}>{t}</button>)}</div>
          <div className="seg">
            <button className={"seg-btn" + (ihz === "sth" ? " on" : "")} onClick={() => setIhz("sth")}>Corto plazo</button>
            <button className={"seg-btn" + (ihz === "lth" ? " on" : "")} onClick={() => setIhz("lth")}>Ciclo</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span className="tiny muted">Compro cuando el SOPR baja de</span>
            <input type="number" step="0.001" value={iu} onChange={e => setIu(parseFloat(e.target.value) || INV_SOPR_MAX)}
              style={{ width: 78, fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--surface, #fff)", color: "var(--ink)" }} />
          </label>
          {uInfo && <span className="tiny muted">esa zona cubre el <b className="num" style={{ color: "var(--ink)" }}>{uInfo.pct == null ? "—" : uInfo.pct.toFixed(0) + "%"}</b> de los días ({uInfo.bajo} de {uInfo.n})</span>}
        </div>

        {acc && acc.length > 0 ?
          <>
            <table className="tbl">
              <thead><tr>
                <th>Ciclo</th><th className="c">Tramos</th><th className="r">1ª compra</th>
                <th className="r">Tu coste medio</th><th className="r">DCA de ciclo</th><th className="r">Ventaja vs ciclo</th>
                <th className="r">Ventaja real</th><th className="r">Calendario + refuerzo</th><th className="r">Al techo</th>
              </tr></thead>
              <tbody>
                {acc.map(c => {
                  if (c.sinZona) return (
                    <tr key={c.n}><td style={{ fontWeight: 600 }}>Ciclo {c.n}</td>
                      <td className="c num">0</td><td colSpan={6} className="tiny muted">El SOPR nunca bajó de {iu.toFixed(3)} en este ciclo: no habría habido compras.</td></tr>
                  );
                  const gana = c.ventajaCiego != null && c.ventajaCiego > 0;
                  return (
                    <tr key={c.n} style={c.abierto ? { background: "var(--surface-2, #F2F6F2)" } : null}>
                      <td style={{ fontWeight: 600 }}>Ciclo {c.n}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{c.ini.slice(0, 7)} → {c.abierto ? "en curso" : c.fin.slice(0, 7)}</div>
                        {c.parcial && <div className="tiny" style={{ fontWeight: 600, color: E.inkColor("#B0642A", 4.5) }}>solo {c.dias} de {Math.round((new Date((c.abierto ? "2026-12-31" : c.fin) + "T00:00:00Z") - new Date(c.ini + "T00:00:00Z")) / 86400000)} días<div style={{ fontWeight: 400 }}>los datos empiezan {nplu(c.faltan, "día")} tarde</div></div>}</td>
                      <td className="c num">{c.compras.length}
                        {c.compras.length <= 5 && <div className="tiny" style={{ color: E.inkColor("#B0642A", 4.5), fontWeight: 600 }}>muestra corta</div>}</td>
                      <td className="r num tiny">{c.compras[0].iso.slice(0, 7)}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{c.arranqueReal == null ? "sin dato del inicio" : "día " + c.arranqueReal + " del ciclo"}</div></td>
                      <td className="r num" style={{ fontWeight: 700, color: "#2E6FAE" }}>{E.fmt.usd(c.costeMedio)}</td>
                      <td className="r num">{c.costeCiego == null ? "—" : E.fmt.usd(c.costeCiego)}</td>
                      <td className="r num" style={{ color: c.ventajaCiego == null ? "var(--ink-3)" : gana ? "#2F7D5B" : "#C0492E" }}>
                        {c.ventajaCiego == null ? "—" : (c.ventajaCiego > 0 ? "−" : "+") + Math.abs(c.ventajaCiego).toFixed(1) + "%"}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{gana ? "más barato" : "más caro"}</div></td>
                      <td className="r num" style={{ fontWeight: 700, color: c.ventajaVentana == null ? "var(--ink-3)" : c.ventajaVentana > 0 ? "#2F7D5B" : "#C0492E" }}>
                        {c.ventajaVentana == null ? "—" : (c.ventajaVentana > 0 ? "−" : "+") + Math.abs(c.ventajaVentana).toFixed(1) + "%"}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{c.ventajaVentana > 0 ? "más barato" : "más caro"}</div></td>
                      <td className="r num" style={{ fontWeight: 700, color: c.ventajaRefuerzo == null ? "var(--ink-3)" : c.ventajaRefuerzo > 0 ? "#2F7D5B" : "#C0492E" }}>
                        {c.ventajaRefuerzo == null ? "—" : (c.ventajaRefuerzo > 0 ? "−" : "+") + Math.abs(c.ventajaRefuerzo).toFixed(1) + "%"}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{c.ventajaRefuerzo == null ? "—" : c.ventajaRefuerzo > 0 ? "más barato" : "más caro"} · {c.bTramos}+{c.bExtras}</div></td>
                      <td className="r num" style={{ fontWeight: 700 }}>{c.multTecho == null ? "—" : c.multTecho.toFixed(2) + "×"}
                        <div className="tiny muted" style={{ fontWeight: 400 }}>{c.abierto ? "máximo hasta hoy" : E.fmt.usd(c.techoPx)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(() => {
              /* La conclusión se escribe del resultado, no al revés. Se
                 excluyen los ciclos con cobertura parcial y el que está en
                 curso, porque ninguno de los dos permite comparar. */
              const val = acc.filter(c => !c.sinZona && !c.abierto && !c.parcial);
              if (!val.length) return null;
              const gV = val.filter(c => c.ventajaVentana > 0).length;
              const gR = val.filter(c => c.ventajaRefuerzo > 0).length;
              const peor = val.slice().sort((x, y) => x.ventajaVentana - y.ventajaVentana)[0];
              const pronto = val.filter(c => c.arranqueReal != null && c.arranqueReal < 60);
              const tramosMin = Math.min(...val.map(c => c.compras.length));
              /* Con 2 o 3 ciclos no hay veredicto sostenible: se declara el
                 recuento y el tamaño de muestra, sin afirmar que funciona ni
                 que no. Un empate tampoco es un fracaso. */
              const concluyente = val.length >= 4;
              const veredicto = !concluyente ? "indeterminado"
                : gV === val.length ? "afavor" : gV === 0 ? "encontra" : "mixto";
              const vRef = !concluyente ? "indeterminado"
                : gR === val.length ? "afavor" : gR === 0 ? "encontra" : "mixto";
              /* ¿el refuerzo mejora a algún umbral? si no, es estructural */
              const barr = invBarridoRefuerzo(itype, ihz);
              const refuerzoNuncaGana = barr.length > 0 && barr.every(x => x.refuerzo === 0);
              const solaAlgunUmbral = barr.filter(x => x.sola > x.n / 2).map(x => x.u);
              const col = (gR > 0 || gV > 0) ? "#2F7D5B" : "#B0642A";
              return (
                <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2, #F2F6F2)" }}>
                  <div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, color: E.inkColor(col, 4.5, "#F2F6F2"), marginBottom: 6 }}>Qué dice este resultado</div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)" }}>
                    <b style={{ color: "var(--ink)" }}>Comparado dentro de la misma ventana —la prueba equiparable—, acumular solo en zonas de SOPR bajo salió más barato en {gV} de {val.length} {plu(val.length, "ciclo cerrado", "ciclos cerrados")}.</b>{" "}
                    {!concluyente
                      ? `Con ${nplu(val.length, "ciclo")} de muestra no se puede afirmar ni que funcione ni que no: son demasiados pocos casos para distinguir la señal de la casualidad. Lo honesto es leerlo como un indicio, no como una conclusión.`
                      : veredicto === "afavor" ? "La señal aporta por sí sola en todos los ciclos medidos: comprar solo en esas zonas dio mejor coste medio que repartir a ciegas en el mismo periodo."
                      : veredicto === "encontra" ? `En ningún ciclo mejoró un calendario ciego del mismo periodo.${peor && peor.arranqueReal != null && peor.arranqueReal < 60 ? ` Y el peor caso, el ciclo ${peor.n} con un ${Math.abs(peor.ventajaVentana).toFixed(0)}% más caro, disparó en el día ${peor.arranqueReal}, así que no vale explicarlo por llegar tarde.` : ""}`
                      : "El resultado es mixto: gana en unos ciclos y pierde en otros, lo que apunta a que depende del régimen de mercado más que de la señal."}
                    {tramosMin <= 5 && ` Aviso: el ciclo con menos compras solo tiene ${nplu(tramosMin, "tramo")}, así que su cifra no es comparable a la de un ciclo con decenas.`}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", marginTop: 9 }}>
                    Lo que sí se mide en la última columna es la variante que un inversor puede ejecutar de verdad: <b>un calendario de aportes cada 30 días más medio tramo extra cuando aparece la zona</b>. Esa combinación salió más barata en <b>{gR} de {val.length}</b> {plu(val.length, "ciclo", "ciclos")}.
                    {refuerzoNuncaGana && ` Y no es cuestión de calibrar: probado a 0,989, 0,97, 0,95 y 0,92, el refuerzo no mejora el calendario base en ningún umbral. Añadir tramos extra en zona sube el coste medio porque concentra dinero en tramos donde el precio ya subió respecto al arranque del ciclo.`}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border)", color: "var(--ink)" }}>
                    <b>Lo que esto significa para ti:</b>{" "}
                    {refuerzoNuncaGana
                      ? `con estos datos, el aporte constante gana al refuerzo por zonas. Lo que el SOPR sí aporta está en la otra columna: ${solaAlgunUmbral.length ? `la señal sola mejora el coste medio a umbrales de ${solaAlgunUmbral.map(x => x.toFixed(3)).join(" y ")}, que son zonas mucho más raras que 0,989` : "aún no aparece a ningún umbral probado"}. Úsalo para decidir el tamaño de una compra puntual, no para reemplazar tu calendario.`
                      : gR === val.length ? "el refuerzo por zonas mejoró el calendario base en todos los ciclos medidos: mantén los aportes y añade tramos extra cuando aparezca la zona."
                      : `el resultado no es concluyente con ${nplu(val.length, "ciclo")}. Mantén el calendario de aportes, que es lo que no depende de acertar, y trata el refuerzo en zona como una decisión de tamaño, no de calendario.`}
                  </div>
                </div>
              );
            })()}
            <div className="tiny muted" style={{ padding: "12px 18px", lineHeight: 1.6, borderTop: "1px solid var(--border)" }}>
              <b>Cómo leerlo.</b> <b>Ventaja vs ciclo</b> compara tu coste medio con repartir el mismo número de tramos por todo el ciclo desde el día 0; penaliza a la señal por no poder disparar en el arranque, así que no es la comparación justa.
              <b>Ventaja real</b> compara solo dentro de la ventana en que hubo zonas: esa sí aísla lo que aporta la señal.
              <b>Calendario + refuerzo</b> es la estrategia ejecutable: un tramo cada 30 días pase lo que pase, más medio tramo extra en zona, frente al mismo calendario sin refuerzo.
              En las tres, <b>signo negativo (−) es más barato</b> y positivo es más caro.
              <b>Al techo</b> es cuánto valía la posición en el punto más alto del ciclo, el momento en que un inversor de largo plazo reparte salidas.
              No hay «acierto» ni «fallo» aquí: quien acumula no acierta ni falla en cada compra, lo que hace es <b>bajar su coste medio</b>, y esa es la única cifra que decide su resultado años después.
            </div>
          </>
          : <div className="tiny muted" style={{ padding: "16px 18px" }}>Sin datos suficientes para simular la acumulación en {itype}.</div>}
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
                  <thead><tr><th>Regla</th><th className="c">Episodios</th><th className="r">Mediana a {hz}d</th><th className="r">Acertó</th><th className="r">Recorrido en contra</th></tr></thead>
                  <tbody>
                    {[["Base", sB, "dirección + intensidad" + (hcoh === "sth" ? " + aSOPR" : "")],
                      ["Confirmado", sC, "base + giro desde el extremo"]].map(([r, s, expl]) => (
                      <tr key={r} style={r === "Confirmado" ? { background: mixSoft(col, .93) } : null}>
                        <td style={{ fontWeight: r === "Confirmado" ? 700 : 500 }}>{r}<div className="tiny muted" style={{ fontWeight: 400 }}>{expl}</div></td>
                        <td className="c num">{s.n}{s.n > 0 && s.n < 5 && <div className="tiny" style={{ color: E.inkColor("#B0642A", 4.5, mixSoft(col, .93)), fontWeight: 600 }}>muestra corta</div>}</td>
                        <td className="r num" style={{ fontWeight: 700, color: s.med == null ? "var(--ink-3)" : s.n < 5 ? "var(--ink-3)" : col }}>{sgn(s.med)}</td>
                        <td className="r num" style={{ fontWeight: 700, color: s.n > 0 && s.n < 5 ? "var(--ink-3)" : "var(--ink)" }}>{s.hit == null ? "—" : s.hit.toFixed(0) + "%"}<div className="tiny muted" style={{ fontWeight: 400 }}>el precio {verb}</div></td>
                        <td className="r num" style={{ fontWeight: 700, color: s.mae == null ? "var(--ink-3)" : "#C0492E" }}>{s.mae == null ? "—" : (s.mae > 0 ? "+" : "") + s.mae.toFixed(1) + "%"}<div className="tiny muted" style={{ fontWeight: 400 }}>en contra</div></td>
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
                  <th className="r">30d</th><th className="r">90d</th><th className="r">180d</th><th className="r">En contra 90d</th></tr>
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
                      <td className="c"><span className="badge" style={{ background: mixSoft(col), color: E.inkColor(col, 4.5, mixSoft(col)), fontWeight: 700 }}>{x.kind === "buy" ? "COMPRA" : "VENTA"}</span></td>
                      <td className="c tiny" style={{ fontWeight: x.confirmado ? 700 : 400, color: x.confirmado ? E.inkColor(col, 4.5) : "var(--ink-3)" }}>{x.confirmado ? "confirmado" : "base"}</td>
                      <td className="r num">{x.v.toFixed(3)}</td>
                      <td className="c num tiny">{x.pct.toFixed(1)}</td>
                      <td className="r num tiny" style={{ color: x.vel == null ? "var(--ink-3)" : "var(--ink-2)" }}>{x.vel == null ? "—" : (x.vel > 0 ? "+" : "") + x.vel.toFixed(2)}</td>
                      <td className="r num">{E.fmt.usd(x.px)}</td>
                      {cell(30)}{cell(90)}{cell(180)}
                      <td className="r num tiny" style={{ color: "#C0492E" }}>{x.mae && Number.isFinite(x.mae[90]) ? (x.mae[90] > 0 ? "+" : "") + x.mae[90].toFixed(1) + "%" : "—"}</td>
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
        <b>Cómo se prueba.</b> El percentil de cada día histórico se calcula <b>solo con los datos anteriores a ese día</b>, no con la serie completa: en marzo de 2019 el detector no podía conocer la distribución de 2026, y medir con ella infla el resultado. Se exige un año de historia previa para evaluar, así que los primeros meses de cada serie no producen episodios.
        La columna <b>recorrido en contra</b> es lo máximo que el precio se movió en tu contra dentro del horizonte antes de que la zona diera resultado: negativo en las compras (cayó) y positivo en las ventas (siguió subiendo). Un acierto del 80% con un −18% de por medio no es la misma cosa que uno del 80% sin sobresaltos.
        <br /><br />
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
