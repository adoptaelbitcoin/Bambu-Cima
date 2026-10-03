/* ============================================================
   BAMBÚ · Reporte 360 — Informe mensual institucional
   Estructura: conclusiones clave · dónde está el mercado · objetivo
   principal con fecha · objetivo anual · perspectiva trimestral ·
   cuándo reevaluar · anexo de cálculos y limitaciones.
   Bandas = múltiplos del coste LTH. Fecha = primer toque bajo un
   modelo browniano con deriva sobre ln(precio / (k·coste LTH)).
   ============================================================ */

/* ---------- utilidades ---------- */
function mesLargo(ym) { const d = new Date(ym + "-01T00:00:00Z"); const s = d.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }); return s[0].toUpperCase() + s.slice(1); }
function prevYm(ym) { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; }
function lastDayYm(ym) { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function listMonths(latestIso, n) { const out = []; let m = latestIso.slice(0, 7); for (let k = 0; k < n; k++) { out.push(m); m = prevYm(m); } return out; }
function isoAdd(iso, n) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + Math.round(n)); return d.toISOString().slice(0, 10); }
function fLarga(iso) { return new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); }
function fCorta(iso) { return new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }); }
const pctS = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d).replace(".", ",") + "%";
const pctU = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(d).replace(".", ",") + "%";
const decS = (v, d) => v == null || !isFinite(v) ? "—" : v.toFixed(d).replace(".", ",");
const usdK = v => v == null || !isFinite(v) ? "—" : v >= 10000 ? "$" + (v / 1000).toFixed(1).replace(".", ",") + "K" : E.fmt.usd(v);
const kS = k => "×" + String(k).replace(".", ",");

