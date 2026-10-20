/* Bambú 2.0 · interfaz */
(function(){
"use strict";
const B=window.Bambu2,$=s=>document.querySelector(s);
const S={BTC:B.compute("BTC"),ETH:B.compute("ETH")};window.Bambu2S=S;
const st={t:localStorage.getItem("b2_t")||"BTC",mode:localStorage.getItem("b2_mode")||"retail",rS:localStorage.getItem("b2_rS2")||"1a",rL:localStorage.getItem("b2_rL2")||"1a"};
const f0=v=>v==null?"—":Math.round(v).toLocaleString("es-ES",{useGrouping:"always"});
const f2=v=>v==null?"—":v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
const usd=v=>v==null?"—":"$"+(v>=1000?Math.round(v).toLocaleString("es-ES",{useGrouping:"always"}):v.toLocaleString("es-ES",{maximumFractionDigits:2}));
const sg=v=>(v>=0?"+":"−")+f2(Math.abs(v));
const fd=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
const last=s=>s.n-1;
const ink=hex=>{const n=parseInt(hex.slice(1),16),l=[n>>16,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*l[0]+.7152*l[1]+.0722*l[2]>.18?"#141714":"#fff";};

function read(t){const s=S[t],i=last(s),z=s.z[i],nu=s.nupl[i],ix=s.idx[i];
 return{s,i,z,nu,ix,lab:B.idxLabel(ix),zo:B.zone(t,z),ph:B.phase(t,nu),ex:B.exec(t,z,nu),arr:s.start.slice(i-9,i+1).some(Boolean)};}

/* ---------- termómetros STH y LTH ---------- */
function thermo(el,hz){const r=read(st.t),s=r.s,i=r.i,v=hz==="sth"?s.short[i]:s.cyc[i],c0=B.CFG[st.t];
 const PH={BAJA:["FASE BAJA","#3d6fbf"],MEDIA:["FASE MEDIA","#5e655f"],ALTA:["FASE ALTA","#c0392b"]};
 const lab=hz==="sth"?B.stZone(v):B.idxLabel(v);
 const ZL=hz==="sth"?B.STZ.map(([b,k,sh],j)=>[sh,j?B.STZ[j-1][0]:0,Math.min(b,100),k]):[["MUY FRÍO",0,20],["FRÍO",20,40],["TEMPLADO",40,60],["CALIENTE",60,80],["MUY CALIENTE",80,100]];
 const ticks=[0,20,40,60,80,100].map(k=>`<div class="tk" style="bottom:${k}%">${k}</div>`).join("");
 const grad="#1f4e9c 0%,#8fc0f0 25%,#d8dcd6 42%,#d8dcd6 58%,#f7e6a0 66%,#ee9b4a 80%,#c0392b 100%";
 const zones=ZL.filter(([,a,b])=>b-a>=4).map(([n,a,b,full])=>`<div class="zn${lab.k===(full||n)?" on":""}" style="bottom:${((a+b)/2).toFixed(1)}%">${n}</div>`).join("")+ZL.slice(1).map(([,a])=>`<div class="zc" style="bottom:${a.toFixed(1)}%"></div>`).join("");
 const c=B.CFG[st.t];
 const act=hz==="sth"?(r.arr?"Arranque: entrar temprano y cabalgar la onda.":`${lab.a}.`):(r.ph.k==="BAJA"?"Alimentar la cartera de ciclo.":r.ph.k==="ALTA"?"Dejar de acumular y asegurar.":"Mantener la cartera de ciclo y esperar.");
 const so=s.sopr[i],adj=so==null?0:so<1?(so-1)*120:(so-1)*60;
 const src=hz==="sth"?`z ${sg(r.z)} · SOPR corto ${so==null?"—":so.toLocaleString("es-ES",{minimumFractionDigits:3,maximumFractionDigits:3})} (${adj>=0?"+":"−"}${f2(Math.abs(adj))} pts) · regla: ${r.zo.lbl.toLowerCase()}${r.arr?" · ARRANQUE":""}`:`NUPL LTH ${f2(r.nu)} · fase ${r.ph.k.toLowerCase()}`;
 const role=hz==="sth"?"Corto plazo · marca el ritmo (cuándo)":"Largo plazo · marca el tamaño (cuánto)";
 document.querySelector(el).innerHTML=`
 <div class="th-head"><span class="hz ${hz}">${hz.toUpperCase()}</span><div><b>${hz==="sth"?"Termómetro de corto":"Termómetro de ciclo"}</b><p class="muted sm" style="margin:0">${role}</p></div></div>
 <div class="th-wrap">
  <div class="th-ticks">${ticks}</div>
  <div class="th-bar" style="background:linear-gradient(to top,${grad})"><div class="th-mark" style="bottom:${v}%"><i></i></div></div>
  <div class="th-zones">${zones}</div>
  <div class="th-read">
   <div class="th-num">${Math.round(v)}</div>
   <div class="th-lbl" style="background:${lab.col};color:${ink(lab.col)}">${lab.k}</div>
   <p class="th-act">${act}</p>
   <p class="th-src">${src}</p>
  </div>
 </div>`;}
/* ---------- lectura de hoy ---------- */
function combo(){const r=read(st.t),i=r.i,s=r.s,a=B.idxLabel(s.cyc[i]),b=B.stZone(s.short[i]);
 const out=r.arr?"arranque: entrar temprano y cabalgar la onda":r.ex.side==="sell"?r.ex.txt.toLowerCase():r.ex.side==="buy"&&r.ex.pct>0?r.ex.txt.toLowerCase():a.k==="MUY CALIENTE"||a.k==="CALIENTE"?"aligerar y vigilar":"esperar";
 document.querySelector("#combo").innerHTML=`<b>Ciclo ${a.k.toLowerCase()}</b> + <b>corto ${b.k.toLowerCase()}</b> → ${out}.`;}
function today(){$("#today").innerHTML=["BTC","ETH"].map(t=>{const r=read(t);
 const act=r.arr?"ARRANQUE: entrar temprano y cabalgar la onda; salir con las señales de venta, no sostener 1 año.":`${r.zo.txt}. ${r.ex.txt}.`;
 return `<article class="rd${t===st.t?" cur":""}" data-t="${t}">
  <header><b>${B.CFG[t].name}</b><span>${usd(r.s.p[r.i])}</span></header>
  <div class="rd-l"><span class="dot" style="background:${B.stZone(r.s.short[r.i]).col}"></span><span class="k">Termómetro STH</span><span class="v">${Math.round(r.s.short[r.i])} · ${B.stZone(r.s.short[r.i]).k}</span></div>
  <div class="rd-l"><span class="dot" style="background:${B.idxLabel(r.s.cyc[r.i]).col}"></span><span class="k">Termómetro LTH</span><span class="v">${Math.round(r.s.cyc[r.i])} · ${B.idxLabel(r.s.cyc[r.i]).k}</span></div>
  <div class="rd-l"><span class="dot" style="background:${r.ph.k==="BAJA"?"#0d7a2f":r.ph.k==="ALTA"?"#c0392b":"#8a918b"}"></span><span class="k">Fase de ciclo</span><span class="v">${r.ph.k} · NUPL ${f2(r.nu)}</span></div>
  <p class="rd-a${r.arr?" arr":""}">${act}</p></article>`;}).join("")+`<p class="muted sm asof">Índice combinado (resumen): BTC ${Math.round(S.BTC.idx[last(S.BTC)])} · ETH ${Math.round(S.ETH.idx[last(S.ETH)])}. Lectura del ${fd(S.BTC.d[last(S.BTC)])} · cierre diario</p>`;
 document.querySelectorAll(".rd").forEach(e=>e.onclick=()=>setT(e.dataset.t));}

/* ---------- gráficas de bandas STH y LTH ---------- */
const BAND=[["#1f4e9c",.55],["#3d6fbf",.45],["#8fc0f0",.5],["#cfe8d3",.7],["#e6efc8",.8],["#f7e6a0",.85],["#ee9b4a",.7],["#e0703a",.7]];
const RANGES=[["180d","180 días",180],["1a","1 año",365],["2a","2 años",730],["4a","4 años",1460],["max","Máx.",1e9]];
function lthLevels(t){const c=B.CFG[t];return [[-0.3,0,"#1f4e9c",.5],[0,c.nupl[0],"#8fc0f0",.55],[c.nupl[0],c.nupl[1],"#e6efc8",.8],[c.nupl[1],0.87,"#ee9b4a",.65],[0.87,0.95,"#c0392b",.6]];}
const HEAT=[[-1.8,[31,78,156]],[-1.25,[61,111,191]],[-0.75,[90,143,214]],[-0.25,[143,192,240]],[0,[207,232,211]],[0.5,[230,239,200]],[1,[247,230,160]],[1.5,[238,155,74]],[1.75,[224,112,58]],[2,[192,57,43]]];
function heat(m){if(m<=HEAT[0][0])return HEAT[0][1];for(let j=1;j<HEAT.length;j++)if(m<=HEAT[j][0]){const[a,A]=HEAT[j-1],[b,C]=HEAT[j],f=(m-a)/(b-a);return A.map((v,k)=>Math.round(v+(C[k]-v)*f));}return HEAT[HEAT.length-1][1];}
function heatBands(lv,hot){return lv.slice(0,-1).map((a,b)=>{const top=b===lv.length-2,m=(a+lv[b+1])/2,rgb=top&&hot?[192,57,43]:heat(m);return[a,lv[b+1],`rgb(${rgb.join(",")})`,m<0?.62:m<1?.8:.72];});}
function chart(hz){const s=S[st.t],c=B.CFG[st.t],n=s.n,rk=hz==="sth"?"rS":"rL";
 const lvF=hz==="sth"?(i,k)=>B.levelPrice(s,i,k):(i,x)=>B.levelLTH(s,i,x);
 const cost=hz==="sth"?i=>s.c[i]:i=>s.cl[i];
 const custom=hz==="sth"?c.lvS:c.lvL;
 const lvList0=custom||c.levels;
 const bands=custom?heatBands(custom,hz==="sth"):c.levels.slice(0,-1).map((k,b)=>{const[col,op]=hz==="sth"&&st.t==="ETH"&&b===7?["#c0392b",.6]:BAND[b];return[k,c.levels[b+1],col,op];});
 const lvList=hz==="sth"&&!lvList0.includes(c.sellR)?[...lvList0,c.sellR].sort((a,b)=>a-b):lvList0;
 const sellK=hz==="sth"?c.sellR:null;
 const days=RANGES.find(r=>r[0]===st[rk])[2];let i0=Math.max(0,n-days);while(i0<n&&(lvF(i0,0)==null||!s.p[i0]))i0++;
 const idx=[];const step=Math.max(1,Math.floor((n-i0)/700));for(let i=i0;i<n;i+=step)idx.push(i);if(idx[idx.length-1]!==n-1)idx.push(n-1);
 const W=1000,H=400,PL=8,PR=6,PT=12,PB=26,iw=W-PL-PR,ih=H-PT-PB;
 let lo=Infinity,hi=-Infinity;const ext=[lvList[0],lvList[lvList.length-1]];
 idx.forEach(i=>{[s.p[i],cost(i),lvF(i,ext[0]),lvF(i,ext[1])].forEach(v=>{if(v>0){lo=Math.min(lo,v);hi=Math.max(hi,v);}});});
 lo*=.9;hi*=1.08;const ly=v=>PT+ih-(Math.log(v)-Math.log(lo))/(Math.log(hi)-Math.log(lo))*ih;
 const x=k=>PL+k/(idx.length-1)*iw,cl=v=>Math.max(PT,Math.min(PT+ih,ly(v)));
 let g="";
 bands.forEach(([a,b,col,op])=>{const up=idx.map((i,k)=>`${x(k).toFixed(1)},${cl(lvF(i,b)).toFixed(1)}`),dn=idx.map((i,k)=>`${x(k).toFixed(1)},${cl(lvF(i,a)).toFixed(1)}`).reverse();g+=`<polygon points="${up.join(" ")} ${dn.join(" ")}" fill="${col}" fill-opacity="${op}"/>`;});
 const line=(f,stroke,w)=>`<polyline points="${idx.map((i,k)=>{const v=f(i);return v>0?`${x(k).toFixed(1)},${cl(v).toFixed(1)}`:null;}).filter(Boolean).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;
 g+=(sellK!=null?line(i=>lvF(i,sellK),"#c0392b",2.6):"")+line(cost,"#0d7a2f",2)+line(i=>s.p[i],"#111",1.5);
 const box0=document.querySelector("#chart-"+hz),rh=(box0.querySelector("svg")||{}).clientHeight||(window.innerWidth<=860?320:400),minU=13*H/rh;
 const li=n-1;let LAB=lvList.map(k=>({k,y:lvF(li,k)?ly(lvF(li,k)):null})).filter(o=>o.y!=null&&o.y>=PT&&o.y<=PT+ih).sort((p,q)=>p.y-q.y);
 if(LAB.length*minU>ih){LAB=LAB.filter((o,j)=>o.k===0||o.k===sellK||Number.isInteger(o.k*2)&&Math.round(o.k*2)%2===0||Math.abs(o.k)===1.5||o.k===-1.8);}
 for(let j=1;j<LAB.length;j++)if(LAB[j].y-LAB[j-1].y<minU)LAB[j].y=LAB[j-1].y+minU;
 const over=LAB.length?LAB[LAB.length-1].y-(PT+ih):0;if(over>0)LAB.forEach(o=>o.y-=over);
 const nm=k=>String(Math.abs(k)).replace(".",",");
 const lbl=LAB.map(({k,y})=>{const sell=k===sellK;const t=`${k>0?"+":k<0?"−":""}${nm(k)}σ`;return `<span class="${sell?"lv sell":"lv"}" style="top:${(y/H*100).toFixed(2)}%">${t}${sell?" venta":""}</span>`;}).join("");
 const starts=hz!=="sth"?"":s.starts.filter(i=>i>=i0).map(i=>{const k=Math.round((i-i0)/(n-1-i0)*(idx.length-1));const y=cl(s.p[i])+14;return `<path d="M${x(k).toFixed(1)} ${(y-7).toFixed(1)} l6 10 h-12z" fill="#0d7a2f" stroke="#fff" stroke-width="1"><title>Arranque · ${fd(s.d[i])}</title></path>`;}).join("");
 const span=n-1-i0,ax=[];let pk=null;
 idx.forEach((i,k)=>{const d=s.d[i],y=d.slice(0,4),m=+d.slice(5,7);let key,lab;
  if(span<=400){key=d.slice(0,7);if(span>200&&m%2===0)key=null;lab=new Date(d+"T00:00:00Z").toLocaleDateString("es-ES",{month:"short",year:"2-digit",timeZone:"UTC"});}
  else if(span<=800){key=m%3===1?d.slice(0,7):null;lab=new Date(d+"T00:00:00Z").toLocaleDateString("es-ES",{month:"short",year:"2-digit",timeZone:"UTC"});}
  else{key=y;lab=y;}
  if(key&&key!==pk&&k>0)ax.push(`<line x1="${x(k)}" x2="${x(k)}" y1="${PT}" y2="${PT+ih}" class="grid"/><text x="${x(k)+3}" y="${H-8}" class="ax">${lab}</text>`);if(key)pk=key;});
 const box=document.querySelector("#chart-"+hz);
 box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="bands">${ax.join("")}${g}${starts}<line class="hx" y1="${PT}" y2="${PT+ih}"/><rect x="${PL}" y="${PT}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="lvs">${lbl}</div><div class="tip"></div>`;
 const svg=box.querySelector("svg"),tip=box.querySelector(".tip"),hx=box.querySelector(".hx");
 svg.onmousemove=e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W;const k=Math.max(0,Math.min(idx.length-1,Math.round((px-PL)/iw*(idx.length-1))));const i=idx[k];
  hx.setAttribute("x1",x(k));hx.setAttribute("x2",x(k));hx.style.opacity=1;
  const extra=hz==="sth"?(()=>{const zo=B.zone(st.t,s.z[i]);return `<span>Coste STH ${usd(s.c[i])}</span><span>z ${s.z[i]==null?"—":sg(s.z[i])} · ${zo?zo.lbl:"—"}</span><span>Termómetro ${s.short[i]==null?"—":Math.round(s.short[i])}</span>`;})():(()=>{const ph=B.phase(st.t,s.nupl[i]);return `<span>Coste LTH ${usd(s.cl[i])}</span><span>z LTH ${s.zL[i]==null?"—":sg(s.zL[i])}</span><span>NUPL LTH ${f2(s.nupl[i])} · ${ph?ph.k:"—"}</span><span>Termómetro ${s.cyc[i]==null?"—":Math.round(s.cyc[i])}</span>`;})();
  const green=["BTC","ETH"].map(t=>{const so=S[t],j=so.d.indexOf(s.d[i]),v=j<0?null:(hz==="sth"?so.c[j]:so.cl[j]);return `<span class="tg"><i></i>${t} · coste ${hz.toUpperCase()} <b>${usd(v)}</b></span>`;}).join("");
  tip.innerHTML=`<b>${fd(s.d[i])}</b><span>Precio ${usd(s.p[i])}</span>${extra}<span class="tsep">Línea verde · ambas monedas</span>${green}`;
  tip.style.opacity=1;const left=x(k)/W*r.width;tip.style.left=(left>r.width*.6?left-tip.offsetWidth-12:left+12)+"px";};
 svg.onmouseleave=()=>{tip.style.opacity=0;hx.style.opacity=0;};
 const rg=document.querySelector("#range-"+hz);rg.innerHTML=RANGES.map(r=>`<button data-r="${r[0]}" class="${st[rk]===r[0]?"on":""}">${r[1]}</button>`).join("");
 rg.querySelectorAll("button").forEach(b=>b.onclick=()=>{st[rk]=b.dataset.r;localStorage.setItem("b2_"+rk+"2",b.dataset.r);chart(hz);});
 document.querySelector("#sub-"+hz).textContent=hz==="sth"?`${c.name} · precio frente al coste STH · bandas en σ de la desviación · ${s.starts.filter(i=>i>=i0).length} arranques en el periodo`:`${c.name} · precio frente al coste LTH · bandas en σ (z LTH hoy ${sg(s.zL[n-1])}) · informativa del estiramiento del ciclo, sin frontera de venta`;}

/* ---------- modo inversor ---------- */
function weighted(t){const s=S[t],n=s.n,from=Math.max(0,n-365);let wp=0,w=0,ap=0,k=0;
 for(let i=from;i<n;i++){ap+=s.p[i];k++;const e=B.exec(t,s.z[i],s.nupl[i]);if(e&&e.side==="buy"&&e.pct>0){wp+=s.p[i]*e.pct;w+=e.pct;}}
 return{avg:ap/k,w:w?wp/w:null,days:w};}
function nextEdge(t,z){const c=B.CFG[t],E=[-1,c.buy[0],c.buy[1],1,c.sellO,c.sellR].sort((a,b)=>a-b);const up=E.find(e=>e>z),dn=[...E].reverse().find(e=>e<=z);return{up,dn};}
function investor(){const t=st.t,r=read(t),c=B.CFG[t],s=r.s,i=r.i;
 const pct=((s.p[i]/s.c[i])-1)*100;const edge=nextEdge(t,r.z);
 const pz=k=>B.levelPrice(s,i,k)&&usd(s.c[i]*(s.mu[i]+k*s.sd[i]));
 const align=r.zo.dir===r.ph.dir?(r.zo.dir===0?"Sí: los dos dicen esperar.":r.zo.dir>0?"Sí: los dos dicen comprar.":"Sí: los dos dicen vender."):(r.zo.dir===0||r.ph.dir===0?"En parte: uno está neutro, el otro no.":"No: corto y ciclo apuntan en direcciones opuestas.");
 const W=weighted(t);
 let Q;
 if(st.mode==="fondo"){Q=[
  ["¿Ejecuto en zona razonable, o caro o barato?",`${r.zo.lbl}.`,`La z del corto es ${sg(r.z)}: el precio está a ${f2(Math.abs(r.z))} desviaciones ${r.z>=0?"por encima":"por debajo"} de su media frente al coste STH.`],
  ["Si reparto en 30–50 días, ¿acelero o freno hoy?",r.ex.side==="buy"?`Acelerar: ${r.ex.pct}% en esta visita.`:r.ex.side==="sell"?`Frenar y soltar ${r.ex.pct}%.`:"Frenar: 0% extra hoy.","Tamaño según la escala de ejecución (z × fase de ciclo)."],
  ["¿En qué fase del ciclo entro y cuánto recorrido de caída tengo?",`Fase ${r.ph.k}.`,`NUPL de largo en ${f2(r.nu)}. El precio está un ${f0(Math.abs(pct))}% ${pct>=0?"por encima":"por debajo"} del coste STH (${usd(s.c[i])}).`],
  ["¿Corto y largo están alineados hoy?",align,`Corto: ${r.zo.lbl.toLowerCase()}. Ciclo: fase ${r.ph.k.toLowerCase()}.`],
  ["¿Cuándo dejo de acumular y aseguro?",r.ph.k==="ALTA"?"Ya: el ciclo está en fase alta.":`Cuando el NUPL de largo pase de ${f2(c.nupl[1])}.`,`Hoy está en ${f2(r.nu)}; le faltan ${f2(Math.max(0,c.nupl[1]-r.nu))} puntos para la fase alta.`],
  ["Si el mercado gira a mitad de colocación, ¿el plan frena?","Sí, al cambiar de zona.",`La zona cambia hacia arriba con z ${edge.up!=null?sg(edge.up)+" (≈ "+pz(edge.up)+")":"—"} y hacia abajo con z ${edge.dn!=null?sg(edge.dn)+" (≈ "+pz(edge.dn)+")":"—"}.`],
  ["¿Valor medio de entrada ponderado?",W.w?`${usd(W.w)} frente a ${usd(W.avg)} de media simple.`:"Sin compras en los últimos 12 meses.",W.w?`Últimos 12 meses siguiendo la escala: ${W.w<W.avg?"entrada un "+f0((1-W.w/W.avg)*100)+"% por debajo":"entrada un "+f0((W.w/W.avg-1)*100)+"% por encima"} de comprar y mantener.`:`El sistema no marcó zona de compra; la media simple del periodo fue ${usd(W.avg)}.`]];}
 else{const inv=Math.round((100-s.cyc[i])/5)*5;const calm=r.zo.dir===0;Q=[
  ["Mi cartera de ciclo, ¿la sigo alimentando o espero?",r.ph.k==="BAJA"?"Aliméntala.":r.ph.k==="MEDIA"?"Sigue con aportes normales, sin forzar.":"Espera: no añadas más.",`El NUPL de largo está en ${f2(r.nu)}, fase ${r.ph.k.toLowerCase()}.`],
  ["Mi 30% de corto, ¿lo muevo o me quedo quieto?",r.ex.side==="hold"?"Quieto.":r.ex.txt+".",`La z del corto es ${sg(r.z)} (${r.zo.lbl.toLowerCase()}).`],
  ["¿Miedo o paciencia? ¿Estoy por cometer un error emocional?",calm?"Paciencia.":r.zo.dir>0?"Si sientes miedo, es cuando toca comprar.":"Si sientes euforia, es cuando toca soltar.",calm?"El mercado está templado: cualquier movimiento hoy sería por emoción.":"El termómetro está fuera de la zona templada."],
  ["¿Cuánto de cada 100 debería tener invertido ahora?",`Unos ${inv} de cada 100.`,`Orientativo: 100 menos el índice de ciclo (${Math.round(s.cyc[i])}).`],
  ["¿Tengo permiso para no hacer nada?",calm?"Sí. Hoy no hacer nada es la decisión correcta.":"Hoy no: hay una acción marcada.",calm?"Corto templado y ciclo sin extremos.":r.ex.txt+"."]];}
 $("#inv").innerHTML=Q.map(([q,a,w],k)=>`<div class="qa"><span class="qn">${k+1}</span><div><p class="q">${q}</p><p class="a">${a}</p><p class="w">${w}</p></div></div>`).join("");
 $("#inv-sub").textContent=st.mode==="fondo"?"Ejecuta en 20–50 movimientos y justifica ante comité. Se mide contra comprar y mantener.":"Cartera de ciclo más un 30% de corto. Se mide en errores emocionales evitados.";
 document.querySelectorAll("#mode button").forEach(b=>b.classList.toggle("on",b.dataset.m===st.mode));}

/* ---------- escala de ejecución ---------- */
function scale(){const t=st.t,c=B.CFG[t],r=read(t);
 const rows=[[`Zona compra (z ${sg(c.buy[0])}…${sg(c.buy[1])})`,0],[`Más abajo (z −1,00…${sg(c.buy[0])})`,1],["Muy abajo (z < −1,00) *",2],["Templado o por encima",3]];
 const BUY=[[40,30,15],[30,20,10],[20,10,5],[0,0,0]];
 $("#scale").innerHTML=`<table class="sc"><thead><tr><th>Compra · % por visita</th>${["BAJA","MEDIA","ALTA"].map((p,k)=>`<th class="${r.ex.col===k?"hc":""}">Ciclo ${p.toLowerCase()}</th>`).join("")}</tr></thead><tbody>${rows.map(([l,ri])=>`<tr class="${r.ex.side!=="sell"&&r.ex.row===ri?"hr":""}"><td>${l}</td>${BUY[ri].map((v,k)=>`<td class="${r.ex.side!=="sell"&&r.ex.row===ri&&r.ex.col===k?"now":""}">${v}%</td>`).join("")}</tr>`).join("")}</tbody></table>
 <p class="muted sm">* Sólo si la tesis de ciclo aguanta (NUPL bajo); a corto puede seguir cayendo.</p>
 <table class="sc sell"><thead><tr><th>Venta · % de la posición de corto</th><th></th></tr></thead><tbody>
 <tr class="${r.zo.k==="caliente"?"hr":""}"><td>Naranja (z ${sg(c.sellO)}…${sg(c.sellR)})</td><td class="${r.zo.k==="caliente"?"now":""}">25–30%</td></tr>
 <tr class="${r.zo.k==="venta"&&r.z<=3?"hr":""}"><td>Rojo (z ≥ ${sg(c.sellR)})</td><td class="${r.zo.k==="venta"&&r.z<=3?"now":""}">50–60%</td></tr>
 <tr class="${r.z>3?"hr":""}"><td>Extremo (z > +3,00)</td><td class="${r.z>3?"now":""}">El resto</td></tr></tbody></table>
 <p class="muted sm">Bolsa de corto: máximo 30% del portafolio. Se entra y se sale por tramos. Hoy: <b>${r.ex.txt}</b>.</p>`;}

/* ---------- calendario por zona (spec v2 §3) ---------- */
const NOTE={
 moderada:["Compra · acumulación moderada","La mejor entrada",t=>`Zona de compra sólida. En promedio, a 180 días esta compra rinde bien (${t==="BTC"?"BTC ~+33%":"ETH ~+12-20%"}) y sube ~3 de cada 4 veces. Marca revisión a 6 meses; la onda completa hasta zona de venta dura ~7 meses (mediana ${t==="BTC"?"207":"212"} días).`],
 fuerte:["Compra · acumulación fuerte","Lo más frío: cuidado",t=>t==="BTC"?"Está barato pero suele seguir cayendo a corto (BTC a 180 días, negativo). Compra poco y con paciencia, no cargues de golpe. Revisa a 90-180 días.":"Está barato y puede seguir cayendo a corto. En ETH esta zona sí premia mejor, pero compra por tramos, no de golpe. Revisa a 90-180 días."],
 neutra:["Zona neutra","Sin ventaja estadística",()=>"No hacer nada. Esperar a que el termómetro se enfríe o se caliente."],
 naranja:["Venta · distribución","Aligerar por tramos",()=>"Empieza a aligerar por tramos. Caro puede seguir subiendo un rato (BTC aún +35% a 60 días en distribución). Suelta parcial, no todo."],
 roja:["Venta · roja","Señal fuerte",t=>`Señal fuerte de venta (${t==="BTC"?"z ≥ 1,75":"z ≥ 2,0"}). A 180 días el precio cae la gran mayoría de veces${t==="ETH"?" (ETH reciente: bajó el 100%)":""}. Vender el grueso.`]};
const REENTRY={ETH:"Tras distribuir, en promedio a los ~9 días (rango 4–55) suele reaparecer zona de compra. ETH respira rápido: estate muy pendiente esa primera semana o dos.",BTC:"Tras distribuir, la reentrada tarda ~29 días de media (rango 5–152). Más lento que ETH."};
function calendar(){const t=st.t,r=read(t),s=r.s,i=r.i,zs=B.stZone(s.short[i]),[ttl,tag,fn]=NOTE[zs.note];
 let lastSell=-1;for(let j=i;j>=Math.max(0,i-60);j--){const zo=B.zone(t,s.z[j]);if(zo&&zo.dir<0){lastSell=j;break;}}
 const re=lastSell>=0?`<div class="cal-re"><p class="eyebrow">Calendario de reentrada · última zona de venta ${fd(s.d[lastSell])}</p><p class="w">${REENTRY[t]}</p><p class="w muted">En toro fuerte el precio puede seguir subiendo tras tu venta (ej. BTC 152 días y +178%): la reentrada barata tarda meses y llega más cara. Ahí no persigas el precio; deja que trabaje el portafolio de largo.</p></div>`:"";
 $("#cal").innerHTML=`<div class="cal-h"><span class="cal-sw" style="background:${zs.col}"></span><div><p class="eyebrow">${ttl} · ${tag}</p><p class="a">${zs.k} · termómetro STH ${Math.round(s.short[i])}</p></div></div><p class="w">${fn(t)}</p>${re}<p class="muted sm">Medianas del backtest (ciclos recientes con más peso), no promesas.</p>`;}

/* ---------- reparto de zonas STH (spec v2 §10) ---------- */
function distrib(){$("#dist").innerHTML=["BTC","ETH"].map(t=>{const s=S[t],cnt=B.STZ.map(()=>0);let n=0;
 for(let i=0;i<s.n;i++){const v=s.short[i];if(v==null)continue;const k=B.STZ.findIndex(z=>v<z[0]);cnt[k<0?6:k]++;n++;}
 const pc=cnt.map(c=>c/n*100),acc=pc[0]+pc[1]+pc[2],sell=pc[4]+pc[5]+pc[6];
 return `<div class="ds"><header><b>${B.CFG[t].name}</b><span class="muted">${f0(acc)}% del tiempo en acumulación · ${f0(pc[3])}% neutra · ${f2(sell)}% en venta</span></header><div class="ds-bar">${pc.map((p,k)=>`<i style="flex:${p.toFixed(3)} 1 0;background:${B.STZ[k][4]}" title="${B.STZ[k][1]} · ${f2(p)}%"></i>`).join("")}</div><div class="ds-l">${pc.map((p,k)=>`<span><i style="background:${B.STZ[k][4]}"></i>${B.STZ[k][2].toLowerCase()} ${f2(p)}%</span>`).join("")}</div></div>`;}).join("")+`<p class="muted sm">Cada día desde ${fd(S.BTC.d[S.BTC.short.findIndex(v=>v!=null)])} clasificado en las 7 zonas del termómetro STH, calculado sobre los datos cargados. El mercado pasa la mayor parte del tiempo barato o templado y muy poco caro: por eso las señales de venta son raras.</p>`;}

/* ---------- respaldo ---------- */
const PROOF={BTC:[["Compra corto (z −0,5…0)","3m +12% (62%) · 6m +39% (70%)"],["Venta recalibrada (z ≥ 1,75)","A 180 días el precio baja el 74% de las veces · capta los techos recientes, incluido 2024"],["Venta (z ≥ 2,5)","6m −50% · acierto 100% (n=21) · no se alcanza desde 2021"],["Arranque","6m +14% (81%) · a 1 año se da la vuelta"],["Entrada de ciclo (NUPL ≤ 0,36)","1a +98% (96%) · 2a +307% (100%)"],["Zona alta (NUPL ≥ 0,72)","1a −14%"],["Índice muy frío (< 20)","1a +78% (96%)"],["Índice muy caliente (> 80)","1a −26% · sube sólo el 26%"],["Escala vs DCA plano","Más barato 10 de 10 años (−8,2% de media)"]],
 ETH:[["Compra corto (z 0…0,3)","3m +26% (66%) · 6m +22% (69%)"],["Venta (z ≥ 2,0)","6m −51% · acierto 100% (n=23)"],["Arranque","6m +19% (59%) · a 1 año se da la vuelta"],["Entrada de ciclo (NUPL ≤ 0,07)","1a +68% (79%) · 2a +1001% (100%)"],["Zona alta (NUPL ≥ 0,65)","1a −41%"],["Índice muy frío (< 20)","1a +68% (81%)"],["Índice muy caliente (> 80)","1a −50% · sube sólo el 5%"],["Escala vs DCA plano","Más barato 8 de 10 años (−1% medio); falla 2017 por ventana insuficiente"]]};
function proof(){$("#proof").innerHTML=PROOF[st.t].map(([k,v])=>`<div class="pf"><dt>${k}</dt><dd>${v}</dd></div>`).join("");}

function render(){document.querySelectorAll("#coin button").forEach(b=>b.classList.toggle("on",b.dataset.t===st.t));thermo("#th-sth","sth");thermo("#th-lth","lth");combo();today();calendar();distrib();window.Bambu2Supply&&window.Bambu2Supply.render();chart("sth");chart("lth");investor();scale();proof();}
function setT(t){st.t=t;localStorage.setItem("b2_t",t);render();}
document.querySelectorAll("#coin button").forEach(b=>b.onclick=()=>setT(b.dataset.t));
document.querySelectorAll("#mode button").forEach(b=>b.onclick=()=>{st.mode=b.dataset.m;localStorage.setItem("b2_mode",st.mode);investor();});
render();
})();
