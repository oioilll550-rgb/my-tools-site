document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("restaurantList");
  const openings = document.getElementById("newOpenings");
  const count = document.getElementById("restaurantCount");
  const holder = list || openings || document.querySelector("[data-category-count]");
  if (!holder) return;

  const url =
    (list && list.dataset.dataUrl) ||
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
      externalLink(mapUrl(restaurant.address), restaurant.address, "map-address-link")
    );

    if (restaurant.openingDate) {
      addDlRow(dl, "開店日", fmtDate(restaurant.openingDate));
    }
    if (restaurant.checkedAt) {
      addDlRow(dl, "情報確認", fmtDate(restaurant.checkedAt));
    }

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
      sourceLine.appendChild(
        externalLink(restaurant.sourceUrl, restaurant.sourceUrl)
      );
      article.appendChild(sourceLine);
    }

    return article;
  }

  function createOpeningCard(restaurant) {
    const article = document.createElement("article");
    article.className = "facility-card";

    const heading = document.createElement("h2");
    heading.textContent = restaurant.name;

    const dl = document.createElement("dl");
    addDlRow(dl, "開店日", fmtDate(restaurant.openingDate));
    addDlRow(
      dl,
      "住所",
      externalLink(mapUrl(restaurant.address), restaurant.address, "map-address-link")
    );

    article.append(heading, dl);
    return article;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("restaurant data request failed");

    const data = await response.json();
    const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];

    if (count) count.textContent = restaurants.length + "店舗掲載";

    document.querySelectorAll("[data-category-count]").forEach((node) => {
      const tag = node.dataset.categoryCount;
      const value = restaurants.filter((r) => (r.tags || []).includes(tag)).length;
      node.textContent = String(value);
    });

    if (openings) {
      const recent = restaurants
        .filter((restaurant) => restaurant.openingDate)
        .sort((a, b) => b.openingDate.localeCompare(a.openingDate))
        .slice(0, 5);

      openings.innerHTML = "";
      recent.forEach((restaurant) => openings.appendChild(createOpeningCard(restaurant)));

      if (!recent.length) {
        openings.innerHTML = '<p class="notice">現在、新規OPEN情報を追加準備中です。</p>';
      }
    }

    if (list) {
      const tag = list.dataset.category;
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