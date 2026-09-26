document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("officialRestaurantList");
  const input = document.getElementById("officialRestaurantSearch");
  const countEl = document.getElementById("officialRestaurantCount");
  const statusEl = document.getElementById("officialRestaurantStatus");
  const more = document.getElementById("officialRestaurantMore");
  if (!root || !input || !more) return;

  const dataUrl = root.dataset.dataUrl;
  let all = [];
  let filtered = [];
  let shown = 0;
  const PAGE = 50;

  const norm = (v) => String(v || "").toLowerCase().replace(/[\s　・･,，.。]/g, "");
  const mapUrl = (r) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(r.name + " " + r.address);

  function card(r) {
    const a = document.createElement("article");
    a.className = "facility-card restaurant-facility-card";

    const h = document.createElement("h2");
    h.textContent = r.name;

    const dl = document.createElement("dl");
    const dt1 = document.createElement("dt");
    dt1.textContent = "住所";
    const dd1 = document.createElement("dd");
    const map = document.createElement("a");
    map.className = "map-address-link";
    map.href = mapUrl(r);
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    map.textContent = r.address;
    dd1.appendChild(map);
    dl.append(dt1, dd1);

    if (r.permitDate) {
      const dt2 = document.createElement("dt");
      dt2.textContent = "許可・届出日";
      const dd2 = document.createElement("dd");
      dd2.textContent = r.permitDate.replace(/-/g, "/");
      dl.append(dt2, dd2);
    }

    const p = document.createElement("p");
    p.className = "facility-url";
    const lab = document.createElement("span");
    lab.textContent = "地図";
    const gm = document.createElement("a");
    gm.href = mapUrl(r);
    gm.target = "_blank";
    gm.rel = "noopener noreferrer";
    gm.textContent = "Google Maps";
    p.append(lab, document.createTextNode(" "), gm);

    a.append(h, dl, p);
    return a;
  }

  function render(reset = false) {
    if (reset) {
      root.innerHTML = "";
      shown = 0;
    }
    const next = filtered.slice(shown, shown + PAGE);
    next.forEach((r) => root.appendChild(card(r)));
    shown += next.length;
    more.hidden = shown >= filtered.length;
    if (statusEl) statusEl.textContent = filtered.length.toLocaleString("ja-JP") + "件";
  }

  function search() {
    const q = norm(input.value);
    filtered = !q ? all : all.filter((r) => norm(r.name + r.address).includes(q));
    render(true);
  }

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("request failed");
    const data = await res.json();
    all = Array.isArray(data.restaurants) ? data.restaurants : [];
    filtered = all;
    if (countEl) countEl.textContent = (data.count || all.length).toLocaleString("ja-JP") + "件";
    if (statusEl) statusEl.textContent = all.length.toLocaleString("ja-JP") + "件";
    root.innerHTML = "";
    render(false);
  } catch (e) {
    root.innerHTML = '<p class="notice">行政公開データを取得できませんでした。更新処理の完了後に再度ご確認ください。</p>';
    more.hidden = true;
  }

  input.addEventListener("input", search);
  more.addEventListener("click", () => render(false));
});