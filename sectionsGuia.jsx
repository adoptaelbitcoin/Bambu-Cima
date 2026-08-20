/* ============================================================
   BAMBÚ · Sección Guía — Cómo usar Bambu (tutorial in-app)
   ============================================================ */
function GuiaStep({ n, q, title, img, children, action }) {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", padding: "26px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18 }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600 }}>{q}</div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em", margin: "2px 0 12px" }}>{title}</div>
        <div style={{ border: "1px solid var(--border-2)", borderRadius: 11, overflow: "hidden", boxShadow: "0 6px 20px rgba(27,36,32,.10)", marginBottom: 14, background: "#fff" }}>
          <img src={img} alt={title} style={{ display: "block", width: "100%", height: "auto" }} />
        </div>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--brand-soft)", borderRadius: 10, padding: "12px 14px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M20 6 9 17l-5-5" /></svg>
          <span style={{ fontSize: 14, color: "var(--brand-ink)" }}><strong>Qué hacer:</strong> {action}</span>
        </div>
      </div>
    </div>
  );
}

function SectionGuia({ palette }) {
  const cold = E.tempColor(8, palette), neutral = E.tempColor(50, palette), warm = E.tempColor(92, palette);
  const colors = [
    { c: cold, t: "Azul = Frío", w: "barato", d: <>El mercado está <strong>barato</strong>. Históricamente, buen momento para <strong>acumular</strong> (comprar poco a poco).</> },
    { c: neutral, t: "Gris = Neutral", w: "esperar", d: <>Sin un sesgo claro. Lo razonable es <strong>esperar</strong> y mantener tu plan sin forzar operaciones.</> },
    { c: warm, t: "Rojo = Caliente", w: "caro", d: <>El mercado está <strong>caro</strong> (euforia). Momento de <strong>proteger ganancias</strong> o reducir, no de perseguir el precio.</> },
  ];
  const rules = [
    ["01", "Nunca inviertas todo", "El error que arruina cuentas no es equivocar la dirección, es el tamaño. Arriesga solo una pequeña parte por operación."],
    ["02", "Siempre con stop", "Define de antemano dónde aceptas estar equivocado. El stop es tu red de seguridad ante las grandes caídas."],
    ["03", "Compra frío, vende caliente", "Acumula cuando hay miedo y el mercado está azul; toma ganancias cuando hay euforia y todo está rojo."],
  ];
  const routine = [
    ["Abre el Resumen", "Mira el veredicto y el color de hoy para BTC y ETH."],
    ["Revisa «Lo esencial»", "¿Las 4 preguntas apuntan al mismo lado? Más coincidencia = más confianza."],
    ["Mira las Alertas", "Si hay un aviso rojo, léelo: te dice qué hacer y por qué."],
    ["Solo si vas a operar: arma el Plan", "Define cuánto y dónde está tu stop antes de comprar o vender."],
    ["Cada lunes: lee el Reporte 360", "Tu foto de la semana y lo que viene."],
  ];

  return (
    <div className="fade-in">
      <div className="page-head"><h1>Cómo usar Bambu</h1><p>Una guía sencilla, paso a paso, para entender qué dice el mercado y tomar mejores decisiones — sin ser experto.</p></div>

      {/* qué es */}
      <Card title="¿Qué es Bambu?" sub="Para empezar" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 15.5, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 12px" }}>Bambu es un <strong>tablero que lee el mercado por ti</strong> y lo traduce a algo simple: ¿está caro o barato?, ¿es momento de comprar, vender o esperar? Por dentro mira decenas de indicadores reales de Bitcoin y Ethereum, pero tú no necesitas entenderlos todos: Bambu hace el trabajo difícil y te da una <strong>lectura clara y una acción recomendada</strong>. Piénsalo como el <strong>termómetro y el GPS</strong> de tu inversión.</p>
        <div style={{ display: "flex", gap: 13, alignItems: "center", background: "#15201A", color: "#DCE5DD", borderRadius: 12, padding: "15px 18px" }}>
          <span style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", border: "2px solid #4C6B57", color: "#9FC4A9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700 }}>?</span>
          <span style={{ fontSize: 14.5 }}>¿Ves un signo <strong style={{ color: "#fff" }}>?</strong> junto al título de cada pantalla? Pasa el cursor o tócalo y Bambu te explica para qué sirve esa sección.</span>
        </div>
      </Card>

      {/* colores */}
      <Card title="Los 3 colores de Bambu" sub="Lo único que debes memorizar" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", margin: "0 0 14px" }}>Todo el tablero habla el mismo idioma de colores. Si entiendes esto, ya entiendes Bambu:</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {colors.map((x, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "15px 16px" }}>
              <div style={{ height: 10, borderRadius: 6, background: x.c, marginBottom: 12 }} />
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>{x.t}</div>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "6px 0 0", lineHeight: 1.5 }}>{x.d}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* pasos */}
      <Card title="Usar Bambu en 6 pasos" sub="Sigue este orden y tendrás una decisión completa" style={{ marginBottom: 16 }}>
        <div style={{ marginTop: -4 }}>
          <GuiaStep n="1" q="¿Qué dice el mercado hoy?" title="Empieza por el Resumen" img="tutorial/img/1-resumen.png"
            action="lee el veredicto y el color. Eso ya te dice la dirección general: comprar, esperar o reducir.">
            Es tu punto de partida. En grande verás el <strong>veredicto</strong> (por ejemplo «Acumulación selectiva»), la <strong>temperatura</strong> del mercado y por qué. Cambia entre las pestañas <strong>Bitcoin</strong> y <strong>Ethereum</strong>.
          </GuiaStep>
          <GuiaStep n="2" q="¿Caro o barato? ¿Euforia o miedo?" title="Confirma con «Lo esencial»" img="tutorial/img/3-alertas.png"
            action="cuando varias respuestas coinciden en azul, la señal de comprar es más fiable. Si coinciden en rojo, cuidado.">
            En <strong>Alertas &amp; diario</strong>, la tarjeta «Lo esencial» responde <strong>4 preguntas simples</strong> en lenguaje claro, cada una con su lectura («Barato», «Optimismo sano»…) y color.
          </GuiaStep>
          <GuiaStep n="3" q="¿En qué punto del ciclo estamos?" title="Ubícate en el Heatmap" img="tutorial/img/2-heatmap.png"
            action="en zona fría o temprana hay margen para acumular; en zona cálida o caliente, piensa en tomar ganancias.">
            El termómetro muestra de un vistazo dónde está el mercado entre <strong>acumulación (frío)</strong> y <strong>distribución (caliente)</strong>, para saber si aún hay recorrido o si ya se está calentando.
          </GuiaStep>
          <GuiaStep n="4" q="¿Cuánto invierto y cómo me protejo?" title="Arma tu Plan de operación" img="tutorial/img/4-cartera.png"
            action="nunca inviertas «todo». Deja que Bambu te diga cuánto arriesgar (1–2% por operación) y respeta el stop.">
            En <strong>Cartera &amp; Riesgo</strong> indicas tu <strong>capital</strong> y cuánto aceptas arriesgar, y Bambu calcula el <strong>tamaño correcto</strong> de la posición, dónde poner el <strong>stop</strong> y qué puedes ganar a cada plazo.
          </GuiaStep>
          <GuiaStep n="5" q="¿Cuándo debo salir?" title="Prepara tu salida con «¿Qué pasaría si?»" img="tutorial/img/5-quepasaria.png"
            action="anota el precio donde la señal se vuelve roja. Ese es tu objetivo de salida planificado.">
            Mueve el precio con el deslizador y observa cómo cambia la señal. Así descubres <strong>a qué precio el modelo te dirá que vendas</strong>, antes de que ocurra — con la cabeza fría.
          </GuiaStep>
          <GuiaStep n="6" q="¿Qué pasó y qué viene esta semana?" title="Léete el Reporte 360" img="tutorial/img/6-reporte.png"
            action="dedícale 5 minutos cada lunes. Es tu resumen para arrancar la semana con un plan.">
            Cada lunes, Bambu prepara un <strong>informe de la semana</strong>: lo que pasó, las señales al cierre y lo que viene. Puedes <strong>exportarlo a PDF</strong> para guardarlo o compartirlo.
          </GuiaStep>
        </div>
      </Card>

      {/* rutina + reglas */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card title="Tu rutina de 5 minutos" sub="No necesitas mirar todo cada día">
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {routine.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: "var(--ink)", color: "#fff", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{r[0]}</div><div className="tiny muted" style={{ marginTop: 1 }}>{r[1]}</div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="3 reglas de oro" sub="No las olvides">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rules.map((r, i) => (
              <div key={i} style={{ borderLeft: "3px solid var(--brand)", paddingLeft: 13 }}>
                <div className="num tiny" style={{ color: "var(--brand)", fontWeight: 600 }}>{r[0]}</div>
                <div style={{ fontSize: 15, fontWeight: 700, margin: "2px 0 3px" }}>{r[1]}</div>
                <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>{r[2]}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="tiny muted" style={{ marginTop: 18, padding: "16px 0", borderTop: "1px solid var(--border)", lineHeight: 1.6, maxWidth: 720 }}>
        Bambu es una herramienta de análisis sobre datos públicos on-chain. Sus lecturas reflejan el estado del mercado y la historia, <strong>no predicen el futuro ni constituyen asesoramiento financiero</strong>. Las decisiones de inversión son tuyas. Invierte solo lo que puedas permitirte arriesgar.
      </div>
    </div>
  );
}
Object.assign(window, { SectionGuia });
