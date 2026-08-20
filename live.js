/* ============================================================
   BAMBÚ · Datos en vivo · 2 APIs gratuitas (sin clave)
   1) CoinGecko  → precio, % cambio, market cap, volumen (BTC/ETH)
   2) alternative.me → Fear & Greed (actual + historial)
   Funciona al abrir/publicar el archivo en un navegador normal.
   Dentro del editor (sandbox) las llamadas externas pueden fallar:
   en ese caso se mantienen los datos de muestra.
   ============================================================ */
(function () {
  "use strict";
  const CG = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h,7d,30d&precision=2";
  const FG = "https://api.alternative.me/fng/?limit=30&format=json";
  const GLOBAL = "https://api.coingecko.com/api/v3/global"; // opcional (dominancia real)

  async function jget(url, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms || 9000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // Llamada 1 — CoinGecko markets (BTC + ETH)
  async function fetchMarkets() {
    const arr = await jget(CG);
    const out = {};
    arr.forEach(c => {
      const sym = c.symbol.toUpperCase();
      out[sym] = {
        price: c.current_price,
        mcap: c.market_cap,
        vol: c.total_volume,
        d1: (c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0) / 100,
        d7: (c.price_change_percentage_7d_in_currency ?? 0) / 100,
        d30: (c.price_change_percentage_30d_in_currency ?? 0) / 100,
        ath: c.ath, athChg: (c.ath_change_percentage ?? 0) / 100,
        updated: c.last_updated,
      };
    });
    return out;
  }

  // Llamada 2 — Fear & Greed (alternative.me)
  async function fetchFearGreed() {
    const j = await jget(FG);
    const data = (j.data || []).slice().reverse(); // viejo→nuevo
    const series = data.map(d => ({
      value: +d.value,
      label: new Date(+d.timestamp * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    }));
    const cur = data[data.length - 1] || {};
    return { value: +cur.value, classification: cur.value_classification, series };
  }

  // (opcional) dominancia real — no cuenta como llamada esencial
  async function fetchGlobal() {
    const j = await jget(GLOBAL);
    const mc = j.data && j.data.market_cap_percentage || {};
    return { btc: mc.btc, eth: mc.eth, totalUsd: j.data && j.data.total_market_cap && j.data.total_market_cap.usd };
  }

  const fgLabelEs = v => v < 20 ? "Miedo extremo" : v < 40 ? "Miedo" : v < 55 ? "Neutral" : v < 75 ? "Codicia" : "Codicia extrema";

  window.BambuLive = {
    sources: [
      { name: "CoinGecko", what: "Precio · cambio % · market cap · volumen", url: "api.coingecko.com", free: true },
      { name: "Alternative.me", what: "Fear & Greed Index + 30 días", url: "api.alternative.me", free: true },
    ],
    // 2 llamadas en paralelo. Devuelve {ok, markets, fg, ts, errors}
    async fetchAll(opts) {
      opts = opts || {};
      const tasks = [fetchMarkets().catch(e => ({ __err: "markets:" + e.message })),
                     fetchFearGreed().catch(e => ({ __err: "fng:" + e.message }))];
      if (opts.global) tasks.push(fetchGlobal().catch(e => ({ __err: "global:" + e.message })));
      const [markets, fg, global] = await Promise.all(tasks);
      const errors = [markets, fg, global].filter(x => x && x.__err).map(x => x.__err);
      return {
        ok: !(markets && markets.__err) && !(fg && fg.__err),
        markets: markets && markets.__err ? null : markets,
        fg: fg && fg.__err ? null : fg,
        global: global && !global.__err ? global : null,
        errors, ts: Date.now(),
      };
    },
    fgLabelEs,
  };
})();
