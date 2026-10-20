/* Bambú CIMA 2.0 · Historial de lecturas diarias */
(function(){
"use strict";
const B=window.Bambu2,S=window.Bambu2S,$=s=>document.querySelector(s);
const f0=v=>v==null?"—":Math.round(v).toLocaleString("es-ES",{useGrouping:"always"});
const f2=v=>v==null?"—":v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
const usd=v=>v==null?"—":"$"+(v>=1000?f0(v):v.toLocaleString("es-ES",{maximumFractionDigits:2}));
const sg=v=>v==null?"—":(v>=0?"+":"−")+f2(Math.abs(v));
const fd=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("es-ES",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});
const ink=hex=>{const n=parseInt(hex.slice(1),16),l=[n>>16,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*l[0]+.7152*l[1]+.0722*l[2]>.18?"#141714":"#fff";};
const D=S.BTC.d,LAST=D[D.length-1],FIRST=D[S.BTC.short.findIndex(v=>v!=null)];
const back=(iso,n)=>{const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-n);const s=d.toISOString().slice(0,10);return s<FIRST?FIRST:s;};
const PRE={"180":180,"365":365,"730":730,"max":null};
const st={pre:localStorage.getItem("b2_h_pre")||"180",from:localStorage.getItem("b2_h_from")||"",to:localStorage.getItem("b2_h_to")||"",coin:localStorage.getItem("b2_h_coin")||"both",only:localStorage.getItem("b2_h_only")||"all"};
function act(t,s,i){const e=B.exec(t,s.z[i],s.nupl[i]);if(!e)return{k:"—",c:""};const arr=s.start.slice(Math.max(0,i-9),i+1).some(Boolean);
 if(arr)return{k:"Arranque",c:"h-arr",sig:1};if(e.side==="buy"&&e.pct>0)return{k:`Acumular ${e.pct}%`,c:"h-buy",sig:1};if(e.side==="sell")return{k:`Reducir ${e.pct}%`,c:"h-sell",sig:1};return{k:"Mantener",c:"",sig:0};}
function rowOf(t,i){const s=S[t];if(s.short[i]==null)return null;const z=B.stZone(s.short[i]),l=B.idxLabel(s.cyc[i]),ph=B.phase(t,s.nupl[i]),a=act(t,s,i);
 return{p:s.p[i],d1:i>0?s.p[i]/s.p[i-1]-1:null,sth:s.short[i],z:s.z[i],stz:z,lth:s.cyc[i],lz:l,ph,nu:s.nupl[i],sopr:s.sopr[i],c:s.c[i],a};}
function range(){let to=st.to&&st.pre==="custom"?st.to:LAST,from;
 if(st.pre==="custom"&&st.from)from=st.from;else from=PRE[st.pre]==null?FIRST:back(to,PRE[st.pre]);
 if(to>LAST)to=LAST;if(from<FIRST)from=FIRST;if(from>to)[from,to]=[to,from];return{from,to};}
function build(){const d=S.BTC.d,{from:f,to:t}=range(),R=[];let i0=d.findIndex(x=>x>=f),i1=d.length-1;while(i1>0&&d[i1]>t)i1--;
 for(let i=Math.max(1,i0);i<=i1;i++){const b=rowOf("BTC",i),e=rowOf("ETH",i);if(!b&&!e)continue;
  const pb=i>0?rowOf("BTC",i-1):null,pe=i>0?rowOf("ETH",i-1):null,ev=[];
  const chk=(t,x,px)=>{if(!x||!px)return;if(x.stz.k!==px.stz.k)ev.push(`${t}: STH pasa a ${x.stz.k.toLowerCase()}`);if(x.ph.k!==px.ph.k)ev.push(`${t}: ciclo pasa a fase ${x.ph.k.toLowerCase()}`);if(x.a.k!==px.a.k&&x.a.sig)ev.push(`${t}: ${x.a.k.toLowerCase()}`);if(px.p<px.c&&x.p>=x.c)ev.push(`${t}: precio cruza al alza el coste STH`);if(px.p>=px.c&&x.p<x.c)ev.push(`${t}: precio pierde el coste STH`);};
  chk("BTC",b,pb);chk("ETH",e,pe);R.push({iso:d[i],b,e,ev});}
 return R.reverse();}
const pill=(txt,col)=>`<span class="h-pill" style="background:${col};color:${ink(col)}">${txt}</span>`;
const cell=x=>x?`<td class="h-num">${usd(x.p)}<small class="${x.d1>=0?"rp-pos":"rp-neg"}">${x.d1==null?"":(x.d1>=0?"+":"−")+f2(Math.abs(x.d1*100))+"%"}</small></td><td class="h-num">${Math.round(x.sth)}<small>z ${sg(x.z)}</small></td><td>${pill(x.stz.k,x.stz.col)}</td><td class="h-num">${Math.round(x.lth)}<small>NUPL ${f2(x.nu)}</small></td><td>${x.ph.k}</td><td class="${x.a.c}">${x.a.k}</td>`:`<td colspan="6" class="muted">—</td>`;
function render(){const all=build(),coins=st.coin==="both"?["BTC","ETH"]:[st.coin];
 const blocks=coins.map(t=>{const k=t==="BTC"?"b":"e",c=B.CFG[t];
  let rows=all.filter(r=>r[k]).map(r=>({iso:r.iso,x:r[k],ev:r.ev.filter(e=>e.startsWith(t)).map(e=>e.slice(t.length+2))}));
  const V=rows.map(r=>r.x),cnt=f=>V.filter(f).length;
  let sum='<p class="muted sm">Sin lecturas en el rango elegido.</p>';
  if(V.length){const x=V[0],o=V[V.length-1],ch=x.p/o.p-1;
   const st3=f=>{const q=V.map(f),mn=Math.min(...q),mx=Math.max(...q),av=q.reduce((s,v)=>s+v,0)/q.length,now=f(x);return{mn,mx,av,now,pos:mx>mn?(now-mn)/(mx-mn)*100:50};};
   const line=(lbl,m,fmt)=>`<div class="h-rg"><span class="k">${lbl}</span><span class="v">${fmt(m.now)}</span><div class="h-rbar" title="Posición en el rango"><i style="left:${m.pos.toFixed(1)}%"></i></div><span class="r">mín ${fmt(m.mn)} · media ${fmt(m.av)} · máx ${fmt(m.mx)}</span></div>`;
   sum=`<div class="h-sum"><p class="eyebrow">Valor al ${fd(rows[0].iso)} frente al rango</p><p class="h-big">${usd(x.p)} <small class="${ch>=0?"rp-pos":"rp-neg"}">${(ch>=0?"+":"−")+f2(Math.abs(ch*100))}% desde ${fd(rows[rows.length-1].iso)}</small></p>${line("Precio",st3(y=>y.p),usd)}${line("Termómetro STH",st3(y=>y.sth),f0)}${line("Termómetro LTH",st3(y=>y.lth),f0)}${line("z corto",st3(y=>y.z),sg)}</div>
   <div class="h-sum"><p class="eyebrow">Días en el rango</p><div class="h-days">${[["Acumulación",cnt(y=>y.stz.lo<42),"#3d6fbf"],["Neutra",cnt(y=>y.stz.k==="ZONA NEUTRA"),"#8a918b"],["Distribución",cnt(y=>y.stz.lo>=58),"#ee9b4a"],["Con señal",cnt(y=>y.a.sig),"#141714"]].map(([l,n,col])=>`<div><b style="color:${col}">${n}</b><span>${l}</span></div>`).join("")}</div><p class="muted sm">${V.length} lecturas · fase de ciclo hoy: ${x.ph.k.toLowerCase()} (NUPL LTH ${f2(x.nu)}) · zona STH hoy: ${x.stz.k.toLowerCase()}</p></div>`;}
  if(st.only==="ev")rows=rows.filter(r=>r.ev.length);
  const tb=`<thead><tr><th>Fecha</th><th>Hechos relevantes</th><th>Precio</th><th>1 d</th><th>STH</th><th>z</th><th>Zona STH</th><th>LTH</th><th>NUPL LTH</th><th>Fase</th><th>Acción</th></tr></thead><tbody>${rows.map(r=>{const x=r.x;return `<tr class="${r.ev.length?"h-ev":""}"><td class="h-date"><button class="h-open" data-iso="${r.iso}" title="Abrir el informe de este día">${fd(r.iso)}</button></td><td class="h-evt">${r.ev.length?r.ev.map(e=>`<span>${e[0].toUpperCase()+e.slice(1)}</span>`).join(""):'<span class="muted">Sin cambios</span>'}</td><td class="h-num">${usd(x.p)}</td><td class="h-num ${x.d1>=0?"rp-pos":"rp-neg"}">${x.d1==null?"—":(x.d1>=0?"+":"−")+f2(Math.abs(x.d1*100))+"%"}</td><td class="h-num"><b>${Math.round(x.sth)}</b></td><td class="h-num">${sg(x.z)}</td><td>${pill(x.stz.k,x.stz.col)}</td><td class="h-num"><b>${Math.round(x.lth)}</b></td><td class="h-num">${f2(x.nu)}</td><td>${x.ph.k}</td><td class="${x.a.c}">${x.a.k}</td></tr>`;}).join("")}</tbody>`;
  return `<section class="h-block"><header class="h-bh"><span class="h-coin ${t.toLowerCase()}">${t}</span><h3>${c.name}</h3><span class="muted sm" style="margin:0">${rows.length} ${rows.length===1?"lectura":"lecturas"}${st.only==="ev"?" con cambios":""}</span></header><div class="h-sums">${sum}</div><div class="h-wrap"><table class="h-t">${tb}</table></div></section>`;}).join("");
 $("#h-blocks").innerHTML=blocks;
 document.querySelectorAll(".h-open").forEach(b=>b.onclick=()=>{localStorage.setItem("b2_inf_iso",b.dataset.iso);window.Bambu2View&&window.Bambu2View("informe");});
 [["#h-days","pre"],["#h-coin","coin"],["#h-only","only"]].forEach(([sel,key])=>document.querySelectorAll(sel+" button").forEach(b=>b.classList.toggle("on",String(st[key])===b.dataset.v)));
 const rg=range(),fI=$("#h-from"),tI=$("#h-to");[fI,tI].forEach(e=>{e.min=FIRST;e.max=LAST;});fI.value=rg.from;tI.value=rg.to;
 $("#h-rng").textContent=`${fd(rg.from)} → ${fd(rg.to)}`;}
function csv(){const R=build(),H=["Fecha","BTC_precio","BTC_STH","BTC_z","BTC_zona","BTC_LTH","BTC_NUPL_LTH","BTC_fase","BTC_accion","ETH_precio","ETH_STH","ETH_z","ETH_zona","ETH_LTH","ETH_NUPL_LTH","ETH_fase","ETH_accion","Hechos"];
 const c=x=>x?[x.p,x.sth.toFixed(1),x.z.toFixed(3),x.stz.k,x.lth.toFixed(1),x.nu,x.ph.k,x.a.k]:["","","","","","","",""];
 const L=[H.join(",")].concat(R.map(r=>[r.iso,...c(r.b),...c(r.e),r.ev.join(" | ")].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")));
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+L.join("\n")],{type:"text/csv"}));a.download=`Bambu_CIMA2_historial_${R[0].iso}.csv`;a.click();}
const save=()=>["pre","from","to","coin","only"].forEach(k=>localStorage.setItem("b2_h_"+k,st[k]));
[["#h-days","pre"],["#h-coin","coin"],["#h-only","only"]].forEach(([sel,key])=>document.querySelectorAll(sel+" button").forEach(b=>b.onclick=()=>{st[key]=b.dataset.v;if(key==="pre"){st.from="";st.to="";}save();render();}));
const onDate=()=>{st.pre="custom";st.from=$("#h-from").value;st.to=$("#h-to").value;save();render();};$("#h-from").onchange=onDate;$("#h-to").onchange=onDate;
$("#h-csv").onclick=csv;
window.Bambu2Hist={render};
})();
