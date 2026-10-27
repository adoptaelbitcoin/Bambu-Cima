// ============================================================
// Bambú · trae de ChartInspect (API v1, cabecera x-api-key) los campos de
// origen de BTC y ETH, y el precio de cierre diario de Binance.
//
// Uso:  node automatizacion/traer-chartinspect.mjs <salida.json> [desde AAAA-MM-DD]
//   Sin "desde": empieza 2 días antes del último que ya tiene app/*_real.js (revisiones).
//   Escribe { "BTC": { "AAAA-MM-DD": {campo: valor} }, "ETH": {...} } para bambu-datos.mjs.
// Mapeo comprobado contra los datos ya publicados (oct-2026).
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const KEY = process.env.CHARTINSPECT_API_KEY;
if (!KEY) { console.error("Falta CHARTINSPECT_API_KEY"); process.exit(1); }
const API = "https://chartinspect.com/api/v1/onchain";
const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DIA = 864e5;
const iso = t => new Date(t).toISOString().slice(0, 10);
const masDias = (d, n) => iso(Date.parse(d + "T00:00:00Z") + n * DIA);

// [campo Bambú, métrica, campo de la respuesta, media móvil simple a aplicar (días) o null, decimales]
const MAPA = {
  BTC: [
    ["rpSTH", "sth-cost-basis", "sth_cost_basis", null, 0],
    ["rpLTH", "lth-cost-basis", "lth_cost_basis", null, 0],
    ["sthSopr", "sth-sopr", "sth_sopr", 7, 4],
    ["lthSopr", "lth-sopr", "lth_sopr", 7, 4],
    ["asopr", "sopr", "asopr_sma7", null, 4],
    ["nuplSTH", "sth-nupl", "sth_nupl", null, 4],
    ["nuplLTH", "lth-nupl", "lth_nupl", null, 4],
    ["mvrvZ", "mvrv-z-score", "z_score", null, 4],
    ["puell", "puell-multiple", "puell_multiple", null, 4],
    ["spProf", "sth-in-profit", "pct_sth_in_profit", null, 2],
  ],
  ETH: [
    ["rpSTH", "sth-cost-basis", "sth_cost_basis", null, 2],
    ["rpLTH", "lth-cost-basis", "lth_cost_basis", null, 0],
    ["sthSopr", "sth-sopr", "sth_sopr", 7, 4],
    ["lthSopr", "lth-sopr", "lth_sopr", 7, 4],
    ["asopr", "asopr", "adjusted_sopr", 7, 4],
    ["nuplSTH", "sth-nupl", "sth_nupl", null, 4],
    ["nuplLTH", "lth-nupl", "lth_nupl", null, 4],
    ["mvrvZ", "mvrv-z-score", "z_score", null, 4],
    ["spProf", "sth-in-profit", "pct_sth_in_profit", null, 2],
  ],
};
const CADENA = { BTC: "bitcoin", ETH: "ethereum" };
const PAR = { BTC: ["BTCUSDT", 0], ETH: ["ETHUSDT", 1] };

const redondear = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

async function pedir(url, cabeceras = {}) {
  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch(url, { headers: cabeceras });
    if (res.ok) return res.json();
    if (intento === 3 || res.status < 500 && res.status !== 429) throw new Error(`${res.status} en ${url.replace(/\?.*/, "")}: ${(await res.text()).slice(0, 160)}`);
    await new Promise(s => setTimeout(s, 3000 * intento));
  }
}

// Serie diaria { fecha: valor } de un campo de una métrica
async function serie(cadena, metrica, campo, desde, hasta) {
  const url = `${API}/${metrica}?chain=${cadena}&startDate=${desde}&endDate=${hasta}&fields=${campo}`;
  const j = await pedir(url, { "x-api-key": KEY });
  const filas = Array.isArray(j) ? j : j.data;
  if (!Array.isArray(filas)) throw new Error(`Respuesta inesperada de ${metrica} (${cadena})`);
  const out = {};
  for (const f of filas) { const v = Number(f[campo]); if (f[campo] != null && Number.isFinite(v)) out[String(f.date).slice(0, 10)] = v; }
  return out;
}

// Media simple de n días que termina en "dia" (null si falta algún día)
function mediaSimple(s, dia, n) {
  let suma = 0;
  for (let k = 0; k < n; k++) { const v = s[masDias(dia, -k)]; if (v == null) return null; suma += v; }
  return suma / n;
}

async function cierresBinance(simbolo, desde, hasta) {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${simbolo}&interval=1d&startTime=${Date.parse(desde + "T00:00:00Z")}&endTime=${Date.parse(hasta + "T23:59:59Z")}&limit=1000`;
  const out = {};
  for (const k of await pedir(url)) out[iso(k[0])] = Number(k[4]);
  return out;
}

export async function traer(activo, desde, hasta) {
  const cadena = CADENA[activo], filas = {};
  for (let d = desde; d <= hasta; d = masDias(d, 1)) filas[d] = {};
  const [par, dec] = PAR[activo];
  const precios = await cierresBinance(par, desde, hasta);
  for (const d in filas) filas[d].price = redondear(precios[d], dec);
  for (const [f, metrica, campo, media, decs] of MAPA[activo]) {
    const s = await serie(cadena, metrica, campo, media ? masDias(desde, -media) : desde, hasta);
    for (const d in filas) filas[d][f] = redondear(media ? mediaSimple(s, d, media) : s[d], decs);
  }
  // CDD: oscilador = media 90 días / media 365 días de los días destruidos
  if (activo === "BTC") {
    const m90 = await serie(cadena, "cdd-vdd", "cdd_90_ma", desde, hasta);
    const m365 = await serie(cadena, "cdd-vdd", "cdd_365_ma", desde, hasta);
    for (const d in filas) filas[d].cdd = m90[d] && m365[d] ? redondear(m90[d] / m365[d], 4) : null;
  } else {
    const s = await serie(cadena, "cdd", "cdd", masDias(desde, -370), hasta);
    for (const d in filas) { const a = mediaSimple(s, d, 90), b = mediaSimple(s, d, 365); filas[d].cdd = a && b ? redondear(a / b, 4) : null; }
  }
  return filas;
}

function ultimoDia(rel) {
  const ctx = { window: {} }; vm.runInNewContext(readFileSync(`${RAIZ}/${rel}`, "utf8"), ctx);
  return Object.values(ctx.window.BambuRealData)[0].latestIso;
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const [salida, desdeArg] = process.argv.slice(2);
  const hasta = iso(Date.now() - DIA);
  const out = {};
  for (const [activo, rel] of [["BTC", "app/btc_real.js"], ["ETH", "app/eth_real.js"]]) {
    // Pide también los 3 últimos días ya publicados, por si ChartInspect los ha revisado
    const desde = desdeArg || masDias(ultimoDia(rel), -2);
    if (desde > hasta) { console.log(`${activo}: ya está al día`); out[activo] = {}; continue; }
    out[activo] = await traer(activo, desde, hasta);
    console.log(`${activo}: datos de ${desde} a ${hasta}`);
  }
  writeFileSync(salida, JSON.stringify(out, null, 1));
}
