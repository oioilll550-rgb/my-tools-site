document.addEventListener("DOMContentLoaded",function(){
const sel=document.getElementById("utilitySelect"),app=document.getElementById("utilityApp");if(!app)return;
const L=s=>String(s).split(/\r\n|\r|\n/);
const N=s=>{const t=String(s).trim();if(!t)return[];const a=t.split(/[\s,、]+/).filter(Boolean).map(Number);return a.every(Number.isFinite)?a:null};
const G=s=>{s=String(s);if(typeof Intl!=="undefined"&&Intl.Segmenter){return Array.from(new Intl.Segmenter("ja",{granularity:"grapheme"}).segment(s),x=>x.segment)}return Array.from(s)};
const ymd=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3],ms=Date.UTC(y,mo-1,d),x=new Date(ms);return x.getUTCFullYear()===y&&x.getUTCMonth()===mo-1&&x.getUTCDate()===d?{y,mo,d,ms}:null};
const moneyRound=(n,mode)=>mode==="切り捨て"?Math.floor(n):mode==="切り上げ"?Math.ceil(n):mode==="四捨五入"?Math.round(n):n;
const fmtNum=n=>Number.isFinite(n)?String(Number(n.toFixed(10))):"入力内容を確認してください";
const tools=[
["trim","前後空白削除",[["text","文章","textarea"]],v=>v.text.trim()],
["sort","行の並べ替え",[["text","行","textarea"],["order","順序","select",["昇順","降順"]]],v=>L(v.text).sort((a,b)=>a.localeCompare(b,"ja")*(v.order==="降順"?-1:1)).join("\n")],
["reverse-lines","行順反転",[["text","行","textarea"]],v=>L(v.text).reverse().join("\n")],
["number-lines","行番号追加",[["text","行","textarea"]],v=>L(v.text).map((x,i)=>(i+1)+". "+x).join("\n")],
["remove-empty","空行削除",[["text","文章","textarea"]],v=>L(v.text).filter(x=>x.trim()).join("\n")],
["shuffle","行シャッフル",[["text","行","textarea"]],v=>{let a=L(v.text);for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.join("\n")}],
["emails","メールアドレス抽出",[["text","文章","textarea"]],v=>(v.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).join("\n")],
["urls","URL抽出",[["text","文章","textarea"]],v=>(v.text.match(/https?:\/\/[^\s<>"']+/g)||[]).join("\n")],
["reverse-text","文字列反転",[["text","文字列","textarea"]],v=>G(v.text).reverse().join("")],
["rot13","ROT13変換",[["text","文字列","textarea"]],v=>v.text.replace(/[A-Za-z]/g,c=>{let b=c<="Z"?65:97;return String.fromCharCode(b+(c.charCodeAt(0)-b+13)%26)})],
["escape","HTMLエスケープ",[["text","HTML","textarea"]],v=>v.text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))],
["unescape","HTMLアンエスケープ",[["text","文字参照","textarea"]],v=>{let t=document.createElement("textarea");t.innerHTML=v.text;return t.value}],
["repeat","文字列繰り返し",[["text","文字列","textarea"],["a","回数","number",3]],v=>{const n=intNum(v.a,"回数");if(n<0||n>1000)throw new Error("回数は0〜1000で入力してください");return Array(n).fill(v.text).join("")}],
["prefix","行頭文字追加",[["text","行","textarea"],["a","追加文字","text"]],v=>L(v.text).map(x=>v.a+x).join("\n")],
["suffix","行末文字追加",[["text","行","textarea"],["a","追加文字","text"]],v=>L(v.text).map(x=>x+v.a).join("\n")],
["join","行結合",[["text","複数行","textarea"],["a","区切り文字","text",", "]],v=>L(v.text).join(v.a)],
["split","区切り文字で分割",[["text","文字列","textarea"],["a","区切り文字","text",","]],v=>v.a?v.text.split(v.a).join("\n"):v.text],
["comma-lines","カンマ→改行",[["text","カンマ区切り","textarea"]],v=>v.text.split(",").map(x=>x.trim()).join("\n")],
["lines-comma","改行→カンマ",[["text","複数行","textarea"]],v=>L(v.text).map(x=>x.trim()).filter(Boolean).join(",")],
["frequency","単語出現回数",[["text","文章","textarea"]],v=>{let m=new Map;v.text.trim().split(/\s+/).filter(Boolean).forEach(w=>m.set(w,(m.get(w)||0)+1));return [...m].sort((a,b)=>b[1]-a[1]).map(x=>x[0]+"\t"+x[1]).join("\n")}],
["sum","数値合計",[["text","数値","textarea"]],v=>{const a=N(v.text);return a===null?"数値以外が含まれています":String(a.reduce((x,y)=>x+y,0))}],
["avg","数値平均",[["text","数値","textarea"]],v=>{const a=N(v.text);if(a===null)return"数値以外が含まれています";return a.length?fmtNum(a.reduce((x,y)=>x+y,0)/a.length):"数値を入力してください"}],
["minmax","最小・最大値",[["text","数値","textarea"]],v=>{const a=N(v.text);if(a===null)return"数値以外が含まれています";return a.length?"最小: "+Math.min(...a)+"\n最大: "+Math.max(...a):"数値を入力してください"}],
["percent","割合計算",[["a","対象の数","number"],["b","全体","number"]],v=>{const a=num(v.a,"対象の数"),b=num(v.b,"全体");if(b===0)throw new Error("全体は0以外を入力してください");return (a/b*100).toFixed(2)+"%"}],
["discount","割引計算",[["a","元の価格","number"],["b","割引率（%）","number"]],v=>{const p=num(v.a,"元の価格"),rr=num(v.b,"割引率");if(p<0||rr<0||rr>100)throw new Error("価格は0以上、割引率は0〜100%で入力してください");return "割引後: "+(p*(1-rr/100)).toFixed(2)+"\n値引額: "+(p*rr/100).toFixed(2)}],
["tax","税込計算",[["a","税抜金額","number"],["b","税率（%）","number",10]],v=>{const p=num(v.a,"税抜金額"),rr=num(v.b,"税率");if(p<0||rr<0)throw new Error("金額と税率は0以上で入力してください");return "税込: "+(p*(1+rr/100)).toFixed(2)+"\n税額: "+(p*rr/100).toFixed(2)}],
["age","年齢計算",[["a","生年月日","date"],["b","基準日","date"]],v=>{if(!v.a)throw new Error("生年月日を入力してください");const birth=utcDate(v.a);const now=new Date();const base=v.b?utcDate(v.b):Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());if(birth>base)throw new Error("生年月日は基準日以前にしてください");const bd=new Date(birth),bt=new Date(base);let n=bt.getUTCFullYear()-bd.getUTCFullYear();const m=bt.getUTCMonth()-bd.getUTCMonth();if(m<0||(m===0&&bt.getUTCDate()<bd.getUTCDate()))n--;return n+"歳"}],
["days","日数差計算",[["a","開始日","date"],["b","終了日","date"]],v=>((utcDate(v.b)-utcDate(v.a))/86400000)+"日"],
["adddays","日付加算",[["a","日付","date"],["b","加算日数","number",1]],v=>{const t=utcDate(v.a)+intNum(v.b,"加算日数")*86400000;const d=new Date(t);return d.getUTCFullYear()+"/"+(d.getUTCMonth()+1)+"/"+d.getUTCDate()}],
["unix-date","Unix時刻→日時",[["a","Unix秒","number"]],v=>{const n=num(v.a,"Unix時刻");const d=new Date(n*1000);if(Number.isNaN(d.getTime()))throw new Error("有効なUnix時刻を入力してください");return d.toLocaleString("ja-JP")}],
["date-unix","日時→Unix時刻",[["a","日時","datetime-local"]],v=>{if(!v.a)throw new Error("日時を入力してください");const t=new Date(v.a).getTime();if(Number.isNaN(t))throw new Error("正しい日時を入力してください");return String(Math.floor(t/1000))}],
["uuid","UUID生成",[],()=>{if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;return [...a].map((b,i)=>([4,6,8,10].includes(i)?"-":"")+b.toString(16).padStart(2,"0")).join("")}],
["hex-dec","16進数→10進数",[["a","16進数","text","FF"]],v=>{const s=String(v.a).trim().replace(/^0x/i,"");if(!/^[0-9a-f]+$/i.test(s))throw new Error("16進数として正しい文字を入力してください");return String(parseInt(s,16))}],
["dec-hex","10進数→16進数",[["a","10進数","number",255]],v=>intNum(v.a,"10進数").toString(16).toUpperCase()],
["bin-dec","2進数→10進数",[["a","2進数","text","1010"]],v=>{const s=String(v.a).trim();if(!/^[01]+$/.test(s))throw new Error("2進数は0と1だけで入力してください");return String(parseInt(s,2))}],
["dec-bin","10進数→2進数",[["a","10進数","number",10]],v=>intNum(v.a,"10進数").toString(2)],
["rgb-hex","RGB→HEX",[["a","R","number"],["b","G","number"],["c","B","number"]],v=>"#"+[["R",v.a],["G",v.b],["B",v.c]].map(([label,x])=>{const n=intNum(x,label);if(n<0||n>255)throw new Error(label+"は0〜255で入力してください");return n.toString(16).padStart(2,"0")}).join("").toUpperCase()],
["hex-rgb","HEX→RGB",[["a","HEX","text","#336699"]],v=>{let h=String(v.a).trim().replace(/^#/,"");if(!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h))throw new Error("HEXは3桁または6桁で入力してください");if(h.length===3)h=[...h].map(x=>x+x).join("");const n=parseInt(h,16);return "rgb("+(n>>16)+", "+((n>>8)&255)+", "+(n&255)+")"}],
["bytes","データ容量変換",[["a","値","number"],["from","変換元（1KB=1024B）","select",["B","KB","MB","GB","TB"]],["to","変換先","select",["B","KB","MB","GB","TB"]]],v=>{const n=num(v.a,"値");if(n<0)throw new Error("値は0以上で入力してください");const u={B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776};return (n*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to}],
["temp","温度変換",[["a","値","number"],["from","変換元","select",["℃","℉","K"]],["to","変換先","select",["℃","℉","K"]]],v=>{if(String(v.a).trim()==="")return"値を入力してください";let c=Number(v.a);if(!Number.isFinite(c))return"数値を入力してください";if(v.from==="℉")c=(c-32)*5/9;if(v.from==="K")c-=273.15;if(c<-273.15-1e-10)return"絶対零度未満の温度は指定できません";let out=c;if(v.to==="℉")out=c*9/5+32;if(v.to==="K")out=c+273.15;return fmtNum(out)+" "+v.to}],
["length","長さ変換",[["a","値","number"],["from","変換元","select",["mm","cm","m","km","inch","ft"]],["to","変換先","select",["mm","cm","m","km","inch","ft"]]],v=>{const n=Number(v.a),u={mm:.001,cm:.01,m:1,km:1000,inch:.0254,ft:.3048};return String(v.a).trim()!==""&&Number.isFinite(n)?(n*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to:"数値を入力してください"}],
["area","面積変換",[["a","値","number"],["from","変換元","select",["㎡","㎢","坪","ha","acre"]],["to","変換先","select",["㎡","㎢","坪","ha","acre"]]],v=>{const n=Number(v.a),u={"㎡":1,"㎢":1e6,"坪":3.3057851239669422,"ha":10000,acre:4046.8564224};return String(v.a).trim()!==""&&Number.isFinite(n)?(n*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to:"数値を入力してください"}],
["weight","重さ変換",[["a","値","number"],["from","変換元","select",["mg","g","kg","oz","lb"]],["to","変換先","select",["mg","g","kg","oz","lb"]]],v=>{const n=Number(v.a),u={mg:.001,g:1,kg:1000,oz:28.349523125,lb:453.59237};return String(v.a).trim()!==""&&Number.isFinite(n)?(n*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to:"数値を入力してください"}],
["speed","速度変換",[["a","値","number"],["from","変換元","select",["m/s","km/h","mph","knot"]],["to","変換先","select",["m/s","km/h","mph","knot"]]],v=>{const n=Number(v.a),u={"m/s":1,"km/h":1/3.6,mph:.44704,knot:0.5144444444444445};return String(v.a).trim()!==""&&Number.isFinite(n)?(n*u[v.from]/u[v.to]).toLocaleString("ja-JP",{maximumFractionDigits:8})+" "+v.to:"数値を入力してください"}],
["upper","大文字化",[["text","文字列","textarea"]],v=>v.text.toUpperCase()],
["lower","小文字化",[["text","文字列","textarea"]],v=>v.text.toLowerCase()],
["char-count","文字数カウント",[["text","文章","textarea"]],v=>String(G(v.text).length)],
["line-count","行数カウント",[["text","文章","textarea"]],v=>String(v.text===""?0:L(v.text).length)],
["space-count","空白数カウント",[["text","文章","textarea"]],v=>String((v.text.match(/[ \t　]/g)||[]).length)],
["random-number","乱数生成",[["a","最小","number",1],["b","最大","number",100]],v=>{const a=intNum(v.a,"最小値"),b=intNum(v.b,"最大値");if(a>b)throw new Error("最小値は最大値以下にしてください");const range=b-a+1;if(range<=0||range>0x100000000)throw new Error("範囲が大きすぎます");const max=Math.floor(0x100000000/range)*range;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=max);return String(a+(x%range))}]
];
if(sel){tools.forEach((t,i)=>{let o=document.createElement("option");o.value=i;o.textContent=(i+1)+". "+t[1];sel.appendChild(o)});}
function render(){app.innerHTML="";let index=sel?+sel.value:tools.findIndex(t=>t[0]===app.dataset.tool);if(index<0)index=0;let t=tools[index],refs={};t[2].forEach(s=>{let label=document.createElement("label");label.style.display="block";label.style.marginBottom="12px";let cap=document.createElement("span");cap.textContent=s[1];cap.style.display="block";cap.style.marginBottom="5px";label.appendChild(cap);let e;if(s[2]==="textarea"){e=document.createElement("textarea");e.style.minHeight="140px"}else if(s[2]==="select"){e=document.createElement("select");s[3].forEach(x=>{let o=document.createElement("option");o.value=o.textContent=x;e.appendChild(o)})}else{e=document.createElement("input");e.type=s[2]||"text";if(s[3]!==undefined)e.value=s[3]}e.style.width="100%";e.style.padding="10px";e.style.border="1px solid #c8cdd3";e.style.borderRadius="9px";refs[s[0]]=e;label.appendChild(e);app.appendChild(label)});
let b=document.createElement("div");b.className="buttons";let run=document.createElement("button");run.textContent="実行";let copy=document.createElement("button");copy.textContent="結果をコピー";copy.className="secondary";b.append(run,copy);let out=document.createElement("textarea");out.readOnly=true;out.placeholder="結果";out.style.marginTop="16px";let msg=document.createElement("div");msg.className="message";app.append(b,out,msg);
run.onclick=()=>{try{let v={};Object.keys(refs).forEach(k=>v[k]=refs[k].value);out.value=t[3](v);msg.textContent="完了しました。"}catch(e){msg.textContent=e&&e.message?e.message:"入力内容を確認してください。";}};
copy.onclick=async()=>{if(!out.value){msg.textContent="コピーする結果がありません。";return}try{await navigator.clipboard.writeText(out.value);msg.textContent="コピーしました。"}catch(e){msg.textContent="コピーできませんでした。"}};
}
if(sel)sel.onchange=render;render();
});