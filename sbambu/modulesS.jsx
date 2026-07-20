/* ============================================================
   BAMBU GO · Módulos — Mi cartera (G/P) + teaser backtesting
   ============================================================ */
const ME = window.BambuEngine;
const MPAL = "sobria";
const LKEY = "bambus_ledger_v1";
const PKEY = "bambus_prices_v1";

function loadJSON(k, def) { try { const s = localStorage.getItem(k); if (s) return JSON.parse(s); } catch (e) {} return def; }

/* ---------- Mi cartera: seguimiento de ganancias y pérdidas ---------- */
function Ledger({ prices, temps }) {
  const [entries, setEntries] = React.useState(() => loadJSON(LKEY, []));
  const [manual, setManual] = React.useState(() => loadJSON(PKEY, {}));   // precios manuales de otras monedas
  const [mode, setMode] = React.useState("BTC");                            // BTC | ETH | custom
  const [customTk, setCustomTk] = React.useState("");
  const [side, setSide] = React.useState("buy");
  const [units, setUnits] = React.useState("");
  const [price, setPrice] = React.useState("");

  React.useEffect(() => { try { localStorage.setItem(LKEY, JSON.stringify(entries)); } catch (e) {} }, [entries]);
  React.useEffect(() => { try { localStorage.setItem(PKEY, JSON.stringify(manual)); } catch (e) {} }, [manual]);
  React.useEffect(() => { if (mode === "BTC" || mode === "ETH") setPrice(String(prices[mode] || "")); else setPrice(""); }, [mode]);

  const ticker = mode === "custom" ? (customTk || "").toUpperCase().trim() : mode;
  const curPrice = tk => prices[tk] != null ? prices[tk] : (manual[tk] || 0);

  const add = () => {
    const u = parseFloat(units), p = parseFloat(price);
    if (!ticker || !u || u <= 0 || !p || p <= 0) return;
    setEntries(e => [{ id: Date.now(), asset: ticker, side, units: u, price: p, ts: Date.now() }, ...e]);
    if (mode === "custom" && manual[ticker] == null) setManual(m => ({ ...m, [ticker]: p })); // siembra precio actual editable
    setUnits("");
  };
  const del = id => setEntries(e => e.filter(x => x.id !== id));
  const setManualPrice = (tk, val) => setManual(m => ({ ...m, [tk]: parseFloat(val) || 0 }));
  // liquidar: vende toda la posición al precio actual y realiza la utilidad
  const liquidate = (tk, net, cur) => {
    if (!(net > 0) || !(cur > 0)) return;
    setEntries(e => [{ id: Date.now(), asset: tk, side: "sell", units: net, price: cur, ts: Date.now(), liq: true }, ...e]);
  };

  // resumen por moneda (dinámico: todas las que aparezcan en el historial)
  const tickers = React.useMemo(() => [...new Set(entries.map(e => e.asset))], [entries]);
  const summary = React.useMemo(() => {
    const out = {};
    tickers.forEach(a => {
      const es = entries.filter(x => x.asset === a);
      let bu = 0, bc = 0, su = 0, sp = 0;
      es.forEach(x => { if (x.side === "buy") { bu += x.units; bc += x.units * x.price; } else { su += x.units; sp += x.units * x.price; } });
      const avg = bu ? bc / bu : 0;
      const net = bu - su;
      const cur = curPrice(a);
      const value = net * cur;
      const cost = net * avg;
      const unreal = value - cost;
      const unrealPct = cost ? (value / cost - 1) * 100 : 0;
      const realized = sp - su * avg;
      out[a] = { es, net, avg, value, cost, unreal, unrealPct, realized, cur, model: prices[a] != null };
    });
    return out;
  }, [entries, tickers, manual, prices]);

  // totales de cartera
  const tot = React.useMemo(() => {
    let value = 0, cost = 0, realized = 0;
    tickers.forEach(a => { const s = summary[a]; value += s.value; cost += s.cost; realized += s.realized; });
    return { value, cost, unreal: value - cost, pct: cost ? (value / cost - 1) * 100 : 0, realized };
  }, [summary, tickers]);

  const hasData = tickers.length > 0;
  const curTemp = (mode === "BTC" || mode === "ETH") ? temps[mode] : null;
  const curCol = curTemp != null ? ME.tempColor(curTemp, MPAL) : "var(--ink-3)";
  const zoneWord = curTemp == null ? null : curTemp < 40 ? "fría (barato)" : curTemp < 60 ? "neutral" : "caliente (caro)";

  const fld = { fontFamily: "var(--mono)", fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--card)", color: "var(--ink)", width: "100%" };
  const seg = on => ({ flex: 1, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5, padding: "9px 8px", borderRadius: 9, border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" });

  return (
    <div>
      {/* resumen global de la cartera */}
      {hasData && (
        <div style={{ background: "linear-gradient(150deg,#16241C,#1E3A2C)", color: "#E7ECE6", borderRadius: 16, padding: "20px 22px", marginBottom: 14, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9FC4A9" }}>Valor actual de la cartera</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
            <span className="num" style={{ fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{ME.fmt.usd(tot.value)}</span>
            <span className="num" style={{ fontSize: 16, fontWeight: 700, color: tot.unreal >= 0 ? "#7BD0A0" : "#E98A7A" }}>{tot.unreal >= 0 ? "+" : ""}{ME.fmt.usd(tot.unreal)} ({tot.pct >= 0 ? "+" : ""}{tot.pct.toFixed(1)}%)</span>
          </div>
          <div className="num" style={{ fontSize: 12.5, color: "#A8BCAD", marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Invertido (posición actual): {ME.fmt.usd(tot.cost)}</span>
            {Math.abs(tot.realized) > 0.5 && <span>Ganancia realizada: {tot.realized >= 0 ? "+" : ""}{ME.fmt.usd(tot.realized)}</span>}
          </div>
        </div>
      )}

      {/* tarjetas por moneda */}
      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginBottom: 14 }}>
          {tickers.map(a => {
            const s = summary[a];
            return (
              <div key={a} style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "15px 17px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{a}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.net.toFixed(4)} uds</span>
                  {!s.model && <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--gold)", border: "1px dashed rgba(185,141,32,.5)", borderRadius: 5, padding: "1px 5px", marginLeft: "auto" }}>manual</span>}
                </div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 7, lineHeight: 1 }}>{ME.fmt.usd(s.value)}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 4 }}>
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: s.unreal >= 0 ? "var(--brand-2)" : "#B0402A" }}>{s.unreal >= 0 ? "+" : ""}{ME.fmt.usd(s.unreal)}</span>
                  <span className="num" style={{ fontSize: 12, color: s.unreal >= 0 ? "var(--brand-2)" : "#B0402A" }}>({s.unrealPct >= 0 ? "+" : ""}{s.unrealPct.toFixed(1)}%)</span>
                </div>
                <div className="num" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>Precio medio {ME.fmt.usd(s.avg)}</div>
                {s.model ? (
                  <div className="num" style={{ fontSize: 11, color: "var(--ink-3)" }}>Precio ahora {ME.fmt.usd(s.cur)}</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Precio ahora</span>
                    <input type="number" value={manual[a] || ""} onChange={e => setManualPrice(a, e.target.value)}
                      style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "4px 7px", borderRadius: 7, border: "1px solid var(--border-2)", width: 92, background: "var(--card)", color: "var(--ink)" }} />
                  </div>
                )}
                {Math.abs(s.realized) > 0.5 && (
                  <div className="num" style={{ fontSize: 11.5, marginTop: 6, color: s.realized >= 0 ? "var(--brand-2)" : "#B0402A", fontWeight: 600 }}>Utilidad realizada: {s.realized >= 0 ? "+" : ""}{ME.fmt.usd(s.realized)}</div>
                )}
                {s.net > 0.0000001 && s.cur > 0 && (
                  <button onClick={() => liquidate(a, s.net, s.cur)} title={`Vender ${s.net.toFixed(4)} ${a} a ${ME.fmt.usd(s.cur)}`}
                    style={{ marginTop: 11, width: "100%", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 12.5, padding: "9px 10px", borderRadius: 9, border: `1.5px solid ${s.unreal >= 0 ? "var(--brand)" : "#C9856F"}`, background: s.unreal >= 0 ? "var(--brand-soft)" : "#FBEEE9", color: s.unreal >= 0 ? "var(--brand-ink)" : "#8f3320" }}>
                    Liquidar ahora · {s.unreal >= 0 ? "+" : ""}{ME.fmt.usd(s.unreal)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* formulario */}
      <div style={{ background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setMode("BTC")} style={seg(mode === "BTC")}>BTC</button>
          <button onClick={() => setMode("ETH")} style={seg(mode === "ETH")}>ETH</button>
          <button onClick={() => setMode("custom")} style={seg(mode === "custom")}>+ Otra moneda</button>
          <span style={{ width: 10 }} />
          <button onClick={() => setSide("buy")} style={seg(side === "buy")}>Compra</button>
          <button onClick={() => setSide("sell")} style={seg(side === "sell")}>Venta</button>
        </div>
        {mode === "custom" && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Nombre / símbolo de la moneda</label>
            <input style={fld} type="text" value={customTk} onChange={e => setCustomTk(e.target.value)} placeholder="p. ej. SOL, ADA, LINK…" maxLength={8} />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Cantidad {ticker ? `(${ticker})` : ""}</label>
            <input style={fld} type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>Precio (USD)</label>
            <input style={fld} type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
          </div>
          <button onClick={add} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff" }}>Añadir</button>
        </div>
        {zoneWord && (
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 11, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: curCol, flex: "none" }} />
            Hoy {mode} está en zona <b style={{ color: curCol }}>{zoneWord}</b> ({Math.round(curTemp)}°). {side === "buy" ? "Comprar en zona fría mejora tu precio medio." : "Vender en zona caliente asegura ganancias."}
          </div>
        )}
        {mode === "custom" && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 11, lineHeight: 1.5 }}>Bambu Go solo analiza BTC y ETH; para otras monedas registras el precio manualmente y la herramienta calcula tus ganancias y pérdidas.</div>}
      </div>

      {/* historial */}
      {entries.length > 0 && (
        <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", overflow: "hidden", marginTop: 14 }}>
          {entries.slice(0, 30).map((x, i) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: x.side === "buy" ? "var(--brand-2)" : "#B0402A", background: x.side === "buy" ? "var(--brand-soft)" : "#FBEEE9", borderRadius: 100, padding: "3px 9px" }}>{x.side === "buy" ? "COMPRA" : "VENTA"}</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{x.asset}</span>
              <span className="num" style={{ fontSize: 13, color: "var(--ink-2)" }}>{x.units} × {ME.fmt.usd(x.price)}</span>
              <span style={{ flex: 1 }} />
              <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{ME.fmt.usd(x.units * x.price)}</span>
              <button onClick={() => del(x.id)} title="Eliminar" style={{ cursor: "pointer", border: "none", background: "none", color: "var(--ink-3)", fontSize: 17, lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Teaser de backtesting → Bambu + ---------- */
function BacktestTeaser({ type }) {
  const H = window.BambuHistory;
  const sSTH = H.realStats(27, type, "STH");
  const sLTH = H.realStats(27, type, "LTH");
  const openPlus = () => { try { localStorage.setItem("bambu_page", "backtest"); } catch (e) {} window.location.href = "Bambu-Dashboard.html"; };

  const Stat = ({ lab, s }) => (
    <div style={{ flex: 1, textAlign: "center", padding: "14px 10px" }}>
      <div className="num" style={{ fontSize: 30, fontWeight: 700, color: "var(--brand-2)", lineHeight: 1 }}>{s ? Math.round(s.hitRate * 100) : "—"}%</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 5 }}>{lab}</div>
      <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{s ? `${s.hits}/${s.n} lecturas` : ""}</div>
    </div>
  );

  return (
    <div style={{ background: "linear-gradient(150deg,#16241C,#1E3A2C)", borderRadius: 18, padding: "24px 26px", color: "#E7ECE6", boxShadow: "var(--shadow-lg)" }}>
      <div style={{ fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#9FC4A9" }}>¿Se puede confiar en el modelo?</div>
      <h2 style={{ fontSize: 21, fontWeight: 700, margin: "6px 0 4px", color: "#fff", letterSpacing: "-.01em" }}>Cuánto acierta esta lectura en {type}</h2>
      <p style={{ fontSize: 13.5, color: "#C2D2C6", margin: "0 0 4px", maxWidth: "60ch", lineHeight: 1.55 }}>Reconstruido sobre los puntos de inflexión reales de {type} desde 2013: cuántas veces la dirección de la lectura acertó.</p>
      <div style={{ display: "flex", gap: 8, margin: "14px 0", background: "rgba(255,255,255,.05)", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
        <Stat lab="Acierto corto plazo · STH" s={sSTH} />
        <div style={{ width: 1, background: "rgba(255,255,255,.1)" }} />
        <Stat lab="Acierto largo plazo · LTH" s={sLTH} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Prueba el backtesting interactivo</div>
          <div style={{ fontSize: 12.5, color: "#A8BCAD", marginTop: 2, lineHeight: 1.5 }}>Elige cualquier fecha, horizonte y estrategia y mide el resultado tú mismo. Disponible en <b style={{ color: "#EAD98A" }}>Bambu +</b>.</div>
        </div>
        <button onClick={openPlus} style={{ cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14, padding: "13px 22px", borderRadius: 11, border: "none", background: "linear-gradient(180deg,#EAD98A,#C9A227)", color: "#26200A", boxShadow: "0 6px 18px rgba(201,162,39,.3)" }}>Abrir Bambu + →</button>
      </div>
    </div>
  );
}

/* ---------- Prueba de resultados: todos los puntos STH y LTH ---------- */
function sigPill(comp) {
  const DD = window.BambuData, temp = ME.temperature(comp, 27), sig = ME.signalFor(comp), col = ME.tempColor(temp, MPAL);
  return <span className="num" style={{ fontSize: 11, fontWeight: 700, color: col, background: ME.mix(col, "#FFFFFF", .85), border: `1px solid ${ME.mix(col, "#FFFFFF", .6)}`, borderRadius: 100, padding: "3px 9px", whiteSpace: "nowrap" }}>{(DD.SIGNALS[sig] || {}).short || sig}</span>;
}
/* historia de inversión: $10.000 siguiendo los colores vs comprar-y-guardar */
function investStory(type) {
  const H = window.BambuHistory, EG = window.BambuEngine;
  const R = H.realOf && H.realOf(type); if (!R) return null;
  const rows = R.lastDays(99999); if (!rows || rows.length < 60) return null;
  const step = Math.max(1, Math.floor(rows.length / 320));
  const pts = []; for (let i = 0; i < rows.length; i += step) pts.push(rows[i]);
  const price = p => p.values.price;
  const temp = p => { const res = EG.computeAsset({ type, values: p.values }, { k: 27 }); return res.sth.temp * 0.2 + res.lth.temp * 0.8; };
  const START = 10000;
  const p0 = price(pts[0]);
  let units = START / p0, cash = 0, inMarket = true, moves = 0;
  pts.forEach(p => {
    const t = temp(p), pr = price(p);
    if (inMarket && t > 70) { cash = units * pr; units = 0; inMarket = false; moves++; }
    else if (!inMarket && t < 42) { units = cash / pr; cash = 0; inMarket = true; moves++; }
  });
  const lp = price(pts[pts.length - 1]);
  const follow = units * lp + cash;
  const hold = (START / p0) * lp;
  const years = Math.max(1, Math.round(pts.length * step / 365));
  return { follow, hold, years, moves, start: START, firstIso: rows[0].iso };
}

function BacktestProof({ defaultType }) {
  const H = window.BambuHistory;
  const [type, setType] = React.useState(defaultType || "BTC");
  const bt = React.useMemo(() => (H.realBacktest(27, type, "COMBO") || []), [type]);
  const sSTH = H.realStats(27, type, "STH"), sLTH = H.realStats(27, type, "LTH");
  const dirOf = comp => comp > 0.05 ? 1 : comp < -0.05 ? -1 : 0;
  const seg = on => ({ cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, padding: "7px 16px", borderRadius: 9, border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--border-2)", background: on ? "var(--brand-soft)" : "var(--card)", color: on ? "var(--brand-ink)" : "var(--ink-3)" });
  const th = { textAlign: "left", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600, padding: "0 10px 8px" };
  const td = { padding: "10px", borderTop: "1px solid var(--border)", fontSize: 13, verticalAlign: "middle" };

  return (
    <div>
      {/* historia de inversión */}
      {(() => {
        const st = investStory(type); if (!st) return null;
        const win = st.follow >= st.hold;
        return (
          <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>La prueba, contada como inversión</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.55 }}>Imagina {ME.fmt.usd(st.start)} en {type} desde {st.firstIso.slice(0, 4)} ({st.years} años): siguiendo los colores de Bambu (invertido en frío, a USD en euforia — solo {st.moves} movimientos en total) frente a comprar y no tocar:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--brand-soft)", border: "1px solid #CFE3D3", borderRadius: 11, padding: "13px 15px" }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--brand-2)" }}>Siguiendo los colores</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 3, color: "var(--brand-ink)" }}>{ME.fmt.usd(st.follow)}</div>
              </div>
              <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "13px 15px" }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--ink-3)" }}>Comprar y no tocar</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, marginTop: 3 }}>{ME.fmt.usd(st.hold)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, marginTop: 10, color: win ? "var(--brand-2)" : "var(--ink-2)", fontWeight: 600 }}>{win ? `+${ME.fmt.usd(st.follow - st.hold)} extra por seguir los colores — sin mirar el mercado a diario.` : `En esta ventana, comprar y no tocar ganó por ${ME.fmt.usd(st.hold - st.follow)}. La ventaja de los colores está en evitar las caídas profundas.`}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>Simulación sobre datos reales, sin costes de transacción. Rendimientos pasados no garantizan resultados futuros.</div>
          </div>
        );
      })()}

      {/* selector activo + aciertos */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => setType("BTC")} style={seg(type === "BTC")}>BTC</button>
          <button onClick={() => setType("ETH")} style={seg(type === "ETH")}>ETH</button>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-2)" }}>{sSTH ? Math.round(sSTH.hitRate * 100) : "—"}%</div><div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Acierto STH ({sSTH ? sSTH.n : 0})</div></div>
          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-2)" }}>{sLTH ? Math.round(sLTH.hitRate * 100) : "—"}%</div><div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>Acierto LTH ({sLTH ? sLTH.n : 0})</div></div>
        </div>
      </div>

      {/* tabla de todos los puntos */}
      <div style={{ background: "var(--card)", borderRadius: 14, boxShadow: "var(--shadow)", padding: "16px 8px 8px", overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fecha · evento</th>
              <th style={{ ...th, textAlign: "right" }}>Precio</th>
              <th style={{ ...th, textAlign: "center" }}>STH</th>
              <th style={{ ...th, textAlign: "center" }}>LTH</th>
              <th style={{ ...th, textAlign: "right" }}>90 días</th>
              <th style={{ ...th, textAlign: "center" }}>Acierto</th>
            </tr>
          </thead>
          <tbody>
            {bt.map((p, i) => {
              const hit = p.mov == null ? null : (dirOf(p.comp) === 0 ? null : (dirOf(p.comp) > 0 ? p.mov > 0 : p.mov < 0));
              return (
                <tr key={i} style={p.today ? { background: "var(--brand-soft)" } : null}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{p.evt}</div>
                    <div className="num" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.date}</div>
                  </td>
                  <td style={{ ...td, textAlign: "right" }} className="num">{ME.fmt.usd(p.price)}</td>
                  <td style={{ ...td, textAlign: "center" }}>{sigPill(p.sth)}</td>
                  <td style={{ ...td, textAlign: "center" }}>{sigPill(p.lth)}</td>
                  <td style={{ ...td, textAlign: "right" }} className="num">
                    {p.mov == null ? <span style={{ color: "var(--ink-3)" }}>en curso</span> : <span style={{ fontWeight: 700, color: p.mov >= 0 ? "var(--brand-2)" : "#B0402A" }}>{p.mov >= 0 ? "+" : ""}{p.mov.toFixed(0)}%</span>}
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                    {hit == null ? <span style={{ color: "var(--ink-3)" }}>—</span> : hit ? <span style={{ color: "var(--brand-2)" }}>✓</span> : <span style={{ color: "#B0402A" }}>✗</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>Cada fila es un punto de inflexión real de {type} (capitulaciones y techos) desde 2013, con la señal que el modelo daba en corto (STH) y largo (LTH) plazo y el movimiento del precio en los 90 días siguientes. La fila resaltada es la lectura de hoy. Rendimientos pasados no garantizan resultados futuros.</div>
    </div>
  );
}

Object.assign(window, { Ledger, BacktestTeaser, BacktestProof });
