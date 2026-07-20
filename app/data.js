/* ============================================================
   BAMBÚ · Dashboard On-Chain · DATOS Y ESQUEMA
   Modelo de scoring v2.2 — Pedro Iván Avellaneda
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Escala térmica (paleta sobria elegida) ----------
     0 frío (acumulación)  →  100 caliente (distribución)        */
  const PALETTES = {
    sobria: {
      name: "Sobria · hielo→brasa",
      stops: [
        [0,   "#2E6FAE"], // azul hielo
        [25,  "#4C9FB0"], // cian
        [50,  "#9CA1A8"], // gris neutro
        [75,  "#D69A40"], // ámbar
        [100, "#BC4A2E"], // rojo brasa
      ],
    },
    termica: {
      name: "Térmica clásica",
      stops: [
        [0,   "#2563B0"],
        [25,  "#36A66B"],
        [50,  "#E2C541"],
        [75,  "#E08A35"],
        [100, "#CB3B2C"],
      ],
    },
    magma: {
      name: "Magma",
      stops: [
        [0,   "#3B3A8C"],
        [25,  "#7A3D9E"],
        [50,  "#B5407E"],
        [75,  "#E0653F"],
        [100, "#E69A2E"],
      ],
    },
  };

  /* ---------- Las 5 zonas térmicas ---------- */
  const ZONES = [
    { id: "fria",     min: 0,  max: 20,  label: "FRÍA",     en: "Cold",        phase: "Acumulación profunda",   action: "Acumular",          temp: 10 },
    { id: "temprana", min: 20, max: 40,  label: "TEMPRANA", en: "Early",       phase: "Acumulación temprana",   action: "Acumular en tramos",temp: 30 },
    { id: "neutral",  min: 40, max: 60,  label: "NEUTRAL",  en: "Neutral",     phase: "Equilibrio",             action: "Mantener",          temp: 50 },
    { id: "calida",   min: 60, max: 80,  label: "CÁLIDA",   en: "Warm",        phase: "Distribución temprana",  action: "Reducir gradual",   temp: 70 },
    { id: "caliente", min: 80, max: 100, label: "CALIENTE", en: "Hot",         phase: "Distribución",           action: "Distribuir",        temp: 90 },
  ];

  /* ---------- Señales del modelo (composite → señal) · 7 niveles ---------- */
  const SIGNALS = {
    "COMPRA FUERTE":   { id: "compra_fuerte",   short: "C.FUERTE",  tone: "buy2",  comp: 1.8,  long: 1.15, hedge: 0,    stop: -0.25, tp: "+30/+60/+100%", note: "Sobreponderar. Convicción total · suelo profundo." },
    "COMPRA NATURAL":  { id: "compra_natural",  short: "C.NATURAL", tone: "buy",   comp: 1.0,  long: 0.95, hedge: 0,    stop: -0.20, tp: "+20/+40%",      note: "Peso base completo. Acumulación estándar." },
    "COMPRA TEMPRANA": { id: "compra_temprana", short: "C.TEMPR.",  tone: "buy0",  comp: 0.45, long: 0.80, hedge: 0.05, stop: -0.18, tp: "+15/+25%",      note: "Inicio de acumulación. Entrar en tramos." },
    "NEUTRAL":         { id: "neutral",         short: "NEUTRAL",   tone: "neut",  comp: 0,    long: 0.70, hedge: 0.10, stop: -0.15, tp: "+15%",          note: "Peso reducido + cobertura mínima. Esperar confirmación." },
    "REDUCIR":         { id: "reducir",         short: "REDUCIR",   tone: "sell0", comp: -0.45,long: 0.45, hedge: 0.20, stop: -0.12, tp: "Reducir 25%",   note: "Sizing bajo. Empezar a aligerar gradualmente." },
    "VENTA":           { id: "venta",           short: "VENTA",     tone: "sell",  comp: -1.0, long: 0.30, hedge: 0.35, stop: -0.08, tp: "Vender 40%",    note: "Mayoría defensiva + hedge moderado." },
    "VENTA FUERTE":    { id: "venta_fuerte",    short: "V.FUERTE",  tone: "sell2", comp: -1.8, long: 0.15, hedge: 0.50, stop: -0.05, tp: "Inmediato 60%", note: "Mayoría cash + short. Net negativo · techo." },
  };

  /* ---------- Funciones de score (valor → −1..+1) ----------
     Calibradas para reproducir exactamente los composites del Excel. */
  const S = {
    mvrvSTH:  v => v < 0.85 ? 1 : v < 0.95 ? 0.5 : v > 1.25 ? -1 : v > 1.15 ? -0.5 : 0,
    sopr:     v => v < 0.97 ? 1 : v < 1 ? 0.5 : v > 1.08 ? -1 : v > 1.05 ? -0.5 : 0,
    nuplSTH:  v => v < 0.1 ? 1 : v > 0.7 ? -1 : v > 0.5 ? -0.5 : 0,
    ssr:      v => v < 5 ? 1 : v < 8 ? 0.5 : v > 18 ? -1 : v > 15 ? -0.5 : 0,
    cdd:      v => v > 3 ? -1 : v > 2 ? -0.5 : v < 0.5 ? 0.5 : 0,
    funding:  v => v < -0.01 ? 1 : v < 0 ? 0.5 : v > 0.025 ? -1 : v > 0.015 ? -0.5 : 0,
    netflow:  v => v < -1000 ? 1 : v < 0 ? 0.5 : v > 5000 ? -1 : v > 0 ? -0.5 : 0,
    doi:      v => v > 20 ? -1 : v > 4.5 ? -0.5 : v < -15 ? 0.5 : 0,
    emaPct:   v => v < -20 ? 1 : v < -10 ? 0.5 : v > 25 ? -1 : v > 15 ? -0.5 : 0,
    bb:       v => v < 0 ? 1 : v < 0.15 ? 0.5 : v > 1 ? -1 : v > 0.85 ? -0.5 : 0,
    rsi:      v => v < 25 ? 1 : v < 32 ? 0.5 : v > 75 ? -1 : v > 68 ? -0.5 : 0,
    netEmis:  v => v < 0 ? 1 : v > 2 ? -0.5 : 0,

    mvrvLTH:  v => v < 2 ? 1 : v > 4.5 ? -1 : v > 3.5 ? -0.5 : 0,
    lthSopr:  v => v < 1.5 ? 1 : v > 5 ? -1 : v > 4 ? -0.5 : 0,
    nuplLTH:  v => v < 0 ? 1 : v > 0.45 ? -1 : v > 0.3 ? -0.5 : 0,
    mvrvZ:    v => v < 1.5 ? 1 : v > 7 ? -1 : v > 5 ? -0.5 : 0,
    rhodl:    v => v > 150000 ? -1 : v > 100000 ? -0.5 : 0,
    reserve:  v => v < 0.002 ? 1 : v < 0.004 ? 0.5 : v > 0.02 ? -1 : v > 0.012 ? -0.5 : 0,
    lthSup:   v => v > 64 ? 1 : v < 60 ? -1 : v < 63 ? -0.5 : 0,
    asopr:    v => v < 0.99 ? 1 : v < 1 ? 0.5 : v > 1.08 ? -1 : v > 1.05 ? -0.5 : 0,
    mayer:    v => v < 0.7 ? 1 : v < 0.85 ? 0.5 : v > 1.5 ? -1 : 0,
    picycle:  v => v >= 1 ? -1 : v > 0.9 ? -0.5 : 0,
    ma2y:     v => v < 0.8 ? 1 : v > 1.4 ? -1 : v > 1.1 ? -0.5 : 0,
    puell:    v => v < 0.5 ? 1 : v < 0.8 ? 0.5 : v > 3 ? -1 : v > 2 ? -0.5 : 0,
    emaW:     v => v < -30 ? 1 : v < -15 ? 0.5 : v > 50 ? -1 : v > 25 ? -0.5 : 0,
    bbW:      v => v < 0 ? 1 : v < 0.1 ? 0.5 : v > 1 ? -1 : v > 0.95 ? -0.5 : 0,
    rsiW:     v => v < 30 ? 1 : v < 40 ? 0.5 : v > 55 ? -1 : v > 50 ? -0.5 : 0,
  };

  /* ---------- Esquema de métricas por tipo de activo ----------
     group: val | liq | tec (STH) · val | coh | cic | flu | tec (LTH)  */
  function metricsFor(type) {
    const eth = type === "ETH";

    const sthVal = [
      { key: "rpSTH",   label: "Realized Price STH", tech: "Realized Price STH", unit: "USD", group: "val", noscore: true, src: "cryptoquant.com" },
      { key: "mvrvSTH", label: "MVRV STH",           tech: "MVRV STH",           unit: "x",   group: "val", auto: v => v.rpSTH ? v.price / v.rpSTH : 0, score: S.mvrvSTH, read: ">1.15 sobrecalentado · <0.95 oportunidad", src: "auto = Precio / RP" },
      { key: "sthSopr", label: "STH-SOPR 7d MA",     tech: "STH-SOPR 7d MA",     unit: "",    group: "val", score: S.sopr,   read: "<1 capitulación", src: "cryptoquant.com" },
      { key: "nuplSTH", label: "NUPL STH",           tech: "NUPL STH",           unit: "",    group: "val", score: S.nuplSTH,read: "Bº/pérdida no realizado STH", src: "cryptoquant.com" },
    ];

    const sthLiq = eth
      ? [
          { key: "netEmS",  label: "ETH Net Emission % YoY", tech: "Net Emission % YoY", unit: "%", group: "liq", score: S.netEmis, read: "<0 deflación (EIP-1559)", src: "ultrasound.money" },
          { key: "ssr",     label: "SSR · Stablecoin Supply Ratio", tech: "SSR", unit: "", group: "liq", score: S.ssr, read: "<5 polvo seco · >18 capital escaso", src: "cryptoquant.com" },
          { key: "funding", label: "Funding Rate 30d MA", tech: "Funding 30d MA", unit: "%", group: "liq", score: S.funding, read: ">0.025% euforia sostenida", src: "coinglass.com" },
          { key: "netflow", label: "Exchange Netflow 7d", tech: "Exchange Netflow 7d", unit: "", group: "liq", score: S.netflow, read: "Negativo = acumulación", src: "coinank.com" },
          { key: "doi",     label: "Δ Open Interest 7d", tech: "Δ OI 7d", unit: "%", group: "liq", score: S.doi, read: ">20% apalancamiento peligroso", src: "coinglass.com" },
        ]
      : [
          { key: "ssr",     label: "SSR · Stablecoin Supply Ratio", tech: "SSR", unit: "", group: "liq", score: S.ssr, read: "<5 polvo seco · >18 capital escaso", src: "cryptoquant.com" },
          { key: "cdd",     label: "CDD · oscilador (SMA90 / SMA365)", tech: "CDD SMA90 ratio", unit: "x", group: "liq", score: S.cdd, read: ">2 = LTHs distribuyendo · <0.5 = monedas dormidas", src: "base de datos" },
          { key: "funding", label: "Funding Rate 30d MA", tech: "Funding 30d MA", unit: "%", group: "liq", score: S.funding, read: ">0.025% euforia sostenida", src: "coinglass.com" },
          { key: "netflow", label: "Exchange Netflow 7d", tech: "Exchange Netflow 7d", unit: "", group: "liq", score: S.netflow, read: "Negativo = acumulación", src: "coinank.com" },
          { key: "doi",     label: "Δ Open Interest 7d", tech: "Δ OI 7d", unit: "%", group: "liq", score: S.doi, read: ">20% apalancamiento peligroso", src: "coinglass.com" },
        ];

    const sthTec = [
      { key: "ema1d", label: "EMA 200 — Desv. % (1D)", tech: "EMA200 Dev % 1D", unit: "%", group: "tec", score: S.emaPct, read: "(Precio−EMA200)/EMA200 ×100", src: "tradingview.com" },
      { key: "bb1d",  label: "Bollinger %B (20d, 1D)", tech: "BB %B 1D", unit: "", group: "tec", score: S.bb, read: ">1 sobre banda · <0 bajo banda", src: "tradingview.com" },
      { key: "rsi1d", label: "RSI 14 (1D)", tech: "RSI 14 1D", unit: "", group: "tec", score: S.rsi, read: ">70 sobrecompra · <30 sobreventa", src: "tradingview.com" },
    ];

    const lthVal = [
      { key: "rpLTH",   label: "Realized Price LTH", tech: "Realized Price LTH", unit: "USD", group: "val", noscore: true, src: "cryptoquant.com" },
      { key: "mvrvLTH", label: "MVRV LTH", tech: "MVRV LTH", unit: "x", group: "val", auto: v => v.rpLTH ? v.price / v.rpLTH : 0, score: S.mvrvLTH, read: ">3.5 ciclo maduro · <1 oportunidad", src: "auto = Precio / RP" },
      { key: "lthSopr", label: "LTH-SOPR 7d MA", tech: "LTH-SOPR 7d MA", unit: "", group: "val", score: S.lthSopr, read: ">5 LTHs vendiendo ganancias", src: "cryptoquant.com" },
      { key: "nuplLTH", label: "NUPL LTH", tech: "NUPL LTH", unit: "", group: "val", score: S.nuplLTH, read: ">0.75 euforia · <0 capitulación", src: "lookintobitcoin.com" },
      { key: "mvrvZ",   label: "MVRV Z-Score", tech: "MVRV Z-Score", unit: "", group: "val", score: S.mvrvZ, read: ">7 techo · <0 suelo", src: "lookintobitcoin.com" },
      { key: "rhodl",   label: "RHODL Ratio", tech: "RHODL Ratio", unit: "", group: "val", score: S.rhodl, read: ">150k euforia ciclo", src: "lookintobitcoin.com" },
    ];

    const lthCoh = [
      { key: "reserve",  label: "Reserve Risk", tech: "Reserve Risk", unit: "", group: "coh", score: S.reserve, read: "<0.002 oportunidad · >0.020 euforia", src: "lookintobitcoin.com" },
      { key: "lthSup",   label: "LTH Supply % del total", tech: "LTH Supply %", unit: "%", group: "coh", score: S.lthSup, read: ">70 acumulación · <60 distribución", src: "glassnode.com" },
      { key: "asopr",    label: "aSOPR (Adjusted SOPR)", tech: "aSOPR", unit: "", group: "coh", score: S.asopr, read: "<1 capitulación · >1.05 toma ganancias", src: "glassnode.com" },
    ];

    const lthCic = [
      { key: "mayer",   label: "Mayer Multiple", tech: "Mayer Multiple", unit: "x", group: "cic", score: S.mayer, read: ">2.4 sobreextensión techo · <0.7 suelo", src: "tradingview.com" },
      { key: "picycle", label: "Pi Cycle Ratio", tech: "Pi Cycle Ratio", unit: "", group: "cic", score: S.picycle, read: "≥1.0 cruce inminente (TOP)", src: "lookintobitcoin.com" },
      { key: "ma2y",    label: "2yMA Multiplier", tech: "2yMA Multiplier", unit: "x", group: "cic", score: S.ma2y, read: "Banda macro de ciclo · >5 techo", src: "lookintobitcoin.com" },
    ];

    const lthFlu = eth
      ? [{ key: "netEmL", label: "ETH Net Emission % YoY", tech: "Net Emission % YoY", unit: "%", group: "flu", score: S.netEmis, read: "<0 deflación estructural", src: "ultrasound.money" }]
      : [{ key: "puell",  label: "Puell Multiple", tech: "Puell Multiple", unit: "x", group: "flu", score: S.puell, read: "Presión vendedora mineros", src: "lookintobitcoin.com" }];

    const lthTec = [
      { key: "ema1w", label: "EMA 200 — Desv. % (1W)", tech: "EMA200 Dev % 1W", unit: "%", group: "tec", score: S.emaW, read: "Desviación semanal vs EMA200", src: "tradingview.com" },
      { key: "bb1w",  label: "Bollinger %B (20w, 1W)", tech: "BB %B 1W", unit: "", group: "tec", score: S.bbW, read: "%B semanal · extremos de ciclo", src: "tradingview.com" },
      { key: "rsi1w", label: "RSI 14 (1W)", tech: "RSI 14 1W", unit: "", group: "tec", score: S.rsiW, read: "RSI semanal · momentum macro", src: "tradingview.com" },
    ];

    return {
      sth: { groups: [
        { id: "val", name: "Valuación", weight: 0.35, metrics: sthVal },
        { id: "liq", name: "Liquidez / Flujo", weight: 0.35, metrics: sthLiq },
        { id: "tec", name: "Técnico", weight: 0.30, metrics: sthTec },
      ]},
      lth: { groups: [
        { id: "val", name: "Valuación", weight: 0.30, metrics: lthVal },
        { id: "coh", name: "Cohortes", weight: 0.20, metrics: lthCoh },
        { id: "cic", name: "Ciclo", weight: 0.20, metrics: lthCic },
        { id: "flu", name: "Flujo", weight: 0.15, metrics: lthFlu },
        { id: "tec", name: "Técnico", weight: 0.15, metrics: lthTec },
      ]},
    };
  }

  /* ---------- Valores precargados (Excel v2.2) ---------- */
  const PRELOAD = {
    BTC: {
      price: 95000,
      rpSTH: 93000, sthSopr: 1.002, nuplSTH: 0.12,
      ssr: 10, cdd: 3, funding: 0.007, netflow: -2800, doi: 5,
      ema1d: 13, bb1d: 0.55, rsi1d: 54,
      rpLTH: 38000, lthSopr: 2.4, nuplLTH: 0.5, mvrvZ: 2.7, rhodl: 30000,
      reserve: 0.005, lthSup: 67, asopr: 1.01,
      mayer: 1.7, picycle: 0.7, ma2y: 1.8,
      puell: 1.5, ema1w: 111, bb1w: 0.65, rsi1w: 58,
    },
    ETH: {
      price: 2400,
      rpSTH: 2300, sthSopr: 1.002, nuplSTH: 0.08,
      netEmS: 0.28, ssr: 10, funding: 0.005, netflow: -9500, doi: 4,
      ema1d: 3, bb1d: 0.45, rsi1d: 47,
      rpLTH: 1600, lthSopr: 1.3, nuplLTH: 0.28, mvrvZ: 1, rhodl: 30000,
      reserve: 0.005, lthSup: 65, asopr: 1.005,
      mayer: 1.2, picycle: 0.7, ma2y: 1.5,
      netEmL: 0.28, ema1w: 40, bb1w: 0.5, rsi1w: 48,
    },
  };

  const ASSETS_INIT = [
    { id: "btc", name: "Bitcoin", ticker: "BTC", type: "BTC", values: { ...PRELOAD.BTC } },
    { id: "eth", name: "Ethereum", ticker: "ETH", type: "ETH", values: { ...PRELOAD.ETH } },
  ];

  /* ---------- Assets con el último dato on-chain real superpuesto ----------
     PRELOAD queda como base (campos que ChartInspect no trae: ssr, funding,
     netflow, doi, rhodl, reserve, lthSup, netEmS/L); el resto (precio, SOPR,
     NUPL, MVRV-Z, técnicos…) se sobreescribe con la última fila real cargada
     por btc_real.js / eth_real.js, para que nunca queden desactualizados. */
  function freshAssets() {
    return ASSETS_INIT.map(a => {
      const R = typeof window !== "undefined" && window.BambuRealData && window.BambuRealData[a.type];
      if (!R || !R.count) return { ...a, values: { ...a.values } };
      const last = R.rowAt(R.count - 1);
      return { ...a, values: { ...a.values, ...last } };
    });
  }

  /* ---------- Backtest · 15 fechas (composite y señal autoritativos del Excel) ---------- */
  const BACKTEST = [
    { date: "Nov 2017", evt: "Top ciclo 2017",     price: 19800, comp: -1.60, sig: "VENTA FUERTE", mov: -45, out: "Corrección −83% en 12 meses hasta 3.2k" },
    { date: "Dic 2018", evt: "Suelo ciclo 2018",    price: 3200,  comp: 1.83,  sig: "COMPRA FUERTE", mov: 60,  out: "Suelo confirmado · +540% en 18 meses" },
    { date: "Mar 2020", evt: "Crash COVID",         price: 4900,  comp: 1.55,  sig: "COMPRA FUERTE", mov: 120, out: "Suelo · +1300% en 20 meses" },
    { date: "Abr 2021", evt: "ATH parcial",         price: 64000, comp: -1.13, sig: "REDUCIR",       mov: -30, out: "Corrección −53% en 3 meses" },
    { date: "Jul 2021", evt: "Mid-cycle bottom",    price: 30000, comp: 0.25,  sig: "NEUTRAL",       mov: 50,  out: "Recuperación +130%" },
    { date: "Nov 2021", evt: "Top ciclo 2021",      price: 69000, comp: -1.28, sig: "REDUCIR",       mov: -40, out: "Corrección −77% en 12 meses" },
    { date: "Jun 2022", evt: "Crash Luna",          price: 19000, comp: 1.35,  sig: "COMPRA",        mov: -20, out: "Caída adicional −18% hasta 15.5k" },
    { date: "Nov 2022", evt: "FTX bottom",          price: 15500, comp: 1.83,  sig: "COMPRA FUERTE", mov: 35,  out: "Suelo · +180% en 12 meses" },
    { date: "Mar 2023", evt: "Recovery SVB",        price: 24500, comp: 0.80,  sig: "COMPRA",        mov: 25,  out: "Rally +20% en 4 meses" },
    { date: "Oct 2023", evt: "ETF rally",           price: 34500, comp: 0.53,  sig: "COMPRA",        mov: 80,  out: "Rally +110% en 5 meses" },
    { date: "Mar 2024", evt: "ATH post-halving",    price: 73000, comp: -0.58, sig: "REDUCIR",       mov: -25, out: "Corrección −25%" },
    { date: "Ago 2024", evt: "Carry trade",         price: 54000, comp: 0.23,  sig: "NEUTRAL",       mov: 60,  out: "Recuperación +90%" },
    { date: "Dic 2024", evt: "Pico post-elección",  price: 107000,comp: -0.78, sig: "REDUCIR",       mov: -30, out: "Corrección −30% en 4 meses" },
    { date: "Abr 2025", evt: "Tariff scare",        price: 76000, comp: -0.08, sig: "NEUTRAL",       mov: 25,  out: "Recuperación +25% en 6 sem" },
    { date: "Hoy",      evt: "Lectura actual",      price: 95000, comp: -0.25, sig: "NEUTRAL",       mov: 0,   out: "TBD", today: true },
  ];

  /* ---------- Estadísticas del modelo ---------- */
  const STATS = {
    hitRate: 0.9090909090909091,
    profitFactor: 24.5,
    maxDrawdown: 0.2,
    equityFinal: 1563.705,
    grossWin: 490,
    grossLoss: 20,
    totalSignals: 11,
    totalHits: 10,
    buckets: [
      { sig: "COMPRA FUERTE", n: 3, hits: 3, hr: 1,    avg: 71.67 },
      { sig: "COMPRA",        n: 3, hits: 2, hr: 0.667, avg: 28.33 },
      { sig: "NEUTRAL",       n: 3, hits: null, hr: null, avg: 45 },
      { sig: "REDUCIR",       n: 4, hits: 4, hr: 1,    avg: -31.25 },
      { sig: "VENTA FUERTE",  n: 1, hits: 1, hr: 1,    avg: -45 },
    ],
  };

  /* ---------- Interpretación por régimen (Regimen sheet) ---------- */
  const REGIMES = {
    "BULL MARKET":   { mult: 1.10, read: "Composite +1 descuenta entusiasmo; −1 confirma corrección sana.", action: "Buy the dip · respetar stops · no aumentar leverage." },
    "BEAR MARKET":   { mult: 0.70, read: "Composite +1 puede ser bull trap; −1 puede prolongarse meses.",   action: "Posición defensiva · DCA muy lento · paciencia." },
    "ACUMULACIÓN":   { mult: 1.20, read: "Bias bullish estructural; cualquier compra es prematura pero sólida.", action: "Acumular en tramos · horizonte largo · ignorar volatilidad." },
    "DISTRIBUCIÓN":  { mult: 0.60, read: "Bias bajista; las recuperaciones son trampas tácticas.",          action: "Reducir lentamente · cubrir parcialmente · no buy the dip." },
  };

  window.BambuData = {
    PALETTES, ZONES, SIGNALS, REGIMES, metricsFor, PRELOAD, ASSETS_INIT, freshAssets,
    BACKTEST, STATS, BASE_WEIGHT: 0.05,
  };
})();
