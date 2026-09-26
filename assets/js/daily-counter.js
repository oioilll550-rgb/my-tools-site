document.addEventListener("DOMContentLoaded", async () => {
  const totalEl = document.getElementById("visitorTotal");
  const todayEl = document.getElementById("visitorToday");
  const onlineEl = document.getElementById("onlineViewers");
  if (!totalEl || !todayEl || !onlineEl) return;

  const API = "https://abacus.jasoncameron.dev";
  const NS = "benri-chan-biryoku-8f6c2e";
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const today = dateFmt.format(new Date());
  const countedKey = "benri-counted-v3-" + today;
  const totalKey = "total";
  const todayCounterKey = "day-" + today;

  async function api(path) {
    const res = await fetch(API + path, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });
    if (!res.ok) throw new Error("counter api failed");
    const data = await res.json();
    return Number(data.value || 0);
  }

  async function hit(key) {
    return api("/hit/" + encodeURIComponent(NS) + "/" + encodeURIComponent(key));
  }

  async function get(key) {
    try {
      return await api("/get/" + encodeURIComponent(NS) + "/" + encodeURIComponent(key));
    } catch (_) {
      return 0;
    }
  }

  async function updateDailyAndTotal() {
    try {
      let total;
      let todayValue;

      if (!localStorage.getItem(countedKey)) {
        [total, todayValue] = await Promise.all([
          hit(totalKey),
          hit(todayCounterKey)
        ]);
        localStorage.setItem(countedKey, "1");
      } else {
        [total, todayValue] = await Promise.all([
          get(totalKey),
          get(todayCounterKey)
        ]);
      }

      totalEl.textContent = total.toLocaleString("ja-JP");
      todayEl.textContent = todayValue.toLocaleString("ja-JP");
    } catch (_) {
      totalEl.textContent = "-";
      todayEl.textContent = "-";
    }
  }

  function minuteKey() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(now);
    const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return "online-" + obj.year + obj.month + obj.day + "-" + obj.hour + obj.minute;
  }

  async function updateOnline() {
    const key = minuteKey();
    const localKey = "benri-online-minute";
    try {
      let value;
      if (localStorage.getItem(localKey) !== key) {
        value = await hit(key);
        localStorage.setItem(localKey, key);
      } else {
        value = await get(key);
      }
      onlineEl.textContent = value.toLocaleString("ja-JP");
    } catch (_) {
      onlineEl.textContent = "-";
    }
  }

  await Promise.all([updateDailyAndTotal(), updateOnline()]);
  setInterval(updateOnline, 30000);
});