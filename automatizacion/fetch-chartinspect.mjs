// ============================================================
// Bambu · fetch-chartinspect.mjs  (v2 · corregido para la API real)
// Trae las métricas del día desde ChartInspect y guarda datos-hoy.json.
// Node 18+ (usa fetch nativo).
//
// USO:
//   export CHARTINSPECT_API_KEY="tu-key"      (Windows: set CHARTINSPECT_API_KEY=...)
//   node fetch-chartinspect.mjs
//
// Doc oficial: https://chartinspect.com/api-docs/api/data
//   - Auth:   header  x-api-key: TU_KEY
//   - Endpoint: GET https://chartinspect.com/api/v1/onchain/{metric}?chain=bitcoin&days=2
//   - Respuesta: { success, metric, chain, data:[ { date, btc_price, <campos...> } ] }
//   - Requiere plan Pro para datos on-chain.
// ============================================================
import { writeFile } from "node:fs/promises";

const API_KEY = process.env.CHARTINSPECT_API_KEY;
if (!API_KEY) { console.error("Falta CHARTINSPECT_API_KEY"); process.exit(1); }

const BASE = "https://chartinspect.com/api/v1";

// ------------------------------------------------------------
// MAPEO: campo Bambu -> { metric: id ChartInspect, fields: [posibles nombres del valor] }
// El script prueba los nombres de "fields" en orden y usa el primero que exista.
// Si ninguno coincide, avisa y lista los campos disponibles para que ajustes.
//
// IDs CONFIRMADOS en la documentación (no cambiar):
//   mvrv, mvrv-z-score, nupl, sth-nupl, lth-nupl, sopr, sth-sopr, lth-sopr, daily-issuance
// Campos internos (btc_price, mvrv_ratio, sopr...) confirmados donde se indica;
// los marcados "verificar" son la mejor estimación: revísalos en el Playground.
// ------------------------------------------------------------
const METRIC_MAP = {
  // --- Realized Price por cohorte (verificar id/campos en el Playground) ---
  rpSTH:   { metric: "sth-realized-price", fields: ["realized_price", "sth_realized_price", "value"] },
  rpLTH:   { metric: "lth-realized-price", fields: ["realized_price", "lth_realized_price", "value"] },

  // --- SOPR (ids confirmados) ---
  sthSopr: { metric: "sth-sopr", fields: ["sopr", "sth_sopr", "value"] },
  lthSopr: { metric: "lth-sopr", fields: ["sopr", "lth_sopr", "value"] },
  asopr:   { metric: "sopr",     fields: ["sopr", "asopr", "value"] },

  // --- NUPL por cohorte (ids confirmados) ---
  nuplSTH: { metric: "sth-nupl", fields: ["nupl", "sth_nupl", "value"] },
  nuplLTH: { metric: "lth-nupl", fields: ["nupl", "lth_nupl", "value"] },

  // --- Valuación (ids confirmados) ---
  mvrvZ:   { metric: "mvrv-z-score", fields: ["mvrv_z_score", "z_score", "zscore", "value"] },
  puell:   { metric: "daily-issuance", fields: ["puell_multiple", "puell", "value"] },

  // --- Técnicos / momentum (verificar: pueden estar en market-indicators) ---
  mayer:   { metric: "mayer-multiple", fields: ["mayer_multiple", "mayer", "value"] },
  rsi1d:   { metric: "rsi", fields: ["rsi", "rsi_14", "value"] },
  // Campos que Bambu tiene pero que quizá no expone ChartInspect directamente:
  // rpSTH/rpLTH alternativos, ma2y, picycle, cdd, rsi1w, ema1d/1w, bb1d/1w, lthSopr...
  // Si no hay id para alguno, el script lo omite y Bambu hace forward-fill.
};

// El precio viene GRATIS dentro de cualquier respuesta on-chain (campo btc_price / eth_price).
const PRICE_FIELDS = ["btc_price", "eth_price", "close", "price"];

const CHAIN = { BTC: "bitcoin", ETH: "ethereum" };

function pickField(row, candidates) {
  for (const c of candidates) {
    if (row[c] != null && Number.isFinite(Number(row[c]))) return Number(row[c]);
  }
  return null;
}

async function fetchMetric(chain, metricId) {
  const url = `${BASE}/onchain/${metricId}?chain=${chain}&days=2`;
  const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${t.slice(0, 120)}`);
  }
  const json = await res.json();
  const arr = json.data || [];
  if (!arr.length) throw new Error("sin data");
  return arr[arr.length - 1]; // fila más reciente
}

async function fetchAsset(assetKey) {
  const chain = CHAIN[assetKey];
  const values = {};
  let iso = null, priceSet = false;

  // dedupe: cada metric id se pide una sola vez
  const wanted = Object.entries(METRIC_MAP);
  const cache = {};

  for (const [field, spec] of wanted) {
    try {
      if (!cache[spec.metric]) cache[spec.metric] = await fetchMetric(chain, spec.metric);
      const row = cache[spec.metric];
      if (!iso) iso = (row.date || row.formattedDate || "").slice(0, 10);
      // precio (una vez)
      if (!priceSet) { const p = pickField(row, PRICE_FIELDS); if (p != null) { values.price = p; priceSet = true; } }
      // valor de la métrica
      const v = pickField(row, spec.fields);
      if (v != null) values[field] = v;
      else console.warn(`  ${assetKey}.${field}: no encontré ${spec.fields.join("/")} en '${spec.metric}'. Campos: ${Object.keys(row).join(", ")}`);
    } catch (e) {
      console.warn(`  ${assetKey}.${field} (${spec.metric}): ${e.message} — se omite`);
    }
  }
  if (!iso) throw new Error(`${assetKey}: no se obtuvo fecha`);
  return { iso, values };
}

const out = {};
for (const asset of ["BTC", "ETH"]) {
  console.log(`Trayendo ${asset}…`);
  out[asset] = await fetchAsset(asset);
}
await writeFile("datos-hoy.json", JSON.stringify(out, null, 2));
console.log("OK → datos-hoy.json");
console.log("Revisa arriba si algún campo salió con aviso: corrige su id/campo en METRIC_MAP usando el Playground de ChartInspect.");
