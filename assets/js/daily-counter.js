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

  async function request(path) {
    const res = await fetch(API + path, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error("counter api failed: " + res.status);

    const data = await res.json();
    const value = Number(data.value);
    return Number.isFinite(value) ? value : 0;
  }

  async function hit(key) {
    return request("/hit/" + encodeURIComponent(NS) + "/" + encodeURIComponent(key));
  }

  async function get(key) {
    return request("/get/" + encodeURIComponent(NS) + "/" + encodeURIComponent(key));
  }

  try {
    const alreadyCounted = localStorage.getItem(countedKey) === "1";
    let total;
    let todayValue;

    if (!alreadyCounted) {
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

      // Recover automatically if the external counter lost/expired a key.
      if (total === null) total = await hit(totalKey);
      if (todayValue === null) todayValue = await hit(todayCounterKey);
    }

    const yesterdayValue = (await get(yesterdayCounterKey)) ?? 0;

    totalEl.textContent = Number(total || 0).toLocaleString("ja-JP");
    todayEl.textContent = Number(todayValue || 0).toLocaleString("ja-JP");
    yesterdayEl.textContent = Number(yesterdayValue || 0).toLocaleString("ja-JP");
  } catch (error) {
    console.warn("Access counter error:", error);
    totalEl.textContent = "-";
    todayEl.textContent = "-";
    yesterdayEl.textContent = "-";
  }
});