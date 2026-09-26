document.addEventListener("DOMContentLoaded", async () => {
  const totalEl = document.getElementById("visitorTotal");
  const todayEl = document.getElementById("visitorToday");
  const yesterdayEl = document.getElementById("visitorYesterday");
  if (!totalEl || !todayEl || !yesterdayEl) return;

  const API = "https://abacus.jasoncameron.dev";
  const NS = "benri-chan-biryoku-8f6c2e";
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const today = dateFmt.format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(y, m - 1, d) - 86400000);
  const yesterday =
    yesterdayDate.getUTCFullYear() + "-" +
    String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(yesterdayDate.getUTCDate()).padStart(2, "0");

  const countedKey = "benri-counted-v3-" + today;
  const totalKey = "total";
  const todayCounterKey = "day-" + today;
  const yesterdayCounterKey = "day-" + yesterday;

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

    const yesterdayValue = await get(yesterdayCounterKey);

    totalEl.textContent = total.toLocaleString("ja-JP");
    todayEl.textContent = todayValue.toLocaleString("ja-JP");
    yesterdayEl.textContent = yesterdayValue.toLocaleString("ja-JP");
  } catch (_) {
    totalEl.textContent = "-";
    todayEl.textContent = "-";
    yesterdayEl.textContent = "-";
  }
});