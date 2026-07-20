// ============================================================
// Bambu · fetch-chartinspect.mjs
// Trae las métricas del día desde ChartInspect (o tu fuente) y
// guarda datos-hoy.json. Node 18+ (usa fetch nativo).
//
// USO:
//   export CHARTINSPECT_API_KEY="tu-key"
//   node fetch-chartinspect.mjs
// ============================================================
import { writeFile } from "node:fs/promises";

const API_KEY = process.env.CHARTINSPECT_API_KEY;
if (!API_KEY) { console.error("Falta CHARTINSPECT_API_KEY"); process.exit(1); }

// Endpoint base de ChartInspect. Ajusta a la doc real de tu plan.
const BASE = "https://api.chartinspect.com/v1";

// ------------------------------------------------------------
// MAPEO: campo Bambu  ->  id de la métrica en ChartInspect.
// Revisa cada id contra la documentación de la API y corrígelo.
// Un valor null = no lo traes por API (se deja como estaba / forward-fill).
// ------------------------------------------------------------
const METRIC_MAP = {
  price:   "price_usd_close",
  rpSTH:   "realized_price_sth",
  rpLTH:   "realized_price_lth",
  sthSopr: "sth_sopr",
  asopr:   "asopr",
  lthSopr: "lth_sopr",
  nuplSTH: "nupl_sth",
  nuplLTH: "nupl_lth",
  puell:   "puell_multiple",
  cdd:     "cdd_oscillator",       // CDD ÷ media 1 año
  mvrvZ:   "mvrv_zscore",
  mayer:   "mayer_multiple",
  ma2y:    "price_over_2y_ma",
  picycle: "pi_cycle_ratio",
  rsi1d:   "rsi_daily",
  ema1d:   "price_ema_dist_daily",
  bb1d:    "bollinger_pos_daily",
  rsi1w:   "rsi_weekly",
  ema1w:   "price_ema_dist_weekly",
  bb1w:    "bollinger_pos_weekly",
};

// Pide UNA métrica (último valor) para un activo.
async function fetchMetric(asset, metricId) {
  // Ajusta la forma de la URL/params a tu API. Ejemplo genérico:
  const url = `${BASE}/metric/${metricId}?asset=${asset}&limit=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (!res.ok) throw new Error(`${asset}/${metricId}: HTTP ${res.status}`);
  const json = await res.json();
  // Se asume respuesta tipo { data: [{ t: "2026-07-13", v: 63039 }] }
  const last = Array.isArray(json.data) ? json.data[json.data.length - 1] : json;
  return { iso: (last.t || last.date || "").slice(0, 10), v: Number(last.v ?? last.value) };
}

async function fetchAsset(asset) {
  const values = {};
  let iso = null;
  for (const [field, metricId] of Object.entries(METRIC_MAP)) {
    if (!metricId) continue;
    try {
      const { iso: d, v } = await fetchMetric(asset, metricId);
      if (Number.isFinite(v)) values[field] = v;
      if (d) iso = d;
    } catch (e) {
      console.warn(`  aviso ${asset}.${field}: ${e.message} (se omite, forward-fill)`);
    }
  }
  if (!iso) throw new Error(`${asset}: no se obtuvo fecha`);
  return { iso, values };
}

const out = {};
for (const asset of ["BTC", "ETH"]) {
  console.log(`Trayendo ${asset}…`);
  out[asset] = await fetchAsset(asset);
}
await writeFile("datos-hoy.json", JSON.stringify(out, null, 2));
console.log("OK → datos-hoy.json");
