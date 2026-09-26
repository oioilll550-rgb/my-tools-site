const SITE_TOOLS = [
  { name:"文字数カウンター", url:"tools/character-counter.html", keywords:["文字数","カウント","文章","行数","単語数"] },
  { name:"全角・半角変換", url:"tools/zenkaku-hankaku.html", keywords:["全角","半角","変換","英数字","記号"] },
  { name:"改行削除", url:"tools/remove-linebreaks.html", keywords:["改行","削除","文章","整形","スペース"] },
  { name:"重複行削除", url:"tools/remove-duplicates.html", keywords:["重複","行","削除","整理","リスト"] },
  { name:"大文字・小文字変換", url:"tools/case-converter.html", keywords:["大文字","小文字","英字","uppercase","lowercase"] },
  { name:"空白削除", url:"tools/space-remover.html", keywords:["空白","スペース","削除","全角","半角"] },
  { name:"便利ツール50", url:"tools/utility-box.html", keywords:["50","文章整形","数値計算","日付","変換","単位","色","乱数","UUID","割引","税"] }
];

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase().replace(/[・\s]/g, "");
}

function searchTools() {
  const input=document.getElementById("toolSearch");
  const results=document.getElementById("searchResults");
  if(!input||!results) return;
  const keyword=normalizeSearchText(input.value);
  results.innerHTML="";
  if(!keyword) return;
  const matched=SITE_TOOLS.filter(tool=>{
    const target=[tool.name,...(tool.keywords||[])].map(normalizeSearchText).join(" ");
    return target.includes(keyword);
  });
  if(matched.length===0){
    const p=document.createElement("p");
    p.textContent="該当するツールがありません。";
    results.appendChild(p);
    return;
  }
  matched.forEach(tool=>{
    const link=document.createElement("a");
    link.href=tool.url;
    link.textContent=tool.name;
    link.className="result-link";
    results.appendChild(link);
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  const input=document.getElementById("toolSearch");
  if(input) input.addEventListener("keydown",e=>{if(e.key==="Enter") searchTools();});
  const year=document.querySelector("[data-current-year]");
  if(year) year.textContent=new Date().getFullYear();
});