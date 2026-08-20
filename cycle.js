/* ============================================================
   BAMBÚ · Datos de ciclos de halving de Bitcoin
   Fechas y precios públicos. Cálculos de countdown en vivo.
   ============================================================ */
(function () {
  "use strict";
  const DAY = 86400000;
  const d = s => new Date(s + "T00:00:00Z");
  const daysBetween = (a, b) => Math.round((d2(b) - d2(a)) / DAY);
  function d2(x) { return x instanceof Date ? x : d(x); }
  const fmtES = x => d2(x).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

  const halvings = [
    { n: 0, date: "2009-01-03", reward: 50,     label: "Génesis" },
    { n: 1, date: "2012-11-28", reward: 25,     label: "1er halving" },
    { n: 2, date: "2016-07-09", reward: 12.5,   label: "2º halving" },
    { n: 3, date: "2020-05-11", reward: 6.25,   label: "3er halving" },
    { n: 4, date: "2024-04-20", reward: 3.125,  label: "4º halving" },
    { n: 5, date: "2028-04-17", reward: 1.5625, label: "5º halving", est: true },
  ];

  // ciclos (numeración con génesis = 1 · el actual es el 5º, tras el 4º halving)
  // low = suelo macro previo a la subida · high = ATH del ciclo
  const cycles = [
    { n: 1, halvingLabel: "Génesis", start: "2009-01-03", end: "2012-11-28", block: 0, reward: 50, partial: true,
      low: { p: 0.05, d: "2010-07-18" }, high: { p: 31, d: "2011-06-08" } },
    { n: 2, halvingLabel: "1er halving", start: "2012-11-28", end: "2016-07-09", block: 210000, reward: 25,
      low: { p: 2.0, d: "2011-11-18" }, high: { p: 1163, d: "2013-11-29" } },
    { n: 3, halvingLabel: "2º halving", start: "2016-07-09", end: "2020-05-11", block: 420000, reward: 12.5,
      low: { p: 164, d: "2015-01-14" }, high: { p: 19783, d: "2017-12-17" } },
    { n: 4, halvingLabel: "3er halving", start: "2020-05-11", end: "2024-04-20", block: 630000, reward: 6.25,
      low: { p: 3191, d: "2018-12-15" }, high: { p: 68789, d: "2021-11-10" } },
    { n: 5, halvingLabel: "4º halving", start: "2024-04-20", end: "2028-04-17", block: 840000, reward: 3.125, current: true,
      low: { p: 15476, d: "2022-11-21" }, high: { p: 124715, d: "2025-10-06" } },
  ];

  // enriquecer: duración, fase alcista (halving→ATH) y bajista (ATH→siguiente suelo)
  cycles.forEach((c, i) => {
    c.dispN = c.n - 1;                                       // numeración de display: génesis = 0
    c.duration = daysBetween(c.start, c.end);
    c.bullDays = daysBetween(c.start, c.high.d);            // halving → ATH
    c.peakDays = c.bullDays;
    const next = cycles[i + 1];
    c.bearDays = next ? daysBetween(c.high.d, next.low.d) : null; // ATH → siguiente suelo macro
    c.roi = c.high.p / c.low.p;
    c.drawdown = next ? (next.low.p / c.high.p - 1) : null; // caída ATH→suelo siguiente
  });

  // promedios de las fases con datos completos (ciclos halving 2–4)
  const completed = cycles.filter(c => c.bearDays != null && c.n >= 2);
  const avgBull = Math.round(completed.reduce((a, c) => a + c.bullDays, 0) / completed.length);
  const avgBear = Math.round(completed.reduce((a, c) => a + c.bearDays, 0) / completed.length);

  // forma esquemática del ciclo (progreso 0..1 → altura 0..1)
  const SHAPE = [
    [0.00, 0.16], [0.08, 0.24], [0.16, 0.36], [0.26, 0.55], [0.34, 0.78],
    [0.42, 0.97], [0.46, 1.00], [0.52, 0.66], [0.58, 0.80], [0.64, 0.52],
    [0.72, 0.34], [0.80, 0.20], [0.87, 0.13], [0.93, 0.18], [1.00, 0.30],
  ];

  const PHASES = [
    { from: 0.00, to: 0.20, name: "Acumulación", temp: 14 },
    { from: 0.20, to: 0.42, name: "Expansión / Markup", temp: 50 },
    { from: 0.42, to: 0.52, name: "Euforia / Distribución", temp: 92 },
    { from: 0.52, to: 0.78, name: "Corrección / Markdown", temp: 58 },
    { from: 0.78, to: 0.95, name: "Capitulación / Suelo", temp: 12 },
    { from: 0.95, to: 1.00, name: "Acumulación temprana", temp: 26 },
  ];

  function computeNow(now) {
    now = now ? d2(now) : new Date();
    const cur = cycles.find(c => c.current);
    const lastH = halvings.find(h => h.n === 4);
    const nextH = halvings.find(h => h.n === 5);
    const daysSince = daysBetween(lastH.date, now);
    const daysUntil = daysBetween(now, nextH.date);
    const cycleLen = daysBetween(lastH.date, nextH.date);
    const progress = Math.max(0, Math.min(1, daysSince / cycleLen));
    const phase = PHASES.find(p => progress >= p.from && progress < p.to) || PHASES[PHASES.length - 1];
    // fase macro alcista/bajista respecto al ATH del ciclo actual
    const ath = cur.high;
    const athPassed = now >= d2(ath.d);
    const daysSinceATH = athPassed ? daysBetween(ath.d, now) : null;
    const daysToATH = athPassed ? null : daysBetween(now, ath.d);
    const bullDone = daysBetween(cur.start, ath.d);
    // proyección de suelo: ATH + promedio de bear histórico
    const projBottom = new Date(d2(ath.d).getTime() + avgBear * DAY);
    const daysToProjBottom = athPassed ? daysBetween(now, projBottom) : null;
    const macroPhase = athPassed ? "Bajista · markdown" : "Alcista · markup";
    return { now, cur, lastH, nextH, daysSince, daysUntil, cycleLen, progress, phase,
             cycleNumber: 4, reward: 3.125,
             ath, athPassed, daysSinceATH, daysToATH, bullDone, macroPhase,
             avgBull, avgBear, projBottom, daysToProjBottom };
  }

  window.BambuCycle = { halvings, cycles, SHAPE, PHASES, computeNow, daysBetween, fmtES, avgBull, avgBear };
})();
