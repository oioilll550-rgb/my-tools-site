const json = (data, status = 200, origin = "*") =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
      "vary": "Origin"
    }
  });

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  if (allowed.length === 0) return "*";
  return allowed.includes(origin) ? origin : "";
}

function tokyoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (!origin) return json({ error: "origin_not_allowed" }, 403, "null");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
          "vary": "Origin"
        }
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === "/hit" && request.method === "POST") {
      const day = tokyoDate();

      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO counters (name, value) VALUES ('total', 1) " +
          "ON CONFLICT(name) DO UPDATE SET value = value + 1"
        ),
        env.DB.prepare(
          "INSERT INTO daily_counts (day, value) VALUES (?, 1) " +
          "ON CONFLICT(day) DO UPDATE SET value = value + 1"
        ).bind(day)
      ]);

      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === "/count" && request.method === "GET") {
      const day = tokyoDate();
      const [totalRow, todayRow] = await Promise.all([
        env.DB.prepare("SELECT value FROM counters WHERE name = 'total'").first(),
        env.DB.prepare("SELECT value FROM daily_counts WHERE day = ?").bind(day).first()
      ]);

      return json({
        total: totalRow?.value || 0,
        today: todayRow?.value || 0,
        day
      }, 200, origin);
    }

    return json({ error: "not_found" }, 404, origin);
  }
};
