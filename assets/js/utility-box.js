document.addEventListener("DOMContentLoaded",function(){
const sel=document.getElementById("utilitySelect"),app=document.getElementById("utilityApp");if(!app)return;
const L=s=>String(s).split(/\r?\n/), N=s=>String(s).split(/[\s,、]+/).map(Number).filter(Number.isFinite);
const tools=[
["trim","前後空白削除",[["text","文章","textarea"]],v=>v.text.trim()],
["sort","行の並べ替え",[["text","行","textarea"],["order","順序","select",["昇順","降順"]]],v=>L(v.text).sort((a,b)=>a.localeCompare(b,"ja")*(v.order==="降順"?-1:1)).join("\n")],
["reverse-lines","行順反転",[["text","行","textarea"]],v=>L(v.text).reverse().join("\n")],
["number-lines","行番号追加",[["text","行","textarea"]],v=>L(v.text).map((x,i)=>(i+1)+". "+x).join("\n")],
["remove-empty","空行削除",[["text","文章","textarea"]],v=>L(v.text).filter(x=>x.trim()).join("\n")],
["shuffle","行シャッフル",[["text","行","textarea"]],v=>{let a=L(v.text);for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.join("\n")}],
["emails","メールアドレス抽出",[["text","文章","textarea"]],v=>(v.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).join("\n")],
["urls","URL抽出",[["text","文章","textarea"]],v=>(v.text.match(/https?:\/\/[^\s<>"']+/g)||[]).join("\n")],
["reverse-text","文字列反転",[["text","文字列","textarea"]],v=>[...v.text].reverse().join("")],
["rot13","ROT13変換",[["text","文字列","textarea"]],v=>v.text.replace(/[A-Za-z]/g,c=>{let b=c<="Z"?65:97;return String.fromCharCode(b+(c.charCodeAt(0)-b+13)%26)})],
["escape","HTMLエスケープ",[["text","HTML","textarea"]],v=>v.text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))],
["unescape","HTMLアンエスケープ",[["text","文字参照","textarea"]],v=>{let t=document.createElement("textarea");t.innerHTML=v.text;return t.value}],
["repeat","文字列繰り返し",[["text","文字列","textarea"],["a","回数","number",3]],v=>Array(Math.max(0,Math.min(1000,+v.a||0))).fill(v.text).join("")],
["prefix","行頭文字追加",[["text","行","textarea"],["a","追加文字","text"]],v=>L(v.text).map(x=>v.a+x).join("\n")],
["suffix","行末文字追加",[["text","行","textarea"],["a","追加文字","text"]],v=>L(v.text).map(x=>x+v.a).join("\n")],
["join","行結合",[["text","複数行","textarea"],["a","区切り文字","text",", "]],v=>L(v.text).join(v.a)],
["split","区切り文字で分割",[["text","文字列","textarea"],["a","区切り文字","text",","]],v=>v.a?v.text.split(v.a).join("\n"):v.text],
["comma-lines","カンマ→改行",[["text","カンマ区切り","textarea"]],v=>v.text.split(",").map(x=>x.trim()).join("\n")],
["lines-comma","改行→カンマ",[["text","複数行","textarea"]],v=>L(v.text).map(x=>x.trim()).filter(Boolean).join(",")],
["frequency","単語出現回数",[["text","文章","textarea"]],v=>{let m=new Map;v.text.trim().split(/\s+/).filter(Boolean).forEach(w=>m.set(w,(m.get(w)||0)+1));return [...m].sort((a,b)=>b[1]-a[1]).map(x=>x[0]+"\t"+x[1]).join("\n")}],
["sum","数値合計",[["text","数値","textarea"]],v=>String(N(v.text).reduce((a,b)=>a+b,0))],
["avg","数値平均",[["text","数値","textarea"]],v=>{let a=N(v.text);return a.length?String(a.reduce((x,y)=>x+y,0)/a.length):""}],
["minmax","最小・最大値",[["text","数値","textarea"]],v=>{let a=N(v.text);return a.length?"最小: "+Math.min(...a)+"\n最大: "+Math.max(...a):""}],
["percent","割合計算",[["a","対象の数","number"],["b","全体","number"]],v=>+v.b?((+v.a/+v.b*100).toFixed(2)+"%"):"全体は0以外を入力してください"],
["discount","割引計算",[["a","元の価格","number"],["b","割引率（%）","number"]],v=>{let p=+v.a,r=+v.b;return "割引後: "+(p*(1-r/100)).toFixed(2)+"\n値引額: "+(p*r/100).toFixed(2)}],
["tax","税込計算",[["a","税抜金額","number"],["b","税率（%）","number",10]],v=>{let p=+v.a,r=+v.b;return "税込: "+(p*(1+r/100)).toFixed(2)+"\n税額: "+(p*r/100).toFixed(2)}],
["age","年齢計算",[["a","生年月日","date"],["b","基準日","date"]],v=>{if(!v.a)return"";let d=new Date(v.a+"T00:00:00"),t=v.b?new Date(v.b+"T00:00:00"):new Date(),n=t.getFullYear()-d.getFullYear(),m=t.getMonth()-d.getMonth();if(m<0||(m===0&&t.getDate()<d.getDate()))n--;return n+"歳"}],
["days","日数差計算",[["a","開始日","date"],["b","終了日","date"]],v=>Math.round((new Date(v.b+"T00:00:00")-new Date(v.a+"T00:00:00"))/86400000)+"日"],
["adddays","日付加算",[["a","日付","date"],["b","加算日数","number",1]],v=>{let d=new Date(v.a+"T00:00:00");d.setDate(d.getDate()+(+v.b||0));return d.toLocaleDateString("ja-JP")}],
["unix-date","Unix時刻→日時",[["a","Unix秒","number"]],v=>new Date(+v.a*1000).toLocaleString("ja-JP")],
["date-unix","日時→Unix時刻",[["a","日時","datetime-local"]],v=>v.a?String(Math.floor(new Date(v.a).getTime()/1000)):""],
["uuid","UUID生成",[],()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)],
["hex-dec","16進数→10進数",[["a","16進数","text","FF"]],v=>String(parseInt(v.a.replace(/^0x/i,""),16))],
["dec-hex","10進数→16進数",[["a","10進数","number",255]],v=>(+v.a).toString(16).toUpperCase()],
["bin-dec","2進数→10進数",[["a","2進数","text","1010"]],v=>String(parseInt(v.a,2))],
["dec-bin","10進数→2進数",[["a","10進数","number",10]],v=>(+v.a).toString(2)],
["rgb-hex","RGB→HEX",[["a","R","number"],["b","G","number"],["c","B","number"]],v=>"#"+[v.a,v.b,v.c].map(n=>Math.max(0,Math.min(255,+n||0)).toString(16).padStart(2,"0")).join("").toUpperCase()],
["hex-rgb","HEX→RGB",[["a","HEX","text","#336699"]],v=>{let h=v.a.replace("#","");if(h.length===3)h=[...h].map(x=>x+x).join("");let n=parseInt(h,16);return "rgb("+(n>>16)+", "+((n>>8)&255)+", "+(n&255)+")"}],
["bytes","データ容量変換",[["a","値","number"],["from","変換元","select",["B","KB","MB","GB","TB"]],["to","変換先","select",["B","KB","MB","GB","TB"]]],v=>{let u={B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776};return (+v.a*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["temp","温度変換",[["a","値","number"],["from","変換元","select",["℃","℉","K"]],["to","変換先","select",["℃","℉","K"]]],v=>{let c=+v.a;if(v.from==="℉")c=(c-32)*5/9;if(v.from==="K")c-=273.15;let r=c;if(v.to==="℉")r=c*9/5+32;if(v.to==="K")r=c+273.15;return r.toFixed(4)+" "+v.to}],
["length","長さ変換",[["a","値","number"],["from","変換元","select",["mm","cm","m","km","inch","ft"]],["to","変換先","select",["mm","cm","m","km","inch","ft"]]],v=>{let u={mm:.001,cm:.01,m:1,km:1000,inch:.0254,ft:.3048};return (+v.a*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["area","面積変換",[["a","値","number"],["from","変換元","select",["㎡","㎢","坪","ha","acre"]],["to","変換先","select",["㎡","㎢","坪","ha","acre"]]],v=>{let u={"㎡":1,"㎢":1e6,"坪":3.305785,"ha":10000,acre:4046.8564224};return (+v.a*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["weight","重さ変換",[["a","値","number"],["from","変換元","select",["mg","g","kg","oz","lb"]],["to","変換先","select",["mg","g","kg","oz","lb"]]],v=>{let u={mg:.001,g:1,kg:1000,oz:28.349523125,lb:453.59237};return (+v.a*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["speed","速度変換",[["a","値","number"],["from","変換元","select",["m/s","km/h","mph","knot"]],["to","変換先","select",["m/s","km/h","mph","knot"]]],v=>{let u={"m/s":1,"km/h":1/3.6,mph:.44704,knot:.514444};return (+v.a*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["upper","大文字化",[["text","文字列","textarea"]],v=>v.text.toUpperCase()],
["lower","小文字化",[["text","文字列","textarea"]],v=>v.text.toLowerCase()],
["char-count","文字数カウント",[["text","文章","textarea"]],v=>String([...v.text].length)],
["line-count","行数カウント",[["text","文章","textarea"]],v=>String(L(v.text).length)],
["space-count","空白数カウント",[["text","文章","textarea"]],v=>String((v.text.match(/[ \t　]/g)||[]).length)],
["random-number","乱数生成",[["a","最小","number",1],["b","最大","number",100]],v=>String(Math.floor(Math.random()*(+v.b-+v.a+1))+(+v.a))]
];
if(sel){tools.forEach((t,i)=>{let o=document.createElement("option");o.value=i;o.textContent=(i+1)+". "+t[1];sel.appendChild(o)});}
function render(){app.innerHTML="";let index=sel?+sel.value:tools.findIndex(t=>t[0]===app.dataset.tool);if(index<0)index=0;let t=tools[index],refs={};t[2].forEach(s=>{let label=document.createElement("label");label.style.display="block";label.style.marginBottom="12px";let cap=document.createElement("span");cap.textContent=s[1];cap.style.display="block";cap.style.marginBottom="5px";label.appendChild(cap);let e;if(s[2]==="textarea"){e=document.createElement("textarea");e.style.minHeight="140px"}else if(s[2]==="select"){e=document.createElement("select");s[3].forEach(x=>{let o=document.createElement("option");o.value=o.textContent=x;e.appendChild(o)})}else{e=document.createElement("input");e.type=s[2]||"text";if(s[3]!==undefined)e.value=s[3]}e.style.width="100%";e.style.padding="10px";e.style.border="1px solid #c8cdd3";e.style.borderRadius="9px";refs[s[0]]=e;label.appendChild(e);app.appendChild(label)});
let b=document.createElement("div");b.className="buttons";let run=document.createElement("button");run.textContent="実行";let copy=document.createElement("button");copy.textContent="結果をコピー";copy.className="secondary";b.append(run,copy);let out=document.createElement("textarea");out.readOnly=true;out.placeholder="結果";out.style.marginTop="16px";let msg=document.createElement("div");msg.className="message";app.append(b,out,msg);
run.onclick=()=>{try{let v={};Object.keys(refs).forEach(k=>v[k]=refs[k].value);out.value=t[3](v);msg.textContent="完了しました。"}catch(e){msg.textContent="入力内容を確認してください。"}};
copy.onclick=async()=>{if(!out.value){msg.textContent="コピーする結果がありません。";return}try{await navigator.clipboard.writeText(out.value);msg.textContent="コピーしました。"}catch(e){msg.textContent="コピーできませんでした。"}};
}
if(sel)sel.onchange=render;render();
});