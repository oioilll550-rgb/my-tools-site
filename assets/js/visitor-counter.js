document.addEventListener("DOMContentLoaded", async () => {
  const box = document.getElementById("visitorCounter");
  const totalEl = document.getElementById("visitorTotal");
  const todayEl = document.getElementById("visitorToday");
  if (!box || !totalEl || !todayEl) return;

  const apiBase = (window.BENRI_CONFIG?.counterApiUrl || "").replace(/\/$/, "");
  if (!apiBase) {
    box.hidden = true;
    return;
  }

  async function fetchCount() {
    const res = await fetch(apiBase + "/count", {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });
    if (!res.ok) throw new Error("count failed");
    return res.json();
  }

  try {
    const sessionKey = "benri-visitor-counted-v1";
    if (!sessionStorage.getItem(sessionKey)) {
      const res = await fetch(apiBase + "/hit", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store"
      });
      if (res.ok) sessionStorage.setItem(sessionKey, "1");
    }

    const data = await fetchCount();
    totalEl.textContent = Number(data.total || 0).toLocaleString("ja-JP");
    todayEl.textContent = Number(data.today || 0).toLocaleString("ja-JP");
    box.hidden = false;
  } catch (error) {
    box.hidden = true;
  }
});
