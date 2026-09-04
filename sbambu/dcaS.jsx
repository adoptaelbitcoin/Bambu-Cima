/* ============================================================
   BAMBU · Plan de aportes (DCA) — compartido S/Pro
   Presupuesto de ahorro MENSUAL fijo. Las cadencias solo lo reparten.
   Inteligente: ahorra y compra en las bajadas, sin pasarse del presupuesto.
   ============================================================ */
const DE = window.BambuEngine;
const DPAL = "sobria";
const DK = "bambu_dca_v2";
function dLoad() {
  try { const s = localStorage.getItem(DK); if (s) return JSON.parse(s); } catch (e) {}
  return { monthly: 400, freq: "inteligente", weight: 70, horizon: 24, cost: 25 };
}
const MODES = [["semanal", "Semanal"], ["quincenal", "Quincenal"], ["mensual", "Mensual"], ["inteligente", "Inteligente"]];

/* Simula una estrategia sobre datos reales respetando el presupuesto mensual B.
   Nunca gasta más de lo ahorrado hasta la fecha (no adelanta presupuesto futuro). */
function simDCA(type, months, B, mode) {
  const H = window.BambuHistory, EG = window.BambuEngine;
  const R = H.realOf && H.realOf(type); if (!R || !(B > 0)) return null;
  let rows = R.lastDays(Math.round((months || 24) * 30.4)); if (!rows) return null;
  rows = rows.filter(r => r.values && r.values.price > 0);
  if (rows.length < 4) return null;
  const nWeeks = Math.max(4, Math.round((months || 24) * 4.33));
  const step = Math.max(1, Math.floor(rows.length / nWeeks));
  const pts = []; for (let i = 0; i < rows.length; i += step) pts.push(rows[i]);
  const price = p => p.values.price;
  /* la lectura va en la escala publicada 0-100, la misma del resto de la suite */
  const HZ = window.BambuHistory;
  const temps = p => {
    const res = EG.computeAsset({ type, values: p.values }, { k: 27 });
    if (HZ && HZ.zoneOf) return { s: HZ.zoneOf(res.sth.temp, type, "sth", 27).rank, l: HZ.zoneOf(res.lth.temp, type, "lth", 27).rank };
    return { s: res.sth.temp, l: res.lth.temp };
  };
  const save = B / 4.33;               // ahorro por semana
  let units = 0, invested = 0, cash = 0; const series = [];
  const N = pts.length;
  pts.forEach((p, i) => {
    cash += save; invested += save;
    const pr = price(p); const lastOne = i === N - 1;
    if (mode === "semanal") { units += cash / pr; cash = 0; }
    else if (mode === "quincenal") { if (i % 2 === 1 || lastOne) { units += cash / pr; cash = 0; } }
    else if (mode === "mensual") { if (i % 4 === 3 || lastOne) { units += cash / pr; cash = 0; } }
    else {
      const t = temps(p);
      /* plan de salida: al entrar el ciclo en zona de DISTRIBUCIÓN (80 de 100) asegura por tramos a USD */
      if (t.l > 80 && units > 0) { const f = Math.min(0.5, 0.15 + (t.l - 80) / 20); cash += units * f * pr; units -= units * f; }
      /* muy frío: coloca todo lo ahorrado de inmediato */
      else if (t.s < 35) { units += cash / pr; cash = 0; }
      /* frío: coloca cuando hay al menos mes y medio ahorrado (mejor precio medio que el goteo) */
      else if (t.s < 50 && cash >= B * 1.5) { units += cash / pr; cash = 0; }
      /* evita efectivo infinito en mercados laterales largos */
      else if (cash >= B * 5) { units += (cash * 0.5) / pr; cash *= 0.5; }
    }
    series.push({ invested, value: units * pr + cash });
  });
  const lp = price(pts[N - 1]);
  if (mode !== "inteligente" && cash > 0) { units += cash / lp; cash = 0; }
  return { units, invested, value: units * lp + cash, realized: cash, avg: units ? invested / units : 0, lastPrice: lp, series };
}
function combinedSeries(rowsAsset, months, B, per2, mode) {
  const arr = rowsAsset.map(r => simDCA(r.asset.type, months, B * (per2[r.asset.type] || 0), mode));
  if (arr.some(x => !x)) return null;
  const len = Math.min(...arr.map(a => a.series.length)); const out = [];
  for (let i = 0; i < len; i++) out.push({ invested: arr.reduce((s, a) => s + a.series[i].invested, 0), value: arr.reduce((s, a) => s + a.series[i].value, 0) });
  return out;
}

