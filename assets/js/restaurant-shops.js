document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("publicRestaurantList");
  const search = document.getElementById("publicRestaurantSearch");
  const category = document.getElementById("publicRestaurantCategory");
  const confidence = document.getElementById("publicRestaurantConfidence");
  const sort = document.getElementById("publicRestaurantSort");
  const more = document.getElementById("publicRestaurantMore");
  const count = document.getElementById("publicRestaurantCount");
  const status = document.getElementById("publicRestaurantStatus");
  if (!list || !search || !category || !confidence || !sort || !more) return;

  const PAGE = 50;
  const config = window.BENRI_CONFIG || {};
  const apiBase = String(config.facilityApiUrl || "").replace(/\/$/, "");
  const jsonUrl = list.dataset.dataUrl;
  let all = [];
  let filtered = [];
  let shown = 0;
  let nextOffset = 0;
  let loading = false;
  let debounceTimer = 0;

  const normalize = (value) =>
    String(value || "").toLowerCase().replace(/[\s　・･,，.。()（）]/g, "");

  const mapUrl = (r) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(r.name + " " + r.address);

  function labelForConfidence(value) {
    if (value === "official") return "公式";
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
    badge.className = "restaurant-confidence is-" + (r.confidence || "medium");
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

    if (r.openingDate) {
      const dtOpening = document.createElement("dt");
      dtOpening.textContent = "開店日";
      const ddOpening = document.createElement("dd");
      ddOpening.textContent = r.openingDate;
      dl.append(dtOpening, ddOpening);
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

  async function loadApiPage(reset) {
    if (loading) return;
    loading = true;
    more.disabled = true;
    try {
      if (reset) {
        list.innerHTML = "";
        nextOffset = 0;
      }
      const params = new URLSearchParams({
        municipality_code: "112224",
        type: "restaurant",
        limit: String(PAGE),
        offset: String(nextOffset),
        sort: sort.value,
      });
      const q = search.value.trim();
      if (q) params.set("q", q);
      if (category.value) params.set("category", category.value);
      if (confidence.value) params.set("confidence", confidence.value);

      const res = await fetch(apiBase + "/api/facilities?" + params.toString());
      if (!res.ok) throw new Error("api request failed");
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      items.forEach(createCard);
      nextOffset = data.nextOffset == null ? nextOffset + items.length : data.nextOffset;
      more.hidden = !data.hasMore;
      if (status) {
        status.textContent = nextOffset.toLocaleString("ja-JP") + "件表示" +
          (data.hasMore ? "（続きがあります）" : "");
      }
      if (!items.length && reset) {
        list.innerHTML = '<p class="notice">条件に一致する店舗がありません。</p>';
      }
    } catch (_) {
      if (reset) {
        await loadJson();
      }
    } finally {
      loading = false;
      more.disabled = false;
    }
  }

  async function loadApiStats() {
    if (!apiBase || !count) return;
    try {
      const res = await fetch(apiBase + "/api/stats?municipality_code=112224&type=restaurant");
      if (!res.ok) return;
      const data = await res.json();
      count.textContent = Number(data.count || 0).toLocaleString("ja-JP") + "件";
    } catch (_) {}
  }

  function applyJsonFilters() {
    const q = normalize(search.value);
    const cat = category.value;
    const conf = confidence.value;
    filtered = all.filter((r) => {
      if (q && !normalize(r.name + " " + r.address).includes(q)) return false;
      if (cat && !(r.tags || []).includes(cat)) return false;
      if (conf && r.confidence !== conf) return false;
      return true;
    });

    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja");
    const byDate = (a, b) => {
      const ad = String(a.permitDate || "");
      const bd = String(b.permitDate || "");
      if (!ad && !bd) return byName(a, b);
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.localeCompare(bd) || byName(a, b);
    };

    if (sort.value === "permit_date_asc") filtered.sort(byDate);
    else if (sort.value === "name_asc") filtered.sort(byName);
    else if (sort.value === "name_desc") filtered.sort((a, b) => -byName(a, b));
    else filtered.sort((a, b) => -byDate(a, b));

    list.innerHTML = "";
    shown = 0;
    renderJsonMore();
  }

  function renderJsonMore() {
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

  async function loadJson() {
    const res = await fetch(jsonUrl, {cache: "no-store"});
    if (!res.ok) throw new Error("data request failed");
    const data = await res.json();
    all = Array.isArray(data.restaurants) ? data.restaurants : [];
    filtered = all;
    if (count) count.textContent = (data.count || all.length).toLocaleString("ja-JP") + "件";
    list.innerHTML = "";
    shown = 0;
    renderJsonMore();
  }

  async function refresh() {
    if (apiBase) {
      await loadApiPage(true);
    } else {
      applyJsonFilters();
    }
  }

  try {
    if (apiBase) {
      await Promise.all([loadApiPage(true), loadApiStats()]);
    } else {
      await loadJson();
    }
  } catch (_) {
    list.innerHTML = '<p class="notice">店舗データを取得できませんでした。時間をおいて再度ご確認ください。</p>';
    more.hidden = true;
  }

  search.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, 300);
  });
  category.addEventListener("change", refresh);
  confidence.addEventListener("change", refresh);
  sort.addEventListener("change", refresh);
  more.addEventListener("click", () => {
    if (apiBase) loadApiPage(false);
    else renderJsonMore();
  });
});
