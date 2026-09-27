document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("restaurantList");
  const openings = document.getElementById("newOpenings");
  const count = document.getElementById("restaurantCount");
  const holder = list || openings || document.querySelector("[data-category-count]");
  if (!holder) return;

  const config = window.BENRI_CONFIG || {};
  const apiBase = String(config.facilityApiUrl || "").replace(/\/$/, "");
  const publicDataUrl = "../../../assets/data/restaurants-koshigaya-public.json";
  const url =
    (list && publicDataUrl) ||
    (openings && openings.dataset.dataUrl) ||
    "../../../assets/data/restaurants-koshigaya.json";

  const mapUrl = (value) =>
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(value);

  const fmtDate = (value) => value ? value.replace(/-/g, "/") : "";

  function externalLink(href, text, className) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text;
    if (className) link.className = className;
    return link;
  }

  function addDlRow(dl, label, valueNode) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (valueNode instanceof Node) dd.appendChild(valueNode);
    else dd.textContent = valueNode;
    dl.append(dt, dd);
  }

  function createRestaurantCard(restaurant) {
    const article = document.createElement("article");
    article.className = "facility-card restaurant-facility-card";

    const heading = document.createElement("h2");
    heading.textContent = restaurant.name;

    const dl = document.createElement("dl");
    addDlRow(
      dl,
      "住所",
      externalLink(mapUrl(restaurant.name + " " + restaurant.address), restaurant.address, "map-address-link")
    );

    if (restaurant.permitDate) addDlRow(dl, "許可・届出", fmtDate(restaurant.permitDate));
    if (restaurant.openingDate) addDlRow(dl, "開店日", fmtDate(restaurant.openingDate));
    if (restaurant.checkedAt) addDlRow(dl, "情報確認", fmtDate(restaurant.checkedAt));

    article.append(heading, dl);

    const mapLine = document.createElement("p");
    mapLine.className = "facility-url";
    const mapLabel = document.createElement("span");
    mapLabel.textContent = "地図";
    mapLine.append(mapLabel, document.createTextNode(" "));
    mapLine.appendChild(
      externalLink(mapUrl(restaurant.name + " " + restaurant.address), "Google Maps")
    );
    article.appendChild(mapLine);

    if (restaurant.sourceUrl) {
      const sourceLine = document.createElement("p");
      sourceLine.className = "facility-url restaurant-source-url";
      const sourceLabel = document.createElement("span");
      sourceLabel.textContent = restaurant.sourceLabel || "情報元";
      sourceLine.append(sourceLabel, document.createTextNode(" "));
      sourceLine.appendChild(externalLink(restaurant.sourceUrl, restaurant.sourceUrl));
      article.appendChild(sourceLine);
    }

    return article;
  }

  function createOpeningRow(restaurant) {
    const a = document.createElement("a");
    a.className = "home-info-row home-opening-row";
    a.href = mapUrl(restaurant.name + " " + restaurant.address);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = restaurant.name + "｜" + restaurant.address;

    const date = document.createElement("time");
    date.className = "home-info-date";
    date.dateTime = restaurant.openingDate;
    date.textContent = fmtDate(restaurant.openingDate);

    const title = document.createElement("span");
    title.className = "home-info-title";
    title.textContent = restaurant.name + "｜" + restaurant.address;

    a.append(date, title);
    return a;
  }

  async function loadDbStats() {
    try {
      if (apiBase) {
        const res = await fetch(
          apiBase + "/api/stats?municipality_code=112224&type=restaurant&group=category",
          {cache: "no-store"}
        );
        if (!res.ok) throw new Error("stats api");
        const data = await res.json();

        const totalText = Number(data.total || 0).toLocaleString("ja-JP");
        if (count) count.textContent = totalText + "店舗DB収録";
        document.querySelectorAll("[data-total-restaurant-count]").forEach((node) => {
          node.textContent = totalText;
        });
        document.querySelectorAll("[data-category-count]").forEach((node) => {
          const tag = node.dataset.categoryCount;
          node.textContent = Number((data.counts || {})[tag] || 0).toLocaleString("ja-JP");
        });
        const uncategorized = Number(data.uncategorized || 0);
        document.querySelectorAll("[data-uncategorized-count]").forEach((node) => {
          node.textContent = uncategorized.toLocaleString("ja-JP");
        });
        document.querySelectorAll(".restaurant-uncategorized-row").forEach((row) => {
          row.hidden = uncategorized === 0;
        });
        return true;
      }

      const res = await fetch(publicDataUrl, {cache: "no-store"});
      if (!res.ok) throw new Error("public json stats");
      const data = await res.json();
      const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
      const totalText = restaurants.length.toLocaleString("ja-JP");

      if (count) count.textContent = totalText + "店舗DB収録";
      document.querySelectorAll("[data-total-restaurant-count]").forEach((node) => {
        node.textContent = totalText;
      });
      document.querySelectorAll("[data-category-count]").forEach((node) => {
        const tag = node.dataset.categoryCount;
        const n = restaurants.filter((r) => (r.tags || []).includes(tag)).length;
        node.textContent = n.toLocaleString("ja-JP");
      });
      const uncategorized = restaurants.filter((r) => !(r.tags || []).length).length;
      document.querySelectorAll("[data-uncategorized-count]").forEach((node) => {
        node.textContent = uncategorized.toLocaleString("ja-JP");
      });
      document.querySelectorAll(".restaurant-uncategorized-row").forEach((row) => {
        row.hidden = uncategorized === 0;
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function loadCategoryFromDb(tag) {
    if (!apiBase || !list || !tag) return false;
    let offset = 0;
    const limit = 100;
    let moreButton = null;

    async function loadNext() {
      const params = new URLSearchParams({
        municipality_code: "112224",
        type: "restaurant",
        category: tag,
        sort: "name_asc",
        limit: String(limit),
        offset: String(offset),
      });
      const res = await fetch(apiBase + "/api/facilities?" + params.toString(), {cache: "no-store"});
      if (!res.ok) throw new Error("category api");
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      items.forEach((restaurant) => list.appendChild(createRestaurantCard(restaurant)));
      offset += items.length;

      if (moreButton) moreButton.remove();
      moreButton = null;
      if (data.hasMore) {
        moreButton = document.createElement("button");
        moreButton.type = "button";
        moreButton.textContent = "さらに100件表示";
        moreButton.addEventListener("click", loadNext);
        const wrap = document.createElement("div");
        wrap.className = "buttons restaurant-category-more";
        wrap.appendChild(moreButton);
        list.after(wrap);
        moreButton.addEventListener("click", () => wrap.remove(), {once:true});
      }
    }

    list.innerHTML = "";
    await loadNext();
    if (!list.children.length) {
      list.innerHTML = '<p class="notice">現在、この分類に該当する店舗はありません。</p>';
    }
    return true;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("restaurant data request failed");
    const data = await response.json();
    const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];

    const dbStatsLoaded = await loadDbStats();
    if (count && !dbStatsLoaded) count.textContent = restaurants.length + "店舗掲載";
    if (!dbStatsLoaded) {
      document.querySelectorAll("[data-total-restaurant-count]").forEach((node) => {
        node.textContent = String(restaurants.length);
      });
      document.querySelectorAll("[data-category-count]").forEach((node) => {
        const tag = node.dataset.categoryCount;
        node.textContent = String(restaurants.filter((r) => (r.tags || []).includes(tag)).length);
      });
      const uncategorized = restaurants.filter((r) => !(r.tags || []).length).length;
      document.querySelectorAll("[data-uncategorized-count]").forEach((node) => {
        node.textContent = String(uncategorized);
      });
      document.querySelectorAll(".restaurant-uncategorized-row").forEach((row) => {
        row.hidden = uncategorized === 0;
      });
    }

    if (openings) {
      const recent = restaurants
        .filter((restaurant) => restaurant.openingDate)
        .sort((a, b) => b.openingDate.localeCompare(a.openingDate))
        .slice(0, 5);

      openings.innerHTML = "";
      recent.forEach((restaurant) => openings.appendChild(createOpeningRow(restaurant)));
      if (!recent.length) {
        openings.innerHTML = '<p class="notice">現在、新規OPEN情報を追加準備中です。</p>';
      }
    }

    if (list) {
      const tag = list.dataset.category;
      if (await loadCategoryFromDb(tag)) return;

      const matched = restaurants
        .filter((restaurant) => (restaurant.tags || []).includes(tag))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));

      list.innerHTML = "";
      if (!matched.length) {
        list.innerHTML = '<p class="notice">現在、掲載店舗を追加準備中です。</p>';
      } else {
        matched.forEach((restaurant) => list.appendChild(createRestaurantCard(restaurant)));
      }
    }
  } catch (error) {
    console.warn("Restaurant data error:", error);
    if (openings) openings.innerHTML = '<p class="notice">新規OPEN情報を取得できませんでした。</p>';
    if (list) list.innerHTML = '<p class="notice">店舗情報を取得できませんでした。</p>';
  }
});