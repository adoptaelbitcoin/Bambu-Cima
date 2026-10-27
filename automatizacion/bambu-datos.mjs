// ============================================================
// Bambú · añade días nuevos a app/btc_real.js y app/eth_real.js,
// calcula los campos derivados y regenera app/history.js y bambu2/data.js.
//
// Entrada: un JSON { "BTC": { "AAAA-MM-DD": {campo: valor, ...} }, "ETH": {...} }
// con los campos de ChartInspect (ver CAMPOS_ORIGEN). Lo genera traer-chartinspect.mjs.
//
// Uso:  node automatizacion/bambu-datos.mjs automatizacion/datos-nuevos.json
// Fórmulas comprobadas al decimal contra los datos existentes (oct-2026).
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ARCHIVO = { BTC: "app/btc_real.js", ETH: "app/eth_real.js" };

// Campos que vienen de ChartInspect. Un día solo se añade si trae todos los OBLIGATORIOS.
const CAMPOS_ORIGEN = ["price", "rpSTH", "rpLTH", "sthSopr", "asopr", "lthSopr", "nuplSTH", "nuplLTH", "mvrvZ", "cdd", "puell", "spProf",
  "supplyP", "sthLoss", "exBal", "exFlow", "netflow", "exFlow30", "lthSupply", "lthSupplyPct", "lthNet30"];
// Campos que estuvieron parados desde el 9-sep-2026; "--rellenar AAAA-MM-DD" los rehace desde esa fecha
const RELLENO = ["supplyP", "sthLoss", "exBal", "exFlow", "netflow", "exFlow30", "lthSupply", "lthSupplyPct", "lthNet30"];
const OBLIGATORIOS = ["price", "rpSTH", "rpLTH", "sthSopr", "nuplSTH", "nuplLTH"];

// Medias de series on-chain: [campo, base, periodo, tipo]
const MEDIAS = [
  ["sthSoprE7", "sthSopr", 7, "ema"], ["sthSoprE14", "sthSopr", 14, "ema"],
  ["asoprE7", "asopr", 7, "ema"], ["asoprE14", "asopr", 14, "ema"],
  ["nuplSTHs7", "nuplSTH", 7, "sma"], ["nuplSTHs14", "nuplSTH", 14, "sma"],
  ["lthSoprS28", "lthSopr", 28, "sma"], ["lthSoprS60", "lthSopr", 60, "sma"],
  ["nuplLTHs28", "nuplLTH", 28, "sma"], ["nuplLTHs60", "nuplLTH", 60, "sma"],
  ["asoprS14", "asopr", 14, "sma"], ["asoprS28", "asopr", 28, "sma"], ["asoprS60", "asopr", 60, "sma"],
  ["spProfE30", "spProf", 30, "ema"], ["spProfE60", "spProf", 60, "ema"], ["spProfE90", "spProf", 90, "ema"],
];
const DERIVADOS = new Set(["mayer", "ma2y", "picycle", "rsi1d", "ema1d", "bb1d", "rsi1w", "ema1w", "bb1w",
  "spLossE30", "spLossE60", "spLossE90", ...MEDIAS.map(m => m[0])]);

// ---------- utilidades ----------
const r = (v, d) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
const sig = (v, n = 6) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(n)));
const smaAt = (a, i, n) => { if (i < n - 1) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) { if (a[k] == null) return null; s += a[k]; } return s / n; };
const emaLast = (a, n) => { const al = 2 / (n + 1); let e = null; for (const v of a) { if (v == null) continue; e = e == null ? v : al * v + (1 - al) * e; } return e; };
function rsiLast(a, n = 14) {
  let g = 0, l = 0;
  for (let i = 1; i < a.length; i++) {
    const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; } } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
