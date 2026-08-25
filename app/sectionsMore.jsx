/* ============================================================
   BAMBÚ · Secciones — Heatmap, Backtest, Estadísticas, Sizing
   ============================================================ */

/* ---------- leyenda de zonas reutilizable ----------
   Usa las bandas calibradas por percentiles del activo cuando se le pasan. */
function ZoneLegend({ palette, current, horizontal, bands }) {
  const Z = bands || DD.ZONES;
  const fmt = v => (Math.round(v * 10) / 10).toFixed(0);
  const PHASE = { fria: "Capitulación", temprana: "Acumulación", neutral: "Equilibrio", calida: "Distribución temprana", caliente: "Distribución" };
  const ACT = { fria: "Comprar con convicción", temprana: "Acumular en tramos", neutral: "Mantener", calida: "Reducir gradual", caliente: "Distribuir" };
  if (horizontal) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Z.length}, 1fr)`, gap: 10 }}>
        {Z.map(z => {
          const col = E.tempColor(z.temp, palette);
          const on = current && current.id === z.id;
          return (
            <div key={z.id} style={{ padding: "10px 11px", borderRadius: 9, background: on ? mixSoft(col, .8) : "var(--surface-3)", border: on ? `1px solid ${mixSoft(col, .55)}` : "1px solid transparent" }}>
              <div style={{ height: 8, borderRadius: 4, background: col, marginBottom: 8 }} />
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{z.label}</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>{z.phase || PHASE[z.id]}</div>
              <div className="num tiny muted" style={{ marginTop: 3 }}>{fmt(z.min)}–{fmt(z.max)}°</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {[...Z].reverse().map(z => {
        const col = E.tempColor(z.temp, palette);
        const on = current && current.id === z.id;
        return (
          <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 9px", borderRadius: 8, background: on ? mixSoft(col, .8) : "transparent", border: on ? `1px solid ${mixSoft(col, .55)}` : "1px solid transparent" }}>
            <span style={{ width: 30, height: 30, borderRadius: 7, background: col, flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{z.label}</div>
              <div className="tiny muted">{z.phase || PHASE[z.id]} → {z.action || ACT[z.id]}</div>
            </div>
            <span className="num tiny muted">{fmt(z.min)}–{fmt(z.max)}°</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- termómetro horizontal de mercado ----------
   La aguja se ubica por el percentil histórico (rank) para que "a la izquierda"
   signifique extremo frío real y "a la derecha" extremo caliente real. */
function HorizontalThermo({ temp, zone, palette, type, hz }) {
  const H = window.BambuHistory;
  const rank = (type && H && H.tempRank) ? H.tempRank(temp, type, hz || "lth", 27) : temp;
  const col = E.tempColor(rank, palette);
  const stops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const grad = "linear-gradient(90deg," + stops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
  const t = Math.max(0, Math.min(100, rank));
  const band = (type && H && H.bandsFor) ? H.bandOf(temp, H.bandsFor(type, hz || "lth", 27).bands) : null;
  const zz = (type && H && H.zoneOf) ? H.zoneOf(temp, type, hz || "lth") : {};
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      {/* lectura grande */}
      <div style={{ flex: "none", minWidth: 150 }}>
        <div className="num" style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1, color: col }}>{temp.toFixed(0)}°</div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 8, color: col }}>{band ? band.label : zone.label + " · " + zone.en}</div>
        <div className="tiny muted" style={{ marginTop: 4 }}>{(zz.phase || zone.phase)} → <strong style={{ color: "var(--ink)" }}>{zz.action || zone.action}</strong></div>
      </div>
      {/* barra horizontal */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{ position: "relative", height: 34, borderRadius: 8, background: grad, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>
          {/* aguja */}
          <div style={{ position: "absolute", left: t + "%", top: -6, bottom: -6, width: 5, background: "#1B2420", borderRadius: 3, transform: "translateX(-50%)", boxShadow: "0 0 0 2.5px #fff" }} />
          <div style={{ position: "absolute", left: t + "%", top: -26, transform: "translateX(-50%)", background: col, color: E.readableText(col), fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }} className="num">{temp.toFixed(0)}°</div>
        </div>
        <div className="gbar-scale" style={{ marginTop: 10 }}>
          <span>Extremo frío</span><span>Frío</span><span>Neutral</span><span>Cálido</span><span>Extremo caliente</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.45 }}>La posición es el <strong>percentil histórico</strong>: a la izquierda del todo significa que solo un puñado de días en la historia del activo estuvieron más fríos que hoy.</div>
      </div>
    </div>
  );
}

/* ============================================================
   HEATMAP DE ZONAS
   ============================================================ */
/* ---------- bandas de zona por horizonte ----------
   El LTH se mueve lento y en rango amplio: frío hasta 35, caliente desde 60.
   El STH oscila en un rango más estrecho, así que sus bandas se ajustan para que
   una lectura baja se lea como fría y una alta como caliente. */
const TEMP_BANDS = {
  lth: [
    { id: "fria",     min: 0,  max: 35,  label: "FRÍA · acumulación",   temp: 12 },
    { id: "temprana", min: 35, max: 47,  label: "TEMPRANA",             temp: 32 },
    { id: "neutral",  min: 47, max: 60,  label: "NEUTRAL",              temp: 50 },
    { id: "caliente", min: 60, max: 100, label: "CALIENTE · distribuir", temp: 82 },
  ],
  sth: [
    { id: "fria",     min: 0,  max: 30,  label: "FRÍA · acumulación",   temp: 12 },
    { id: "temprana", min: 30, max: 45,  label: "TEMPRANA",             temp: 32 },
    { id: "neutral",  min: 45, max: 60,  label: "NEUTRAL",              temp: 50 },
    { id: "caliente", min: 60, max: 100, label: "CALIENTE · distribuir", temp: 82 },
  ],
};

/* ---------- calibración compartida (history.js) ---------- */
function histBands(type, hz, k) { return window.BambuHistory.bandsFor(type, hz, k || 27); }
function bandFor(temp, bands) { return window.BambuHistory.bandOf(temp, bands); }

/* ---------- gráfica de temperatura con bandas de zona ---------- */
function TempChart({ data, palette, height = 132, bands, lo = 0, hi = 100 }) {
  const ZB = bands || DD.ZONES;
  const w = 440, pad = { l: 30, r: 76, t: 8, b: 18 };
  const n = data.length;
  const X = i => pad.l + (n <= 1 ? 0.5 : i / (n - 1)) * (w - pad.l - pad.r);
  const span = Math.max(1, hi - lo);
  const Y = t => pad.t + (1 - (Math.max(lo, Math.min(hi, t)) - lo) / span) * (height - pad.t - pad.b);
  const mid = Math.round((lo + hi) / 2);
  const pts = data.map((d, i) => `${X(i)},${Y(d.temp)}`).join(" ");
  const cur = data[n - 1];
  const curCol = E.tempColor(cur.temp, palette);
  const stride = Math.ceil(n / 5);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {/* bandas de zona (frío abajo→caliente arriba) */}
      {ZB.map(z => {
        const y0 = Y(z.max), y1 = Y(z.min), col = E.tempColor(z.temp, palette);
        return <rect key={z.id} x={pad.l} y={y0} width={w - pad.l - pad.r} height={y1 - y0} fill={mixSoft(col, 0.74)} />;
      })}
      {/* nombre de cada banda y su rango */}
      {ZB.map(z => {
        const col = E.tempColor(z.temp, palette), yc = (Y(z.max) + Y(z.min)) / 2;
        if (Y(z.min) - Y(z.max) < 9) return null;
        return (
          <g key={"lb" + z.id}>
            <text x={w - pad.r + 5} y={yc - 1} fontSize="7.2" fill={col} fontWeight="700">{z.label}</text>
            <text x={w - pad.r + 5} y={yc + 7} fontSize="6.6" fill="#9AA29A" fontFamily="var(--mono)">{z.min.toFixed(0)}–{z.max.toFixed(0)}°</text>
          </g>
        );
      })}
      {[lo, mid, hi].map(t => <line key={t} x1={pad.l} y1={Y(t)} x2={w - pad.r} y2={Y(t)} stroke="rgba(0,0,0,.06)" strokeWidth="1" />)}
      <text x={pad.l - 6} y={Y(hi) + 8} textAnchor="end" fontSize="8" fill="#A83C26" fontWeight="700">{hi.toFixed(0)}</text>
      <text x={pad.l - 6} y={Y(mid) + 3} textAnchor="end" fontSize="8" fill="#8C9389">{mid}</text>
      <text x={pad.l - 6} y={Y(lo) - 2} textAnchor="end" fontSize="8" fill="#2E6FAE" fontWeight="700">{lo.toFixed(0)}</text>
      {/* línea de temperatura */}
      <polyline points={pts} fill="none" stroke="#1B2420" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.78" />
      <circle cx={X(n - 1)} cy={Y(cur.temp)} r="4.5" fill={curCol} stroke="#fff" strokeWidth="1.8" />
      {data.map((d, i) => (i % stride === 0 || i === n - 1) &&
        <text key={i} x={X(i)} y={height - 5} textAnchor="middle" fontSize="8.5" fill="#8C9389" fontFamily="var(--mono)">{d.x}</text>)}
    </svg>
  );
}

function SectionHeatmap({ results, regime, palette, k }) {
  k = k || 27;
  const H = window.BambuHistory;
  const [tab, setTab] = React.useState(results[0].asset.id);
  const active = results.some(r => r.asset.id === tab) ? tab : results[0].asset.id;
  const allResults = results;
  results = allResults.filter(r => r.asset.id === active);
  const sigs = flatSignals(results);
  const mt = marketTemp(results);
  const mz = E.zoneFor(mt);
  const mtCol = E.tempColor(mt, palette);

  // matriz composite: filas horizonte, cols activos
  const assets = results.map(r => r.asset.ticker);

  // series de temperatura por item (BTC·STH, BTC·LTH, ETH·STH, ETH·LTH)
  const RANGES = React.useMemo(() => (window.convRanges ? window.convRanges() : [["1 año", 365]]), []);
  const [specDays, setSpecDays] = React.useState(365);
  const xlab = iso => { const d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }); };
  const tempItems = [];
  results.forEach(r => {
    const series = H.rangeComposites(r.asset.type, k, specDays, 260);
    tempItems.push({ key: `${r.asset.ticker} · LTH · ciclo (largo plazo)`, hz: "lth", type: r.asset.type, hr: r.lth, data: series.map(d => ({ x: xlab(d.iso), temp: d.lthTemp })) });
    tempItems.push({ key: `${r.asset.ticker} · STH · corto plazo`, hz: "sth", type: r.asset.type, hr: r.sth, data: series.map(d => ({ x: xlab(d.iso), temp: d.sthTemp })) });
  });

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Heatmap de zonas</h1>
        <p>Mapa térmico del mercado. La aguja y los colores ubican cada señal entre <strong style={{ color: E.tempColor(8, palette) }}>acumulación (frío)</strong> y <strong style={{ color: E.tempColor(92, palette) }}>distribución (caliente)</strong>, pasando por zonas tempranas y neutrales.</p>
      </div>

      {/* pestañas por moneda */}
      <div className="tabs" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {allResults.map(r => (
          <button key={r.asset.id} className={"tab" + (active === r.asset.id ? " active" : "")} onClick={() => setTab(r.asset.id)}>
            {r.asset.name} <span className="tk">{r.asset.ticker}</span>
          </button>
        ))}
      </div>

      {/* termómetro horizontal */}
      <Card title="Termómetro de mercado" sub="Temperatura media de las señales activas">
        <HorizontalThermo temp={mt} zone={mz} palette={palette} type={results[0].asset.type} hz="lth" />
        <div className="divider" style={{ margin: "18px 0 14px" }} />
        <ZoneLegend palette={palette} current={window.BambuHistory.bandOf(mt, window.BambuHistory.bandsFor(results[0].asset.type, "lth", 27).bands)} horizontal bands={window.BambuHistory.bandsFor(results[0].asset.type, "lth", 27).bands} />
      </Card>

      {/* matriz composite por activo × horizonte */}
      <Card title="Temperatura por activo y horizonte" sub="Cada celda = temperatura del composite (°) · hoy" style={{ marginTop: 16 }}>
        <HeatMatrix palette={palette} rows={["STH · corto", "LTH · largo"]} cols={assets}
          cell={(ri, ci) => {
            const r = results[ci];
            const hz = ri === 0 ? "sth" : "lth";
            const hr = ri === 0 ? r.sth : r.lth;
            const zz = window.BambuHistory.zoneOf(hr.temp, r.asset.type, hz);
            /* color por percentil histórico: la misma calibración del espectro */
            return { temp: zz.rank != null ? zz.rank : hr.temp, text: hr.temp.toFixed(0) + "°",
                     title: `${r.asset.ticker} ${hz.toUpperCase()} · ${zz.label} · ${hr.signal}` };
          }} />
        <div className="legend" style={{ marginTop: 14 }}>
          {window.BambuHistory.bandsFor(results[0].asset.type, "lth", 27).bands.map(z =>
            <span key={z.id} className="li"><span className="sw" style={{ background: E.tempColor(z.temp, palette) }} />{z.label} <span className="num tiny muted">{z.min.toFixed(0)}–{z.max.toFixed(0)}°</span></span>)}
        </div>
      </Card>

      {/* Espectro acumulación → distribución: gráficas de temperatura por item */}
      <Card title="Espectro acumulación → distribución · evolución de temperatura" sub="Bandas calibradas con la distribución histórica del activo: los valles caen en la franja azul (extremo frío, zona de compra) y los picos suben a la roja (extremo caliente, zona de venta)" style={{ marginTop: 16 }}>
        {/* menú de periodo */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <label className="tiny muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Periodo</label>
          <select value={specDays} onChange={e => setSpecDays(+e.target.value)}
                  style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600, padding: "9px 13px", borderRadius: 9, border: "1.5px solid var(--border-2, #D7DBD0)", background: "var(--card, #fff)", color: "var(--ink)", cursor: "pointer", maxWidth: "100%" }}>
            {RANGES.map(([l, d]) => <option key={d} value={d}>{l}</option>)}
          </select>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
          {tempItems.map((it, i) => {
            const hb = histBands(it.type, it.hz, k);
            const bands = hb.bands;
            const band = bandFor(it.hr.temp, bands);
            const col = E.tempColor(band.temp, palette);
            return (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{it.key}</span>
                  <span className="num" style={{ fontWeight: 700, color: col }}>{it.hr.temp.toFixed(0)}°</span>
                  <span className="badge" style={{ background: mixSoft(col), color: col }}>{band.label}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <SignalPill signal={it.hr.signal} />
                </div>
                <TempChart data={it.data} palette={palette} bands={bands} lo={hb.lo} hi={hb.hi} height={158} />
              </div>
            );
          })}
        </div>
        {/* lectura guiada */}
        <div style={{ background: "var(--surface-3)", borderRadius: 11, padding: "13px 16px", marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--ink-3)", marginBottom: 7 }}>Cómo leer estas gráficas</div>
          <div className="tiny" style={{ lineHeight: 1.65, color: "var(--ink-2)" }}>
            Cada gráfica es la <strong>temperatura</strong> de un horizonte a lo largo del tiempo. Las bandas no son cortes arbitrarios: se calculan con la <strong>distribución histórica completa</strong> del propio activo — la franja azul es el <strong>10% de días más fríos de toda su historia</strong> y la roja el 10% más calientes. Por eso los <strong>valles de la línea caen en el azul y los picos suben al rojo</strong>: cuando eso ocurre, el mercado está de verdad en un extremo histórico, no solo alto respecto a la última semana. El eje encuadra el rango real en que se mueve la métrica, así que la línea ya no queda plana en el centro. Amplía el periodo a ciclos completos para comprobar cómo cada visita al azul precedió una subida y cada visita al rojo un techo. El STH sirve para tus aportes; el LTH marca las decisiones de patrimonio.
          </div>
        </div>
      </Card>

      {/* matrices por sección */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <Card title="Desglose STH por sección" sub="De qué está hecha la temperatura de corto plazo (STH)">
          <p className="tiny muted" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
            La temperatura de cada activo no es un número mágico: surge de promediar varias <strong>secciones</strong> de métricas (Valuación, Liquidez/Flujo, Técnico). Esta matriz <strong>abre el composite STH</strong> y muestra el score de cada sección por activo: así ves <strong>qué está empujando</strong> la señal de corto plazo. Verde = esa sección apunta a acumulación; rojo = a distribución. Si todas coinciden en verde, la compra es más sólida; si se contradicen, conviene esperar.
          </p>
          <SectionMatrix results={results} horizon="sth" palette={palette} />
        </Card>
        <Card title="Desglose LTH por sección" sub="De qué está hecha la temperatura de largo plazo (LTH)">
          <p className="tiny muted" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
            Igual que el STH pero para el <strong>ciclo</strong>: descompone el composite LTH en sus secciones (Valuación, Cohortes, Ciclo, Flujo, Técnico). Demuestra <strong>dónde está la convicción estructural</strong> del mercado: si la Valuación y el Ciclo están en verde profundo, estamos en zona de suelo aunque el corto plazo rebote. Es la base para decidir <strong>acumulación de largo plazo</strong> con criterio, no por ruido diario.
          </p>
          <SectionMatrix results={results} horizon="lth" palette={palette} />
        </Card>
      </div>
    </div>
  );
}

function SectionMatrix({ results, horizon, palette }) {
  const H = window.BambuHistory;
  const palStops = (DD.PALETTES[palette] || DD.PALETTES.sobria).stops;
  const grad = "linear-gradient(90deg," + palStops.map(s => `${s[1]} ${s[0]}%`).join(",") + ")";
  const multi = results.length > 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {results.map(r => r[horizon].groups.map((g, gi) => {
        const temp = Math.max(2, Math.min(98, 50 - g.sectionScore * 50));
        const bands = H && H.bandsFor ? H.bandsFor(r.asset.type, horizon, 27).bands : null;
        const band = bands ? H.bandOf(temp, bands) : null;
        const pos = H && H.tempRank ? H.tempRank(temp, r.asset.type, horizon, 27) : temp;
        const col = E.tempColor(pos, palette);
        return (
          <div key={r.asset.ticker + gi} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{multi ? r.asset.ticker + " · " : ""}{g.name}</span>
              <span className="tiny muted">peso {(g.weight * 100).toFixed(0)}%</span>
              <span style={{ flex: 1 }} />
              <span className="num tiny" style={{ fontWeight: 700 }}>{E.fmt.signed(g.sectionScore)}</span>
              <span className="badge" style={{ background: mixSoft(col), color: col }}>{band ? band.label : E.zoneFor(temp).label}</span>
            </div>
            {/* espectro frío → caliente con marcador (posición = percentil histórico) */}
            <div style={{ position: "relative", height: 9, borderRadius: 5, background: grad, marginTop: 9 }}>
              <div style={{ position: "absolute", left: pos + "%", top: -3, width: 4, height: 15, background: "#1B2420", borderRadius: 2, transform: "translateX(-50%)", boxShadow: "0 0 0 2px #fff" }}></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span className="tiny" style={{ color: E.tempColor(8, palette), fontWeight: 600 }}>extremo frío · compra</span>
              <span className="tiny" style={{ color: E.tempColor(92, palette), fontWeight: 600 }}>extremo caliente · venta</span>
            </div>
          </div>
        );
      }))}
    </div>
  );
}

/* ============================================================
   BACKTEST
   ============================================================ */
function SectionBacktest({ palette, k, assets }) {
  const H = window.BambuHistory;
  const realAssets = (assets || []).filter(a => H.isReal(a.type)).map(a => a.type);
  const opts = [...new Set(realAssets.length ? realAssets : ["BTC"])];
  const [asset, setAsset] = React.useState(opts[0] || "BTC");
  const useAsset = opts.includes(asset) ? asset : opts[0];
  const [horizon, setHorizon] = React.useState("COMBO");
  /* periodo del backtest */
  const BT_RANGES = React.useMemo(() => {
    const end = new Date((window.BambuDataDate || "2026-06-30") + "T00:00:00Z");
    const since = iso => Math.round((end - new Date(iso + "T00:00:00Z")) / 86400000);
    return [
      ["90 días", 90], ["180 días", 180], ["1 año", 365], ["2 años", 730],
      ["4º ciclo (desde halving 2024)", since("2024-04-20")],
      ["3er ciclo en adelante (desde 2020)", since("2020-05-11")],
      ["2º ciclo en adelante (desde 2016)", since("2016-07-09")],
      ["Todos los ciclos", 99999],
    ];
  }, []);
  const [perDays, setPerDays] = React.useState(99999);
  const cutIso = React.useMemo(() => {
    if (perDays >= 99999) return "1900-01-01";
    const d = new Date((window.BambuDataDate || "2026-06-30") + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - perDays);
    return d.toISOString().slice(0, 10);
  }, [perDays]);
  const realBtAll = H && H.realBacktest ? H.realBacktest(k || 27, useAsset, horizon) : null;
  const realBt = realBtAll ? realBtAll.filter(d => d.today || !d.iso || d.iso >= cutIso) : null;
  const bt = (realBt && realBt.length > 1) ? realBt : (realBtAll || DD.BACKTEST);
  const filtered = !!(realBt && realBt.length > 1);
  const real = !!realBt;
  const tempOf = c => E.temperature(c, k || 27);
  const lineData = bt.map(d => ({ x: (d.iso ? d.iso.slice(0, 7) : d.date.split(" ")[0]), y: d.comp, temp: tempOf(d.comp), big: d.today }));
  const assetSel = opts.length > 1 ? (
    <div className="seg">{opts.map(o => <button key={o} className={useAsset === o ? "on" : ""} onClick={() => setAsset(o)}>{o}</button>)}</div>
  ) : null;
  const horizonSel = (
    <div className="seg">
      {[["STH", "STH"], ["LTH", "LTH"], ["COMBO", "Combo"]].map(([v, l]) => (
        <button key={v} className={horizon === v ? "on" : ""} onClick={() => setHorizon(v)}>{l}</button>
      ))}
    </div>
  );
  const horizonTxt = horizon === "COMBO" ? "combinado (LTH 60% / STH 40%)" : horizon === "STH" ? "corto plazo (STH)" : "largo plazo (LTH)";

  // ----- conclusión: estadísticas del backtest (sobre el periodo elegido) -----
  const rs = real ? (function () {
    const dir = bt.filter(d => d.mov != null && d.sig !== "NEUTRAL");
    let hits = 0, gw = 0, gl = 0;
    dir.forEach(d => {
      const bull = d.sig.indexOf("COMPRA") >= 0;
      const ok = (bull && d.mov > 0) || (!bull && d.mov < 0);
      if (ok) { hits++; gw += Math.abs(d.mov); } else { gl += Math.abs(d.mov); }
    });
    return { hitRate: dir.length ? hits / dir.length : 0, pf: gl > 0 ? gw / gl : Infinity, gw, gl, hits, n: dir.length };
  })() : null;
  const SIG_ORDER = ["COMPRA FUERTE", "COMPRA NATURAL", "COMPRA TEMPRANA", "NEUTRAL", "REDUCIR", "VENTA", "VENTA FUERTE"];
  const buckets = real ? SIG_ORDER.map(sig => {
    const rows = bt.filter(d => d.sig === sig);
    const dir = rows.filter(d => d.mov != null);
    const directional = sig !== "NEUTRAL";
    let hits = 0; dir.forEach(d => { const bull = sig.indexOf("COMPRA") >= 0; if ((bull && d.mov > 0) || (!bull && d.mov < 0)) hits++; });
    const avg = dir.length ? dir.reduce((s, d) => s + d.mov, 0) / dir.length : null;
    return { sig, n: rows.length, hits: directional ? hits : null, hr: (directional && dir.length) ? hits / dir.length : null, avg };
  }).filter(b => b.n > 0) : DD.STATS.buckets;
  const ST = real ? { hitRate: rs.hitRate, profitFactor: rs.pf, grossWin: Math.round(rs.gw), grossLoss: Math.round(rs.gl), totalHits: rs.hits, totalSignals: rs.n } : DD.STATS;
  const expOf = s => (s.indexOf("COMPRA") >= 0) ? 1 : (s === "NEUTRAL") ? 0.5 : 0;
  let eq = 100; const curve = [{ x: "Inicio", y: 100, temp: 50 }];
  let peak = 100, maxDD = 0;
  bt.filter(d => d.mov != null).forEach(d => {
    eq = eq * (1 + expOf(d.sig) * d.mov / 100);
    peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak);
    curve.push({ x: d.iso ? d.iso.slice(0, 7) : d.date.split(" ")[0], y: eq, temp: E.temperature(d.comp, k || 27) });
  });
  const equityMult = eq / 100;
  const verdictTxt = ST.hitRate >= 0.7 ? "Sólido" : ST.hitRate >= 0.55 ? "Con ventaja" : "Ventaja débil";
  const verdictCol = ST.hitRate >= 0.7 ? E.tempColor(12, palette) : ST.hitRate >= 0.55 ? E.tempColor(35, palette) : E.tempColor(60, palette);

  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
        <h1>Backtest histórico {real && <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", verticalAlign: "middle", marginLeft: 8 }}>datos reales {useAsset} · {horizon}</span>}</h1>
        <p>{real
          ? <>Índice de Convicción del horizonte <strong>{horizonTxt}</strong> calculado por el motor sobre <strong>datos on-chain reales de {useAsset}</strong> en puntos de inflexión del mercado. El <strong>Mov. 90d</strong> es el retorno real posterior. Los <strong style={{ color: E.tempColor(90, palette) }}>tops (caliente)</strong> anticiparon caídas; los <strong style={{ color: E.tempColor(10, palette) }}>suelos (frío)</strong>, rallies.</>
          : <>15 fechas clave coloreadas por su temperatura.</>}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {assetSel}{horizonSel}
          <select value={perDays} onChange={e => setPerDays(+e.target.value)}
                  style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 9, border: "1.5px solid var(--border-2, #D7DBD0)", background: "var(--card, #fff)", color: "var(--ink)", cursor: "pointer", maxWidth: "100%" }}>
            {BT_RANGES.map(([l, d]) => <option key={d} value={d}>{l}</option>)}
          </select>
        </div>
      </div>
      {!filtered && perDays < 99999 && <div className="tiny" style={{ background: "var(--surface-3)", borderRadius: 9, padding: "9px 13px", marginBottom: 14, color: "var(--ink-2)" }}>En ese periodo no hay puntos de inflexión registrados además de la lectura actual — se muestran todos los ciclos. Los periodos cortos (90/180 días) suelen contener pocos eventos: el backtest gana sentido en ventanas de ciclo.</div>}

      <Card title="Índice de Convicción a lo largo del tiempo" sub="Línea = convicción · punto coloreado por temperatura · línea base en 0">
        <LineChart data={lineData} height={210} baseline={0} palette={palette} dotTemp color="#586259"
          yFmt={v => v.toFixed(1)} />
      </Card>

      {/* tira térmica */}
      <Card title={`Tira térmica · ${bt.length} fechas`} className="" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {bt.map((d, i) => {
            const t = tempOf(d.comp), col = E.tempColor(t, palette);
            return (
              <div key={i} style={{ flex: 1, textAlign: "center" }} title={`${d.date} · ${d.evt} · ${t.toFixed(0)}°`}>
                <div style={{ height: 46, borderRadius: 6, background: col, display: "flex", alignItems: "center", justifyContent: "center", color: E.readableText(col), fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, border: d.today ? "2px solid #1B2420" : "none" }}>{t.toFixed(0)}</div>
                <div className="tiny muted" style={{ marginTop: 5, fontSize: 9.5, lineHeight: 1.2 }}>{d.date}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Detalle por fecha" style={{ marginTop: 16 }} pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th><th>Evento</th><th className="r">Precio</th><th className="c">Convicción</th>
                <th className="c">Temp.</th><th className="c">Zona</th><th>Señal</th><th className="r">Mov. 90d</th><th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {bt.map((d, i) => {
                const t = tempOf(d.comp), z = window.BambuHistory.zoneOf(t, useAsset, horizon === "STH" ? "sth" : "lth"), col = E.tempColor(z.rank != null ? z.rank : t, palette);
                return (
                  <tr key={i} className={d.today ? "today" : ""}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{d.date}</td>
                    <td className="muted">{d.evt}</td>
                    <td className="r num">{E.fmt.usd(d.price)}</td>
                    <td className="c num" style={{ fontWeight: 600 }}>{E.fmt.signed(d.comp)}</td>
                    <td className="c"><span className="num" style={{ fontWeight: 600, color: col }}>{t.toFixed(0)}°</span></td>
                    <td className="c"><span className="badge" style={{ background: mixSoft(col), color: col }}>{z.label}</span></td>
                    <td><SignalPill signal={d.sig} /></td>
                    <td className="r num" style={{ fontWeight: 600, color: d.mov > 0 ? "var(--brand)" : d.mov < 0 ? "#A83C26" : "var(--ink-3)" }}>{d.mov == null ? "—" : E.fmt.pct(d.mov)}</td>
                    <td className="muted tiny" style={{ maxWidth: 220 }}>{d.out}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {/* ===== CONCLUSIÓN Y RESULTADOS ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 14px" }}>
        <span className="diamond" />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>Conclusión y resultados · {useAsset} · {horizon === "COMBO" ? "Combinado" : horizon}</h2>
        <span style={{ flex: 1 }} />
        <span className="badge" style={{ background: mixSoft(verdictCol), color: verdictCol, fontSize: 12 }}>{verdictTxt}</span>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, borderLeft: `6px solid ${verdictCol}` }}>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--ink)" }}>
          Sobre <strong>{bt.filter(d => d.mov != null).length} señales</strong> con resultado conocido de <strong>{useAsset}</strong> en el horizonte <strong>{horizonTxt}</strong>, el modelo acertó la dirección el <strong style={{ color: verdictCol }}>{(ST.hitRate * 100).toFixed(0)}%</strong> de las veces ({ST.totalHits}/{ST.totalSignals}), con un <strong>profit factor de {isFinite(ST.profitFactor) ? ST.profitFactor.toFixed(1) : "∞"}</strong> (ganancias {ST.grossWin}% frente a pérdidas {ST.grossLoss}%). Siguiendo la señal, 100 unidades de capital se habrían convertido en <strong style={{ color: E.tempColor(12, palette) }}>{E.fmt.num(eq, 0)}</strong> (×{equityMult.toFixed(1)}), con una caída máxima del {(maxDD * 100).toFixed(0)}%. Veredicto: <strong style={{ color: verdictCol }}>{verdictTxt.toLowerCase()}</strong>.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <BigStat lab="Hit-rate global" val={(ST.hitRate * 100).toFixed(1) + "%"} sub={`${ST.totalHits} de ${ST.totalSignals} señales`} />
        <BigStat lab="Profit factor" val={isFinite(ST.profitFactor) ? ST.profitFactor.toFixed(1) : "∞"} sub={`Gan. ${ST.grossWin}% / Pérd. ${ST.grossLoss}%`} />
        <BigStat lab="Max drawdown" val={(maxDD * 100).toFixed(0) + "%"} sub="Peor caída del equity" warn />
        <BigStat lab="Retorno simulado" val={equityMult.toFixed(1) + "×"} sub={`${curve.length - 1} ventanas · base 100`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.1fr", alignItems: "start" }}>
        <Card title="Hit-rate por nivel de señal" sub="Aciertos y movimiento medio posterior">
          <table className="tbl">
            <thead><tr><th>Señal</th><th className="c">N</th><th className="c">Hit-rate</th><th className="r">Mov. medio</th></tr></thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i}>
                  <td><SignalPill signal={b.sig} /></td>
                  <td className="c num">{b.n}</td>
                  <td className="c">{b.hr === null
                    ? <span className="muted tiny">N/A</span>
                    : <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        <div style={{ width: 70, height: 8, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ width: (b.hr * 100) + "%", height: "100%", background: "var(--brand)", borderRadius: 5 }} />
                        </div>
                        <span className="num tiny" style={{ fontWeight: 600 }}>{(b.hr * 100).toFixed(0)}%</span>
                      </div>}</td>
                  <td className="r num" style={{ fontWeight: 600, color: b.avg > 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(b.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Equity curve simulada" sub="Capital 100 inicial · long si señal positiva, cash si negativa, 50% en neutral">
          <LineChart data={curve} height={230} color="#3E7C57" yFmt={v => Math.round(v)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
            <span className="muted">Equity final</span>
            <span className="num" style={{ fontWeight: 600, color: "var(--brand)" }}>{E.fmt.num(eq, 1)} <span className="muted tiny">(+{((eq / 100 - 1) * 100).toFixed(0)}%)</span></span>
          </div>
        </Card>
      </div>

      {/* ===== BACKTEST DE CORTOS (SHORT) ===== */}
      <ShortBacktest bt={bt} useAsset={useAsset} palette={palette} />
    </div>
  );
}

/* ---------- backtest aparte: señales de venta operadas en corto (short) ---------- */
function ShortBacktest({ bt, useAsset, palette }) {
  const shorts = bt.filter(d => d.mov != null && (d.sig.indexOf("VENTA") >= 0 || d.sig === "REDUCIR"));
  const Head = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 14px" }}>
      <span className="diamond" />
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>Backtest de cortos (short) · {useAsset}</h2>
      <span style={{ flex: 1 }} />
      {shorts.length > 0 && <ShortBadge shorts={shorts} palette={palette} />}
    </div>
  );
  if (!shorts.length) return (
    <div>{Head}<div className="card card-pad tiny muted">En el periodo elegido no hubo señales de venta/reducir con resultado conocido — amplía el periodo para ver el histórico de cortos.</div></div>
  );
  let hits = 0, sum = 0, best = -Infinity, worst = Infinity;
  const rows = shorts.map(d => {
    const shortRet = -d.mov;               /* un short gana lo que el precio cae */
    if (shortRet > 0) hits++;
    sum += shortRet; best = Math.max(best, shortRet); worst = Math.min(worst, shortRet);
    return { ...d, shortRet };
  });
  const hr = hits / rows.length, avg = sum / rows.length;
  let eq = 100; rows.forEach(r => { eq = eq * (1 + r.shortRet / 100); });
  const col = hr >= 0.7 ? E.tempColor(12, palette) : hr >= 0.5 ? E.tempColor(35, palette) : E.tempColor(75, palette);
  return (
    <div>
      {Head}
      <div className="card card-pad" style={{ marginBottom: 16, borderLeft: `6px solid ${col}` }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>
          Simulación aparte: cada señal de <strong>REDUCIR / VENTA / VENTA FUERTE</strong> se opera como un <strong>corto (short)</strong> — se gana lo que el precio cae en los 90 días siguientes. Sobre <strong>{rows.length} señales de venta</strong> de {useAsset}, el corto habría ganado en <strong style={{ color: col }}>{hits} de {rows.length}</strong> ({(hr * 100).toFixed(0)}%), con retorno medio de <strong style={{ color: avg > 0 ? "var(--brand)" : "#A83C26" }}>{avg >= 0 ? "+" : ""}{avg.toFixed(1)}%</strong> por operación. 100 unidades dedicadas solo a estos cortos habrían terminado en <strong>{E.fmt.num(eq, 0)}</strong>. Para quien no opera en corto, la lectura equivalente es: <strong>salir en esas señales te habría ahorrado esas caídas</strong>.
        </p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <BigStat lab="Señales de venta" val={rows.length} sub="con resultado conocido" />
        <BigStat lab="Aciertos del short" val={`${hits}/${rows.length}`} sub={`${(hr * 100).toFixed(0)}% · el precio cayó`} />
        <BigStat lab="Retorno medio short" val={(avg >= 0 ? "+" : "") + avg.toFixed(1) + "%"} sub="por operación · 90 días" />
        <BigStat lab="Mejor / peor" val={`+${best.toFixed(0)}% / ${worst.toFixed(0)}%`} sub="rango de resultados" warn={worst < 0} />
      </div>
      <Card title="Detalle de cada corto" pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Evento</th><th className="r">Precio</th><th>Señal</th><th className="r">Precio 90d después</th><th className="r">Resultado short</th><th className="c">Acierto</th></tr></thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{d.date}</td>
                  <td className="muted">{d.evt}</td>
                  <td className="r num">{E.fmt.usd(d.price)}</td>
                  <td><SignalPill signal={d.sig} /></td>
                  <td className="r num muted">{d.mov >= 0 ? "+" : ""}{d.mov.toFixed(0)}%</td>
                  <td className="r num" style={{ fontWeight: 700, color: d.shortRet > 0 ? "var(--brand)" : "#A83C26" }}>{d.shortRet >= 0 ? "+" : ""}{d.shortRet.toFixed(0)}%</td>
                  <td className="c" style={{ fontWeight: 700 }}>{d.shortRet > 0 ? <span style={{ color: "var(--brand)" }}>✓</span> : <span style={{ color: "#A83C26" }}>✗</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.5 }}>Operar en corto conlleva riesgos adicionales (apalancamiento, liquidación, funding). Este backtest mide la dirección de la señal, no incluye esos costes. No es asesoramiento financiero.</div>
    </div>
  );
}
function ShortBadge({ shorts, palette }) {
  const hits = shorts.filter(d => -d.mov > 0).length, hr = hits / shorts.length;
  const col = hr >= 0.7 ? E.tempColor(12, palette) : hr >= 0.5 ? E.tempColor(35, palette) : E.tempColor(75, palette);
  return <span className="badge" style={{ background: mixSoft(col), color: col, fontSize: 12 }}>{(hr * 100).toFixed(0)}% de aciertos</span>;
}

/* ============================================================
   ESTADÍSTICAS
   ============================================================ */
function SectionStats({ palette, k, assets }) {
  const H = window.BambuHistory;
  const realAssets = (assets || []).filter(a => H.isReal(a.type)).map(a => a.type);
  const opts = [...new Set(realAssets.length ? realAssets : ["BTC"])];
  const [asset, setAsset] = React.useState(opts[0] || "BTC");
  const useAsset = opts.includes(asset) ? asset : opts[0];
  const [horizon, setHorizon] = React.useState("COMBO");
  const realBt = H && H.realBacktest ? H.realBacktest(k || 27, useAsset, horizon) : null;
  const real = !!realBt;
  const bt = realBt || DD.BACKTEST;
  const rs = real ? H.realStats(k || 27, useAsset, horizon) : null;
  const assetSel = opts.length > 1 ? (
    <div className="seg">{opts.map(o => <button key={o} className={useAsset === o ? "on" : ""} onClick={() => setAsset(o)}>{o}</button>)}</div>
  ) : null;
  const horizonSel = (
    <div className="seg">
      {[["STH", "STH"], ["LTH", "LTH"], ["COMBO", "Combo"]].map(([v, l]) => (
        <button key={v} className={horizon === v ? "on" : ""} onClick={() => setHorizon(v)}>{l}</button>
      ))}
    </div>
  );
  // buckets calculados desde el backtest
  const SIG_ORDER = ["COMPRA FUERTE", "COMPRA NATURAL", "COMPRA TEMPRANA", "NEUTRAL", "REDUCIR", "VENTA", "VENTA FUERTE"];
  const buckets = real ? SIG_ORDER.map(sig => {
    const rows = bt.filter(d => d.sig === sig);
    const dir = rows.filter(d => d.mov != null);
    const directional = sig !== "NEUTRAL";
    let hits = 0; dir.forEach(d => { const bull = sig.indexOf("COMPRA") >= 0; if ((bull && d.mov > 0) || (!bull && d.mov < 0)) hits++; });
    const avg = dir.length ? dir.reduce((s, d) => s + d.mov, 0) / dir.length : null;
    return { sig, n: rows.length, hits: directional ? hits : null, hr: (directional && dir.length) ? hits / dir.length : null, avg };
  }).filter(b => b.n > 0) : DD.STATS.buckets;

  const ST = real ? {
    hitRate: rs.hitRate, profitFactor: rs.pf, grossWin: Math.round(rs.gw), grossLoss: Math.round(rs.gl),
    totalHits: rs.hits, totalSignals: rs.n,
  } : DD.STATS;

  // equity curve simulada (regla del modelo)
  const expOf = s => (s.indexOf("COMPRA") >= 0) ? 1 : (s === "NEUTRAL") ? 0.5 : 0;
  let eq = 100; const curve = [{ x: "Inicio", y: 100, temp: 50 }];
  let peak = 100, maxDD = 0;
  bt.filter(d => d.mov != null).forEach(d => {
    eq = eq * (1 + expOf(d.sig) * d.mov / 100);
    peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak);
    curve.push({ x: d.iso ? d.iso.slice(0, 7) : d.date.split(" ")[0], y: eq, temp: E.temperature(d.comp, k || 27) });
  });
  const equityMult = eq / 100;

  return (
    <div className="fade-in">
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
        <h1>Estadísticas del modelo {real && <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", verticalAlign: "middle", marginLeft: 8 }}>datos reales {useAsset} · {horizon}</span>}</h1>
        <p>Desempeño sobre {bt.filter(d => d.mov != null).length} fechas con outcome real conocido de {useAsset} en el horizonte {horizon === "COMBO" ? "combinado" : horizon}. Una señal direccional <strong>acierta</strong> si el movimiento posterior de 90 días va en la dirección esperada.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{assetSel}{horizonSel}</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <BigStat lab="Hit-rate global" val={(ST.hitRate * 100).toFixed(1) + "%"} sub={`${ST.totalHits} de ${ST.totalSignals} señales direccionales`} />
        <BigStat lab="Profit factor" val={isFinite(ST.profitFactor) ? ST.profitFactor.toFixed(1) : "∞"} sub={`Ganancias ${ST.grossWin}% / Pérdidas ${ST.grossLoss}%`} />
        <BigStat lab="Max drawdown" val={(maxDD * 100).toFixed(0) + "%"} sub="Peor caída del equity simulado" warn />
        <BigStat lab="Retorno simulado" val={equityMult.toFixed(1) + "×"} sub={`${curve.length - 1} ventanas de 90 días · base 100`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.1fr", alignItems: "start" }}>
        <Card title="Hit-rate por bucket de señal" sub="Aciertos y movimiento medio posterior">
          <table className="tbl">
            <thead><tr><th>Señal</th><th className="c">N</th><th className="c">Hit-rate</th><th className="r">Mov. medio</th></tr></thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i}>
                  <td><SignalPill signal={b.sig} /></td>
                  <td className="c num">{b.n}</td>
                  <td className="c">
                    {b.hr === null
                      ? <span className="muted tiny">N/A</span>
                      : <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                          <div style={{ width: 70, height: 8, background: "var(--surface-3)", borderRadius: 5, overflow: "hidden" }}>
                            <div style={{ width: (b.hr * 100) + "%", height: "100%", background: "var(--brand)", borderRadius: 5 }} />
                          </div>
                          <span className="num tiny" style={{ fontWeight: 600 }}>{(b.hr * 100).toFixed(0)}%</span>
                        </div>}
                  </td>
                  <td className="r num" style={{ fontWeight: 600, color: b.avg > 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(b.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Equity curve simulada" sub="Capital 100 inicial · long si señal positiva, cash si negativa, 50% en neutral">
          <LineChart data={curve} height={230} color="#3E7C57" yFmt={v => Math.round(v)} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
            <span className="muted">Equity final</span>
            <span className="num" style={{ fontWeight: 600, color: "var(--brand)" }}>{E.fmt.num(eq, 1)} <span className="muted tiny">(+{((eq / 100 - 1) * 100).toFixed(0)}%)</span></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
function BigStat({ lab, val, sub, warn }) {
  return (
    <div className="card kpi">
      <div className="lab">{lab}</div>
      <div className="num val" style={{ color: warn ? "#A83C26" : "var(--brand)" }}>{val}</div>
      <div className="meta muted">{sub}</div>
    </div>
  );
}

/* ============================================================
   SIZING & STOPS
   ============================================================ */
function SectionSizing({ results, regime, palette }) {
  const reg = DD.REGIMES[regime];
  const sigs = flatSignals(results);
  const protocolo = [
    "Esperar 2 lecturas consecutivas con la misma señal antes de mover cartera.",
    "COMPRA → COMPRA FUERTE: incrementar en 4 tramos durante 2 semanas.",
    "NEUTRAL → REDUCIR: reducir en 3 tramos en 1 semana + abrir hedge 25%.",
    "REDUCIR → VENTA FUERTE: liquidar 60% en 48h + abrir short 50%.",
    "Cobertura SHORT vía futuros perpetuos regulados o inverse ETFs.",
    "Régimen BEAR (×0.70) reduce todo el sizing automáticamente.",
    "Régimen ACUMULACIÓN (×1.20) sobrepondera entradas estructurales.",
    "Documentar cada decisión: composite, régimen, sección dominante, macro.",
  ];

  return (
    <div className="fade-in">
      <div className="page-head">
        <h1>Sizing &amp; Stops</h1>
        <p>Gestión de riesgo por señal. Peso base cripto <strong className="num">5%</strong> · régimen <strong style={{ color: "var(--brand)" }}>{regime}</strong> aplica multiplicador <strong className="num">×{reg.mult.toFixed(2)}</strong>.</p>
      </div>

      <Card title="Posición por nivel de señal" sub="% del peso base · LONG direccional + SHORT/HEDGE de cobertura" pad={false}>
        <table className="tbl">
          <thead><tr><th>Señal</th><th className="c">LONG %</th><th className="c">SHORT/HEDGE</th><th className="c">Net</th><th className="c">Stop</th><th className="c">Take profit</th><th>Comentario</th></tr></thead>
          <tbody>
            {Object.entries(DD.SIGNALS).map(([name, sg]) => {
              const t = E.temperature(sg.comp != null ? sg.comp : 0);
              const col = E.tempColor(t, palette);
              return (
                <tr key={name}>
                  <td><span className="pill" style={{ background: mixSoft(col), color: col }}>{name}</span></td>
                  <td className="c num" style={{ fontWeight: 600 }}>{(sg.long * 100).toFixed(0)}%</td>
                  <td className="c num muted">{(sg.hedge * 100).toFixed(0)}%</td>
                  <td className="c num" style={{ fontWeight: 600 }}>{Math.round((sg.long - sg.hedge) * 100) >= 0 ? "+" : ""}{Math.round((sg.long - sg.hedge) * 100)}%</td>
                  <td className="c num" style={{ color: "#A83C26" }}>{(sg.stop * 100).toFixed(0)}%</td>
                  <td className="c num muted">{sg.tp}</td>
                  <td className="muted tiny" style={{ maxWidth: 230 }}>{sg.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", marginTop: 16, alignItems: "start" }}>
        <Card title="Cálculo para tu convicción actual" sub={`Ajustado por régimen ${regime} (×${reg.mult.toFixed(2)})`} pad={false}>
          <table className="tbl">
            <thead><tr><th>Activo</th><th className="c">Convicción</th><th>Señal</th><th className="r">LONG aj.</th><th className="r">HEDGE</th><th className="r">Net</th><th className="r">Stop USD</th></tr></thead>
            <tbody>
              {sigs.map((s, i) => {
                const price = results.find(r => r.asset.ticker === s.ticker).vals.price;
                const sz = E.sizing(s.signal, regime, price);
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.key}</td>
                    <td className="c num">{E.fmt.signed(s.composite)}</td>
                    <td><SignalPill signal={s.signal} /></td>
                    <td className="r num">{(sz.longAdj * 100).toFixed(2)}%</td>
                    <td className="r num muted">{(sz.hedge * 100).toFixed(2)}%</td>
                    <td className="r num" style={{ fontWeight: 600, color: sz.net >= 0 ? "var(--brand)" : "#A83C26" }}>{E.fmt.pct(sz.net * 100, 2)}</td>
                    <td className="r num">{E.fmt.usd(sz.stopUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Protocolo de ejecución">
          <ol style={{ margin: 0, padding: 0, listStyle: "none", counterReset: "p" }}>
            {protocolo.map((p, i) => (
              <li key={i} style={{ display: "flex", gap: 11, padding: "8px 0", borderBottom: i < protocolo.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span className="num" style={{ width: 22, height: 22, flex: "none", borderRadius: 6, background: "var(--brand-soft)", color: "var(--brand-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>{p}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { SectionHeatmap, SectionBacktest, SectionStats, SectionSizing, ZoneLegend });
