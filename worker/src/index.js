const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "").trim();
  const allowOrigin = !allowed || origin === allowed ? (origin || allowed || "*") : allowed;
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function json(data, status, request, env, cacheSeconds = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request, env),
      ...(cacheSeconds ? {"cache-control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`} : {}),
    },
  });
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (m) => "\\" + m);
}

function ftsQuery(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => '"' + term.replace(/"/g, '""') + '"')
    .join(" AND ");
}

function confidenceOrderSql() {
  return "CASE f.confidence WHEN 'official' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END";
}

async function listFacilities(request, env, url) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const municipality = (url.searchParams.get("municipality_code") || "").trim().slice(0, 12);
  const type = (url.searchParams.get("type") || "").trim().slice(0, 40);
  let category = (url.searchParams.get("category") || "").trim().slice(0, 80);
  const confidence = (url.searchParams.get("confidence") || "").trim().slice(0, 20);
  const status = (url.searchParams.get("status") || "").trim().slice(0, 24);
  const sort = (url.searchParams.get("sort") || "permit_date_desc").trim();
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10000000);

  if (category && !category.includes(".")) {
    category = (type || "restaurant") + "." + category;
  }

  const where = [];
  const params = [];
  let join = "";

  const compactQ = q.replace(/\s/g, "");
  if (q && compactQ.length >= 3) {
    join = " JOIN facilities_fts ON facilities_fts.facility_id = f.id ";
    where.push("facilities_fts MATCH ?");
    params.push(ftsQuery(q));
  } else if (q) {
    const like = "%" + escapeLike(q) + "%";
    where.push("(f.name LIKE ? ESCAPE '\\' OR f.address LIKE ? ESCAPE '\\' OR f.search_text LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }

  if (municipality) {
    where.push("f.municipality_code = ?");
    params.push(municipality);
  }
  if (type) {
    where.push("f.facility_type = ?");
    params.push(type);
  }
  if (confidence) {
    where.push("f.confidence = ?");
    params.push(confidence);
  }
  if (status) {
    where.push("f.status = ?");
    params.push(status);
  }
  if (category) {
    where.push("EXISTS (SELECT 1 FROM facility_categories fc WHERE fc.facility_id = f.id AND fc.category_id = ?)");
    params.push(category);
  }

  const sortSql = {
    permit_date_desc: "p.permit_date IS NULL, p.permit_date DESC, f.name ASC",
    permit_date_asc: "p.permit_date IS NULL, p.permit_date ASC, f.name ASC",
    name_asc: "f.name ASC, p.permit_date DESC",
    name_desc: "f.name DESC, p.permit_date DESC",
  }[sort] || "p.permit_date IS NULL, p.permit_date DESC, f.name ASC";

  const sql = `
    SELECT
      f.id, f.name, f.facility_type AS facilityType,
      f.prefecture_code AS prefectureCode,
      f.municipality_code AS municipalityCode,
      f.address, f.latitude, f.longitude, f.status,
      f.opening_date AS openingDate,
      f.closing_date AS closingDate,
      p.permit_date AS permitDate,
      f.official_url AS officialUrl,
      f.confidence,
      f.last_verified_at AS lastVerifiedAt
    FROM facilities f
    ${join}
    LEFT JOIN (
      SELECT facility_id, MAX(permit_date) AS permit_date
      FROM facility_sources
      WHERE permit_date IS NOT NULL AND permit_date <> ''
      GROUP BY facility_id
    ) p ON p.facility_id = f.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${sortSql}
    LIMIT ? OFFSET ?
  `;

  params.push(limit + 1, offset);
  const result = await env.DB.prepare(sql).bind(...params).all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return json({
    items: rows,
    returned: rows.length,
    offset,
    nextOffset: hasMore ? offset + rows.length : null,
    hasMore,
  }, 200, request, env, 300);
}

async function facilityDetail(request, env, id) {
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(id)) {
    return json({error: "invalid facility id"}, 400, request, env);
  }

  const [facility, categories, sources] = await env.DB.batch([
    env.DB.prepare(`
      SELECT id, name, name_kana AS nameKana, facility_type AS facilityType,
        prefecture_code AS prefectureCode, municipality_code AS municipalityCode,
        postal_code AS postalCode, address, latitude, longitude, status,
        opening_date AS openingDate, closing_date AS closingDate,
        (SELECT MAX(fs.permit_date) FROM facility_sources fs WHERE fs.facility_id = facilities.id) AS permitDate,
        official_url AS officialUrl, confidence, last_verified_at AS lastVerifiedAt,
        created_at AS createdAt, updated_at AS updatedAt
      FROM facilities WHERE id = ?
    `).bind(id),
    env.DB.prepare(`
      SELECT c.id, c.name, c.slug
      FROM facility_categories fc
      JOIN categories c ON c.id = fc.category_id
      WHERE fc.facility_id = ?
      ORDER BY c.sort_order, c.name
    `).bind(id),
    env.DB.prepare(`
      SELECT s.id, s.provider, s.title, s.source_type AS sourceType,
        COALESCE(fs.source_url, s.url) AS url,
        s.trust_level AS trustLevel,
        fs.observed_at AS observedAt
      FROM facility_sources fs
      JOIN sources s ON s.id = fs.source_id
      WHERE fs.facility_id = ?
      ORDER BY fs.is_primary DESC, s.title
    `).bind(id),
  ]);

  const row = facility.results?.[0];
  if (!row) return json({error: "not found"}, 404, request, env);

  row.categories = categories.results || [];
  row.sources = sources.results || [];
  return json(row, 200, request, env, 600);
}

async function stats(request, env, url) {
  const municipality = (url.searchParams.get("municipality_code") || "").trim().slice(0, 12);
  const type = (url.searchParams.get("type") || "").trim().slice(0, 40);
  const where = [];
  const params = [];
  if (municipality) {
    where.push("municipality_code = ?");
    params.push(municipality);
  }
  if (type) {
    where.push("facility_type = ?");
    params.push(type);
  }

  const sql = `
    SELECT COUNT(*) AS count
    FROM facilities
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
  `;
  const row = await env.DB.prepare(sql).bind(...params).first();
  return json({count: Number(row?.count || 0)}, 200, request, env, 3600);
}

async function health(request, env) {
  const row = await env.DB.prepare("SELECT 1 AS ok").first();
  return json({ok: row?.ok === 1, service: "benri-facility-api"}, 200, request, env, 60);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders(request, env)});
    }
    if (request.method !== "GET") {
      return json({error: "method not allowed"}, 405, request, env);
    }

    const url = new URL(request.url);
    const cache = caches.default;
    const canCache = !request.headers.get("authorization");

    if (canCache) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }

    let response;
    try {
      if (url.pathname === "/api/health") {
        response = await health(request, env);
      } else if (url.pathname === "/api/stats") {
        response = await stats(request, env, url);
      } else if (url.pathname === "/api/facilities") {
        response = await listFacilities(request, env, url);
      } else if (url.pathname.startsWith("/api/facilities/")) {
        response = await facilityDetail(request, env, decodeURIComponent(url.pathname.slice("/api/facilities/".length)));
      } else {
        response = json({error: "not found"}, 404, request, env);
      }
    } catch (error) {
      console.error(error);
      response = json({error: "database query failed"}, 500, request, env);
    }

    if (canCache && response.ok && response.headers.get("cache-control")) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  },
};
