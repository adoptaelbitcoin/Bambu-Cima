# Formato de datos que espera Bambu

Bambu lee los datos reales desde dos archivos:

- `app/btc_real.js`  → registra `window.BambuRealData["BTC"]`
- `app/eth_real.js`  → registra `window.BambuRealData["ETH"]`

Cada archivo es un IIFE que define tres cosas y arma un objeto:

```js
(function () {
  "use strict";
  var FIELDS = ["price","rpSTH","rpLTH", ...];   // orden de las columnas
  var DATES  = ["2010-07-17", ..., "2026-07-13"]; // 1 fecha ISO por día, ascendente
  var COLS   = { price:[...], rpSTH:[...], ... }; // 1 array por campo, alineado con DATES
  function rowAt(i){var v={};for(var f=0;f<FIELDS.length;f++){var c=COLS[FIELDS[f]][i];if(c!==null)v[FIELDS[f]]=c;}return v;}
  function labelEs(iso){var d=new Date(iso+"T00:00:00Z");return d.toLocaleDateString("es-ES",{day:"2-digit",month:"short",timeZone:"UTC"});}
  window.BambuRealData=window.BambuRealData||{};
  window.BambuRealData["BTC"]={type:"BTC",fields:FIELDS,dates:DATES,cols:COLS,count:DATES.length,
    rowAt:rowAt,labelEs:labelEs,iso:function(i){return DATES[i];},price:function(i){return COLS.price[i];},
    latest:rowAt(DATES.length-1),latestIso:DATES[DATES.length-1],
    lastDays:function(n){var r=[],s=Math.max(0,DATES.length-n);for(var i=s;i<DATES.length;i++)r.push({i:i,iso:DATES[i],label:labelEs(DATES[i]),values:rowAt(i)});return r;},
    indexOfIso:function(iso){return DATES.indexOf(iso);}};
})();
```

## Reglas
- **DATES**: fechas ISO `YYYY-MM-DD`, orden ascendente (la última = hoy), una por día.
- **COLS[campo].length === DATES.length** siempre. Si un día no hay dato para un
  campo, repetir el último válido (forward-fill) o poner `null` (Bambu lo ignora).
- **Actualizar = añadir UNA fila**: push de la fecha nueva a `DATES` y push del
  valor nuevo a cada `COLS[campo]`. No hace falta recalcular el histórico.
- `window.BambuDataDate` en `app/history.js` debe fijarse a la última fecha
  (el build script lo actualiza automáticamente).

## Campos (FIELDS)

### BTC
`price, rpSTH, rpLTH, sthSopr, asopr, lthSopr, nuplSTH, nuplLTH, puell, cdd,
mvrvZ, mayer, ma2y, picycle, rsi1d, ema1d, bb1d, rsi1w, ema1w, bb1w`

### ETH
Mismos campos que BTC. (MVRV STH/LTH se derivan solos: price÷rpSTH y price÷rpLTH,
no se cargan.)

## Unidades y notas por campo
| Campo | Qué es | Unidad / rango típico |
|---|---|---|
| `price` | Precio de mercado | USD |
| `rpSTH` / `rpLTH` | Realized Price corto / largo plazo | USD |
| `sthSopr` / `lthSopr` / `asopr` | SOPR corto / largo / ajustado | ~0.9–1.1 (aSOPR), LTH puede >5 |
| `nuplSTH` / `nuplLTH` | NUPL corto / largo plazo | fracción, ej. 0.31 = 31% (puede ser negativo) |
| `puell` | Puell Multiple | ~0.3–4 |
| `cdd` | CDD como oscilador (CDD ÷ media 1 año) | ~0–5 |
| `mvrvZ` | MVRV Z-Score | ~-0.5 a 8 |
| `mayer` | Mayer Multiple (precio ÷ MA200) | ~0.5–2.8 |
| `ma2y` | Precio ÷ media 2 años | ~0.7–4 |
| `picycle` | Pi Cycle ratio (MA111 ÷ MA350×2) | 0–1.3 |
| `rsi1d` / `rsi1w` | RSI diario / semanal | 0–100 |
| `ema1d` / `ema1w` | Distancia % del precio a su EMA (diaria/semanal) | %, con signo |
| `bb1d` / `bb1w` | Posición en las Bandas de Bollinger (diaria/semanal) | 0 = banda baja, 1 = banda alta |

> El resto de métricas que aparecen en Bambu (SSR, netflow, reserve, rhodl,
> lthSup, doi, netEmS/L) hoy vienen del preload/derivadas; si tu plan de
> ChartInspect las incluye, se añaden a `FIELDS` y a `METRIC_MAP` igual que las demás.
