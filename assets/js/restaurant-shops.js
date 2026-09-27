document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("publicRestaurantList");
  const search = document.getElementById("publicRestaurantSearch");
  const category = document.getElementById("publicRestaurantCategory");
  const confidence = document.getElementById("publicRestaurantConfidence");
  const more = document.getElementById("publicRestaurantMore");
  const count = document.getElementById("publicRestaurantCount");
  const status = document.getElementById("publicRestaurantStatus");
  if (!list || !search || !category || !confidence || !more) return;

  const PAGE = 50;
  let all = [];
  let filtered = [];
  let shown = 0;

  const normalize = (value) =>
    String(value || "").toLowerCase().replace(/[\s　・･,，.。()（）]/g, "");

  const mapUrl = (r) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(r.name + " " + r.address);

  function labelForConfidence(value) {
    if (value === "confirmed") return "確認済み";
    if (value === "high") return "自動判定・高";
    return "自動判定";
  }

  function createCard(r) {
    const article = document.createElement("article");
    article.className = "facility-card restaurant-facility-card";

    const heading = document.createElement("h2");
    heading.textContent = r.name;

    const badge = document.createElement("span");
    badge.className = "restaurant-confidence " + "is-" + r.confidence;
    badge.textContent = labelForConfidence(r.confidence);
    heading.appendChild(document.createTextNode(" "));
    heading.appendChild(badge);

    const dl = document.createElement("dl");

    const dtAddr = document.createElement("dt");
    dtAddr.textContent = "住所";
    const ddAddr = document.createElement("dd");
    const a = document.createElement("a");
    a.className = "map-address-link";
    a.href = mapUrl(r);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = r.address;
    ddAddr.appendChild(a);
    dl.append(dtAddr, ddAddr);

    if (r.permitDate) {
      const dtPermit = document.createElement("dt");
      dtPermit.textContent = "許可・届出";
      const ddPermit = document.createElement("dd");
      ddPermit.textContent = r.permitDate;
      dl.append(dtPermit, ddPermit);
    }

    if ((r.tags || []).length) {
      const dtTags = document.createElement("dt");
      dtTags.textContent = "分類";
      const ddTags = document.createElement("dd");
      ddTags.textContent = r.tags.join(" / ");
      dl.append(dtTags, ddTags);
    }

    article.append(heading, dl);
    list.appendChild(article);
  }

  function applyFilters() {
    const q = normalize(search.value);
    const cat = category.value;
    const conf = confidence.value;

    filtered = all.filter((r) => {
      if (q && !normalize(r.name + " " + r.address).includes(q)) return false;
      if (cat && !(r.tags || []).includes(cat)) return false;
      if (conf && r.confidence !== conf) return false;
      return true;
    });

    list.innerHTML = "";
    shown = 0;
    renderMore();
  }

  function renderMore() {
    const next = filtered.slice(shown, shown + PAGE);
    next.forEach(createCard);
    shown += next.length;
    more.hidden = shown >= filtered.length;
    if (status) {
      status.textContent =
        filtered.length.toLocaleString("ja-JP") + "件中 " +
        shown.toLocaleString("ja-JP") + "件表示";
    }
    if (!filtered.length) {
      list.innerHTML = '<p class="notice">条件に一致する店舗がありません。</p>';
    }
  }

  try {
    const res = await fetch(list.dataset.dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("data request failed");
    const data = await res.json();
    all = Array.isArray(data.restaurants) ? data.restaurants : [];
    filtered = all;
    if (count) count.textContent = (data.count || all.length).toLocaleString("ja-JP") + "件";
    list.innerHTML = "";
    renderMore();
  } catch (_) {
    list.innerHTML = '<p class="notice">店舗データを取得できませんでした。自動分類処理の完了後に再度ご確認ください。</p>';
    more.hidden = true;
  }

  search.addEventListener("input", applyFilters);
  category.addEventListener("change", applyFilters);
  confidence.addEventListener("change", applyFilters);
  more.addEventListener("click", renderMore);
});