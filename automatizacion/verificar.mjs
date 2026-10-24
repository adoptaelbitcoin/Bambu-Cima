// Bambú · compara lo que trae traer-chartinspect.mjs con los últimos días ya publicados.
// Uso: node automatizacion/verificar.mjs <informe.txt> [días=5]
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { traer } from "./traer-chartinspect.mjs";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const [salida, n = "5"] = process.argv.slice(2);
const lineas = [`Verificación ${new Date().toISOString()}`];
let malos = 0;
for (const [activo, rel] of [["BTC", "app/btc_real.js"], ["ETH", "app/eth_real.js"]]) {
  const ctx = { window: {} }; vm.runInNewContext(readFileSync(`${RAIZ}/${rel}`, "utf8"), ctx);
  const D = Object.values(ctx.window.BambuRealData)[0];
  const dias = D.dates.slice(-Number(n));
  const api = await traer(activo, dias[0], dias.at(-1));
  lineas.push(`\n== ${activo}  (publicado → API, error relativo)`);
  for (const campo of Object.keys(api[dias[0]])) {
    const celdas = dias.map(d => {
      const a = D.cols[campo]?.[D.dates.indexOf(d)], b = api[d][campo];
      const e = a == null || b == null ? null : Math.abs(a - b) / Math.max(1e-9, Math.abs(a));
      if (e == null || e > (campo === "price" ? 0.004 : 0.002)) malos++;
      return `${a}→${b}${e == null ? " ?" : e > 0.002 ? ` (${(e * 100).toFixed(2)}%)` : ""}`;
    });
    lineas.push(`${campo.padEnd(8)} ${celdas.join(" | ")}`);
  }
}
lineas.push(`\nCeldas fuera de tolerancia: ${malos}`);
writeFileSync(salida, lineas.join("\n") + "\n");
console.log(lineas.join("\n"));