/* ---------- estadística ---------- */
function erfA(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
function Phi(x) { return 0.5 * (1 + erfA(x / Math.SQRT2)); }
function logPhi(x) { if (x > -6) return Math.log(Math.max(1e-300, Phi(x))); return -x * x / 2 - Math.log(-x) - 0.5 * Math.log(2 * Math.PI) + Math.log(1 - 1 / (x * x)); }
/* primer paso de X(t)=X0+μt+σW por 0, con a=−X0>0: CDF en t días */
function fptCdf(t, a, mu, s) {
  if (t <= 0) return 0; const st = s * Math.sqrt(t);
  const t1 = Phi((mu * t - a) / st);
  const t2 = Math.exp(Math.min(700, 2 * mu * a / (s * s) + logPhi((-a - mu * t) / st)));
  return Math.min(1, t1 + t2);
}
function fptEver(a, mu, s) { return mu >= 0 ? 1 : Math.exp(2 * mu * a / (s * s)); }
function fptQ(q, a, mu, s) {
  if (fptEver(a, mu, s) <= q) return null;
  let lo = 0.01, hi = 1; while (fptCdf(hi, a, mu, s) < q && hi < 1e6) hi *= 2; if (hi >= 1e6) return null;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (fptCdf(m, a, mu, s) < q) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function meanArr(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function sdArr(a) { const m = meanArr(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); }
function median(a) { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }

/* ---------- modelo de bandas y primer toque ---------- */
const LADDER = [1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4, 5, 6];
function xSeries(R, k, i0, i1) { const P = R.cols.price, L = R.cols.rpLTH, out = []; for (let i = i0; i <= i1; i++) out.push(P[i] && L[i] ? Math.log(P[i] / (k * L[i])) : null); return out; }
function touchModel(R, k, i, trendWin, volWin) {
  const P = R.cols.price, L = R.cols.rpLTH;
  if (!P[i] || !L[i] || i < Math.max(trendWin, volWin) + 1) return null;
  const X0 = Math.log(P[i] / (k * L[i])); if (X0 >= 0) return { above: true, X0 };
  const x = xSeries(R, k, i - Math.max(trendWin, volWin), i);
  if (x.some(v => v == null)) return null;
  const d = []; for (let j = 1; j < x.length; j++) d.push(x[j] - x[j - 1]);
  const mu = meanArr(d.slice(-trendWin)), s = sdArr(d.slice(-volWin)), a = -X0;
  const q25 = fptQ(.25, a, mu, s), q50 = fptQ(.5, a, mu, s), q75 = fptQ(.75, a, mu, s);
  return { X0, a, mu, s, q25, q50, q75, p365: fptCdf(365, a, mu, s), ever: fptEver(a, mu, s) };
}
function rpGrowth(R, i, win) { const L = R.cols.rpLTH; return Math.log(L[i] / L[i - win]) / win; }
function lineAt(R, k, i, days, g) { return k * R.cols.rpLTH[i] * Math.exp(g * days); }

/* prueba histórica: primeros días de trimestre, sólo datos hasta esa fecha */
function timingTest(R, k, fromIso, toIso) {
  const P = R.cols.price, L = R.cols.rpLTH; let elig = 0, sumP = 0, hits = 0, cov = 0, covN = 0;
  for (let y = +fromIso.slice(0, 4); y <= +toIso.slice(0, 4); y++) for (const mm of ["01", "04", "07", "10"]) {
    const iso = `${y}-${mm}-01`; if (iso < fromIso || iso > toIso) continue;
    const i = R.indexOfIso(iso); if (i < 0 || i + 365 >= R.count) continue;
    const m = touchModel(R, k, i, 90, 30); if (!m || m.above || m.mu <= 0) continue;
    elig++; sumP += m.p365;
    let tHit = null; for (let j = i + 1; j <= i + 365; j++) if (P[j] && L[j] && P[j] / L[j] >= k) { tHit = j - i; break; }
    if (tHit != null) hits++;
    if (m.q25 != null && m.q75 != null && m.q75 <= 365) { covN++; if (tHit != null && tHit >= m.q25 && tHit <= m.q75) cov++; }
  }
  return { k, elig, pModel: elig ? sumP / elig : null, hits, cov, covN };
}

/* episodios de recuperación del coste STH */
function reclaimEpisodes(R, iEnd, daysSince) {
  const P = R.cols.price, S = R.cols.rpSTH, So = R.cols.sthSopr, out = []; let last = -1e9;
  for (let i = 61; i < iEnd - 90; i++) {
    if (!(P[i] > S[i] && P[i - 1] <= S[i - 1])) continue;
    let below = 0; for (let j = i - 60; j < i; j++) if (P[j] <= S[j]) below++;
    if (below < 30 || i - last < 30) continue; last = i;
    const j = i + Math.min(daysSince, 60); if (j + 90 >= iEnd) continue;
    let mn = Infinity; for (let q = j; q <= j + 90; q++) mn = Math.min(mn, P[q]);
    out.push({ iso: R.dates[i], j, sopr: So[j], r30: P[j + 30] / P[j] - 1, r90: P[j + 90] / P[j] - 1, dd: mn / P[j] - 1 });
  }
  return out;
}

/* ---------- construcción del informe ---------- */
function buildInstit(t, ym) {
  const R = window.BambuRealData[t]; if (!R) return null;
  let i = -1; for (let q = R.count - 1; q >= 0; q--) if (R.dates[q].slice(0, 7) === ym) { i = q; break; }
  if (i < 0) return null;
  const P = R.cols.price, S = R.cols.rpSTH, L = R.cols.rpLTH, C = R.cols, iso = R.dates[i], px = P[i];
  const lr = w => { const a = []; for (let q = i - w + 1; q <= i; q++) a.push(Math.log(P[q] / P[q - 1])); return sdArr(a) * Math.sqrt(365); };
  const vol30 = lr(30), vol90 = lr(90);
  const ratio = px / L[i];
  /* estado frente al coste STH */
  let since = i; const above = px > S[i]; while (since > 0 && (P[since - 1] > S[since - 1]) === above) since--;
  const daysState = i - since + 1;
  const ab30 = (() => { let n = 0; for (let q = i - 29; q <= i; q++) if (P[q] > S[q]) n++; return n / 30; })();
  const ab90p = (() => { let n = 0; for (let q = i - 119; q <= i - 30; q++) if (P[q] > S[q]) n++; return n / 90; })();
  const state = above ? (ab90p <= .5 ? "RECUPERACIÓN" : "EXPANSIÓN") : (ab90p >= .5 ? "RUPTURA" : "CONTRACCIÓN");
  const dS30 = S[i] / S[i - 30] - 1, dL30 = L[i] / L[i - 30] - 1, dZ30 = C.mvrvZ && C.mvrvZ[i - 30] != null ? C.mvrvZ[i] - C.mvrvZ[i - 30] : null;
  const sopr = C.sthSopr[i], SOPR_F = 1.01;
  const factors = [
    { ok: above, t: "Precio por encima del coste STH" },
    { ok: sopr >= SOPR_F, t: `SOPR STH en o sobre ${decS(SOPR_F, 2)}` },
    { ok: dS30 > 0, t: "Coste STH subiendo en 30 días" },
    { ok: dZ30 != null && dZ30 > 0, t: "MVRV Z subiendo en 30 días" },
  ];
  /* lectura Bambú */
  const snap = repSnap(t, iso), H = window.BambuHistory;
  const zs = H.zoneOf(snap.sth.temp, t, "sth", 27), zl = H.zoneOf(snap.lth.temp, t, "lth", 27);
  /* objetivos: peldaños del coste LTH */
  const pick = need => LADDER.find(k => k * L[i] >= px * (1 + need)) || LADDER[LADDER.length - 1];
  const k3 = pick(.10), kP = Math.max(pick(.35), LADDER[LADDER.indexOf(k3) + 1] || k3), kA = Math.max(pick(.70), LADDER[LADDER.indexOf(kP) + 1] || kP);
  const g90 = rpGrowth(R, i, 90);
  const mk = k => { const m = touchModel(R, k, i, 90, 30); const line = k * L[i]; return { k, line, dist: line / px - 1, m,
    d50: m && m.q50 != null ? isoAdd(iso, m.q50) : null, d25: m && m.q25 != null ? isoAdd(iso, m.q25) : null, d75: m && m.q75 != null ? isoAdd(iso, m.q75) : null,
    lineAt50: m && m.q50 != null ? lineAt(R, k, i, m.q50, g90) : null }; };
  const T3 = mk(k3), TP = mk(kP), TA = mk(kA);
  const yEnd = isoAdd(iso, 365), lineAEnd = lineAt(R, kA, i, 365, g90);
  const sens = [30, 90, 180, 365].map(w => ({ w, p: touchModel(R, kP, i, w, 30), a: touchModel(R, kA, i, w, 30) }));
  const tests = [k3, kP, kA].map(k => timingTest(R, k, "2015-01-01", isoAdd(iso, -366)));
  const eps = reclaimEpisodes(R, i, above ? daysState : 0);
  const grp = f => { const e = eps.filter(f); return { n: e.length, r30: median(e.map(x => x.r30)), r90: median(e.map(x => x.r90)), dd: median(e.map(x => x.dd)) }; };
  const G = { all: grp(() => true), lo: grp(e => e.sopr < SOPR_F), hi: grp(e => e.sopr >= SOPR_F) };
  const near = sopr >= SOPR_F ? G.hi : G.lo;
  return { t, name: t === "BTC" ? "Bitcoin" : "Ethereum", R, i, iso, px, S: S[i], L: L[i], ratio, vol30, vol90, above, since: R.dates[since], daysState, ab30, ab90p, state,
    dS30, dL30, dZ30, sopr, SOPR_F, factors, zs, zl, sigS: E.signalForRank(zs.rank), sigL: E.signalForRank(zl.rank),
    mvrvZ: C.mvrvZ ? C.mvrvZ[i] : null, nuplLTH: C.nuplLTH[i], T3, TP, TA, g90, yEnd, lineAEnd, sens, tests, eps, G, near, regime: E.detectRegime(R.rowAt(i)) };
}

/* ---------- vista ---------- */
function InfTbl({ head, rows, num }) {
  return (
    <table className="tbl" style={{ marginBottom: 14 }}>
      <thead><tr>{head.map((h, k) => <th key={k} className={k && num && num.includes(k) ? "r" : ""}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={k && num && num.includes(k) ? "r num" : ""} style={k === 0 ? { fontWeight: 600 } : null}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
const infP = { fontSize: 13.5, lineHeight: 1.68, color: "var(--ink-2)", margin: "0 0 12px", textWrap: "pretty" };

function InformeMensual({ palette }) {
  const RB = window.BambuRealData.BTC, latest = RB.latestIso;
  const months = React.useMemo(() => listMonths(latest, 24), [latest]);
  const firstComplete = latest === lastDayYm(latest.slice(0, 7)) ? months[0] : months[1];
  const [ym, setYm] = React.useState(firstComplete);
  const [t, setT] = React.useState("BTC");
  const D = React.useMemo(() => buildInstit(t, ym), [t, ym]);
  if (!D) return <p className="muted">Sin datos para ese mes.</p>;
  const { T3, TP, TA } = D;
  const pubIso = isoAdd(D.iso, 1), h3End = isoAdd(D.iso, 92), h12End = D.yEnd;
  const doPrint = () => { document.body.classList.add("printing"); setTimeout(() => { window.print(); document.body.classList.remove("printing"); }, 60); };
  const okN = D.factors.filter(f => f.ok).length;
  const dateOr = (T, fb) => T.m && T.m.above ? "Ya por encima" : T.d50 ? fLarga(T.d50) : fb || "Sin mediana incondicional";
  const testOf = k => D.tests.find(x => x.k === k);
  const covTxt = k => { const x = testOf(k); return x && x.covN ? `${x.cov} de ${x.covN}` : "sin casos suficientes"; };
  const R = D.R, i0c = Math.max(0, D.i - 364);
  const chartDates = R.dates.slice(i0c, D.i + 1), sl = k => R.cols[k].slice(i0c, D.i + 1);
  const band = k => R.cols.rpLTH.slice(i0c, D.i + 1).map(v => v * k);

  return (
    <div className="fade-in">
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 18px", flexWrap: "wrap" }}>
        <div className="seg">{["BTC", "ETH"].map(x => <button key={x} className={t === x ? "on" : ""} onClick={() => setT(x)}>{x}</button>)}</div>
        <span className="tiny muted">Cierre de:</span>
        <select className="inp" style={{ textAlign: "left", width: 210, fontFamily: "var(--sans)" }} value={ym} onChange={e => setYm(e.target.value)}>
          {months.map(m => <option key={m} value={m}>{mesLargo(m)}{m === latest.slice(0, 7) && latest !== lastDayYm(m) ? " · en curso" : ""}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn primary no-print" onClick={doPrint}>⤓ Exportar informe a PDF</button>
      </div>

      <article id="report-sheet" className="card card-pad" style={{ padding: 30, maxWidth: 1000 }}>
        {/* PORTADA */}
        <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 14, marginBottom: 18 }}>
          <div className="tiny" style={{ letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, color: "var(--brand)" }}>Bambú Research · Informe mensual institucional</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", margin: "4px 0 10px" }}>{D.name} · Previsión mensual {mesLargo(pubIso.slice(0, 7))}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "4px 24px", fontSize: 12.5, color: "var(--ink-2)" }}>
            <div><strong>Datos a fecha de:</strong> {fLarga(pubIso)}</div>
            <div><strong>Último dato usado en los cálculos:</strong> {fLarga(D.iso)}</div>
            <div><strong>Horizonte:</strong> 3 meses ({fCorta(pubIso)} – {fLarga(h3End)}); 12 meses (hasta {fLarga(h12End)})</div>
            <div><strong>Modelo:</strong> Bambú v2.2 · Bandas de coste LTH + primer toque · Fuente ChartInspect</div>
          </div>
        </div>

        {/* CONCLUSIONES CLAVE */}
        <RepHead n="◆" t="Conclusiones clave" />
        <p style={infP}>{D.name} {D.above ? "se mantiene por encima" : "está por debajo"} del coste medio de los tenedores de corto plazo ({E.fmt.usd(D.S)}) {D.above ? `desde el ${fLarga(D.since)}` : `desde el ${fLarga(D.since)}`}. El coste STH {D.dS30 >= 0 ? "sube" : "baja"} un {pctU(Math.abs(D.dS30))} en 30 días y el SOPR STH está en {decS(D.sopr, 4)}, {D.sopr >= D.SOPR_F ? `por encima del filtro de calidad de ${decS(D.SOPR_F, 2)}` : D.sopr >= 1 ? `sobre el equilibrio de 1 pero por debajo del filtro de calidad de ${decS(D.SOPR_F, 2)}` : "por debajo del equilibrio de 1: los compradores recientes realizan pérdidas"}. Se cumplen {okN} de 4 factores de calidad. La lectura Bambú es {D.zs.rank.toFixed(0)}/100 en corto ({D.zs.label.toLowerCase()}) y {D.zl.rank.toFixed(0)}/100 en ciclo ({D.zl.label.toLowerCase()}).</p>
        <p style={infP}>El objetivo principal es un toque de la línea coste LTH {kS(TP.k)}, hoy en {E.fmt.usd(TP.line)} ({pctS(TP.dist)}). {TP.m && TP.m.above ? "El precio ya está por encima de esa línea." : TP.d50 ? `Si se mantiene la tendencia de los últimos 90 días, la mediana condicional del primer toque es el ${fLarga(TP.d50)}, con la línea proyectada en torno a ${E.fmt.usd(TP.lineAt50)}.` : "Con la tendencia de los últimos 90 días, menos de la mitad de las trayectorias del modelo llegan a tocarla: no hay fecha mediana."} En la prueba histórica, el rango central de fechas acertó {covTxt(TP.k)} casos, así que la fecha no está validada como previsión.</p>
        <p style={infP}>Para el horizonte anual, la referencia extendida es la línea {kS(TA.k)}, en torno a {E.fmt.usd(D.lineAEnd)} a {fLarga(D.yEnd)} si el coste LTH sigue creciendo al ritmo actual. Es un nivel de escenario, no una previsión del precio de cierre del año.</p>
        <InfTbl head={["Foco", "Referencia de precio", "Fecha bajo el modelo condicional"]} rows={[
          ["Perspectiva a 3 meses", `Toque de coste LTH ${kS(T3.k)}, ~${usdK(T3.lineAt50 || T3.line)}`, dateOr(T3)],
          ["Objetivo principal", `Toque de coste LTH ${kS(TP.k)}, ~${usdK(TP.lineAt50 || TP.line)}`, dateOr(TP)],
          ["Referencia anual", `Coste LTH ${kS(TA.k)}, ~${usdK(D.lineAEnd)} al final del horizonte`, TA.d50 ? `Mediana del primer toque: ${fLarga(TA.d50)}, con la línea en ~${usdK(TA.lineAt50)}` : dateOr(TA)],
        ]} />
        <p className="tiny muted" style={{ margin: "0 0 20px", lineHeight: 1.55 }}>Todas las fechas usan el mismo escenario: se mantienen la tendencia de 90 días y la volatilidad actual. El modelo no anticipa cambios de régimen. Son proyecciones condicionales; cada informe recalcula la volatilidad y puede revisar los objetivos.</p>

        {/* 1 */}
        <RepHead n="1" t="Dónde está el mercado" />
        <InfTbl head={["Métrica", "Valor", "Implicación para el escenario"]} num={[1]} rows={[
          [`${D.t}, cierre diario`, E.fmt.usd(D.px), "Precio de partida de objetivos y fechas"],
          ["Coste LTH (precio realizado LTH)", E.fmt.usd(D.L), "Base de las bandas de precio"],
          [`${D.t} / coste LTH`, decS(D.ratio, 3), `El precio está ${pctS(D.ratio - 1)} sobre el coste de los tenedores de ciclo`],
          ["Coste STH (precio realizado STH)", E.fmt.usd(D.S), "Nivel de referencia para vigilar la recuperación"],
          ["MVRV STH (precio / coste STH)", decS(D.px / D.S, 3), `El precio está ${pctS(D.px / D.S - 1)} sobre el coste STH`],
          ["SOPR STH (media 7 días)", decS(D.sopr, 4), D.sopr >= D.SOPR_F ? "Sobre el filtro de calidad" : D.sopr >= 1 ? `Sobre el equilibrio de 1, bajo el filtro de ${decS(D.SOPR_F, 2)}` : "Bajo 1: realizan pérdidas"],
          ["Cambio 30 días del coste STH", pctS(D.dS30, 2), D.dS30 >= 0 ? "El coste de corto plazo sube" : "El coste de corto plazo baja"],
          ["Cambio 30 días del coste LTH", pctS(D.dL30, 2), D.dL30 >= 0 ? "El coste de ciclo sube" : "El coste de ciclo baja"],
          ["MVRV Z-Score · NUPL LTH", `${decS(D.mvrvZ, 2)} · ${decS(D.nuplLTH, 3)}`, D.mvrvZ < 2 ? "Valoración lejos de zona de techo" : "Valoración elevada"],
          ["Lectura Bambú STH · LTH", `${D.zs.rank.toFixed(0)} · ${D.zl.rank.toFixed(0)}`, <span>{D.zs.label} / {D.zl.label} · <SignalPill signal={D.sigS} /> <SignalPill signal={D.sigL} /></span>],
          ["Volatilidad anualizada, 30 días", pctU(D.vol30, 2), "Dispersión actual de los retornos"],
          ["Volatilidad anualizada, 90 días", pctU(D.vol90, 2), Math.abs(D.vol30 - D.vol90) < .05 ? "Cerca de la estimación del último mes" : D.vol30 > D.vol90 ? "La volatilidad reciente es mayor" : "La volatilidad reciente es menor"],
        ]} />
        <p style={infP}>El estado frente al coste STH es <strong>{D.state}</strong>: el precio está {D.above ? "por encima" : "por debajo"} del coste STH desde el {fLarga(D.since)} ({D.daysState} días). En los últimos 30 días estuvo por encima el {pctU(D.ab30, 0)} del tiempo, y en los 90 anteriores el {pctU(D.ab90p, 0)}. Se cumplen {okN} de los 4 factores de calidad: {D.factors.map(f => (f.ok ? "✓ " : "✗ ") + f.t.toLowerCase()).join("; ")}. Los factores describen el estado; no son votos a favor de un mercado alcista ni fijan la probabilidad de más subidas.</p>
        <div style={{ marginBottom: 22 }}><window.RcPriceCost t={D.t} endI={D.i} days={180} height={200} title="Precio frente a costes STH y LTH · 180 días" /></div>

        {/* 2 */}
        <RepHead n="2" t={`Objetivo de precio y fecha esperada · línea coste LTH ${kS(TP.k)}`} />
        <p style={infP}>La línea está hoy en {E.fmt.usd(TP.line)}, {pctS(TP.dist)} sobre el precio. Se mueve con el coste LTH, así que alcanzar una cifra fija y tocar la línea son sucesos distintos. La fecha se calcula con los cambios de la relación precio / línea: si el precio sube más rápido que el coste, la distancia se acorta. La volatilidad fija la dispersión de las fechas posibles, no la dirección.</p>
        <InfTbl head={["Resultado", "Estimación condicional"]} num={[1]} rows={TP.m && TP.m.above ? [["Estado", "El precio ya está por encima de la línea"]] : [
          ["Mediana del tiempo hasta el primer toque", TP.m && TP.m.q50 != null ? `${Math.round(TP.m.q50)} días` : "Sin mediana"],
          ["Fecha mediana", TP.d50 ? fLarga(TP.d50) : "—"],
          ["50% central de las fechas del modelo", TP.d25 && TP.d75 ? `${fLarga(TP.d25)} – ${fLarga(TP.d75)}` : "—"],
          ["Nivel proyectado de la línea en la fecha mediana", TP.lineAt50 ? E.fmt.usd(TP.lineAt50) : "—"],
          ["Probabilidad del modelo de tocarla en 365 días", TP.m ? pctU(TP.m.p365, 0) : "—"],
        ]} />
        <p style={infP}>La fecha mediana significa que, con estos parámetros, la mitad de los primeros toques del modelo ocurren antes y la mitad después. El rango central sólo recoge la aleatoriedad dentro del modelo: excluye el error de estimar la tendencia, los cambios de volatilidad y un nuevo régimen. En la prueba histórica, ese rango acertó {covTxt(TP.k)} casos, frente al 50% teórico.</p>
        <div style={{ marginBottom: 14 }}>
          <window.RcLine dates={chartDates} height={210} fmt={v => usdK(v)} title={`${D.t} frente a las bandas del coste LTH · 365 días`}
            series={[{ vals: sl("price"), color: "#141714", label: "Precio", width: 2.1 }, { vals: band(T3.k), color: "#ee9b4a", label: `Coste LTH ${kS(T3.k)}`, dash: "5 3" }, { vals: band(TP.k), color: "#c0392b", label: `Coste LTH ${kS(TP.k)}`, dash: "5 3" }, { vals: band(TA.k), color: "#7a1f14", label: `Coste LTH ${kS(TA.k)}`, dash: "2 3" }, { vals: sl("rpLTH"), color: "#3E7C57", label: "Coste LTH" }]} />
        </div>
        <div className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", margin: "4px 0 6px" }}>Sensibilidad de la fecha a la ventana de tendencia</div>
        <InfTbl head={["Ventana de tendencia", `Mediana primer toque ${kS(TP.k)}`, `Mediana primer toque ${kS(TA.k)}`]} rows={D.sens.map(s => [
          s.w === 90 ? "90 días, escenario principal" : `${s.w} días`,
          s.p && s.p.above ? "Ya por encima" : s.p && s.p.q50 != null ? fLarga(isoAdd(D.iso, s.p.q50)) : "Sin mediana incondicional",
          s.a && s.a.above ? "Ya por encima" : s.a && s.a.q50 != null ? fLarga(isoAdd(D.iso, s.a.q50)) : "Sin mediana incondicional"])} />
        <p style={{ ...infP, marginBottom: 22 }}>La tendencia se reestima en cada ventana; la volatilidad de la relación sigue siendo la de 30 días. {D.sens.some(s => !s.p || (s.p.q50 == null && !s.p.above)) ? "En alguna ventana la tendencia de la relación es negativa: dentro del modelo, menos de la mitad de las trayectorias llegan al objetivo. No significa que no pueda subir, pero muestra cuánto depende el resultado del periodo elegido." : "La fecha cambia con la ventana elegida: cuanto más lenta la tendencia, más tarde llega el toque."}</p>

        {/* 3 */}
        <RepHead n="3" t={`Objetivo anual · línea coste LTH ${kS(TA.k)}`} />
        <p style={infP}>Referencia anual: la línea {kS(TA.k)}, en torno a {usdK(D.lineAEnd)} a {fLarga(D.yEnd)}. Es una referencia extendida si las subidas continúan más allá de {kS(TP.k)}. No es un objetivo estadísticamente óptimo, ni un techo de ciclo inevitable, ni una señal automática de venta.</p>
        <InfTbl head={["Métrica", "Estimación"]} num={[1]} rows={[
          [`Línea ${kS(TA.k)} hoy`, E.fmt.usd(TA.line)],
          ["Distancia a la línea actual", pctS(TA.dist)],
          ["Mediana del primer toque con tendencia de 90 días", TA.m && TA.m.above ? "Ya por encima" : TA.d50 ? fLarga(TA.d50) : "Sin mediana incondicional"],
          ["Nivel proyectado de la línea en esa fecha", TA.lineAt50 ? E.fmt.usd(TA.lineAt50) : "—"],
          ["50% central de las fechas del modelo", TA.d25 && TA.d75 ? `${fLarga(TA.d25)} – ${fLarga(TA.d75)}` : "—"],
          ["Nivel proyectado de la línea al final del horizonte anual", E.fmt.usd(D.lineAEnd)],
        ]} />
        <p style={{ ...infP, marginBottom: 22 }}>El precio puede tocar el objetivo durante el año y después caer: el primer toque y el precio al {fLarga(D.yEnd)} se consideran por separado. En la prueba histórica, la línea {kS(TA.k)} se alcanzó en 365 días en {testOf(TA.k) ? `${testOf(TA.k).hits} de ${testOf(TA.k).elig}` : "—"} casos elegibles, frente a una probabilidad media del modelo del {testOf(TA.k) && testOf(TA.k).pModel != null ? pctU(testOf(TA.k).pModel, 0) : "—"}. Esos casos no coinciden del todo con el régimen actual y no son una probabilidad para hoy.</p>

        {/* 4 */}
        <RepHead n="4" t="Perspectiva trimestral a 3 meses" />
        <p style={infP}>Horizonte: {fLarga(pubIso)} – {fLarga(h3End)}. Referencia condicional al alza: coste LTH {kS(T3.k)}, en torno a {usdK(T3.lineAt50 || T3.line)}. {T3.m && T3.m.above ? "El precio ya está por encima." : T3.d50 ? `Con la tendencia de 90 días, la mediana del primer toque es el ${fLarga(T3.d50)}${T3.d25 && T3.d75 ? `, con el 50% central entre el ${fCorta(T3.d25)} y el ${fCorta(T3.d75)}` : ""}.` : "Con la tendencia de 90 días no hay fecha mediana."} Es una referencia de toque durante el trimestre, no el precio de cierre del {fLarga(h3End)}. Para esta línea, el rango acertó {covTxt(T3.k)} casos en la prueba.</p>
        <p style={infP}>Los episodios históricos de recuperación del coste STH (precio que cruza al alza tras pasar al menos la mitad de los 60 días previos por debajo), medidos desde el mismo número de días tras el cruce que hoy:</p>
        <InfTbl head={["Grupo histórico", "Episodios", "Mediana r30", "Mediana r90", "Mediana caída máx. 90 d"]} num={[1, 2, 3, 4]} rows={[
          ["Todas las recuperaciones", D.G.all.n, pctS(D.G.all.r30), pctS(D.G.all.r90), pctS(D.G.all.dd)],
          [`SOPR STH bajo ${decS(D.SOPR_F, 2)}`, D.G.lo.n, pctS(D.G.lo.r30), pctS(D.G.lo.r90), pctS(D.G.lo.dd)],
          [`SOPR STH en o sobre ${decS(D.SOPR_F, 2)}`, D.G.hi.n, pctS(D.G.hi.r30), pctS(D.G.hi.r90), pctS(D.G.hi.dd)],
        ]} />
        <p style={infP}>Por el SOPR actual, el mercado se parece más al grupo «{D.sopr >= D.SOPR_F ? `en o sobre ${decS(D.SOPR_F, 2)}` : `bajo ${decS(D.SOPR_F, 2)}`}» ({D.near.n} episodios). Aplicar mecánicamente su mediana a 90 días da unos {D.near.r90 != null ? E.fmt.usd(D.px * (1 + D.near.r90)) : "—"} desde el precio actual. {D.near.n < 6 ? "La muestra es demasiado pequeña para estimar con precisión la probabilidad de ese camino. " : ""}Las bandas responden cuándo podría llegar el precio a una línea si sigue la tendencia; los episodios muestran lo variadas que han sido las recuperaciones parecidas. No se promedian ni se combinan en una probabilidad global.</p>
        <div className="tiny" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", margin: "4px 0 6px" }}>Niveles a vigilar durante el trimestre</div>
        <InfTbl head={["Zona con los datos actuales", "Papel en el escenario"]} rows={[
          [`${usdK(T3.line)}, coste LTH ${kS(T3.k)}`, "Referencia al alza más cercana"],
          [`${usdK(D.S)}, coste STH`, `Zona para probar la solidez de la recuperación (${pctS(D.S / D.px - 1)})`],
          [`${usdK(D.L * 1.25)}, coste LTH ×1,25`, `Estrés intermedio (${pctS(D.L * 1.25 / D.px - 1)})`],
          [`${usdK(D.L)}, coste LTH`, `Estrés profundo, suelo de ciclo histórico (${pctS(D.L / D.px - 1)})`],
        ]} />
        <p style={{ ...infP, marginBottom: 22 }}>Estas líneas muestran dónde está el precio frente al coste de cada cohorte. No garantizan soporte, y la caída máxima histórica del grupo comparable no fija un mínimo futuro exacto.</p>

        {/* 5 */}
        <RepHead n="5" t="Cuándo reevaluar el escenario" />
        <InfTbl head={["Cambio", "Implicación para el informe"]} rows={[
          [`Un cierre diario por debajo del coste STH (hoy ${usdK(D.S)})`, "Recalcular el escenario de recuperación y las fechas de los objetivos"],
          ["El SOPR STH baja de 1", "Menos confianza en la calidad de la recuperación: las pérdidas realizadas pasan a ser un riesgo"],
          [`El SOPR STH supera ${decS(D.SOPR_F, 2)} con el precio sobre el coste STH`, "Anotar la mejora del filtro sin asignar al mercado la probabilidad del grupo histórico"],
          ["El coste STH o LTH deja de subir en 30 días", "Revisar el soporte de coste del escenario"],
          [`La tendencia de 90 días de ${D.t} / coste LTH pasa a ser no positiva`, "Retirar las fechas medianas del escenario principal y recalcular la probabilidad de alcanzar los objetivos"],
          ["La lectura Bambú STH entra en distribución (≥58) o la LTH supera 80", "Activar el plan de reducción por tramos del modelo"],
          ["La volatilidad o los datos de origen cambian de forma material", "Actualizar fechas y rangos sin tratar la fecha anterior como un compromiso"],
        ]} />
        <p className="tiny muted" style={{ margin: "0 0 24px" }}>Son las reglas de revisión de este informe, no una estrategia de trading probada. Los niveles se recalculan con el coste vigente en cada fecha.</p>

        {/* 6 · CONCLUSIONES */}
        <RepHead n="6" t="Conclusiones" />
        {(() => {
          const posture = D.sigS === D.sigL ? D.sigS : null;
          const corto = D.zs.rank < 42 ? "zona de acumulación" : D.zs.rank < 58 ? "zona neutra" : "zona de distribución";
          const ciclo = D.zl.rank < 40 ? "la parte fría del ciclo" : D.zl.rank < 60 ? "la parte templada del ciclo" : "la parte caliente del ciclo";
          const quality = okN >= 3 ? "sólida" : okN === 2 ? "parcial" : "débil";
          const items = [
            { h: "Estado", p: `${D.name} está en ${D.state.toLowerCase()} frente al coste STH desde hace ${D.daysState} días, con ${okN} de 4 factores de calidad cumplidos: recuperación ${quality}. El precio cotiza ${pctS(D.ratio - 1, 0)} sobre el coste de los tenedores de ciclo y el MVRV Z (${decS(D.mvrvZ, 2)}) está lejos de zona de techo.` },
            { h: "Lectura del modelo", p: <>El corto plazo está en {corto} ({D.zs.rank.toFixed(0)}/100) y el ciclo en {ciclo} ({D.zl.rank.toFixed(0)}/100). Señal de corto <SignalPill signal={D.sigS} />, señal de ciclo <SignalPill signal={D.sigL} />.{posture ? " Ambos plazos coinciden." : " Los plazos no coinciden: el ciclo fija cuánto tener y el corto, cuándo ejecutar."}</> },
            { h: "Escenario base a 3 meses", p: `Continuación de la recuperación con referencia al alza en ${usdK(T3.line)} (coste LTH ${kS(T3.k)}${T3.d50 ? `, toque mediano el ${fLarga(T3.d50)}` : ""}). Los episodios comparables dan una mediana a 90 días de ${pctS(D.near.r90)} con una caída intermedia mediana de ${pctS(D.near.dd)}: hay que contar con retrocesos por el camino.` },
            { h: "Riesgo principal", p: `Perder el coste STH (${usdK(D.S)}, ${pctS(D.S / D.px - 1)}) invalidaría la recuperación y dejaría como siguiente referencia el coste LTH ×1,25 (${usdK(D.L * 1.25)}). ${D.sopr < D.SOPR_F ? `El SOPR STH (${decS(D.sopr, 4)}) todavía no confirma la calidad del movimiento.` : "El SOPR STH ya confirma la calidad del movimiento."}` },
            { h: "Objetivos", p: `Principal: coste LTH ${kS(TP.k)} (${usdK(TP.line)}${TP.d50 ? `, mediana ${fLarga(TP.d50)}` : ""}). Anual: ${kS(TA.k)} (en torno a ${usdK(D.lineAEnd)} al final del horizonte). Las fechas son condicionales a que se mantenga la tendencia de 90 días; con la de 180 días se retrasan varios meses.` },
            { h: "Para el comité", p: `Mantener la exposición de ciclo según la señal LTH y ejecutar el corto por tramos, sin perseguir el precio. Reevaluar si se activa cualquiera de las reglas de la sección 5, en especial un cierre bajo ${usdK(D.S)}.` },
          ];
          return <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>{items.map((it, j) => (
            <div key={j} style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: 14, padding: "10px 0", borderTop: j ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{it.h}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-2)", textWrap: "pretty" }}>{it.p}</div>
            </div>))}</div>;
        })()}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 8 }}>
          <p className="tiny muted" style={{ margin: "0 0 4px", lineHeight: 1.55 }}><strong>Método.</strong> Datos on-chain diarios de ChartInspect, cierre UTC. Bandas: múltiplos del coste LTH. Fechas: primer toque bajo un modelo browniano con deriva (tendencia 90 días, volatilidad 30 días). Episodios: recuperaciones históricas del coste STH.</p>
          <p className="tiny muted" style={{ margin: "0 0 4px", lineHeight: 1.55 }}><strong>Aviso.</strong> Informe de investigación estandarizado para uso interno. Los precios, fechas, rangos y escenarios son estimaciones probabilísticas y no garantizan resultados futuros. Las decisiones de inversión son responsabilidad exclusiva del cliente.</p>
          <p className="tiny muted" style={{ margin: 0 }}>Contenido educativo, no asesoramiento financiero. Invertir en criptoactivos conlleva riesgo de pérdida. © {pubIso.slice(0, 4)} Bambú.</p>
        </div>
      </article>
    </div>
  );
}
Object.assign(window, { InformeMensual, buildInstit });
