// Descubre las métricas de ChartInspect que necesita Bambú y guarda una muestra.
// No escribe la clave en ningún sitio: solo la usa en la cabecera x-api-key.
import { writeFile } from "node:fs/promises";

const KEY = process.env.CHARTINSPECT_API_KEY;
if (!KEY) { console.error("Falta CHARTINSPECT_API_KEY"); process.exit(1); }
const BASE = "https://chartinspect.com/api/v1";
const WANT = /cost-basis|realized|sopr|nupl|mvrv|puell|cdd|profit|loss|supply/i;
const EXTRA = ["sth-cost-basis", "lth-cost-basis", "sth-sopr", "lth-sopr", "asopr", "sopr", "adjusted-sopr",
  "sth-nupl", "lth-nupl", "mvrv-z-score", "puell-multiple", "cdd-vdd", "cdd", "acdd",
  "active-supply-profit-loss", "percent-supply-in-profit", "supply-in-profit", "supply-profit-loss"];

async function get(path) {
  const res = await fetch(BASE + path, { headers: { "x-api-key": KEY } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

const out = { generado: new Date().toISOString(), cadenas: {} };
for (const chain of ["bitcoin", "ethereum"]) {
  const st = await get(`/onchain/status?chain=${chain}`);
  const lista = Array.isArray(st.body?.metrics) ? st.body.metrics : [];
  const c = { status: st.status, total: lista.length, metricas: lista.map(m => ({ metric: m.metric, fields: m.fields })), muestras: {} };
  if (!lista.length) c.respuesta = st.body;
  const nombres = new Set([...lista.map(m => m.metric).filter(m => WANT.test(m)), ...EXTRA]);
  for (const m of nombres) {
    const r = await get(`/onchain/${m}?chain=${chain}&startDate=2026-10-14&endDate=2026-10-24`);
    const rows = Array.isArray(r.body) ? r.body : (Array.isArray(r.body?.data) ? r.body.data : null);
    c.muestras[m] = rows ? { status: r.status, filas: rows.slice(-8) } : { status: r.status, respuesta: typeof r.body === "string" ? r.body : JSON.stringify(r.body).slice(0, 400) };
    await new Promise(s => setTimeout(s, 400));
  }
  out.cadenas[chain] = c;
  console.log(chain, "status", st.status, "métricas", lista.length, "muestras", Object.keys(c.muestras).length);
}
await writeFile("automatizacion/descubrimiento.json", JSON.stringify(out, null, 1));