/* proyección compuesta ilustrativa de aportes mensuales */
function projectDca(monthly, months, annual) {
  const r = Math.pow(1 + annual, 1 / 12) - 1; let fv = 0, invested = 0; const pts = [];
  for (let m = 1; m <= months; m++) { fv = (fv + monthly) * (1 + r); invested += monthly; pts.push({ invested, fv }); }
  return { invested, fv, pts };
}

/* gráfica: valor en USD de dos estrategias en el tiempo */
function TwoLineChart({ a, b, colA, colB }) {
  const s = a; if (!s || s.length < 3) return null;
  const W = 620, H = 158, padL = 4, padR = 4, padT = 12, padB = 16;
  const max = Math.max(...s.map((p, i) => Math.max(p.value, (b[i] || p).value, p.invested)));
  const X = i => padL + (i / (s.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - v / max) * (H - padT - padB);
  const ln = (arr, key) => arr.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p[key]).toFixed(1)).join(" ");
  const area = ln(a, "value") + ` L ${X(s.length - 1)} ${H - padB} L ${X(0)} ${H - padB} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", marginTop: 10 }}>
      <path d={area} fill={colA} opacity="0.09" />
      <path d={ln(a, "invested")} fill="none" stroke="#9AA0A8" strokeWidth="1.8" strokeDasharray="4 4" />
      <path d={ln(b, "value")} fill="none" stroke={colB} strokeWidth="2.2" strokeLinejoin="round" />
      <path d={ln(a, "value")} fill="none" stroke={colA} strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}

const dToneCol = { acc: "#2F6244", neu: "#8A9188", dist: "#B0402A" };
const dToneBg = { acc: "var(--brand-soft)", neu: "var(--surface-3)", dist: "#FBEEE9" };

function DcaPlan({ results, pro }) {
  const [cfg, setCfg] = React.useState(() => { const c = dLoad(); if (c.monthly == null && c.amount != null) c.monthly = c.amount; return c; });
  React.useEffect(() => { try { localStorage.setItem(DK, JSON.stringify(cfg)); } catch (e) {} }, [cfg]);
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  /* en Cima (pro) el plan ES la regla inteligente: sin cadencias fijas */
  const freq = pro ? "inteligente" : cfg.freq;
  const btc = results.find(r => r.asset.type === "BTC"), eth = results.find(r => r.asset.type === "ETH");
  const rowsAsset = [btc, eth].filter(Boolean);
  const B = cfg.monthly || 0;
  const months = cfg.horizon || 24;
  const per2 = { BTC: cfg.weight / 100, ETH: (100 - cfg.weight) / 100 };
  const splitTxt = freq === "semanal" ? `4 aportes de ${DE.fmt.usd(B / 4)} a la semana` : freq === "quincenal" ? `2 aportes de ${DE.fmt.usd(B / 2)} cada quincena` : freq === "mensual" ? `1 aporte de ${DE.fmt.usd(B)} al mes` : `ahorras hasta ${DE.fmt.usd(B)}/mes, colocas todo lo ahorrado cuando el STH marca acumulación y aseguras a USD por tramos cuando el ciclo (LTH) supera 80 de 100 — igual que tu Plan de salida — para recomprar más abajo`;

  const fld = { fontFamily: "var(--mono)", fontSize: 15, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)", width: "100%" };
  const seg = on => ({ flex: 1, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 12.5, padding: "9px 4px", borderRadius: 9, border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" });

  // estrategias sumadas BTC+ETH sobre la ventana
  const stratVals = MODES.map(([m, l]) => { let v = 0, ok = false; rowsAsset.forEach(r => { const s = simDCA(r.asset.type, months, B * (per2[r.asset.type] || 0), m); if (s) { v += s.value; ok = true; } }); return { m, l, v, ok }; });
  const invTotal = B * months;
  const bestFixed = Math.max(stratVals[0].v, stratVals[1].v, stratVals[2].v);
  const smartV = stratVals[3].v;
  const cost = cfg.cost || 25, costWin = cost * months, edge = smartV - bestFixed, paysX = costWin > 0 ? edge / costWin : 0;
  const WINS = [{ m: 12, l: "1 año" }, { m: 24, l: "2 años" }, { m: 48, l: "4 años" }, { m: 999, l: "Todo el histórico" }];
  const winData = WINS.map(w => { let vs = 0, vb = 0; rowsAsset.forEach(r => { const s = simDCA(r.asset.type, w.m, B * (per2[r.asset.type] || 0), "inteligente"); const f = simDCA(r.asset.type, w.m, B * (per2[r.asset.type] || 0), "mensual"); if (s) vs += s.value; if (f) vb += f.value; }); return { ...w, edge: vs - vb, win: vs > vb }; });
  const winsWon = winData.filter(d => d.win).length;
  const smartSeries = combinedSeries(rowsAsset, months, B, per2, "inteligente");
  const mensualSeries = combinedSeries(rowsAsset, months, B, per2, "mensual");

  // qué hacer con el aporte de este periodo, por activo
  const AssetNow = ({ r }) => {
    if (!r) return null;
    const t = r.sth.temp * 0.4 + r.lth.temp * 0.6, col = DE.tempColor(t, DPAL);
    const aporte = B * (per2[r.asset.type] || 0);
    const tone = t < 40 ? "acc" : t > 62 ? "dist" : "neu";
    const txt = tone === "acc" ? "Zona barata: invierte ya el aporte de este periodo." : tone === "dist" ? "Está caro: guarda el aporte y espera un retroceso dentro del periodo." : "Reparte el aporte del periodo con normalidad.";
    return (
      <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "15px 17px", marginBottom: 10, borderLeft: `4px solid ${col}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{r.asset.name}</span>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>aporte {DE.fmt.usd(aporte)}/mes · {r.asset.ticker} {Math.round(t)} de 100</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: dToneCol[tone], background: dToneBg[tone], borderRadius: 100, padding: "3px 10px" }}>{tone === "acc" ? "COMPRAR" : tone === "dist" ? "ESPERAR" : "NORMAL"}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>{txt}</div>
      </div>
    );
  };

  return (
    <div>
      {/* evidencia del backtest: por qué la regla inteligente */}
      <BacktestEvidence rowsAsset={rowsAsset} />
      {/* presupuesto */}
      <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 18, alignItems: "start" }}>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Presupuesto de ahorro al mes (USD) <window.HelpS title="Tu presupuesto" text="Lo máximo que destinas a invertir cada mes. Nunca se gasta más que esto: las cadencias solo reparten ese dinero, y el modo inteligente lo ahorra para comprar en las bajadas." /></label>
            <input style={fld} type="number" value={B} onChange={e => set("monthly", Math.max(0, parseFloat(e.target.value) || 0))} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>{pro ? "La regla de tu plan" : "Cómo lo repartes"}</label>
            {!pro && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {MODES.map(([m, l]) => <button key={m} onClick={() => set("freq", m)} style={seg(cfg.freq === m)}>{l}</button>)}
            </div>}
            {pro && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-ink)", background: "var(--brand-soft)", border: "1.5px solid var(--brand)", borderRadius: 100, padding: "5px 14px", whiteSpace: "nowrap" }}>DCA INTELIGENTE</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>la regla probada del backtest · sin cadencias fijas</span>
            </div>}
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>Con {DE.fmt.usd(B)}/mes: {splitTxt}.</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Reparto BTC / ETH</label>
            <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>{cfg.weight}/{100 - cfg.weight}</span>
          </div>
          <input type="range" min="0" max="100" step="5" value={cfg.weight} onChange={e => set("weight", +e.target.value)} style={{ width: "100%", marginTop: 8, accentColor: "#3E7C57" }} />
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>{DE.fmt.usd(B * per2.BTC)}/mes a BTC · {DE.fmt.usd(B * per2.ETH)}/mes a ETH.</div>
        </div>
      </div>

      {/* qué hacer ahora */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 2px 8px" }}>Qué hacer con el aporte de este periodo</h2>
      <AssetNow r={btc} />
      <AssetNow r={eth} />

      {/* comparación 4 estrategias (solo en Go: en Cima el plan ES la regla inteligente) */}
      {!pro && stratVals[3].ok && (
        <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginTop: 6, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Las 4 formas de repartir, al liquidar en USD</span>
            <window.HelpS title="Comparativa" text="Con el mismo presupuesto mensual, así habría terminado cada forma de repartir en los últimos meses, medido en dólares al vender. El inteligente ahorra para comprar en las bajadas." />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 12 }}>Mismo dinero aportado ({DE.fmt.usd(invTotal)}) en {months} meses:</div>
          {stratVals.map((s, i) => { const mx = Math.max(...stratVals.map(x => x.v)) || 1; const smart = s.m === "inteligente"; return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span style={{ width: 82, fontSize: 12.5, fontWeight: smart ? 700 : 500, color: smart ? "var(--brand-2)" : "var(--ink-2)" }}>{s.l}</span>
              <div style={{ flex: 1, height: 18, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${s.v / mx * 100}%`, height: "100%", background: smart ? "var(--brand)" : "#B7BEB2" }} /></div>
              <span className="num" style={{ width: 96, textAlign: "right", fontSize: 13, fontWeight: 700, color: smart ? "var(--brand-2)" : "var(--ink)" }}>{DE.fmt.usd(s.v)}</span>
            </div>
          ); })}
          <div style={{ fontSize: 12.5, color: "var(--brand-ink)", background: "var(--brand-soft)", borderRadius: 10, padding: "10px 13px", marginTop: 10 }}><b>Inteligente</b> {edge >= 0 ? <>supera a la mejor cadencia fija en <b>{DE.fmt.usd(edge)}</b></> : <>queda <b>{DE.fmt.usd(-edge)}</b> por debajo en esta ventana</>} con el mismo dinero.</div>
          {smartSeries && mensualSeries && <TwoLineChart a={smartSeries} b={mensualSeries} colA="#3E7C57" colB="#C77B3A" />}
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "var(--ink-2)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#3E7C57", borderRadius: 2 }} />Inteligente</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#C77B3A", borderRadius: 2 }} />Mensual</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #9AA0A8" }} />Lo aportado</span>
          </div>
        </div>
      )}

      {/* evolución del plan inteligente (Cima): valor vs aportado, sin cadencias */}
      {pro && stratVals[3].ok && smartSeries && (
        <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px", marginTop: 6, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Así habría funcionado tu plan</span>
            <window.HelpS title="Tu plan en datos reales" text="Simulación de la regla inteligente sobre los datos reales del periodo elegido, con tu presupuesto: la línea verde es el valor del plan (al liquidar en USD) y la punteada lo que llevabas aportado." />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 6 }}>Con tu presupuesto de {DE.fmt.usd(B)}/mes durante los últimos {months} meses: aportaste {DE.fmt.usd(invTotal)} y el plan habría terminado en <b style={{ color: "var(--brand-2)" }}>{DE.fmt.usd(smartV)}</b>.</div>
          <TwoLineChart a={smartSeries} b={smartSeries} colA="#3E7C57" colB="#3E7C57" />
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "var(--ink-2)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#3E7C57", borderRadius: 2 }} />Valor del plan (USD)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed #9AA0A8" }} />Lo aportado</span>
          </div>
        </div>
      )}

      {/* se paga solo (solo en Go: compara contra cadencias) */}
      {!pro && stratVals[3].ok && (
        <div style={{ background: "linear-gradient(150deg,#16241C,#1E3A2C)", color: "#E7ECE6", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9FC4A9" }}>¿Bambu se paga solo?</div>
          <div style={{ fontSize: 25, fontWeight: 700, color: paysX >= 1 ? "#EAD98A" : "#fff", marginTop: 4 }}>{edge > 0 ? (paysX >= 1 ? `✓ Sí — se paga solo ${paysX.toFixed(1)}×` : "Casi — depende del periodo") : "En este periodo no aporta ventaja"}</div>
          <div style={{ fontSize: 13.5, color: "#C2D2C6", marginTop: 8, lineHeight: 1.55 }}>La forma inteligente te dio <b style={{ color: "#7BD0A0" }}>{edge >= 0 ? "+" : ""}{DE.fmt.usd(edge)}</b> más que la mejor cadencia fija en {months} meses.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 12 }}>
            <span style={{ fontSize: 12.5, color: "#A8BCAD" }}>Coste de Bambu</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "4px 8px" }}><span style={{ color: "#A8BCAD" }}>$</span><input type="number" value={cost} onChange={e => set("cost", Math.max(0, parseFloat(e.target.value) || 0))} style={{ width: 52, fontFamily: "var(--mono)", fontSize: 13, border: "none", background: "transparent", color: "#fff" }} /><span style={{ color: "#A8BCAD", fontSize: 12 }}>/mes</span></span>
            <span style={{ fontSize: 12.5, color: "#C2D2C6" }}>= {DE.fmt.usd(costWin)} en {months} meses.{edge > 0 && paysX >= 1 ? ` La ventaja lo cubre ${paysX.toFixed(1)} veces.` : ""}</span>
          </div>
        </div>
      )}

      {/* mírelo por donde lo mire (solo en Go) */}
      {!pro && stratVals[3].ok && (
        <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}><span style={{ fontWeight: 700, fontSize: 14 }}>Mírelo por donde lo mire</span><span style={{ flex: 1 }} /><span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-2)" }}>gana en {winsWon} de {winData.length}</span></div>
          {winData.map((d, i) => { const mx = Math.max(...winData.map(x => Math.abs(x.edge))) || 1; return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{ width: 96, fontSize: 12.5, color: "var(--ink-2)" }}>{d.l}</span>
              <div style={{ flex: 1, height: 16, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.abs(d.edge) / mx * 100}%`, height: "100%", background: d.win ? "var(--brand)" : "#C24B3A" }} /></div>
              <span className="num" style={{ width: 92, textAlign: "right", fontSize: 13, fontWeight: 700, color: d.win ? "var(--brand-2)" : "#B0402A" }}>{d.edge >= 0 ? "+" : ""}{DE.fmt.usd(d.edge)}</span>
              <span style={{ width: 16, textAlign: "center", color: d.win ? "var(--brand-2)" : "#B0402A", fontWeight: 700 }}>{d.win ? "✓" : "✗"}</span>
            </div>
          ); })}
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>Ventaja en USD del reparto inteligente vs. mensual, con tu mismo presupuesto, en cada ventana histórica.</div>
        </div>
      )}

      {/* proyección futura */}
      {(() => { const base = projectDca(B, months, 0.15), lo = projectDca(B, months, 0.05), hi = projectDca(B, months, 0.30); return (
        <div style={{ background: "var(--card)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Si mantienes este aporte…</span>
            <window.HelpS title="Proyección" text="Estima cuánto habrás aportado y cuánto podría valer manteniendo el aporte mensual. Escenarios ilustrativos con distintas tasas anuales, no una predicción." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 10 }}>
            <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "12px 14px" }}><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Habrás aportado</div><div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{DE.fmt.usd(base.invested)}</div></div>
            <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "12px 14px" }}><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Valor estimado</div><div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: "var(--brand-2)" }}>{DE.fmt.usd(base.fv)}</div><div style={{ fontSize: 11, color: "var(--ink-3)" }}>base 15%/año</div></div>
            <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "12px 14px" }}><div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Rango</div><div className="num" style={{ fontSize: 13.5, fontWeight: 700, marginTop: 6 }}>{DE.fmt.usd(lo.fv)} – {DE.fmt.usd(hi.fv)}</div></div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.5 }}>Escenarios ilustrativos con interés compuesto sobre tus aportes. No es una predicción ni una promesa.</div>
        </div>
      ); })()}

      <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.6, marginTop: 12 }}>Nunca se invierte más que tu presupuesto mensual. El reparto inteligente <b>ahorra en USD</b>, coloca todo lo acumulado cuando el <b>STH</b> marca acumulación y <b>asegura por tramos</b> cuando el ciclo (LTH) supera 80 de 100 — la misma regla del Plan de salida — y ese dinero asegurado <b>se reinvierte en la siguiente zona fría</b>: vender arriba y recomprar abajo es lo que compone la ventaja en dólares. No es asesoramiento financiero.</div>
    </div>
  );
}
function TwoLineChart_placeholder() { return null; }

