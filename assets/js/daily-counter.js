document.addEventListener("DOMContentLoaded", async () => {
  const totalEl = document.getElementById("visitorTotal");
  const todayEl = document.getElementById("visitorToday");
  if (!totalEl || !todayEl) return;

  const COUNTER_URL =
    "https://hits.sh/oioilll550-rgb.github.io/my-tools-site.svg?view=today-total&label=&color=6b7280&labelColor=f3f4f6";

  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  const storageKey = "benri-counted-day";
  const cachedKey = "benri-counter-cache";

  function showCached() {
    try {
      const cached = JSON.parse(localStorage.getItem(cachedKey) || "null");
      if (cached && Number.isFinite(cached.today) && Number.isFinite(cached.total)) {
        todayEl.textContent = cached.today.toLocaleString("ja-JP");
        totalEl.textContent = cached.total.toLocaleString("ja-JP");
        return true;
      }
    } catch (_) {}
    return false;
  }

  function parseSvg(svgText) {
    const nums = [...svgText.matchAll(/<text[^>]*>([0-9,]+)<\/text>/g)]
      .map(m => Number(m[1].replace(/,/g, "")))
      .filter(Number.isFinite);

    const unique = [];
    for (const n of nums) {
      if (unique.length === 0 || unique[unique.length - 1] !== n) unique.push(n);
    }

    if (unique.length < 2) return null;
    return { today: unique[0], total: unique[1] };
  }

  const alreadyCountedToday = localStorage.getItem(storageKey) === todayKey;

  if (alreadyCountedToday) {
    showCached();
    return;
  }

  try {
    const response = await fetch(COUNTER_URL, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit"
    });
    if (!response.ok) throw new Error("counter request failed");

    const svg = await response.text();
    const values = parseSvg(svg);
    if (!values) throw new Error("counter parse failed");

    localStorage.setItem(storageKey, todayKey);
    localStorage.setItem(cachedKey, JSON.stringify(values));

    todayEl.textContent = values.today.toLocaleString("ja-JP");
    totalEl.textContent = values.total.toLocaleString("ja-JP");
  } catch (_) {
    if (!showCached()) {
      todayEl.textContent = "-";
      totalEl.textContent = "-";
    }
  }
});
