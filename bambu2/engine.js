/* Bambú CIMA 2.0 · motor de cálculo (spec v2 §2–§4) · BTC venta recalibrada a 1.75σ · termómetro STH con SOPR */
(function(){
"use strict";
const W=1460,MIN=200;
const CFG={
 BTC:{name:"Bitcoin",nupl:[0.36,0.72],
  zA:[[-1.5,5],[-0.5,25],[0,40],[1,55],[1.5,70],[2.5,90],[3.5,100]],
  nA:[[0,0],[0.36,30],[0.72,70],[0.87,90],[1,100]],
  buy:[-0.5,0],sellO:1.5,sellR:1.75,levels:[-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5],
  lvS:[-1.8,-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5,1.75],
  lvL:[-1.8,-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5,1.75,2]},
 ETH:{name:"Ethereum",nupl:[0.07,0.65],
  zA:[[-1.5,5],[0,30],[0.3,38],[1,55],[1.5,70],[2,90],[3,100]],
  nA:[[0,0],[0.07,30],[0.65,70],[0.87,90],[1,100]],
  buy:[0,0.3],sellO:1.5,sellR:2.0,levels:[-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5],
  lvS:[-1.8,-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5,1.75,2],
  lvL:[-1.8,-1.5,-1.25,-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5,1.75,2]}
};
function interp(A,x){if(x==null)return null;if(x<=A[0][0])return A[0][1];for(let i=1;i<A.length;i++)if(x<=A[i][0]){const[a,b]=A[i-1],[c,d]=A[i];return b+(x-a)/(c-a)*(d-b);}return A[A.length-1][1];}
function zOf(ratio){const n=ratio.length,z=new Array(n).fill(null),mu=new Array(n).fill(null),sd=new Array(n).fill(null);let s=0,q=0,k=0;
 for(let i=0;i<n;i++){if(ratio[i]!=null){s+=ratio[i];q+=ratio[i]*ratio[i];k++;}
  const o=i-W;if(o>=0&&ratio[o]!=null){s-=ratio[o];q-=ratio[o]*ratio[o];k--;}
  if(k>=MIN&&ratio[i]!=null){const m=s/k,d=Math.sqrt(Math.max(q/k-m*m,0));mu[i]=m;sd[i]=d;z[i]=d?(ratio[i]-m)/d:0;}}
 return{z,mu,sd};}
function compute(t){
 const R=window.BAMBU2_DATA[t],c=CFG[t],n=R.d.length;
 const ratio=R.p.map((p,i)=>R.c[i]?p/R.c[i]:null);
 const {z,mu,sd}=zOf(ratio);
 const ratioL=R.p.map((p,i)=>R.cl&&R.cl[i]?p/R.cl[i]:null),ZL=zOf(ratioL);
 // percentil causal de sd
 const sdSorted=[],sdPct=new Array(n).fill(null);
 for(let i=0;i<n;i++){if(sd[i]==null)continue;let lo=0,hi=sdSorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sdSorted[m]<sd[i])lo=m+1;else hi=m;}sdSorted.splice(lo,0,sd[i]);sdPct[i]=sdSorted.length>1?lo/(sdSorted.length-1):null;}
 const sopr=R.s||[];
 const short=z.map((v,i)=>{if(v==null)return null;const so=sopr[i];const adj=so==null?0:so<1?(so-1)*120:(so-1)*60;return Math.max(0,Math.min(100,interp(c.zA,v)+adj));});
 const cyc=R.n.map(v=>v==null?null:interp(c.nA,v));
 const idx=short.map((v,i)=>v==null||cyc[i]==null?null:0.5*v+0.5*cyc[i]);
 const start=new Array(n).fill(false);let lastStart=-999;
 for(let i=1;i<n;i++){
  if(z[i]==null||z[i]<0||sdPct[i]==null||sdPct[i]>0.25)continue;
  let cross=-1;for(let j=Math.max(1,i-9);j<=i;j++)if(z[j-1]!=null&&z[j-1]<0&&z[j]>=0){cross=j;break;}
  if(cross<0)continue;
  let cold=false;for(let j=Math.max(0,cross-90);j<cross;j++)if(z[j]!=null&&z[j]<=-0.5){cold=true;break;}
  if(!cold)continue;
  start[i]=true;
 }
 const starts=[];for(let i=0;i<n;i++)if(start[i]&&!(i>0&&start[i-1])&&i-lastStart>30){starts.push(i);lastStart=i;}
 return {t,cfg:c,d:R.d,p:R.p,sopr,c:R.c,cl:R.cl,zL:ZL.z,muL:ZL.mu,sdL:ZL.sd,nupl:R.n,ratio,z,mu,sd,sdPct,short,cyc,idx,start,starts,n};
}
function idxLabel(v){if(v==null)return null;v=Math.round(v);
 if(v<20)return{k:"MUY FRÍO",a:"Acumular fuerte",col:"#1f4e9c"};
 if(v<40)return{k:"FRÍO",a:"Comprar",col:"#5a8fd6"};
 if(v<=60)return{k:"TEMPLADO",a:"Esperar",col:"#5e655f"};
 if(v<80)return{k:"CALIENTE",a:"Aligerar y vigilar",col:"#ee9b4a"};
 return{k:"MUY CALIENTE",a:"Vender",col:"#c0392b"};}
