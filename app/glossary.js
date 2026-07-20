/* ============================================================
   BAMBÚ · Glosario de métricas (explicaciones sencillas)
   Clave = m.key del esquema · usado por los tooltips "?"
   ============================================================ */
(function () {
  "use strict";
  window.BambuGlossary = {
    // ---------- STH · corto plazo ----------
    rpSTH:   { term: "Realized Price STH", def: "Precio promedio al que compraron los holders de corto plazo (monedas movidas hace menos de ~155 días). Si el precio actual está por debajo, ese grupo está en pérdidas." },
    mvrvSTH: { term: "MVRV STH", def: "Precio de mercado ÷ precio realizado de los holders de corto plazo. Por encima de 1 ganan; por debajo de 1 pierden. Valores muy altos = sobrecalentamiento; muy bajos = oportunidad." },
    sthSopr: { term: "STH-SOPR", def: "Indica si las monedas de corto plazo se venden con ganancia (>1) o con pérdida (<1). Por debajo de 1 sostenido suele señalar capitulación y posibles suelos locales." },
    nuplSTH: { term: "NUPL STH", def: "Ganancia o pérdida NO realizada de los holders de corto plazo, como % de su valor. Positivo = el grupo va ganando; negativo = va perdiendo (suele coincidir con miedo)." },
    ssr:     { term: "SSR · Stablecoin Supply Ratio", def: "Compara el valor de Bitcoin con el de las stablecoins disponibles. Bajo = mucha 'pólvora seca' lista para comprar; alto = poco capital en espera." },
    cdd:     { term: "CDD · Coin Days Destroyed (oscilador)", def: "Mide cuántas monedas 'antiguas' se mueven. Aquí es un oscilador (CDD ÷ su media de 1 año): por encima de ~2, holders de largo plazo están distribuyendo; por debajo de ~0.5, las monedas duermen (acumulación)." },
    funding: { term: "Funding Rate", def: "Coste de mantener posiciones largas apalancadas en futuros perpetuos. Muy positivo y sostenido = euforia y exceso de apalancamiento alcista (riesgo de corrección)." },
    netflow: { term: "Exchange Netflow", def: "Flujo neto de monedas hacia/desde los exchanges. Negativo = la gente retira a billeteras frías (acumulan/HODL); positivo = ingresan monedas, posible intención de venta." },
    doi:     { term: "Δ Open Interest", def: "Cambio del interés abierto en derivados (contratos vivos). Subidas fuertes indican más apalancamiento en el sistema, lo que aumenta el riesgo de movimientos bruscos y liquidaciones." },
    ema1d:   { term: "EMA 200 — Desviación % (1D)", def: "Cuánto se aleja el precio de su media móvil exponencial de 200 días (diaria). Muy por encima = extendido/caro; muy por debajo = sobrevendido/barato respecto a su tendencia." },
    bb1d:    { term: "Bollinger %B (1D)", def: "Posición del precio dentro de las Bandas de Bollinger diarias. Cerca o por encima de 1 = pegado a la banda superior (sobrecompra); cerca o por debajo de 0 = banda inferior (sobreventa)." },
    rsi1d:   { term: "RSI 14 (1D)", def: "Índice de fuerza relativa diario (0–100). Por encima de 70 suele indicar sobrecompra; por debajo de 30, sobreventa. Mide el momentum reciente del precio." },
    netEmS:  { term: "ETH Net Emission % (anual)", def: "Emisión neta de ETH tras las quemas de comisiones (EIP-1559). Negativo = la oferta se reduce (deflación), un viento de cola estructural para el precio." },

    // ---------- LTH · largo plazo ----------
    rpLTH:   { term: "Realized Price LTH", def: "Precio promedio al que compraron los holders de largo plazo (monedas en manos firmes >155 días). Suele actuar como suelo histórico en mercados bajistas." },
    mvrvLTH: { term: "MVRV LTH", def: "Precio de mercado ÷ precio realizado de los holders de largo plazo. Bajo (<1) = oportunidad histórica; alto (>3.5) = ciclo maduro y riesgo de techo." },
    lthSopr: { term: "LTH-SOPR", def: "Mide si los holders de largo plazo venden con ganancia. Valores muy altos (>5) indican que las manos firmes están realizando beneficios fuertes, típico cerca de techos." },
    nuplLTH: { term: "NUPL LTH", def: "Ganancia/pérdida no realizada de los holders de largo plazo. Por encima de ~0.75 = euforia (zona de techo); por debajo de 0 = capitulación (zona de suelo)." },
    mvrvZ:   { term: "MVRV Z-Score", def: "Versión estandarizada del MVRV que resalta los extremos del ciclo. Muy alto = techo histórico; cercano o por debajo de 0 = suelo histórico de gran oportunidad." },
    rhodl:   { term: "RHODL Ratio", def: "Compara la riqueza de las monedas recién movidas frente a las muy antiguas. Picos extremos han marcado techos de ciclo de Bitcoin." },
    reserve: { term: "Reserve Risk", def: "Relaciona el precio con la confianza de los holders de largo plazo. Bajo = riesgo/recompensa atractivo para acumular; alto = el precio ha corrido más que la convicción (euforia)." },
    lthSup:  { term: "LTH Supply %", def: "Porcentaje de la oferta total en manos de holders de largo plazo. En aumento = acumulación y manos firmes; en caída = distribución hacia manos nuevas." },
    asopr:   { term: "aSOPR · Adjusted SOPR", def: "SOPR ajustado (ignora monedas movidas en menos de 1h). Por debajo de 1 = se vende en pérdida (capitulación); por encima de 1.05 = toma de ganancias generalizada." },
    mayer:   { term: "Mayer Multiple", def: "Precio ÷ media móvil de 200 días. Por encima de ~2.4 el mercado está sobreextendido (riesgo de techo); por debajo de 0.7, históricamente zona de suelo." },
    picycle: { term: "Pi Cycle Ratio", def: "Relación entre dos medias móviles (111 y 350×2 días). Cuando se acerca a 1 (cruce) ha coincidido históricamente con los techos de ciclo de Bitcoin." },
    ma2y:    { term: "2yMA Multiplier", def: "Precio frente a su media móvil de 2 años. Define una banda macro de ciclo: cerca del suelo de la banda = acumulación; muy por encima = techo." },
    puell:   { term: "Puell Multiple", def: "Mide los ingresos de los mineros frente a su media anual. Bajo = presión vendedora mínima (suelos); alto = mineros muy rentables vendiendo (techos)." },
    ema1w:   { term: "EMA 200 — Desviación % (1W)", def: "Cuánto se aleja el precio de su media exponencial de 200 semanas. Es una referencia macro de muy largo plazo para extremos de ciclo." },
    bb1w:    { term: "Bollinger %B (1W)", def: "Posición del precio dentro de las Bandas de Bollinger semanales. Útil para detectar extremos de ciclo: pegado a la banda superior (euforia) o inferior (capitulación)." },
    rsi1w:   { term: "RSI 14 (1W)", def: "Índice de fuerza relativa semanal (0–100). Mide el momentum macro: lecturas altas sostenidas acompañan tendencias alcistas maduras; bajas, mercados bajistas." },
    netEmL:  { term: "ETH Net Emission % (anual)", def: "Emisión neta de ETH a largo plazo tras las quemas (EIP-1559). Persistentemente negativa = oferta decreciente, soporte estructural del precio." },

    // ---------- conceptos generales ----------
    temperatura: { term: "Temperatura (0–100°)", def: "Resume en un solo número si un horizonte está frío o caliente. Frío (azul, cerca de 0°) = mercado barato respecto a su historia, zona de acumulación; templado (neutral) = sin ventaja clara; caliente (rojo, cerca de 100°) = mercado caro/eufórico, zona de distribución. Se calcula combinando todas las métricas del horizonte y es la base de la zona que marca Bambu." },
    enEspera: { term: "En espera (USD, resto)", def: "La parte de tu capital que conviene NO tener invertida ahora, guardada en efectivo o stablecoins. Es 'pólvora seca': munición lista para comprar en tramos si el precio sigue barato, o simplemente capital protegido mientras no hay ventaja clara." },
    regimen: { term: "Régimen y tamaño de compra", def: "El régimen es la fase amplia del mercado (acumulación, alcista, neutral, distribución o bajista), detectada con métricas de largo plazo. Según la fase, Bambu ajusta CUÁNTO conviene invertir en cada compra: en acumulación puedes poner hasta un 20% más de lo habitual (es la mejor zona histórica); en mercado bajista, solo un 70% de lo habitual, porque la caída puede continuar y conviene guardar munición. No cambia la señal (comprar/vender), cambia el tamaño del paso." },
    conviccion: { term: "Índice de convicción", def: "Resume todas las métricas de un horizonte en un solo número. Positivo = las métricas apuntan a que el mercado está barato (convicción de compra); negativo = apuntan a que está caro (convicción de venta); cerca de 0 = sin ventaja clara. Cuanto más lejos de 0, más de acuerdo están las métricas entre sí y más fiable es la lectura. Su histórico muestra si la convicción está mejorando o deteriorándose." },
    posLong: { term: "LONG · exposición comprada", def: "Porcentaje de tu portafolio que conviene tener COMPRADO en el activo según la señal de ese horizonte, ya ajustado por la fase del mercado. Ejemplo: LONG 8% = de cada $100, unos $8 invertidos en el activo." },
    posHedge: { term: "HEDGE · cobertura", def: "Porcentaje sugerido de protección frente a caídas (por ejemplo, mantener en USD/stablecoins o instrumentos inversos). Actúa como seguro: cuanto más caliente el mercado, mayor cobertura. Si no usas coberturas, léelo como 'parte que conviene NO tener invertida'." },
    posNet: { term: "Posición neta", def: "El resultado final: lo invertido menos la cobertura. Es tu posición real en el activo. Positivo y verde = posición neta compradora; cercano a 0 = neutral; negativo = postura defensiva. Es el número que debes comparar con lo que realmente tienes invertido." },
    diagMatriz: { term: "Matriz Diagnóstico y decisión STH × LTH", def: "Cruza el estado del corto plazo (STH: ¿conviene comprar YA?) con el del largo plazo (LTH: ¿en qué parte del ciclo estamos?). Cada casilla es una combinación posible y la marcada como ACTUAL es donde está el mercado hoy. Cómo leerla: si ambos están fríos, es la mejor zona para comprar con calma; si el corto está frío pero el ciclo caliente, solo compras tácticas y pequeñas; si ambos están calientes, toca asegurar ganancias, no añadir. La primera matriz te dice QUÉ está pasando (diagnóstico) y la segunda QUÉ HACER (decisión)." },
    realizadoLTH: { term: "Distancia al Precio Realizado LTH", def: "El Precio Realizado LTH es el coste medio de los holders de largo plazo. Si el precio de mercado está MUY POR ENCIMA, esos holders acumulan grandes ganancias (zona de techo/distribución); si está cerca o por debajo, el mercado cotiza barato respecto a las manos firmes (zona de suelo/acumulación)." },
    posicionamiento: { term: "Rango sugerido de posición", def: "Horquilla de exposición LONG recomendada para cada señal, ya ajustada por el régimen actual. Entra de forma escalonada dentro del rango: cerca del mínimo si priorizas prudencia, del máximo si tu convicción es alta." },
    estadosSTHLTH: { term: "Estados STH y LTH", def: "El modelo mide dos horizontes: STH (corto plazo, timing táctico) y LTH (largo plazo, estructura de ciclo). Cada uno tiene su propia temperatura y señal; cuando ambos coinciden en frío o caliente, la señal es más fiable." },
    indice:  { term: "Índice Bambú", def: "Número de −100 a +100 que resume todas las métricas del horizonte. Positivo y verde = momento de acumular; negativo y rojo = momento de distribuir; cerca de 0 = neutral." },
    sth:     { term: "STH · Short-Term Holders", def: "Holders de corto plazo: monedas movidas hace menos de ~155 días. Reaccionan rápido al precio; útiles para timing táctico." },
    lth:     { term: "LTH · Long-Term Holders", def: "Holders de largo plazo: monedas en manos firmes más de ~155 días. Marcan la estructura del ciclo y suelen acumular en suelos y distribuir en techos." },
  };
})();
