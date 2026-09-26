document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("restaurantList");
  const openings = document.getElementById("newOpenings");
  const count = document.getElementById("restaurantCount");
  const holder = list || openings;
  if (!holder) return;

  const url =
    (list && list.dataset.dataUrl) ||
    (openings && openings.dataset.dataUrl);
  if (!url) return;

  const mapUrl = (value) =>
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(value);

  const fmtDate = (value) => {
    if (!value) return "";
    const parts = value.split("-");
    return Number(parts[1]) + "/" + Number(parts[2]);
  };

  function createRestaurantCard(restaurant) {
    const article = document.createElement("article");
    article.className = "restaurant-card";

    const heading = document.createElement("h2");
    heading.textContent = restaurant.name;

    const address = document.createElement("p");
    address.className = "restaurant-address";
    const addressLink = document.createElement("a");
    addressLink.href = mapUrl(restaurant.address);
    addressLink.target = "_blank";
    addressLink.rel = "noopener noreferrer";
    addressLink.textContent = restaurant.address;
    address.appendChild(addressLink);

    const meta = document.createElement("div");
    meta.className = "restaurant-meta";

    if (restaurant.openingDate) {
      const opening = document.createElement("span");
      opening.textContent = "OPEN " + fmtDate(restaurant.openingDate);
      meta.appendChild(opening);
    }

    if (restaurant.checkedAt) {
      const checked = document.createElement("span");
      checked.textContent = "確認 " + restaurant.checkedAt.replace(/-/g, "/");
      meta.appendChild(checked);
    }

    const links = document.createElement("div");
    links.className = "restaurant-links";

    const maps = document.createElement("a");
    maps.href = mapUrl(restaurant.name + " " + restaurant.address);
    maps.target = "_blank";
    maps.rel = "noopener noreferrer";
    maps.textContent = "Google Maps";
    links.appendChild(maps);

    if (restaurant.sourceUrl) {
      const source = document.createElement("a");
      source.href = restaurant.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = restaurant.sourceLabel || "情報元";
      links.appendChild(source);
    }

    article.append(heading, address, meta, links);
    return article;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("restaurant data request failed");

    const data = await response.json();
    const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];

    if (count) {
      count.textContent = restaurants.length + "店舗掲載";
    }

    if (openings) {
      const recent = restaurants
        .filter((restaurant) => restaurant.openingDate)
        .sort((a, b) => b.openingDate.localeCompare(a.openingDate))
        .slice(0, 5);

      openings.innerHTML = "";

      recent.forEach((restaurant) => {
        const row = document.createElement("article");
        row.className = "new-opening-row";

        const date = document.createElement("time");
        date.dateTime = restaurant.openingDate;
        date.textContent = restaurant.openingDate.replace(/-/g, "/");

        const body = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = restaurant.name;
        const address = document.createElement("span");
        address.textContent = restaurant.address;

        body.append(name, address);
        row.append(date, body);
        openings.appendChild(row);
      });
    }

    if (list) {
      const tag = list.dataset.category;
      const matched = restaurants
        .filter((restaurant) => (restaurant.tags || []).includes(tag))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));

      list.innerHTML = "";

      if (!matched.length) {
        list.innerHTML =
          '<p class="notice">現在、掲載店舗を追加準備中です。</p>';
      } else {
        matched.forEach((restaurant) => {
          list.appendChild(createRestaurantCard(restaurant));
        });
      }
    }
  } catch (error) {
    console.warn("Restaurant data error:", error);

    if (openings) {
      openings.innerHTML =
        '<p class="notice">新規OPEN情報を取得できませんでした。</p>';
    }
    if (list) {
      list.innerHTML =
        '<p class="notice">店舗情報を取得できませんでした。</p>';
    }
  }
});