const STZ=[[15,"ACUMULACIÓN FUERTE","ACUM. FUERTE","Muy frío: comprar agresivo por tramos","#1f4e9c","fuerte"],[30,"ACUMULACIÓN MEDIA","ACUM. MEDIA","Frío: comprar","#3d6fbf","moderada"],[42,"ACUMULACIÓN","ACUMULACIÓN","Frío ligero: comprar poco","#8fc0f0","moderada"],[58,"ZONA NEUTRA","NEUTRA","Templado: no hacer nada","#5e655f","neutra"],[72,"DISTRIBUCIÓN TEMPRANA","DISTR. TEMPRANA","Caliente: empezar a aligerar","#f7e6a0","naranja"],[88,"DISTRIBUCIÓN","DISTRIBUCIÓN","Muy caliente: soltar","#ee9b4a","naranja"],[101,"SAL AHORA MISMO","SAL AHORA","Extremo: vender fuerte","#c0392b","roja"]];
function stZone(v){if(v==null)return null;let a=0;for(const [b,k,sh,a2,col,note] of STZ){if(v<b)return{k,sh,a:a2,col,note,lo:a,hi:Math.min(b,100)};a=b;}return null;}
function phase(t,nu){const[a,b]=CFG[t].nupl;if(nu==null)return null;
 if(nu<=a)return{k:"BAJA",txt:"Fase baja · zona de entrada de ciclo",dir:1};
 if(nu>=b)return{k:"ALTA",txt:"Fase alta · zona de peligro de ciclo",dir:-1};
 return{k:"MEDIA",txt:"Fase media · el ciclo sigue en curso",dir:0};}
function zone(t,z){if(z==null)return null;const c=CFG[t];
 if(z<-1)return{k:"muyfrio",lbl:"MUY FRÍO",txt:"No comprar aún: suele seguir cayendo",col:"#1f4e9c",row:2,dir:1};
 if(z<c.buy[0])return{k:"abajo",lbl:"MÁS ABAJO",txt:"Compra por tramos pequeños",col:"#3d6fbf",row:1,dir:1};
 if(z<c.buy[1])return{k:"compra",lbl:"COMPRA",txt:t==="ETH"?"Compra: cruza el coste al alza":"Compra en la zona del coste",col:"#5a8fd6",row:0,dir:1};
 if(z<1)return{k:"templado",lbl:"TEMPLADO",txt:"No hacer nada",col:"#5e655f",row:3,dir:0};
 if(z<c.sellO)return{k:"vigilar",lbl:"VIGILAR",txt:"Se calienta: vigilar, sin mover",col:"#d9b93a",row:3,dir:0};
 if(z<c.sellR)return{k:"caliente",lbl:"CALIENTE",txt:"Soltar parcial",col:"#ee9b4a",row:3,dir:-1};
 return{k:"venta",lbl:"VENTA FUERTE",txt:"Venta fuerte",col:"#c0392b",row:3,dir:-1};}
const BUY=[[40,30,15],[30,20,10],[20,10,5],[0,0,0]];
function exec(t,z,nu){const zo=zone(t,z),ph=phase(t,nu);if(!zo||!ph)return null;
 const col=ph.k==="BAJA"?0:ph.k==="MEDIA"?1:2;
 if(zo.dir>0)return{side:"buy",pct:BUY[zo.row][col],txt:`Desplegar ${BUY[zo.row][col]}% de la bolsa de corto en esta visita`,row:zo.row,col};
 if(z>3)return{side:"sell",pct:100,txt:"Soltar el resto de la posición de corto",row:null,col};
 if(zo.k==="venta")return{side:"sell",pct:"50–60",txt:"Soltar 50–60% de la posición de corto",row:null,col};
 if(zo.k==="caliente")return{side:"sell",pct:"25–30",txt:"Soltar 25–30% de la posición de corto",row:null,col};
 return{side:"hold",pct:0,txt:"0%: no mover la bolsa de corto hoy",row:3,col};}
function levelLTH(S,i,k){return S.muL[i]==null||!S.cl[i]?null:S.cl[i]*(S.muL[i]+k*S.sdL[i]);}
function levelPrice(S,i,k){return S.mu[i]==null||!S.c[i]?null:S.c[i]*(S.mu[i]+k*S.sd[i]);}
window.Bambu2={CFG,STZ,stZone,compute,idxLabel,phase,zone,exec,levelPrice,levelLTH,interp};
})();
