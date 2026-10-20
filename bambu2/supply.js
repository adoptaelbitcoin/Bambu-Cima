/* Bambú CIMA 2.0 · Supply in Profit y las 4 fases del corto (anexo del encargo) */
(function(){
"use strict";
const B=window.Bambu2,$=s=>document.querySelector(s);
const f1=v=>v==null?"—":v.toFixed(1).replace(".",","),f2=v=>v==null?"—":v.toFixed(2).replace(".",",");
const sg=v=>v==null?"—":(v>=0?"+":"−")+f2(Math.abs(v));
const usd=v=>"$"+Math.round(v).toLocaleString("es-ES",{useGrouping:"always"});
const PH=[
 {id:1,k:"Acumulación activa",q:"¿Acumulo o me quedo quieto?",rule:"z fría y supply < 50",act:"Acumular por tramos.",col:"#3d6fbf",back:"Zona de compra del corto con el mercado aún en pérdida parcial. La z manda el tamaño; el supply confirma que hay miedo."},
 {id:2,k:"Acumulación agotándose",q:"¿Se agota la caída? ¿Cargo en serio?",rule:"Fuerte: supply < 40 y EMA30 cruza sobre EMA90. Suave: supply bajo, SOPR cruza 1 y z fría",act:"Afinar con el técnico y meter el tramo grande.",col:"#1f4e9c",back:{BTC:"Fuerte: 17 veces, subió ≥10% a 90 d el 76% (mediana +14%). Suave: 47 veces, 60% (mediana +14%).",ETH:"Fuerte: 18 veces, subió ≥10% a 90 d el 72% (mediana +45%). Suave: 35 veces, 63% (mediana +25%)."}},
 {id:3,k:"Distribución activa",q:"¿Distribuyo o aún queda subida?",rule:"z ≥ frontera de venta y supply entre 60 y 90",act:"Distribuir por tramos: el primer calor aún puede subir.",col:"#ee9b4a",back:{BTC:"Supply 60–75: a 180 d mediana +35% y sube el 72%. 75–90: +9%. 90–100: +4%.",ETH:"Supply 60–75: a 180 d mediana +18% y sube el 68%. 75–90: +12%. 90–100: +31% (euforia)."}},
 {id:4,k:"Distribución agotándose",q:"¿Se agota la subida? ¿Termino de salir?",rule:"supply > 80, EMA30 cruza bajo EMA90 y el SOPR pierde el 1",act:"Terminar de distribuir.",col:"#c0392b",back:{BTC:"9 veces: cayó ≥10% a 90 d el 89% (mediana −17%).",ETH:"8 veces: cayó ≥10% a 90 d el 75% (mediana −14%)."}}];
const cache={};
function calc(t){if(cache[t])return cache[t];const D=window.BAMBU2_DATA[t],s=window.Bambu2S[t],c=B.CFG[t],n=D.d.length;
 const sp=D.sp,e30=D.e30,e90=D.e90,so=s.sopr;
 const ev=(f,i)=>{for(let j=Math.max(1,i-9);j<=i;j++){if(f(j))return true;}return false;};
 const phase=i=>{const v=sp[i]!=null?sp[i]:e30[i];if(v==null||e30[i]==null||e90[i]==null||s.z[i]==null||so[i]==null)return null;
  const zF=s.z[i]<c.buy[1];
  const up=ev(j=>e30[j-1]<=e90[j-1]&&e30[j]>e90[j],i),dn=ev(j=>e30[j-1]>=e90[j-1]&&e30[j]<e90[j],i);
  const su=ev(j=>so[j-1]<1&&so[j]>=1,i),sl=ev(j=>so[j-1]>=1&&so[j]<1,i);
  const fl={v,raw:sp[i],zF,up,dn,su,sl,z:s.z[i],sopr:so[i]};
  let p=null,sub=null;
  if(v>80&&dn&&sl)p=4;else if(v<40&&up){p=2;sub="fuerte";}else if(v<50&&su&&zF){p=2;sub="suave";}
  else if(s.z[i]>=c.sellR&&v>=60&&v<=90)p=3;else if(zF&&v<50)p=1;
  return{p,sub,fl};};
 const arr=new Array(n).fill(null);let last=n-1;while(last>0&&sp[last]==null&&e30[last]==null)last--;
 const cnt={1:0,2:0,3:0,4:0,0:0};let tot=0;
 for(let i=0;i<=last;i++){const r=phase(i);if(!r)continue;arr[i]=r;cnt[r.p||0]++;tot++;}
 return cache[t]={D,s,c,last,arr,cnt,tot};}
const RNG={"180":180,"365":365,"730":730,"1460":1460,"max":1e9};let rg=localStorage.getItem("b2_sp_r")||"365";
function chart(t,C){const D=C.D,n=C.last+1,len=Math.min(RNG[rg]||365,n),i0=n-len;
 const box=$("#sp-ch");if(!box)return;const W=Math.max(320,box.clientWidth||760),H=W<520?420:520,PL=8,PR=62,PT=8,PB=26,GAP=10,iw=W-PL-PR;
 const hp=Math.round((H-PT-PB-GAP)*0.62),hs=H-PT-PB-GAP-hp,yP0=PT,yS0=PT+hp+GAP;
 const x=i=>PL+(i-i0)/Math.max(1,n-1-i0)*iw,ys=v=>yS0+(1-v/100)*hs;
 let pmin=Infinity,pmax=-Infinity;for(let i=i0;i<n;i++){const p=D.p[i];if(p>0){pmin=Math.min(pmin,p);pmax=Math.max(pmax,p);}}
 const pad=(pmax-pmin)*0.06||1;pmin-=pad;pmax+=pad;const yp=p=>yP0+(1-(p-pmin)/(pmax-pmin))*hp;
 const raw=(pmax-pmin)/5,mag=Math.pow(10,Math.floor(Math.log10(raw))),stp=[1,2,2.5,5,10].map(m=>m*mag).find(q=>q>=raw)||raw;
 const pt=[];for(let v=Math.ceil(pmin/stp)*stp;v<=pmax;v+=stp)pt.push(v);
 const fmtP=v=>v>=1000?Math.round(v).toLocaleString("es-ES",{useGrouping:"always"}):v.toLocaleString("es-ES",{maximumFractionDigits:2});
 const pGrid=pt.map(v=>'<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+yp(v)+'" y2="'+yp(v)+'" stroke="#000" stroke-opacity=".06"/><text x="'+(W-PR+8)+'" y="'+(yp(v)+4)+'" class="ax">'+fmtP(v)+'</text>').join("");
 let ppath="";for(let i=i0;i<n;i++){const p=D.p[i];if(!(p>0))continue;ppath+=(ppath?"L":"M")+x(i).toFixed(1)+" "+yp(p).toFixed(1);}
 const lp=D.p[n-1],lpY=yp(lp),chg=n>1&&D.p[n-2]?lp/D.p[n-2]-1:null;
 const chgTxt=chg==null?"":(chg>=0?"+":"−")+Math.abs(chg*100).toFixed(2).replace(".",",")+"%";
 const tag='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+lpY+'" y2="'+lpY+'" stroke="#111" stroke-dasharray="1.5 2.5"/><rect x="'+(W-PR+1)+'" y="'+(lpY-17)+'" width="'+(PR-2)+'" height="34" rx="2" fill="#111"/><text x="'+(W-PR+PR/2)+'" y="'+(lpY-4)+'" text-anchor="middle" style="fill:#fff;font:700 11px JetBrains Mono,monospace">'+fmtP(lp)+'</text><text x="'+(W-PR+PR/2)+'" y="'+(lpY+11)+'" text-anchor="middle" style="fill:#fff;font:600 10px JetBrains Mono,monospace">'+chgTxt+'</text><circle cx="'+x(n-1)+'" cy="'+lpY+'" r="3.5" fill="#2962ff"/>';
 const path=a=>{let d="",on=false;for(let i=i0;i<n;i++){const v=a[i];if(v==null){on=false;continue;}d+=(on?"L":"M")+x(i).toFixed(1)+" "+ys(v).toFixed(1);on=true;}return d;};
 const sGrid=[0,20,40,60,80,100].map(v=>'<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+ys(v)+'" y2="'+ys(v)+'" stroke="#000" stroke-opacity=".06"/><text x="'+(W-PR+8)+'" y="'+(ys(v)+4)+'" class="ax">'+v+'</text>').join("");
 const band='<rect x="'+PL+'" width="'+iw+'" y="'+ys(90)+'" height="'+(ys(20)-ys(90))+'" fill="#d9bdf5" opacity=".38"/><line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+ys(90)+'" y2="'+ys(90)+'" stroke="#8a4fc4" stroke-dasharray="4 3" stroke-opacity=".8"/><line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+ys(20)+'" y2="'+ys(20)+'" stroke="#8a4fc4" stroke-dasharray="4 3" stroke-opacity=".8"/>';
 let xl="",pk2="";
 for(let i=i0;i<n;i++){const d=D.d[i],key=len>1000?d.slice(0,4):d.slice(0,7);
  if(key!==pk2){const mo=+d.slice(5,7),ok=len>1000||(len>400?mo%6===1:len>200?mo%2===1:true);if(ok)xl+='<text x="'+x(i)+'" y="'+(H-8)+'" class="ax" text-anchor="middle">'+(len>1000?d.slice(0,4):d.slice(2,7))+'</text>';}pk2=key;}
 const COL={1:"#3d6fbf",2:"#1f4e9c",3:"#ee9b4a",4:"#c0392b"};let dots="";
 for(let i=i0;i<n;i++){const r=C.arr[i];if(!r||!r.p)continue;dots+='<line x1="'+x(i)+'" x2="'+x(i)+'" y1="'+(yS0+hs-7)+'" y2="'+(yS0+hs)+'" stroke="'+COL[r.p]+'" stroke-width="'+Math.max(1,iw/len)+'"/>';}
 const svg='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="width:100%;height:auto;display:block"><rect x="'+PL+'" y="'+yP0+'" width="'+iw+'" height="'+hp+'" fill="none" stroke="#000" stroke-opacity=".1"/><rect x="'+PL+'" y="'+yS0+'" width="'+iw+'" height="'+hs+'" fill="none" stroke="#000" stroke-opacity=".1"/>'+pGrid+'<text x="'+(PL+6)+'" y="'+(yP0+15)+'" style="fill:#444;font:600 12px Instrument Sans,sans-serif">'+t+'/USD · precio de cierre</text><path d="'+ppath+'" fill="none" stroke="#2962ff" stroke-width="2" stroke-linejoin="round"/>'+tag
  +sGrid+band+'<text x="'+(PL+6)+'" y="'+(yS0+15)+'" style="fill:#444;font:600 12px Instrument Sans,sans-serif">Supply in Profit del corto (STH %)</text><path d="'+path(D.sp)+'" fill="none" stroke="#7b2d8e" stroke-width="1.1"/><path d="'+path(D.e90)+'" fill="none" stroke="#141714" stroke-width="1.5" stroke-dasharray="5 3"/><path d="'+path(D.e60)+'" fill="none" stroke="#3E7C57" stroke-width="1.6"/><path d="'+path(D.e30)+'" fill="none" stroke="#f2b01e" stroke-width="2"/>'+dots+xl
  +'<line id="sp-hx" y1="'+PT+'" y2="'+(yS0+hs)+'" stroke="#111" opacity="0" stroke-dasharray="3 3"/><rect id="sp-hit" x="'+PL+'" y="'+PT+'" width="'+iw+'" height="'+(yS0+hs-PT)+'" fill="transparent"/></svg>';
 box.innerHTML=svg+'<div class="sp-leg"><span><i style="background:#2962ff;height:2.5px"></i>Precio '+t+'</span><span><i style="background:#7b2d8e"></i>Valor diario</span><span><i style="background:#f2b01e"></i>EMA 30</span><span><i style="background:#3E7C57"></i>EMA 60</span><span><i style="background:#141714"></i>EMA 90</span><span><i style="background:#d9bdf5;height:8px"></i>Zona 20–90</span><span class="sp-ph"><i style="background:#3d6fbf"></i>1<i style="background:#1f4e9c"></i>2<i style="background:#ee9b4a"></i>3<i style="background:#c0392b"></i>4 marcas de fase</span></div><div class="tip sp-tip" id="sp-tip" style="display:none"></div>';
 const hit=box.querySelector("#sp-hit"),hx=box.querySelector("#sp-hx"),tip=box.querySelector("#sp-tip");
 hit.onmousemove=ev=>{const r=hit.getBoundingClientRect(),sx=(ev.clientX-r.left)/r.width,i=Math.max(i0,Math.min(n-1,Math.round(i0+sx*(n-1-i0))));const ph=C.arr[i]&&C.arr[i].p;
  hx.setAttribute("x1",x(i));hx.setAttribute("x2",x(i));hx.setAttribute("opacity",.5);
  tip.style.display="flex";tip.style.opacity=1;const S=C.s,zo=S.z[i]==null?null:B.zone(t,S.z[i]);tip.innerHTML="<b>"+new Date(D.d[i]+"T00:00:00Z").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})+"</b><span>Precio "+usd(D.p[i])+"</span><span>Valor diario "+f1(D.sp[i])+"%</span><span>EMA30 "+f1(D.e30[i])+" · EMA60 "+f1(D.e60[i])+" · EMA90 "+f1(D.e90[i])+"</span>"+"<span>Coste STH "+usd(S.c[i])+"</span><span>z "+(S.z[i]==null?"—":sg(S.z[i]))+" · "+(zo?zo.lbl:"—")+"</span><span>Termómetro "+(S.short[i]==null?"—":Math.round(S.short[i]))+"</span>"+(ph?"<span class='tsep'>Fase "+ph+" · "+PH[ph-1].k+"</span>":"");
  const bw=box.getBoundingClientRect();const lf=ev.clientX-bw.left;tip.style.left=(lf>bw.width*.6?Math.max(0,lf-tip.offsetWidth-12):lf+12)+"px";tip.style.top="10px";};
 hit.onmouseleave=()=>{tip.style.opacity=0;hx.setAttribute("opacity",0);};}
function render(){const el=$("#sup");if(!el)return;const t=localStorage.getItem("b2_t")||"BTC";const C=calc(t),i=C.last,r=C.arr[i];if(!r){el.innerHTML='<p class="muted sm">Sin datos de Supply in Profit.</p>';return;}
 const D=C.D,fl=r.fl,cur=r.p;
 const fd=new Date(D.d[i]+"T00:00:00Z").toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
 const mk=(v,cls)=>v==null?"":'<i class="sp-m '+cls+'" style="left:'+Math.max(0,Math.min(100,v))+'%"></i>';
 const gauge='<div class="sp-g"><div class="sp-tr"><em style="left:0;width:20%;background:#1f4e9c"></em><em style="left:20%;width:20%;background:#8fc0f0"></em><em style="left:40%;width:20%;background:#d8dcd6"></em><em style="left:60%;width:20%;background:#f7e6a0"></em><em style="left:80%;width:10%;background:#ee9b4a"></em><em style="left:90%;width:10%;background:#c0392b"></em>'+mk(D.e90[i],"m90")+mk(D.e30[i],"m30")+mk(fl.raw,"mv")+'</div><div class="sp-tk"><span>0 capitulación</span><span>50</span><span>100 euforia</span></div></div>';
 const stat=(l,v,d)=>'<div class="sp-s"><span>'+l+'</span><b>'+f1(v)+'%</b>'+(d!=null?'<small>'+(d>=0?"▲ ":"▼ ")+f1(Math.abs(d))+' pts en 7 d</small>':"")+'</div>';
 const d7=a=>a[i]!=null&&a[i-7]!=null?a[i]-a[i-7]:null;
 const ck=(ok,txt)=>'<li class="'+(ok?"ok":"no")+'">'+(ok?"✓ ":"✗ ")+txt+'</li>';
 const flags={1:[ck(fl.zF,"z fría ("+sg(fl.z)+")"),ck(fl.v<50,"supply < 50 ("+f1(fl.v)+")")],
  2:[ck(fl.v<40,"supply < 40 ("+f1(fl.v)+")"),ck(fl.up,"EMA30 cruzó sobre EMA90 (10 d)"),ck(fl.su,"SOPR cruzó sobre 1 (10 d)"),ck(fl.zF,"z fría")],
  3:[ck(fl.z>=C.c.sellR,"z ≥ "+f2(C.c.sellR)+" ("+sg(fl.z)+")"),ck(fl.v>=60&&fl.v<=90,"supply entre 60 y 90 ("+f1(fl.v)+")")],
  4:[ck(fl.v>80,"supply > 80 ("+f1(fl.v)+")"),ck(fl.dn,"EMA30 cruzó bajo EMA90 (10 d)"),ck(fl.sl,"SOPR perdió el 1 (10 d)")]};
 const tiles=PH.map(p=>{const on=cur===p.id,bk=typeof p.back==="string"?p.back:p.back[t];
  return '<article class="sp-t'+(on?" on":"")+'" style="--c:'+p.col+'"><header><span class="sp-n">'+p.id+'</span><b>'+p.k+'</b>'+(on?'<span class="sp-now">HOY'+(r.sub?" · "+r.sub:"")+'</span>':"")+'</header><p class="sp-q">'+p.q+'</p><p class="sp-r">'+p.rule+'</p><ul>'+flags[p.id].join("")+'</ul>'+(on?'<p class="sp-a"><b>'+p.act+'</b></p>':"")+'<p class="sp-b">'+bk+'</p></article>';}).join("");
 const pc=k=>C.cnt[k]/C.tot*100;
 const head=cur?'Fase de hoy: <b>'+PH[cur-1].k.toLowerCase()+'</b>':'Hoy <b>ninguna de las 4 fases está activa</b>: el corto está en zona de transición';
 el.innerHTML='<div class="sp-rg">'+[["180","180 días"],["365","1 año"],["730","2 años"],["1460","4 años"],["max","Máx."]].map(([k,l])=>'<button data-r="'+k+'"'+(rg===k?' class="on"':"")+'>'+l+'</button>').join("")+'</div><div id="sp-ch" class="sp-ch"></div><div class="sp-top"><div class="sp-gw">'+gauge+'<p class="muted sm" style="margin:6px 0 0"><i class="sp-k mv"></i>Valor diario <i class="sp-k m30"></i>EMA30 <i class="sp-k m90"></i>EMA90 · datos al '+fd+(fl.raw==null?' · el valor diario no se publica desde el '+(()=>{let j=i;while(j>0&&D.sp[j]==null)j--;return D.d[j].slice(8)+'-'+D.d[j].slice(5,7);})()+'; las fases usan la EMA 30 como sustituto':'')+'</p></div><div class="sp-ss">'+stat("Valor diario"+(fl.raw==null?" (sin dato)":""),fl.raw!=null?fl.raw:(()=>{let j=i;while(j>0&&D.sp[j]==null)j--;return D.sp[j];})(),fl.raw!=null?d7(D.sp):null)+stat("EMA 30",D.e30[i],d7(D.e30))+stat("EMA 60",D.e60[i],d7(D.e60))+stat("EMA 90",D.e90[i],d7(D.e90))+'</div></div><p class="sp-h">'+head+'. '+(cur?PH[cur-1].act:"Sin ejecución táctica adicional por el supply.")+'</p><div class="sp-tiles">'+tiles+'</div><p class="muted sm" style="margin:10px 0 0">Con estas reglas, desde '+D.d[C.arr.findIndex(x=>x)].slice(0,4)+' el corto de '+C.c.name+' pasó '+f1(pc(1))+'% de los días en acumulación activa, '+f1(pc(2))+'% en acumulación agotándose, '+f1(pc(3))+'% en distribución activa, '+f1(pc(4))+'% en distribución agotándose y '+f1(pc(0))+'% sin fase. El supply no entra al índice: su correlación con la z es de +0,85 (BTC) y +0,80 (ETH), mediría lo mismo dos veces. Son brújula, no GPS (muestras de 8 a 18 casos); para recargar manda la z.</p>';
 chart(t,C);document.querySelectorAll(".sp-rg button").forEach(b=>b.onclick=()=>{rg=b.dataset.r;localStorage.setItem("b2_sp_r",rg);render();});}
window.Bambu2Supply={render};
window.addEventListener("resize",()=>{clearTimeout(window.__spT);window.__spT=setTimeout(render,150);});
render();
})();
