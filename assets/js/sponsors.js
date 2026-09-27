document.addEventListener("DOMContentLoaded", async () => {
  const holder = document.getElementById("restaurantSponsorList");
  if (!holder) return;

  const dataUrl = holder.dataset.dataUrl;
  const advertiseUrl = holder.dataset.advertiseUrl || "../../../advertise.html";

  function recruit() {
    holder.innerHTML = "";
    const box = document.createElement("div");
    box.className = "restaurant-sponsor-recruit";

    const copy = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = "PR掲載枠を募集中";
    const small = document.createElement("small");
    small.textContent = "先着3店舗・30日1,000円でテスト受付しています。";
    copy.append(strong, small);

    const link = document.createElement("a");
    link.className = "button";
    link.href = advertiseUrl;
    link.textContent = "掲載内容を見る";

    box.append(copy, link);
    holder.appendChild(box);
  }

  try {
    const res = await fetch(dataUrl, {cache: "no-store"});
    if (!res.ok) throw new Error("sponsor data");
    const data = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const sponsors = (Array.isArray(data.sponsors) ? data.sponsors : [])
      .filter((s) => (!s.startDate || s.startDate <= today) && (!s.endDate || s.endDate >= today))
      .slice(0, 3);

    if (!sponsors.length) {
      recruit();
      return;
    }

    holder.innerHTML = "";
    sponsors.forEach((sponsor) => {
      const card = document.createElement("article");
      card.className = "restaurant-sponsor-card";

      const pr = document.createElement("span");
      pr.className = "pr-label";
      pr.textContent = "PR";

      const name = document.createElement("strong");
      name.textContent = sponsor.name || "";

      const description = document.createElement("p");
      description.textContent = sponsor.description || "";

      card.append(pr, name, description);

      if (sponsor.address) {
        const address = document.createElement("small");
        address.textContent = sponsor.address;
        card.appendChild(address);
      }

      if (sponsor.url) {
        const link = document.createElement("a");
        link.href = sponsor.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer sponsored";
        link.textContent = sponsor.linkLabel || "公式情報を見る";
        card.appendChild(link);
      }

      holder.appendChild(card);
    });
  } catch (_) {
    recruit();
  }
});