/* ---------- evidencia del backtest que sustenta la regla inteligente ---------- */
function BacktestEvidence({ rowsAsset }) {
  const H = window.BambuHistory;
  if (!H || !H.realBacktest) return null;
  const stats = rowsAsset.map(r => {
    const bt = H.realBacktest(27, r.asset.type, "COMBO") || [];
    const buys = bt.filter(d => d.mov != null && d.sig.indexOf("COMPRA") >= 0);
    const sells = bt.filter(d => d.mov != null && (d.sig.indexOf("VENTA") >= 0 || d.sig === "REDUCIR"));
    return {
      tk: r.asset.ticker,
      buyN: buys.length, buyHits: buys.filter(d => d.mov > 0).length,
      sellN: sells.length, sellHits: sells.filter(d => d.mov < 0).length,
    };
  }).filter(s => s.buyN + s.sellN > 0);
  if (!stats.length) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#15201A,#22402F)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, color: "#EDE7D2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>La regla nace del backtest</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", background: "rgba(255,255,255,.14)", borderRadius: 100, padding: "3px 10px" }}>EVIDENCIA HISTÓRICA</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "#C2D2C6", marginTop: 8 }}>
        El DCA inteligente no es una opinión: aplica automáticamente lo que el backtest demostró en los puntos de inflexión reales desde 2013 — <b style={{ color: "#fff" }}>comprar cuando el modelo marcó acumulación</b> y <b style={{ color: "#fff" }}>asegurar a USD cuando marcó distribución</b> (ciclo sobre 80 de 100, la regla del Plan de salida).
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 12, flexWrap: "wrap" }}>
        {stats.map(s => (
          <React.Fragment key={s.tk}>
            <div><div className="num" style={{ fontSize: 21, fontWeight: 700, color: "#8FD4A8" }}>{s.buyHits}/{s.buyN}</div><div style={{ fontSize: 11, color: "#9FC4A9" }}>compras acertadas · {s.tk}</div></div>
            <div><div className="num" style={{ fontSize: 21, fontWeight: 700, color: "#E8B686" }}>{s.sellHits}/{s.sellN}</div><div style={{ fontSize: 11, color: "#9FC4A9" }}>ventas acertadas · {s.tk}</div></div>
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }}></div>
        <div style={{ fontSize: 11.5, color: "#9FC4A9", alignSelf: "center", maxWidth: 260 }}>Zona medida en los puntos de inflexión históricos, resultado a 90 días. Detalle completo en la sección Backtest.</div>
      </div>
    </div>
  );
}
Object.assign(window, { DcaPlan, TwoLineChart, simDCA });
