document.addEventListener("DOMContentLoaded", async () => {
  const totalEl = document.getElementById("visitorTotal");
  const todayEl = document.getElementById("visitorToday");
  const onlineEl = document.getElementById("onlineViewers");
  if (!totalEl || !todayEl) return;

  const apiBase = (window.BENRI_CONFIG?.counterApiUrl || "").replace(/\/$/, "");
  const FALLBACK_COUNTER_URL =
    "https://hits.sh/oioilll550-rgb.github.io/my-tools-site.svg?view=today-total&label=&color=6b7280&labelColor=f3f4f6";

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  function getOrCreateId(key) {
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID ? crypto.randomUUID() :
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, value);
    }
    return value;
  }

  function getSessionId() {
    const key = "benri-presence-session";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID ? crypto.randomUUID() :
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, value);
    }
    return value;
  }

  async function useOwnCounter() {
    const visitorId = getOrCreateId("benri-visitor-id");
    const countedKey = "benri-counted-day";
    const sessionId = getSessionId();

    if (localStorage.getItem(countedKey) !== todayKey) {
      const hit = await fetch(apiBase + "/hit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitorId }),
        mode: "cors",
        credentials: "omit",
        cache: "no-store"
      });
      if (hit.ok) localStorage.setItem(countedKey, todayKey);
    }

    async function heartbeat() {
      try {
        await fetch(apiBase + "/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
          mode: "cors",
          credentials: "omit",
          cache: "no-store"
        });

        const res = await fetch(apiBase + "/count", {
          mode: "cors",
          credentials: "omit",
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = await res.json();
        todayEl.textContent = Number(data.today || 0).toLocaleString("ja-JP");
        totalEl.textContent = Number(data.total || 0).toLocaleString("ja-JP");
        if (onlineEl) onlineEl.textContent = Number(data.online || 0).toLocaleString("ja-JP");
      } catch (_) {}
    }

    await heartbeat();
    setInterval(heartbeat, 60000);
  }

  function showCached() {
    try {
      const cached = JSON.parse(localStorage.getItem("benri-counter-cache") || "null");
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

  async function useFallbackCounter() {
    if (onlineEl) onlineEl.textContent = "—";
    const storageKey = "benri-counted-day";
    const alreadyCountedToday = localStorage.getItem(storageKey) === todayKey;

    if (alreadyCountedToday) {
      showCached();
      return;
    }

    try {
      const response = await fetch(FALLBACK_COUNTER_URL, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok) throw new Error("counter request failed");
      const values = parseSvg(await response.text());
      if (!values) throw new Error("counter parse failed");

      localStorage.setItem(storageKey, todayKey);
      localStorage.setItem("benri-counter-cache", JSON.stringify(values));
      todayEl.textContent = values.today.toLocaleString("ja-JP");
      totalEl.textContent = values.total.toLocaleString("ja-JP");
    } catch (_) {
      if (!showCached()) {
        todayEl.textContent = "-";
        totalEl.textContent = "-";
      }
    }
  }

  if (apiBase) {
    await useOwnCounter();
  } else {
    await useFallbackCounter();
  }
});
