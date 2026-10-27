// Bambú · prueba: ¿qué métricas de ChartInspect reproducen los datos parados desde el 9-sep-2026?
// Pide cada métrica candidata con todos sus campos y compara cada campo numérico con la
// serie de Bambú cuando aún estaba viva. Solo escribe un informe; no toca los datos.
// Uso: node automatizacion/probar-exchanges.mjs <informe.txt>
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const KEY = process.env.CHARTINSPECT_API_KEY;
if (!KEY) { console.error("Falta CHARTINSPECT_API_KEY"); process.exit(1); }
const BASE = "https://chartinspect.com/api/v1";
const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DESDE = "2025-09-01", VIVO_HASTA = "2026-09-08", HASTA = new Date().toISOString().slice(0, 10);

// [activo, cadena, métricas candidatas, campos de Bambú a reproducir]
const PRUEBAS = [
  ["BTC", "bitcoin", ["exchange-net-position", "exchange-aggregate-balance", "network-estimated-exchange-reserves", "exchange-flow-volume", "network-estimated-exchange-flows"], ["exBal", "exFlow"]],
  ["BTC", "bitcoin", ["supply-in-profit", "sth-in-profit"], ["supplyP", "sthLoss"]],
  ["ETH", "ethereum", ["lth-sopr", "lth-net-position", "lth-supply"], ["lthSupply", "lthSupplyPct", "lthSoprRaw", "lthNet30"]],
];

const lineas = [`Prueba de métricas ChartInspect · ${new Date().toISOString()}`, `Comparación con Bambú del ${DESDE} al ${VIVO_HASTA}; frescura pedida hasta ${HASTA}.`];
const log = s => { lineas.push(s); console.log(s); };

async function get(ruta) {
  const res = await fetch(BASE + ruta, { headers: { "x-api-key": KEY } });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = null; }
  return { status: res.status, j, txt: txt.slice(0, 200) };
}
const fecha = f => {
  if (f.date) return String(f.date).slice(0, 10);
  const ts = f.timestamp ?? f.timeunix;
  if (ts) { const t = Number(ts); return new Date(t > 1e12 ? t : t * 1000).toISOString().slice(0, 10); }
  return f.formattedDate ? String(f.formattedDate).slice(0, 10) : null;
};
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

function bambu(activo) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(`${RAIZ}/app/${activo.toLowerCase()}_real.js`, "utf8"), ctx);
  return Object.values(ctx.window.BambuRealData)[0];
}

// Error típico de un campo de la API frente a una serie de Bambú (en % del valor típico)
function comparar(api, B, campo) {
  const errs = [], refs = [];
  for (let i = 0; i < B.dates.length; i++) {
    const d = B.dates[i];
    if (d < DESDE || d > VIVO_HASTA) continue;
    const a = B.cols[campo]?.[i], b = api[d];
    if (a == null || b == null) continue;
    errs.push(Math.abs(a - b)); refs.push(Math.abs(a));
  }
  if (errs.length < 20) return null;
  return { n: errs.length, err: 100 * mediana(errs) / Math.max(1e-9, mediana(refs)) };
}

for (const [activo, cadena, metricas, campos] of PRUEBAS) {
  const B = bambu(activo);
  log(`\n== ${activo} · objetivo: ${campos.join(", ")}`);
  const mejores = Object.fromEntries(campos.map(c => [c, []]));
  for (const m of metricas) {
    const r = await get(`/onchain/${m}?chain=${cadena}&startDate=${DESDE}&endDate=${HASTA}`);
    const filas = Array.isArray(r.j) ? r.j : Array.isArray(r.j?.data) ? r.j.data : null;
    if (!filas) { log(`${m}: HTTP ${r.status} · ${r.txt}`); continue; }
    const conFecha = filas.filter(fecha);
    const ultima = conFecha.map(fecha).sort().at(-1);
    log(`${m}: HTTP ${r.status} · ${filas.length} filas · último día ${ultima}`);
    const numericos = Object.keys(filas.at(-1) || {}).filter(k => !/date|timestamp|price|height/i.test(k) && Number.isFinite(Number(filas.at(-1)[k])));
    for (const k of numericos) {
      const serie = {};
      for (const f of conFecha) { const v = Number(f[k]); if (f[k] != null && Number.isFinite(v)) serie[fecha(f)] = v; }
      for (const c of campos) {
        const res = comparar(serie, B, c);
        if (res) mejores[c].push({ m, k, ...res, ultimo: serie[ultima] });
      }
    }
    await new Promise(s => setTimeout(s, 400));
  }
  for (const c of campos) {
    const top = mejores[c].sort((x, y) => x.err - y.err).slice(0, 3);
    log(`  ${c}: ` + (top.length ? top.map(t => `${t.m}.${t.k} → error típico ${t.err.toFixed(2)}% (${t.n} días), último valor ${t.ultimo}`).join("  |  ") : "ningún campo comparable"));
  }
}

log("\n== Endpoint de saldos de exchanges (exige permiso de exchanges)");
for (const ruta of ["/exchange-etf/list", "/exchange-etf/exchange-balances?days=400&limit=400"]) {
  const r = await get(ruta);
  const filas = Array.isArray(r.j) ? r.j : Array.isArray(r.j?.data) ? r.j.data : null;
  if (!filas) { log(`${ruta}: HTTP ${r.status} · ${r.txt}`); continue; }
  const B = bambu("BTC"), campos = Object.keys(filas.at(-1) || {});
  log(`${ruta}: HTTP ${r.status} · ${filas.length} filas · último día ${filas.map(fecha).filter(Boolean).sort().at(-1)} · campos: ${campos.slice(0, 20).join(", ")}`);
  const res = [];
  for (const k of campos.filter(k => Number.isFinite(Number(filas.at(-1)[k])) && !/time|price|height/i.test(k))) {
    const serie = {}; for (const f of filas) if (fecha(f) && Number.isFinite(Number(f[k]))) serie[fecha(f)] = Number(f[k]);
    const c = comparar(serie, B, "exBal"); if (c) res.push(`${k} ${c.err.toFixed(2)}%`);
  }
  if (res.length) log(`  exBal frente a: ${res.join(" | ")}`);
  // Los flujos de Bambú salen del saldo total: cambio de 1 día (exFlow) y de 30 días (exFlow30)
  if ("allexchanges" in (filas.at(-1) || {})) {
    const bal = {}; for (const f of filas) if (fecha(f)) bal[fecha(f)] = Number(f.allexchanges);
    const dias = Object.keys(bal).sort(), dif = n => Object.fromEntries(dias.map((d, i) => [d, i >= n ? bal[d] - bal[dias[i - n]] : null]));
    for (const [campo, n] of [["exFlow", 1], ["exFlow30", 30]]) { const c = comparar(dif(n), B, campo); log(`  ${campo} = cambio de ${n} día(s) de allexchanges → ${c ? `error típico ${c.err.toFixed(2)}% (${c.n} días)` : "sin comparación"}`); }
    log(`  últimos días: ${dias.slice(-5).map(d => `${d} ${Math.round(bal[d])}`).join(" · ")}`);
    log(`  Bambú antes de pararse: ${B.dates.slice(B.dates.indexOf("2026-09-05"), B.dates.indexOf("2026-09-10")).map(d => `${d} ${B.cols.exBal[B.dates.indexOf(d)]}`).join(" · ")}`);
    log(`  API esos días: ${["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"].map(d => `${d} ${Math.round(bal[d])}`).join(" · ")}`);
  }
}

writeFileSync(process.argv[2] || "automatizacion/prueba-exchanges.txt", lineas.join("\n") + "\n");
