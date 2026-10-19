/* BAMBÚ · Supply in Profit del corto + 4 fases (precio, hover con todos los valores) */
const SP_PH=[
 {id:1,k:"Acumulación activa",q:"¿Acumulo o me quedo quieto?",rule:"z fría y supply < 50",act:"Acumular por tramos.",col:"#3d6fbf"},
 {id:2,k:"Acumulación agotándose",q:"¿Se agota la caída? ¿Cargo en serio?",rule:"Fuerte: supply < 40 y EMA30 cruza sobre EMA90. Suave: supply bajo, SOPR cruza 1 y z fría",act:"Afinar con el técnico y meter el tramo grande.",col:"#1f4e9c"},
 {id:3,k:"Distribución activa",q:"¿Distribuyo o aún queda subida?",rule:"z ≥ frontera de venta y supply entre 60 y 90",act:"Distribuir por tramos: el primer calor aún puede subir.",col:"#ee9b4a"},
 {id:4,k:"Distribución agotándose",q:"¿Se agota la subida? ¿Termino de salir?",rule:"supply > 80, EMA30 cruza bajo EMA90 y el SOPR pierde el 1",act:"Terminar de distribuir.",col:"#c0392b"}];
const SP_CFG={BTC:{buy:0,sell:1.75},ETH:{buy:0.3,sell:2.0}};
function spCalc(type){
  const R=window.BambuRealData[type],C=R.cols,n=R.count,P=C.price,S=C.rpSTH;
  const z=new Array(n).fill(null),ra=P.map((p,i)=>p&&S[i]?p/S[i]:null),W=1460;
  let s=0,s2=0,c=0;
  for(let i=0;i<n;i++){const r=ra[i];if(r!=null){s+=r;s2+=r*r;c++;}const o=i-W;if(o>=0&&ra[o]!=null){s-=ra[o];s2-=ra[o]*ra[o];c--;}
    if(c>=200&&r!=null){const m=s/c,sd=Math.sqrt(Math.max(0,s2/c-m*m));if(sd>0)z[i]=(r-m)/sd;}}
  let last=n-1;while(last>0&&C.spProf[last]==null&&C.spProfE30[last]==null)last--;
  const cfg=SP_CFG[type],so=C.sthSoprE7,e30=C.spProfE30,e90=C.spProfE90;
  const ev=(f,i)=>{for(let j=Math.max(1,i-9);j<=i;j++)if(f(j))return true;return false;};
  const phase=i=>{const v=C.spProf[i]!=null?C.spProf[i]:e30[i];if(v==null||e30[i]==null||e90[i]==null||z[i]==null||so[i]==null||!e30[i-1]||!e90[i-1])return null;
    const zF=z[i]<cfg.buy,up=ev(j=>e30[j-1]<=e90[j-1]&&e30[j]>e90[j],i),dn=ev(j=>e30[j-1]>=e90[j-1]&&e30[j]<e90[j],i),su=ev(j=>so[j-1]<1&&so[j]>=1,i),sl=ev(j=>so[j-1]>=1&&so[j]<1,i);
    let p=null,sub=null;
    if(v>80&&dn&&sl)p=4;else if(v<40&&up){p=2;sub="fuerte";}else if(v<50&&su&&zF){p=2;sub="suave";}else if(z[i]>=cfg.sell&&v>=60&&v<=90)p=3;else if(zF&&v<50)p=1;
    return{p,sub,fl:{v,zF,up,dn,su,sl,z:z[i]}};};
  const arr=new Array(n).fill(null);for(let i=Math.max(1,last-1500);i<=last;i++)arr[i]=phase(i);
  return{R,C,z,last,arr,cfg};
}
function SupplyProfitCard({ type }) {
  const [rng, setRng] = React.useState("365");
  const [hv, setHv] = React.useState(null);
  const M = React.useMemo(() => { try { return window.BambuRealData[type] && window.BambuRealData[type].cols.spProfE30 ? spCalc(type) : null; } catch (e) { return null; } }, [type]);
  if (!M) return null;
  const { R, C, z, last, arr, cfg } = M, D = R.dates;
  const first = (() => { let f = 0; while (f < last && C.spProfE30[f] == null) f++; return f; })();
  const len = rng === "max" ? last - first + 1 : Math.min(+rng, last - first + 1), i0 = last - len + 1, n = last + 1;
  const f1 = x => x == null ? "—" : x.toFixed(1).replace(".", ","), sg = x => x == null ? "—" : (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(2).replace(".", ",");
  const usd = x => x == null ? "—" : "$" + Math.round(x).toLocaleString("es-ES", { useGrouping: "always" });
  const fdt = d => new Date(d + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const W = 900, H = 470, PL = 8, PR = 62, PT = 8, PB = 26, GAP = 10, iw = W - PL - PR, hp = Math.round((H - PT - PB - GAP) * .6), hs = H - PT - PB - GAP - hp, yS0 = PT + hp + GAP;
  const x = i => PL + (i - i0) / Math.max(1, n - 1 - i0) * iw, ys = v => yS0 + (1 - v / 100) * hs;
  let pmin = 1e12, pmax = 0; for (let i = i0; i < n; i++) { const p = C.price[i]; if (p > 0) { pmin = Math.min(pmin, p); pmax = Math.max(pmax, p); } }
  const pad = (pmax - pmin) * .06 || 1; pmin -= pad; pmax += pad; const yp = p => PT + (1 - (p - pmin) / (pmax - pmin)) * hp;
  const raw = (pmax - pmin) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), stp = [1, 2, 2.5, 5, 10].map(m => m * mag).find(q => q >= raw) || raw; const pt = []; for (let v = Math.ceil(pmin / stp) * stp; v <= pmax; v += stp) pt.push(v);
  const path = a => { let d = "", on = false; for (let i = i0; i < n; i++) { const v = a[i]; if (v == null) { on = false; continue; } d += (on ? "L" : "M") + x(i).toFixed(1) + " " + ys(v).toFixed(1); on = true; } return d; };
  let pp = ""; for (let i = i0; i < n; i++) { const p = C.price[i]; if (p > 0) pp += (pp ? "L" : "M") + x(i).toFixed(1) + " " + yp(p).toFixed(1); }
  const lp = C.price[last], lY = yp(lp);
  const xl = []; let pk = ""; for (let i = i0; i < n; i++) { const d = D[i], key = len > 1000 ? d.slice(0, 4) : d.slice(0, 7); if (key !== pk) { const mo = +d.slice(5, 7); if (len > 1000 || (len > 400 ? mo % 6 === 1 : len > 200 ? mo % 2 === 1 : true)) xl.push([x(i), len > 1000 ? d.slice(0, 4) : d.slice(2, 7)]); } pk = key; }
  const PC = { 1: "#3d6fbf", 2: "#1f4e9c", 3: "#ee9b4a", 4: "#c0392b" };
  const onMove = e => { const r = e.currentTarget.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width, i = Math.max(i0, Math.min(last, Math.round(i0 + ((sx * W - PL) / iw) * (n - 1 - i0)))); setHv({ i, left: sx }); };
  const cur = arr[last], cp = cur && cur.p, fl = cur && cur.fl;
  const v = k => C[k][last], d7 = k => C[k][last - 7] != null && C[k][last] != null ? C[k][last] - C[k][last - 7] : null;
  const Stat = ({ lab, val, d }) => (<div><div className="tiny muted">{lab}</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{f1(val)}%</div>{d != null && <div className="tiny" style={{ color: d >= 0 ? "var(--brand)" : "#A83C26" }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1).replace(".", ",")} pts en 7 d</div>}</div>);
  const ck = (ok, t) => <li style={{ listStyle: "none", color: ok ? "#2F6B49" : "#8A918B" }}>{ok ? "✓ " : "✗ "}{t}</li>;
  const flags = fl ? { 1: [ck(fl.zF, "z fría (" + sg(fl.z) + ")"), ck(fl.v < 50, "supply < 50 (" + f1(fl.v) + ")")], 2: [ck(fl.v < 40, "supply < 40 (" + f1(fl.v) + ")"), ck(fl.up, "EMA30 cruzó sobre EMA90 (10 d)"), ck(fl.su, "SOPR cruzó sobre 1 (10 d)"), ck(fl.zF, "z fría")], 3: [ck(fl.z >= cfg.sell, "z ≥ " + cfg.sell.toFixed(2).replace(".", ",") + " (" + sg(fl.z) + ")"), ck(fl.v >= 60 && fl.v <= 90, "supply entre 60 y 90 (" + f1(fl.v) + ")")], 4: [ck(fl.v > 80, "supply > 80 (" + f1(fl.v) + ")"), ck(fl.dn, "EMA30 cruzó bajo EMA90 (10 d)"), ck(fl.sl, "SOPR perdió el 1 (10 d)")] } : {};
  const hi = hv ? hv.i : null, hph = hi != null && arr[hi] && arr[hi].p;
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Supply in Profit y fases del corto · {type}</div>
          <div className="tiny muted">Qué porcentaje de las monedas recientes (STH) está en ganancia y en cuál de las 4 fases del corto estamos · datos al {fdt(D[last])}</div>
        </div>
        <div className="seg">{[["180", "180 d"], ["365", "1 año"], ["730", "2 años"], ["1460", "4 años"], ["max", "Máx."]].map(([k, l]) => <button key={k} className={rng === k ? "on" : ""} onClick={() => setRng(k)}>{l}</button>)}</div>
      </div>
      <div style={{ position: "relative" }}>
        <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHv(null)}>
          <rect x={PL} y={PT} width={iw} height={hp} fill="none" stroke="#000" strokeOpacity=".1" /><rect x={PL} y={yS0} width={iw} height={hs} fill="none" stroke="#000" strokeOpacity=".1" />
          {pt.map(p => <g key={p}><line x1={PL} x2={W - PR} y1={yp(p)} y2={yp(p)} stroke="#000" strokeOpacity=".06" /><text x={W - PR + 8} y={yp(p) + 4} fontSize="11" fill="#6b726c" fontFamily="JetBrains Mono,monospace">{p >= 1000 ? Math.round(p).toLocaleString("es-ES", { useGrouping: "always" }) : p.toFixed(1)}</text></g>)}
          <text x={PL + 6} y={PT + 15} fontSize="12" fontWeight="600" fill="#444">{type}/USD · precio de cierre</text>
          <path d={pp} fill="none" stroke="#2962ff" strokeWidth="2" strokeLinejoin="round" />
          <line x1={PL} x2={W - PR} y1={lY} y2={lY} stroke="#111" strokeDasharray="1.5 2.5" /><rect x={W - PR + 1} y={lY - 10} width={PR - 2} height={20} rx="2" fill="#111" /><text x={W - PR / 2 + 1} y={lY + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="JetBrains Mono,monospace">{p0(lp)}</text>
          {[0, 20, 40, 60, 80, 100].map(g => <g key={g}><line x1={PL} x2={W - PR} y1={ys(g)} y2={ys(g)} stroke="#000" strokeOpacity=".06" /><text x={W - PR + 8} y={ys(g) + 4} fontSize="11" fill="#6b726c" fontFamily="JetBrains Mono,monospace">{g}</text></g>)}
          <rect x={PL} y={ys(90)} width={iw} height={ys(20) - ys(90)} fill="#d9bdf5" opacity=".38" />
          {[90, 20].map(g => <line key={g} x1={PL} x2={W - PR} y1={ys(g)} y2={ys(g)} stroke="#8a4fc4" strokeDasharray="4 3" strokeOpacity=".8" />)}
          <text x={PL + 6} y={yS0 + 15} fontSize="12" fontWeight="600" fill="#444">Supply in Profit del corto (STH %)</text>
          <path d={path(C.spProf)} fill="none" stroke="#7b2d8e" strokeWidth="1.1" /><path d={path(C.spProfE90)} fill="none" stroke="#141714" strokeWidth="1.5" strokeDasharray="5 3" /><path d={path(C.spProfE60)} fill="none" stroke="#3E7C57" strokeWidth="1.6" /><path d={path(C.spProfE30)} fill="none" stroke="#f2b01e" strokeWidth="2" />
          {arr.map((r, i) => r && r.p && i >= i0 ? <line key={i} x1={x(i)} x2={x(i)} y1={yS0 + hs - 7} y2={yS0 + hs} stroke={PC[r.p]} strokeWidth={Math.max(1, iw / len)} /> : null)}
          {xl.map(([px, t], k) => <text key={k} x={px} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b726c" fontFamily="JetBrains Mono,monospace">{t}</text>)}
          {hi != null && <line x1={x(hi)} x2={x(hi)} y1={PT} y2={yS0 + hs} stroke="#111" strokeOpacity=".5" strokeDasharray="3 3" />}
        </svg>
        {hi != null && <div style={{ position: "absolute", top: 10, left: hv.left > .6 ? "auto" : (hv.left * 100 + 1.5) + "%", right: hv.left > .6 ? ((1 - hv.left) * 100 + 1.5) + "%" : "auto", background: "#141714", color: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 1, minWidth: 190, pointerEvents: "none", zIndex: 3 }}>
          <b>{fdt(D[hi])}</b><span>Precio {usd(C.price[hi])}</span><span>Valor diario {f1(C.spProf[hi])}%</span><span>EMA30 {f1(C.spProfE30[hi])} · EMA60 {f1(C.spProfE60[hi])} · EMA90 {f1(C.spProfE90[hi])}</span><span>Coste STH {usd(C.rpSTH[hi])}</span><span>z {sg(z[hi])}</span>
          {hph ? <span style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,.2)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#a9b0aa" }}>Fase {hph} · {SP_PH[hph - 1].k}</span> : null}</div>}
      </div>
      <div className="tiny muted" style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 4 }}><span style={{ color: "#2962ff" }}>━ Precio</span><span style={{ color: "#7b2d8e" }}>━ Valor diario</span><span style={{ color: "#f2b01e" }}>━ EMA 30</span><span style={{ color: "#3E7C57" }}>━ EMA 60</span><span style={{ color: "#141714" }}>┅ EMA 90</span><span>▮ Zona 20–90</span><span>marcas de fase: <b style={{ color: PC[1] }}>1</b> <b style={{ color: PC[2] }}>2</b> <b style={{ color: PC[3] }}>3</b> <b style={{ color: PC[4] }}>4</b></span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, margin: "14px 0", alignItems: "end" }}>
        <Stat lab="Valor diario" val={v("spProf")} d={d7("spProf")} /><Stat lab="EMA 30" val={v("spProfE30")} d={d7("spProfE30")} /><Stat lab="EMA 60" val={v("spProfE60")} d={d7("spProfE60")} /><Stat lab="EMA 90" val={v("spProfE90")} d={d7("spProfE90")} />
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 14 }}>{cp ? <>Fase de hoy: <b>{SP_PH[cp - 1].k.toLowerCase()}</b>. {SP_PH[cp - 1].act}</> : <>Hoy <b>ninguna de las 4 fases está activa</b>: el corto está en zona de transición. Sin ejecución táctica adicional por el supply.</>}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {SP_PH.map(p => { const on = cp === p.id; return (<div key={p.id} style={{ border: "1px solid " + (on ? p.col : "var(--line)"), borderTop: "3px solid " + p.col, borderRadius: 8, padding: "10px 12px", background: on ? "#fff" : "transparent", opacity: on ? 1 : .85 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.id} · {p.k}{on && <span className="pill" style={{ marginLeft: 6, background: p.col, color: "#fff" }}>HOY{cur.sub ? " · " + cur.sub : ""}</span>}</div>
          <div className="tiny muted" style={{ margin: "4px 0" }}>{p.q}</div><div className="tiny muted">{p.rule}</div>
          <ul className="tiny" style={{ margin: "6px 0 0", padding: 0 }}>{flags[p.id]}</ul></div>); })}
      </div>
      <div className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>El supply no entra al índice: mide casi lo mismo que la z sobre el coste STH. Las fases son brújula, no GPS; para recargar manda la z. Valor diario de los días sin dato de la fuente: reconstruido desde la EMA 30.</div>
    </div>
  );
}
function p0(p){return p>=1000?Math.round(p).toLocaleString("es-ES",{useGrouping:"always"}):p.toFixed(1);}
Object.assign(window, { SupplyProfitCard });
