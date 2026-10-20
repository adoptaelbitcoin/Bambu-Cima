/* Bambú CIMA 2.0 · Informe CIMA (lectura diaria para comité) + historial */
(function(){
"use strict";
const B=window.Bambu2;let S=null;
const getS=()=>S||(S=window.Bambu2S||{BTC:B.compute("BTC"),ETH:B.compute("ETH")});
const f2=v=>v==null?"—":v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
const f0=v=>v==null?"—":Math.round(v).toLocaleString("es-ES",{useGrouping:"always"});
const usd=v=>v==null?"—":"$"+(v>=1000?f0(v):v.toLocaleString("es-ES",{maximumFractionDigits:2}));
const sg=v=>v==null?"—":(v>=0?"+":"−")+f2(Math.abs(v));
const pc=v=>v==null||!isFinite(v)?"—":`<span class="${v>=0?"rp-pos":"rp-neg"}">${v>=0?"+":"−"}${f2(Math.abs(v*100))}%</span>`;
const dl=v=>v==null?"—":`${v>=0?"+":"−"}${f0(Math.abs(v))}`;
const fdL=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
const ink=hex=>{const n=parseInt(hex.slice(1),16),l=[n>>16,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*l[0]+.7152*l[1]+.0722*l[2]>.18?"#141714":"#fff";};
const chip=(t,c)=>`<span class="rp-chip" style="background:${c};color:${ink(c)}">${t}</span>`;
function R(t,iso){const s=getS()[t],i=s.d.indexOf(iso);if(i<7||s.short[i]==null)return null;const z=s.z[i],nu=s.nupl[i];
 return{s,i,z,nu,sth:s.short[i],lth:s.cyc[i],stz:B.stZone(s.short[i]),lz:B.idxLabel(s.cyc[i]),zo:B.zone(t,z),ph:B.phase(t,nu),ex:B.exec(t,z,nu),arr:s.start.slice(Math.max(0,i-9),i+1).some(Boolean),c:B.CFG[t]};}
function action(x){if(x.arr)return{k:"arr",short:"Arranque",txt:"Arranque de ciclo: entrar temprano por tramos."};
 if(x.ex.side==="buy"&&x.ex.pct>0)return{k:"buy"+x.ex.pct,short:`Acumular ${x.ex.pct}%`,txt:`Acumular: desplegar ${x.ex.pct}% de la bolsa de corto.`};
 if(x.ex.side==="sell")return{k:"sell"+x.ex.pct,short:`Reducir ${x.ex.pct}%`,txt:`Reducir: soltar ${x.ex.pct}% de la posición de corto.`};
 return{k:"hold",short:"Mantener",txt:"Mantener. Sin ejecución táctica hoy."};}
const NOTE={moderada:"Zona de compra sólida: a 180 días ha rendido de media BTC ~+33% / ETH ~+12-20%, subiendo ~3 de cada 4 veces.",fuerte:"Lo más frío: barato pero suele seguir cayendo a corto. Comprar poco y con paciencia.",neutra:"Sin ventaja estadística: no ejecutar y esperar a que el termómetro salga de la zona neutra.",naranja:"Distribución: aligerar por tramos; el precio puede seguir subiendo un tiempo.",roja:"Señal fuerte de venta: a 180 días el precio ha caído la gran mayoría de las veces."};

function html(iso){const r={BTC:R("BTC",iso),ETH:R("ETH",iso)};if(!r.BTC||!r.ETH)return `<p class="rp-empty">Sin datos suficientes para el ${iso}.</p>`;
 const verdict=t=>{const x=r[t],a=action(x);
  const why=`Corto ${x.stz.k.toLowerCase()} (termómetro ${Math.round(x.sth)}, z ${sg(x.z)}); ciclo en fase ${x.ph.k.toLowerCase()} (NUPL LTH ${f2(x.nu)}). ${x.ph.k==="BAJA"?"El objetivo de ciclo admite aumentar exposición.":x.ph.k==="ALTA"?"El objetivo de ciclo pide dejar de acumular y asegurar.":"El objetivo de ciclo no cambia."}`;
  return `<article class="rp-vc"><header><b>${x.c.name}</b><span>${usd(x.s.p[x.i])}</span></header><div class="rp-chips">${chip("STH · "+x.stz.k,x.stz.col)}${chip("LTH · "+x.lz.k,x.lz.col)}</div><p class="rp-v">${a.txt}</p><p class="rp-w">${why}</p></article>`;};
 const row=(lbl,fn,g)=>`<tr><td>${lbl}</td>${["BTC","ETH"].map(t=>`<td>${fn(r[t])}</td>`).join("")}<td class="rp-g">${g}</td></tr>`;
 const d7=(x,a)=>x.s[a][x.i]-x.s[a][x.i-7];
 const bar=(v,v7)=>`<div class="rp-bar"><s style="left:${v7}%"></s><i style="left:${v}%"></i></div>`;
 const LZ=[[20,"MUY FRÍO","#1f4e9c"],[40,"FRÍO","#5a8fd6"],[60,"TEMPLADO","#8a918b"],[80,"CALIENTE","#ee9b4a"],[100,"MUY CALIENTE","#c0392b"]];
 const segs=hz=>{const Z=hz==="sth"?B.STZ.map(z=>[Math.min(z[0],100),z[4]]):LZ.map(z=>[z[0],z[2]]);let a=0;return Z.map(([b,c])=>{const s=`<em style="left:${a}%;width:${b-a}%;background:${c}"></em>`;a=b;return s;}).join("");};
 const gauge=(x,hz)=>{const v=hz==="sth"?x.sth:x.lth,v7=hz==="sth"?x.s.short[x.i-7]:x.s.cyc[x.i-7],lab=hz==="sth"?x.stz:x.lz,d=v-v7;
  const sub=hz==="sth"?`z ${sg(x.z)} · regla: ${x.zo.lbl.toLowerCase()}`:`NUPL LTH ${f2(x.nu)} · fase ${x.ph.k.toLowerCase()}`;
  return `<div class="rp-gg"><div class="rp-gh"><span class="rp-hz ${hz}">${hz.toUpperCase()}</span><span class="rp-gr">${hz==="sth"?"Corto · cuándo ejecutar":"Ciclo · cuánto tener"}</span></div>
  <div class="rp-gv"><b>${Math.round(v)}</b><span class="rp-pill" style="background:${lab.col};color:${ink(lab.col)}">${lab.k}</span></div>
  <div class="rp-rc"><div class="rp-track">${segs(hz)}<s style="left:${v7}%"></s><i style="left:${v}%"></i></div>
  <div class="rp-ticks"><span>0 frío</span><span>50</span><span>100 calor</span></div></div>
  <p class="rp-gs">${sub} · hace 7 d: ${Math.round(v7)} → hoy ${Math.round(v)} (<span class="${d>0?"rp-neg":d<0?"rp-cold":""}">${dl(d)}</span>)</p></div>`;};
 const thermos=`<div class="rp-th">${["BTC","ETH"].map(t=>`<div class="rp-tc"><p class="rp-tn">${r[t].c.name}</p>${gauge(r[t],"sth")}${gauge(r[t],"lth")}</div>`).join("")}</div>`;
 const kpi=`<thead><tr><th>Indicador</th><th>BTC</th><th>ETH</th><th>Lectura</th></tr></thead><tbody>`+
  row("Precio de cierre",x=>usd(x.s.p[x.i]),"USD")+
  row("Variación 1 d / 7 d",x=>`${pc(x.s.p[x.i]/x.s.p[x.i-1]-1)} / ${pc(x.s.p[x.i]/x.s.p[x.i-7]-1)}`,"")+
  row("z corto (precio / coste STH)",x=>sg(x.z),"Desviaciones sobre su media de 4 años")+
  row("Coste STH · distancia",x=>`${usd(x.s.c[x.i])} · ${pc(x.s.p[x.i]/x.s.c[x.i]-1)}`,"Compra reciente media (155 d)")+
  row("Coste LTH · distancia",x=>`${usd(x.s.cl[x.i])} · ${pc(x.s.p[x.i]/x.s.cl[x.i]-1)}`,"Precio medio de los holders de ciclo")+
  row("NUPL LTH · fase",x=>`${f2(x.nu)} · ${x.ph.k}`,`Cortes BTC ${f2(r.BTC.c.nupl[0])}/${f2(r.BTC.c.nupl[1])} · ETH ${f2(r.ETH.c.nupl[0])}/${f2(r.ETH.c.nupl[1])}`)+
  row("SOPR corto (EMA 7)",x=>x.s.sopr[x.i]==null?"—":x.s.sopr[x.i].toLocaleString("es-ES",{minimumFractionDigits:3,maximumFractionDigits:3}),"&gt; 1: venden con ganancia")+`</tbody>`;
 const exec=`<thead><tr><th>Moneda</th><th>Regla</th><th>Hoy</th></tr></thead><tbody>`+["BTC","ETH"].map(t=>{const x=r[t];return `<tr><td>${x.c.name}</td><td>${x.zo.lbl}</td><td>${x.ex.side==="buy"&&x.ex.pct>0?"+"+x.ex.pct+"%":x.ex.side==="sell"?"−"+x.ex.pct+"%":"0%"}</td></tr>`;}).join("")+`</tbody>`;
 const L=[["Entra en zona de compra bajo",x=>x.c.buy[1]],["Pasa a compra por tramos pequeños bajo",x=>x.c.buy[0]],["Pasa a vigilar sobre",()=>1],["Soltar parcial sobre",x=>x.c.sellO],["Venta fuerte sobre",x=>x.c.sellR]];
 const lv=`<thead><tr><th>Umbral (z)</th><th>BTC</th><th>ETH</th></tr></thead><tbody>`+L.map(([l,k])=>`<tr><td>${l}</td>${["BTC","ETH"].map(t=>{const x=r[t],kk=k(x);return `<td>${usd(B.levelPrice(x.s,x.i,kk))}<small>z ${sg(kk)}</small></td>`;}).join("")}</tr>`).join("")+`</tbody>`;
 const note=["BTC","ETH"].map(t=>{const x=r[t];return `<p><b>${x.c.name} · ${x.stz.k.toLowerCase()}.</b> ${NOTE[x.stz.note]}</p>`;}).join("")+`<p class="rp-m">Medianas del backtest 2017+, contadas por episodios.</p>`;
 const S0=getS().BTC;
 return `<header class="rp-hd"><div><h1>Informe CIMA</h1><p>Lectura diaria on-chain BTC / ETH para comité de inversión · Bambú CIMA 2.0</p></div><div class="rp-dt"><span class="rp-eb">Datos al cierre</span><b>${fdL(iso)}</b></div></header>
<section><p class="rp-eb">Veredicto del día</p><div class="rp-verd">${verdict("BTC")}${verdict("ETH")}</div></section>
<section><p class="rp-eb">Termómetros STH y LTH · 0 frío (comprar) → 100 calor (vender) · marca tenue: hace 7 días</p>${thermos}</section>
<section><p class="rp-eb">Cuadro de mando</p><table class="rp-t rp-kpi">${kpi}</table></section>
<section class="rp-two"><div><p class="rp-eb">Ejecución · bolsa de corto (máx. 30% del portafolio)</p><table class="rp-t">${exec}</table><p class="rp-fn">Compra: % del capital de corto a desplegar hoy (z × fase). Venta: % de la posición de corto a soltar. Por tramos. Niveles: precio de cierre que cambiaría la regla con el coste STH de ese día.</p></div><div><p class="rp-eb">Qué cambiaría la lectura · niveles de precio</p><table class="rp-t rp-lv">${lv}</table></div></section>
<section><p class="rp-eb">Contexto de la zona</p><div class="rp-note">${note}</div></section>
<footer class="rp-ft"><p>Metodología: z = desviación del ratio precio / coste STH frente a su media móvil causal de 1.460 días. Termómetro STH = anclas de z + ajuste por SOPR de corto. Termómetro LTH y fase de ciclo desde NUPL LTH. Frontera de venta BTC z ≥ ${f2(r.BTC.c.sellR)}, ETH z ≥ ${f2(r.ETH.c.sellR)}. Fuente: ChartInspect, cierre diario UTC. Cálculo causal: el informe de cada fecha usa sólo datos disponibles hasta ese día. Serie ${S0.d[0]} a ${S0.d[S0.n-1]}.</p><p>Contenido educativo, no asesoramiento financiero. Invertir en criptoactivos conlleva riesgo de pérdida.</p></footer>`;}

function history(days){const s=getS().BTC,out=[];let prev=null;
 const from=Math.max(8,s.n-days-1);
 for(let i=from;i<s.n;i++){const iso=s.d[i],b=R("BTC",iso),e=R("ETH",iso);if(!b||!e)continue;
  const ab=action(b),ae=action(e),key=[ab.k,ae.k,b.stz.k,e.stz.k].join("|");
  out.push({iso,btc:{a:ab.short,z:b.stz},eth:{a:ae.short,z:e.stz},change:prev!=null&&prev!==key,sig:ab.k!=="hold"||ae.k!=="hold"});prev=key;}
 return out.slice(1).reverse();}
window.Bambu2Report={html,history,dates:()=>getS().BTC.d};
})();
