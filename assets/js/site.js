const SITE_TOOLS = [
  { name:"文字数カウンター", url:"tools/character-counter.html", keywords:["文字数","カウント","文章","行数","単語数"] },
  { name:"全角・半角変換", url:"tools/zenkaku-hankaku.html", keywords:["全角","半角","変換","英数字","記号"] },
  { name:"改行削除", url:"tools/remove-linebreaks.html", keywords:["改行","削除","文章","整形","スペース"] },
  { name:"重複行削除", url:"tools/remove-duplicates.html", keywords:["重複","行","削除","整理","リスト"] },
  { name:"大文字・小文字変換", url:"tools/case-converter.html", keywords:["大文字","小文字","英字","uppercase","lowercase"] },
  { name:"空白削除", url:"tools/space-remover.html", keywords:["空白","スペース","削除","全角","半角"] },
  { name:"前後空白削除", url:"tools/trim.html", keywords:["前後空白削除","文章全体の前後にある空白を削除します。"] },
  { name:"行の並べ替え", url:"tools/sort.html", keywords:["行の並べ替え","行を昇順","降順に並べ替えます。"] },
  { name:"行順反転", url:"tools/reverse-lines.html", keywords:["行順反転","行の順番を上下反転します。"] },
  { name:"行番号追加", url:"tools/number-lines.html", keywords:["行番号追加","各行の先頭に行番号を付けます。"] },
  { name:"空行削除", url:"tools/remove-empty.html", keywords:["空行削除","空の行をまとめて削除します。"] },
  { name:"行シャッフル", url:"tools/shuffle.html", keywords:["行シャッフル","行の順番をランダムに並べ替えます。"] },
  { name:"メールアドレス抽出", url:"tools/emails.html", keywords:["メールアドレス抽出","文章からメールアドレスだけを抽出します。"] },
  { name:"URL抽出", url:"tools/urls.html", keywords:["URL抽出","文章からURLだけを抽出します。"] },
  { name:"文字列反転", url:"tools/reverse-text.html", keywords:["文字列反転","文字列を後ろから逆順にします。"] },
  { name:"ROT13変換", url:"tools/rot13.html", keywords:["ROT13変換","英字をROT13で変換します。"] },
  { name:"HTMLエスケープ", url:"tools/escape.html", keywords:["HTMLエスケープ","HTML特殊文字を安全な文字参照へ変換します。"] },
  { name:"HTMLアンエスケープ", url:"tools/unescape.html", keywords:["HTMLアンエスケープ","HTML文字参照を元の文字へ戻します。"] },
  { name:"文字列繰り返し", url:"tools/repeat.html", keywords:["文字列繰り返し","指定回数だけ文字列を繰り返します。"] },
  { name:"行頭文字追加", url:"tools/prefix.html", keywords:["行頭文字追加","すべての行の先頭へ文字列を追加します。"] },
  { name:"行末文字追加", url:"tools/suffix.html", keywords:["行末文字追加","すべての行の末尾へ文字列を追加します。"] },
  { name:"行結合", url:"tools/join.html", keywords:["行結合","複数行を指定した区切り文字で1行に結合します。"] },
  { name:"区切り文字で分割", url:"tools/split.html", keywords:["区切り文字で分割","指定した区切り文字を改行へ変換します。"] },
  { name:"カンマ→改行", url:"tools/comma-lines.html", keywords:["カンマ","改行","カンマ区切りを1項目1行へ変換します。"] },
  { name:"改行→カンマ", url:"tools/lines-comma.html", keywords:["改行","カンマ","複数行をカンマ区切りに変換します。"] },
  { name:"単語出現回数", url:"tools/frequency.html", keywords:["単語出現回数","空白区切りの単語の出現回数を集計します。"] },
  { name:"数値合計", url:"tools/sum.html", keywords:["数値合計","入力した数値の合計を計算します。"] },
  { name:"数値平均", url:"tools/avg.html", keywords:["数値平均","入力した数値の平均を計算します。"] },
  { name:"最小・最大値", url:"tools/minmax.html", keywords:["最小","最大値","入力した数値の最小値と最大値を求めます。"] },
  { name:"割合計算", url:"tools/percent.html", keywords:["割合計算","ある数が全体の何％かを計算します。"] },
  { name:"割引計算", url:"tools/discount.html", keywords:["割引計算","価格と割引率から割引後価格を計算します。"] },
  { name:"税込計算", url:"tools/tax.html", keywords:["税込計算","金額と税率から税込金額と税額を計算します。"] },
  { name:"年齢計算", url:"tools/age.html", keywords:["年齢計算","生年月日から指定日時点の年齢を計算します。"] },
  { name:"日数差計算", url:"tools/days.html", keywords:["日数差計算","2つの日付の間の日数を計算します。"] },
  { name:"日付加算", url:"tools/adddays.html", keywords:["日付加算","日付に指定日数を足し引きします。"] },
  { name:"Unix時刻→日時", url:"tools/unix-date.html", keywords:["Unix時刻","日時","Unixタイムスタンプを日時へ変換します。"] },
  { name:"日時→Unix時刻", url:"tools/date-unix.html", keywords:["日時","Unix時刻","日時をUnixタイムスタンプへ変換します。"] },
  { name:"UUID生成", url:"tools/uuid.html", keywords:["UUID生成","UUIDを生成します。"] },
  { name:"16進数→10進数", url:"tools/hex-dec.html", keywords:["16進数","10進数","16進数を10進数へ変換します。"] },
  { name:"10進数→16進数", url:"tools/dec-hex.html", keywords:["10進数","16進数","10進数を16進数へ変換します。"] },
  { name:"2進数→10進数", url:"tools/bin-dec.html", keywords:["2進数","10進数","2進数を10進数へ変換します。"] },
  { name:"10進数→2進数", url:"tools/dec-bin.html", keywords:["10進数","2進数","10進数を2進数へ変換します。"] },
  { name:"RGB→HEX", url:"tools/rgb-hex.html", keywords:["RGB","HEX","RGBカラー値をHEXカラーコードへ変換します。"] },
  { name:"HEX→RGB", url:"tools/hex-rgb.html", keywords:["HEX","RGB","HEXカラーコードをRGBへ変換します。"] },
  { name:"データ容量変換", url:"tools/bytes.html", keywords:["データ容量変換","B","KB","MB","GB","TBを相互換算します。"] },
  { name:"温度変換", url:"tools/temp.html", keywords:["温度変換","摂氏","華氏","ケルビンを相互換算します。"] },
  { name:"長さ変換", url:"tools/length.html", keywords:["長さ変換","mm","cm","m","km","inch","ftを換算します。"] },
  { name:"面積変換", url:"tools/area.html", keywords:["面積変換","㎡","㎢","坪","ha","acreを換算します。"] },
  { name:"重さ変換", url:"tools/weight.html", keywords:["重さ変換","mg","g","kg","oz","lbを換算します。"] },
  { name:"速度変換", url:"tools/speed.html", keywords:["速度変換","m/s","km/h","mph","knotを換算します。"] },
  { name:"大文字化", url:"tools/upper.html", keywords:["大文字化","英字を大文字へ変換します。"] },
  { name:"小文字化", url:"tools/lower.html", keywords:["小文字化","英字を小文字へ変換します。"] },
  { name:"文字数カウント", url:"tools/char-count.html", keywords:["文字数カウント","入力した文章の文字数を数えます。"] },
  { name:"行数カウント", url:"tools/line-count.html", keywords:["行数カウント","入力した文章の行数を数えます。"] },
  { name:"空白数カウント", url:"tools/space-count.html", keywords:["空白数カウント","文章内の半角","全角空白を数えます。"] },
  { name:"乱数生成", url:"tools/random-number.html", keywords:["乱数生成","指定した範囲から整数の乱数を生成します。"] }
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

/* security hardening */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector('meta[name="referrer"]')) {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
  }

  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", Array.from(rel).join(" "));
  });
});
