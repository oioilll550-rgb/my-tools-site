document.addEventListener("DOMContentLoaded", async () => {
  const openingsRoot = document.getElementById("homeNewOpenings");
  const popularRoot = document.getElementById("homePopularPages");

  function externalMapUrl(name, address) {
    return "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(name + " " + address);
  }

  if (openingsRoot) {
    try {
      const res = await fetch(openingsRoot.dataset.dataUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("restaurant data");
      const data = await res.json();
      const items = (Array.isArray(data.restaurants) ? data.restaurants : [])
        .filter((r) => r.openingDate)
        .sort((a, b) => b.openingDate.localeCompare(a.openingDate))
        .slice(0, 5);

      openingsRoot.innerHTML = "";
      items.forEach((r) => {
        const a = document.createElement("a");
        a.className = "home-info-row";
        a.href = externalMapUrl(r.name, r.address);
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        const date = document.createElement("time");
        date.dateTime = r.openingDate;
        date.textContent = r.openingDate.replace(/-/g, "/");

        const body = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = r.name;
        const address = document.createElement("small");
        address.textContent = r.address;
        body.append(name, address);

        a.append(date, body);
        openingsRoot.appendChild(a);
      });

      if (!items.length) {
        openingsRoot.innerHTML = '<p class="notice">新規OPEN情報を追加準備中です。</p>';
      }
    } catch (_) {
      openingsRoot.innerHTML = '<p class="notice">新規OPEN情報を取得できませんでした。</p>';
    }
  }

  if (popularRoot) {
    const API = "https://abacus.jasoncameron.dev";
    const NS = "benri-chan-biryoku-8f6c2e";
    const candidates = [
      { name: "越谷市の飲食店", path: "/restaurants/saitama/koshigaya/", url: "restaurants/saitama/koshigaya/" },
      { name: "越谷市の公共施設", path: "/public/saitama/koshigaya/", url: "public/saitama/koshigaya/" },
      { name: "文字数カウンター", path: "/tools/character-counter.html", url: "tools/character-counter.html" },
      { name: "割引・税込かんたん計算", path: "/tools/discount-tax-app.html", url: "tools/discount-tax-app.html" },
      { name: "家電の電気代かんたん計算", path: "/tools/electricity-cost-app.html", url: "tools/electricity-cost-app.html" },
      { name: "坪・平米かんたん換算", path: "/tools/tsubo-heibei-app.html", url: "tools/tsubo-heibei-app.html" },
      { name: "全角・半角変換", path: "/tools/zenkaku-hankaku.html", url: "tools/zenkaku-hankaku.html" },
      { name: "JSON整形", path: "/tools/json-formatter.html", url: "tools/json-formatter.html" },
      { name: "パスワード生成", path: "/tools/password-generator.html", url: "tools/password-generator.html" },
      { name: "越谷市の公園・植物園", path: "/public/saitama/koshigaya/parks.html", url: "public/saitama/koshigaya/parks.html" },
      { name: "越谷市の図書館・図書室", path: "/public/saitama/koshigaya/libraries.html", url: "public/saitama/koshigaya/libraries.html" },
      { name: "越谷市の飲食店営業許可ベース一覧", path: "/restaurants/saitama/koshigaya/all.html", url: "restaurants/saitama/koshigaya/all.html" }
    ];

    const dateFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const today = dateFmt.format(new Date());

    function pageCounterId(path) {
      let hash = 2166136261;
      for (let i = 0; i < path.length; i++) {
        hash ^= path.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const hashText = (hash >>> 0).toString(16).padStart(8, "0");
      let readable = path;
      while (readable.startsWith("/")) readable = readable.slice(1);
      while (readable.endsWith("/")) readable = readable.slice(0, -1);
      readable = readable
        .replace(/[^A-Za-z0-9_.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(-28) || "home";
      return "p-" + hashText + "-" + readable;
    }

    async function getCount(item) {
      const pageId = pageCounterId(item.path);
      const key = "page-" + pageId + "-day-" + today;
      try {
        const res = await fetch(
          API + "/get/" + encodeURIComponent(NS) + "/" + encodeURIComponent(key),
          { cache: "no-store", credentials: "omit", mode: "cors" }
        );
        if (!res.ok) return { ...item, count: 0 };
        const data = await res.json();
        return { ...item, count: Number(data.value || 0) };
      } catch (_) {
        return { ...item, count: 0 };
      }
    }

    try {
      const ranked = (await Promise.all(candidates.map(getCount)))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
        .slice(0, 5);

      popularRoot.innerHTML = "";
      ranked.forEach((item, index) => {
        const a = document.createElement("a");
        a.className = "home-info-row home-popular-row";
        a.href = item.url;

        const rank = document.createElement("span");
        rank.className = "home-popular-rank";
        rank.textContent = String(index + 1);

        const name = document.createElement("strong");
        name.textContent = item.name;

        const count = document.createElement("span");
        count.className = "home-info-meta";
        count.textContent = item.count.toLocaleString("ja-JP") + "閲覧";

        a.append(rank, name, count);
        popularRoot.appendChild(a);
      });
    } catch (_) {
      popularRoot.innerHTML = '<p class="notice">閲覧状況を取得できませんでした。</p>';
    }
  }
});