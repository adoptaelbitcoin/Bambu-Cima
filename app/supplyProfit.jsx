/* BAMBÚ · Supply in Profit del corto (STH % en ganancia) · EMA 30/60/90 */
function SupplyProfitCard({ type }) {
  const R = window.BambuRealData[type];
  const [rng, setRng] = React.useState("365");
  if (!R || !R.cols.spProfE30 || !window.RcLine) return null;
  const C = R.cols;
  let last = R.count - 1; while (last > 0 && C.spProfE30[last] == null) last--;
  const first = (() => { let f = 0; while (f < last && C.spProfE30[f] == null) f++; return f; })();
  const n = rng === "max" ? last - first + 1 : Math.min(+rng, last - first + 1), i0 = last - n + 1;
  const sl = k => C[k].slice(i0, last + 1);
  const v = k => C[k][last], f1 = x => x == null ? "—" : x.toFixed(1).replace(".", ",");
  const e30 = v("spProfE30"), e60 = v("spProfE60"), e90 = v("spProfE90"), raw = v("spProf");
  const prev = k => C[k][last - 7];
  const state = e30 > 90 ? ["Euforia", "#C0392B"] : e30 < 20 ? ["Capitulación", "#1F4E9C"] : e30 < 40 ? ["Miedo", "#5A8FD6"] : e30 > 80 ? ["Calor alto", "#EE9B4A"] : e30 > 60 ? ["Calor", "#D69A40"] : ["Neutral", "#8A918B"];
  const cross = e30 > e90 ? "EMA30 sobre EMA90: la ganancia del corto va ganando fuerza" : "EMA30 bajo EMA90: la ganancia del corto se está enfriando";
  const iso = R.dates[last], fd = new Date(iso + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const Stat = ({ lab, val, d }) => (<div><div className="tiny muted">{lab}</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{f1(val)}%</div>{d != null && <div className="tiny" style={{ color: d >= 0 ? "var(--brand)" : "#A83C26" }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1).replace(".", ",")} pts en 7 d</div>}</div>);
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Supply in Profit del corto · {type}</div>
          <div className="tiny muted">Porcentaje de las monedas recientes (STH) que hoy están en ganancia · datos al {fd} · 0 capitulación, 100 euforia</div>
        </div>
        <div className="seg">{[["180", "180 d"], ["365", "1 año"], ["730", "2 años"], ["1460", "4 años"], ["max", "Máx."]].map(([k, l]) => <button key={k} className={rng === k ? "on" : ""} onClick={() => setRng(k)}>{l}</button>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 14, alignItems: "end" }}>
        <Stat lab="EMA 30" val={e30} d={prev("spProfE30") != null ? e30 - prev("spProfE30") : null} />
        <Stat lab="EMA 60" val={e60} d={prev("spProfE60") != null ? e60 - prev("spProfE60") : null} />
        <Stat lab="EMA 90" val={e90} d={prev("spProfE90") != null ? e90 - prev("spProfE90") : null} />
        <Stat lab="Valor diario" val={raw} />
        <div><div className="tiny muted">Lectura</div><span className="pill" style={{ background: state[1], color: "#fff", fontWeight: 700 }}>{state[0]}</span></div>
      </div>
      <window.RcLine dates={R.dates.slice(i0, last + 1)} height={230} lo={0} hi={100} fmt={x => x.toFixed(0) + "%"}
        bands={[[90, 100, "#c0392b", .16], [60, 90, "#ee9b4a", .08], [20, 40, "#8fc0f0", .16], [0, 20, "#1f4e9c", .16]]}
        series={[{ vals: sl("spProf"), color: "#B8BDB8", label: "Valor diario", width: 1 }, { vals: sl("spProfE30"), color: "#3d6fbf", label: "EMA 30", width: 2 }, { vals: sl("spProfE60"), color: "#3E7C57", label: "EMA 60", width: 1.8 }, { vals: sl("spProfE90"), color: "#141714", label: "EMA 90", width: 1.8, dash: "5 3" }]} />
      <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.55 }}>{cross}. Zonas: sobre 90 euforia (rojo), bajo 20 capitulación (azul oscuro). Es una capa de contexto: mide casi lo mismo que la desviación sobre el coste STH, así que no entra al índice.</div>
    </div>
  );
}
Object.assign(window, { SupplyProfitCard });