function pctB(a, n = 20) {
  if (a.length < n) return null;
  const w = a.slice(-n), m = w.reduce((x, y) => x + y) / n;
  const sd = Math.sqrt(w.reduce((x, y) => x + (y - m) ** 2, 0) / n);
  return sd === 0 ? null : (a[a.length - 1] - (m - 2 * sd)) / (4 * sd);
}
const sumarDia = iso => new Date(Date.parse(iso + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);

// ---------- leer y escribir los archivos de datos ----------
function cargar(rel) {
  const texto = readFileSync(`${RAIZ}/${rel}`, "utf8");
  const ctx = { window: {} }; vm.runInNewContext(texto, ctx);
  const D = Object.values(ctx.window.BambuRealData)[0];
  return { texto, fields: D.fields, dates: [...D.dates], cols: Object.fromEntries(D.fields.map(f => [f, [...D.cols[f]]])) };
}
function guardar(rel, B, activo) {
  const ini = B.texto.indexOf("var DATES="), fin = B.texto.indexOf("function rowAt");
  if (ini < 0 || fin < 0) throw new Error(`Formato inesperado en ${rel}`);
  const ultimo = B.dates.at(-1);
  const cabecera = B.texto.slice(0, ini)
    .replace(/· \d{4}-\d{2}-\d{2} · \d+ días ·/, `· ${ultimo} · ${B.dates.length} días ·`)
    .replace(/hasta \d{4}-\d{2}-\d{2}\./, `hasta ${ultimo}.`);
  const cols = "{" + B.fields.map(f => `${f}:${JSON.stringify(B.cols[f])}`).join(",") + "}";
  writeFileSync(`${RAIZ}/${rel}`, cabecera + `var DATES=${JSON.stringify(B.dates)};var COLS=${cols};\n  ` + B.texto.slice(fin));
  console.log(`${activo}: ${rel} ahora llega a ${ultimo} (${B.dates.length} días)`);
}

// ---------- calcular los derivados de un día (por defecto, el último) ----------
function derivar(B, i = B.dates.length - 1) {
  const C = B.cols, P = C.price.slice(0, i + 1);
  const set = (f, v) => { if (f in C) C[f][i] = v; };
  set("mayer", r(P[i] / smaAt(P, i, 200), 4));
  set("ma2y", r(P[i] / smaAt(P, i, 730), 4));
  set("picycle", r(smaAt(P, i, 111) / (2 * smaAt(P, i, 350)), 4));
  set("rsi1d", r(rsiLast(P), 2));
  set("ema1d", r((P[i] / emaLast(P, 21) - 1) * 100, 2));
  set("bb1d", r(pctB(P), 3));
  const sem = []; for (let k = i % 7; k <= i; k += 7) sem.push(P[k]); // velas de 7 días contadas desde hoy
  set("rsi1w", r(rsiLast(sem), 2));
  set("ema1w", r((P[i] / emaLast(sem, 21) - 1) * 100, 2));
  set("bb1w", r(pctB(sem), 3));
  for (const [f, base, n, tipo] of MEDIAS) {
    if (!(f in C)) continue;
    const v = C[base][i];
    if (tipo === "sma") { set(f, sig(smaAt(C[base], i, n))); continue; }
    const prev = C[f][i - 1], al = 2 / (n + 1);
    set(f, v == null ? prev : sig(prev == null ? v : al * v + (1 - al) * prev));
  }
  for (const n of [30, 60, 90]) if (C[`spProfE${n}`][i] != null) set(`spLossE${n}`, sig(100 - C[`spProfE${n}`][i]));
}

// ---------- añadir los días nuevos de un activo ----------
const DIAS_REVISION = 3; // ChartInspect corrige a veces los últimos días (sobre todo ETH)

function actualizarActivo(activo, nuevos, hasta, rellenarDesde) {
  const B = cargar(ARCHIVO[activo]);
  // 0) Rellenar los campos de RELLENO desde una fecha (solo esos campos; el resto del histórico no se toca)
  let rellenados = 0;
  if (rellenarDesde) for (let i = 0; i < B.dates.length; i++) {
    const fila = nuevos?.[B.dates[i]];
    if (B.dates[i] < rellenarDesde || !fila) continue;
    for (const f of RELLENO) {
      const v = fila[f];
      if (!(f in B.cols) || v == null || !Number.isFinite(v) || v === B.cols[f][i]) continue;
      B.cols[f][i] = v; rellenados++;
    }
  }
  if (rellenarDesde) console.log(`${activo}: ${rellenados} valores rellenados desde ${rellenarDesde}`);
  // 1) Corregir los últimos días ya publicados si ChartInspect ha revisado sus valores
  let desdeIdx = null;
  for (let i = Math.max(0, B.dates.length - DIAS_REVISION); i < B.dates.length; i++) {
    const fila = nuevos?.[B.dates[i]];
    if (!fila) continue;
    for (const f of CAMPOS_ORIGEN) {
      const v = fila[f];
      if (!(f in B.cols) || v == null || !Number.isFinite(v) || v === B.cols[f][i]) continue;
      console.log(`${activo} ${B.dates[i]}: ${f} corregido ${B.cols[f][i]} → ${v}`);
      B.cols[f][i] = v; desdeIdx = desdeIdx ?? i;
    }
  }
  if (desdeIdx != null) for (let i = desdeIdx; i < B.dates.length; i++) derivar(B, i);
  // 2) Añadir los días nuevos
  let dia = sumarDia(B.dates.at(-1)), añadidos = desdeIdx != null || rellenados ? 1 : 0;
  while (dia <= hasta) {
    const fila = nuevos?.[dia];
    const faltan = OBLIGATORIOS.filter(f => f in B.cols && (fila?.[f] == null || !Number.isFinite(fila[f])));
    if (faltan.length) { console.log(`${activo} ${dia}: ChartInspect aún no publica ${faltan.join(", ")}; se para aquí`); break; }
    B.dates.push(dia);
    for (const f of B.fields) {
      const ant = B.cols[f].at(-1);
      if (DERIVADOS.has(f)) B.cols[f].push(null);
      else if (CAMPOS_ORIGEN.includes(f) && fila[f] != null && Number.isFinite(fila[f])) B.cols[f].push(fila[f]);
      else {
        B.cols[f].push(ant); // sin dato nuevo: se mantiene el último valor, como hasta ahora
        if (CAMPOS_ORIGEN.includes(f) && ant != null) console.log(`AVISO ${activo} ${dia}: sin dato de ${f}; se repite el último valor`);
      }
    }
    derivar(B);
    añadidos++; dia = sumarDia(dia);
  }
  if (añadidos) guardar(ARCHIVO[activo], B, activo);
  else console.log(`${activo}: sin cambios (último ${B.dates.at(-1)})`);
  return { B, añadidos };
}

// ---------- bambu2/data.js: subconjunto de los mismos datos ----------
const MAPA2 = { p: "price", c: "rpSTH", n: "nuplLTH", cl: "rpLTH", s: "sthSoprE7", sp: "spProf", e30: "spProfE30", e60: "spProfE60", e90: "spProfE90" };
function generarBambu2(bases) {
  const out = {};
  for (const [activo, B] of Object.entries(bases)) {
    const i0 = B.dates.indexOf("2017-01-01");
    const o = { d: B.dates.slice(i0) };
    for (const [k, f] of Object.entries(MAPA2)) o[k] = B.cols[f].slice(i0);
    out[activo] = o;
  }
  writeFileSync(`${RAIZ}/bambu2/data.js`, `window.BAMBU2_DATA=${JSON.stringify(out)};`);
}

// ---------- principal ----------
const [entrada, opcion, rellenarDesde] = process.argv.slice(2);
const nuevos = entrada ? JSON.parse(readFileSync(entrada, "utf8")) : {};
const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const relleno = opcion === "--rellenar" ? rellenarDesde : null;
const res = { BTC: actualizarActivo("BTC", nuevos.BTC, ayer, relleno), ETH: actualizarActivo("ETH", nuevos.ETH, ayer, relleno) };
if (res.BTC.añadidos || res.ETH.añadidos) {
  const fecha = [res.BTC.B.dates.at(-1), res.ETH.B.dates.at(-1)].sort()[0];
  const h = `${RAIZ}/app/history.js`;
  writeFileSync(h, readFileSync(h, "utf8").replace(/BambuDataDate = "\d{4}-\d{2}-\d{2}"/, `BambuDataDate = "${fecha}"`));
  generarBambu2({ BTC: res.BTC.B, ETH: res.ETH.B });
  console.log(`Fecha de datos: ${fecha}. bambu2/data.js regenerado.`);
}
