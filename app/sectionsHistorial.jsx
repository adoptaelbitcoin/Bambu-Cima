/* ============================================================
   BAMBÚ · Historial de resúmenes diarios (desde 2017)
   Reconstruye, para cada día, la lectura que Bambu habría dado:
   temperatura STH/LTH, zona y veredicto — con los datos reales.
   ============================================================ */

const HIST_START = "2017-01-01";

function histVerdict(sthTemp, lthTemp) {
  const mt = (sthTemp + lthTemp) / 2;
  if (mt < 20) return { stance: "ACUMULAR", short: "Comprar con convicción", t: mt };
  if (mt < 40) return { stance: "ACUMULAR", short: "Comprar por tramos", t: mt };
  if (mt < 60) return { stance: "MANTENER", short: "Sin ventaja clara", t: mt };
  if (mt < 80) return { stance: "REDUCIR/DISTRIBUIR", short: "Asegurar parte", t: mt };
  return { stance: "REDUCIR/DISTRIBUIR", short: "Repartir salidas", t: mt };
}

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
      const res = E.computeAsset({ type, values: vals }, { k: 27 });
      /* las columnas y el veredicto viven en la escala publicada 0-100 */
      const rS = window.BambuHistory.zoneOf(res.sth.temp, type, "sth", 27);
      const rL = window.BambuHistory.zoneOf(res.lth.temp, type, "lth", 27);
      const v = histVerdict(rS.rank, rL.rank);
      const prev = i > 0 ? R.cols.price[i - 1] : null;
      out.push({
        iso, label: R.labelEs(iso), price: vals.price,
        chg: prev ? ((vals.price - prev) / prev) * 100 : null,
        sthTemp: rS.rank, lthTemp: rL.rank,
        sthZone: rS.label, lthZone: rL.label,
        stance: v.stance, short: v.short, mt: v.t,
      });
    }
    return out.reverse();
  }, [R, type, year, E]);

  const filtered = React.useMemo(() => q === "todos" ? rows : rows.filter(r => r.stance === q), [rows, q]);

  const stats = React.useMemo(() => {
    const c = { ACUMULAR: 0, MANTENER: 0, "REDUCIR/DISTRIBUIR": 0 };
    rows.forEach(r => c[r.stance]++);
    const n = rows.length || 1;
    const first = rows[rows.length - 1], last = rows[0];
    const yr = first && last && first.price ? ((last.price - first.price) / first.price) * 100 : null;
    return { c, n, pct: k => Math.round((c[k] / n) * 100), yr, first, last };
  }, [rows]);

  const stanceCol = s => s === "ACUMULAR" ? "#2F7D5B" : s === "REDUCIR/DISTRIBUIR" ? "#C0492E" : "#7A8A80";

  const exportCsv = () => {
    const head = ["Fecha", "Precio USD", "Var %", "Lectura STH /100", "Lectura LTH /100", "Zona STH", "Zona LTH", "Veredicto", "Acción"];
    const body = filtered.map(r => [r.iso, r.price != null ? r.price.toFixed(2) : "", r.chg != null ? r.chg.toFixed(2) : "",
      r.sthTemp.toFixed(1), r.lthTemp.toFixed(1), r.sthZone, r.lthZone, r.stance, r.short]);
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
          <p>Qué habría dicho Bambu cada día, con los datos de ese día · desde 1 de enero de 2017</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="seg">
            {["BTC", "ETH"].map(t => <button key={t} className={"seg-btn" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t}</button>)}
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

      {/* resumen del año */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 16 }}>
        <KPI lab="Días con lectura" val={stats.n} mono meta={<span className="tiny muted">en {year}</span>} />
        <KPI lab="Días en acumulación" mono val={stats.pct("ACUMULAR") + "%"} valStyle={{ color: "#2F7D5B" }} meta={<span className="tiny muted">{stats.c.ACUMULAR} días fríos</span>} />
        <KPI lab="Días neutrales" mono val={stats.pct("MANTENER") + "%"} valStyle={{ color: "#7A8A80" }} meta={<span className="tiny muted">{stats.c.MANTENER} días sin ventaja</span>} />
        <KPI lab="Días en distribución" mono val={stats.pct("REDUCIR/DISTRIBUIR") + "%"} valStyle={{ color: "#C0492E" }} meta={<span className="tiny muted">{stats.c["REDUCIR/DISTRIBUIR"]} días calientes</span>} />
        <KPI lab={`${type} en el año`} mono val={stats.yr == null ? "—" : (stats.yr > 0 ? "+" : "") + stats.yr.toFixed(0) + "%"} valStyle={{ color: stats.yr > 0 ? "#2F7D5B" : "#C0492E" }} meta={<span className="tiny muted">{stats.first ? stats.first.label : ""} → {stats.last ? stats.last.label : ""}</span>} />
      </div>

      <Card title={`Lectura día a día · ${type} · ${year}`} sub={`${filtered.length} días${q === "todos" ? "" : " · filtrado"} · del más reciente al más antiguo`} pad={false}>
        <div style={{ maxHeight: 620, overflow: "auto" }}>
          <table className="tbl">
            <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--card)" }}>
              <tr>
                <th>Fecha</th><th className="c">Precio</th><th className="c">Var</th>
                <th className="c">STH /100</th><th className="c">LTH /100</th>
                <th className="c">Veredicto</th><th>Qué decía</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sc = E.tempColor(r.sthTemp, palette), lc = E.tempColor(r.lthTemp, palette), vc = stanceCol(r.stance);
                return (
                  <tr key={r.iso}>
                    <td className="tiny" style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{r.label}</td>
                    <td className="c num">{r.price == null ? "—" : "$" + r.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                    <td className="c num tiny" style={{ color: r.chg == null ? "var(--ink-3)" : r.chg >= 0 ? "#2F7D5B" : "#C0492E" }}>{r.chg == null ? "—" : (r.chg > 0 ? "+" : "") + r.chg.toFixed(1) + "%"}</td>
                    <td className="c"><span className="badge num" style={{ background: mixSoft(sc), color: sc, fontWeight: 700 }}>{r.sthTemp.toFixed(0)}</span></td>
                    <td className="c"><span className="badge num" style={{ background: mixSoft(lc), color: lc, fontWeight: 700 }}>{r.lthTemp.toFixed(0)}</span></td>
                    <td className="c"><span className="badge" style={{ background: mixSoft(vc), color: vc, fontWeight: 700, whiteSpace: "nowrap" }}>{r.stance}</span></td>
                    <td className="tiny muted">{r.short}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tiny muted" style={{ padding: "10px 14px", lineHeight: 1.5 }}>
          Cómo leerlo: cada fila es la lectura que el modelo habría dado <b>ese día</b>, calculada solo con los datos disponibles hasta entonces. Compara los años de suelo (mayoría de días fríos) con los de techo (mayoría calientes). Resultados pasados no garantizan resultados futuros.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SectionHistorial });
