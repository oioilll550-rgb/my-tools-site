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

const SITE_CONTENT = [
  ...SITE_TOOLS.map(tool => ({...tool, type:"ツール"})),
  ...[{"name":"公共施設を探す","url":"public/","type":"公共施設","keywords":["公共施設","施設","埼玉県","越谷市"]},{"name":"埼玉県の公共施設","url":"public/saitama/","type":"公共施設","keywords":["埼玉県","市区町村","公共施設"]},{"name":"越谷市の公共施設","url":"public/saitama/koshigaya/","type":"公共施設","keywords":["越谷市","公共施設","施設一覧"]},{"name":"越谷市の図書館・図書室","url":"public/saitama/koshigaya/libraries.html","type":"公共施設","keywords":["図書館","図書室","越谷市立図書館","北部図書室","南部図書室","中央図書室"]},{"name":"越谷市の公園・植物園","url":"public/saitama/koshigaya/parks.html","type":"公共施設","keywords":["公園","植物園","大里第一公園","大里第二公園","大林公園","平方山谷公園","平方公園","沼田第一公園","沼田第二公園","千間台第一公園","間久里第一公園","間久里第二公園","間久里第三公園","間久里第四公園","間久里第五公園","弥十郎公園","弥十郎第二公園","大吉公園","大吉調節池公園","古利根堰公園","向畑公園","大杉公園","大杉第二公園","増林上一区公園","増林公園","記島河原公園","本田グランド","東越谷第一公園","東越谷第二公園","東越谷第三公園","東越谷第四公園","東越谷第六公園","東越谷第七公園","東越谷六丁目公園","東越谷七丁目しいの木公園","東越谷七丁目みどりの公園","東越谷八丁目けやき公園","東越谷八丁目いちょう公園","東越谷九丁目公園","東越谷十丁目2010公園","東越谷ボタン公園","越谷総合公園","花田第一公園","花田第二公園","花田第三公園","花田第四公園","花田第五公園","花田第六公園","恩間公園","恩間第二公園","恩間第三公園","西大袋第一公園","西大袋第三公園","西大袋第五公園","西大袋第七公園","西大袋第九公園","袋山せせらぎ公園","梅林公園","大房新生公園","大房第一公園","千間台第二公園","千間台第三公園","千間台第四公園","千間台第五公園","せんげん堀公園","しらこばと運動公園","最終処理場公園","出津第一公園","出津第二公園","フジバカマ公園","南荻島公園","宮本公園","神明町二丁目公園","わかば公園","七左第三公園","出羽公園","大間野町第一公園","大間野町第二公園","大間野町第三公園","四ケ村スポット公園","蒲生公園","タイヤ公園","蒲生寿町公園","蒲生旭町公園","南越谷第三公園","南部第一公園","南部第二公園","南部第三公園","南部第四公園","南部第五公園","川柳四丁目公園","川柳公園","レイクタウン第七公園","レイクタウン第八公園","レイクタウン湖畔の森公園","レイクタウンスポーツ公園","レイクタウン第一公園","レイクタウン第二公園","レイクタウン第三公園","レイクタウン第四公園","レイクタウン第五公園","レイクタウン第六公園","レイクタウン第九公園","みわの杜公園","辻公園","見田方遺跡公園","越谷流通公園","堂面第一公園","堂面第二公園","大沢公園","鷺高第一公園","鷺高第二公園","鷺高第三公園","鷺高第四公園","鷺高第五公園","鷺高第六公園","鷺高第七公園","定使野公園","鷲越公園","北越谷第一公園","北越谷第二公園","北越谷第三公園","北越谷第四公園","北越谷第五公園","緑の森公園","越ケ谷三丁目公園","赤山町一丁目わくわく公園","赤山第二公園","東越谷第五公園","七左第一公園","七左第二公園","七左第四公園","南越谷グランド","南越谷第一公園","南越谷第二公園","越谷駅西口公園","赤山公園","赤山町第三公園","植物園","しらこばと水上公園","越谷公園","県民健康福祉村"]},{"name":"越谷市の市役所・行政窓口","url":"public/saitama/koshigaya/city-offices.html","type":"公共施設","keywords":["市役所","行政窓口","越谷市役所","パスポートセンター","北部出張所","南部出張所"]},{"name":"越谷市のスポーツ施設","url":"public/saitama/koshigaya/sports.html","type":"公共施設","keywords":["スポーツ","体育館","競技場","球場","市民プール","総合体育館","しらこばと運動公園","越谷市民球場","庭球場","弓道場","洋弓場","サッカー場"]},{"name":"越谷市の児童館・児童発達","url":"public/saitama/koshigaya/children.html","type":"公共施設","keywords":["児童館","児童発達","ヒマワリ","コスモス","児童発達支援センター"]},{"name":"越谷市の市民会館・市民ホール","url":"public/saitama/koshigaya/culture.html","type":"公共施設","keywords":["市民会館","市民ホール","中央市民会館","北部市民会館","サンシティホール","越谷コミュニティセンター"]},{"name":"越谷市の保健医療施設","url":"public/saitama/koshigaya/health.html","type":"公共施設","keywords":["保健医療","保健センター","保健所","夜間急患診療所","市立病院","こころの健康支援室"]},{"name":"越谷市のごみ・リサイクル施設","url":"public/saitama/koshigaya/recycle.html","type":"公共施設","keywords":["ごみ","リサイクル","リサイクルプラザ","東埼玉資源環境組合"]},{"name":"越谷市の高齢者福祉施設","url":"public/saitama/koshigaya/senior.html","type":"公共施設","keywords":["高齢者","老人福祉センター","けやき荘","くすのき荘","ゆりのき荘","ひのき荘"]},{"name":"越谷市の障がい者福祉施設","url":"public/saitama/koshigaya/disability.html","type":"公共施設","keywords":["障がい者","障害者","福祉","しらこばと","こばと館","成年後見センター"]},{"name":"越谷市の斎場","url":"public/saitama/koshigaya/crematorium.html","type":"公共施設","keywords":["斎場","越谷市斎場","火葬"]},{"name":"越谷市の保育所・幼稚園","url":"public/saitama/koshigaya/nursery.html","type":"公共施設","keywords":["保育所","保育園","幼稚園","保育施設"]},{"name":"越谷市の伝統文化施設","url":"public/saitama/koshigaya/traditional.html","type":"公共施設","keywords":["伝統文化","能楽堂","こしがや能楽堂","中村家住宅"]},{"name":"越谷市の学校・教育施設","url":"public/saitama/koshigaya/education.html","type":"公共施設","keywords":["学校","教育","ミラクル","科学技術体験センター","大学","高校","養護学校"]},{"name":"越谷市の地区センター・公民館","url":"public/saitama/koshigaya/community-centers.html","type":"公共施設","keywords":["地区センター","公民館","大袋","南越谷","大沢","桜井","新方","増林","荻島","出羽","蒲生","川柳","大相模","越ヶ谷","北越谷","千間台記念会館","市民活動支援センター"]},{"name":"越谷市の交流館","url":"public/saitama/koshigaya/exchange-halls.html","type":"公共施設","keywords":["交流館","桜井交流館","南越谷交流館","赤山交流館","大沢北交流館","蒲生交流館","南部交流館","大袋北交流館"]},{"name":"越谷市の農業関連施設","url":"public/saitama/koshigaya/agriculture.html","type":"公共施設","keywords":["農業","農業技術センター","卸売市場","市民農園"]},{"name":"越谷市の自然・保養案内","url":"public/saitama/koshigaya/nature.html","type":"公共施設","keywords":["自然","保養","保養施設","両神荘"]},{"name":"越谷市の上下水道関連施設","url":"public/saitama/koshigaya/water.html","type":"公共施設","keywords":["上下水道","水道","越谷松伏水道企業団","江戸川河川事務所"]},{"name":"越谷市の仕事・就職施設","url":"public/saitama/koshigaya/jobs.html","type":"公共施設","keywords":["仕事","就職","ハローワーク","ハローワーク越谷"]},{"name":"越谷市の観光・物産施設","url":"public/saitama/koshigaya/tourism.html","type":"公共施設","keywords":["観光","物産"]},{"name":"越谷市のその他施設","url":"public/saitama/koshigaya/other.html","type":"公共施設","keywords":["消防署","消防局","男女共同参画","ほっと越谷","駐車場","葛西用水","国","県","その他"]}]
];

function searchSite() {
  const input=document.getElementById("siteSearch");
  const results=document.getElementById("searchResults");
  if(!input||!results) return;
  const keyword=normalizeSearchText(input.value);
  results.innerHTML="";
  if(!keyword) return;

  const matched=SITE_CONTENT.filter(item=>{
    const target=[item.name,...(item.keywords||[])].map(normalizeSearchText).join(" ");
    return target.includes(keyword);
  }).slice(0,20);

  if(matched.length===0){
    const p=document.createElement("p");
    p.textContent="該当するページがありません。";
    results.appendChild(p);
    return;
  }

  matched.forEach(item=>{
    const link=document.createElement("a");
    link.href=item.url;
    link.className="result-link";
    const name=document.createElement("span");
    name.textContent=item.name;
    const type=document.createElement("small");
    type.className="result-type";
    type.textContent=item.type || "";
    link.append(name,type);
    results.appendChild(link);
  });
}

function searchTools(){ searchSite(); }

document.addEventListener("DOMContentLoaded",()=>{
  const input=document.getElementById("siteSearch");
  if(input) input.addEventListener("keydown",e=>{if(e.key==="Enter") searchSite();});
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
