const FOOTBALL_CACHE_SECONDS = 7 * 24 * 60 * 60;

function getFootballCacheRequest(target) {
  return new Request(target, { method: "GET" });
}

async function cacheFootballResponse(target, apiResponse) {
  if (!apiResponse.ok) {
    return;
  }

  const cacheHeaders = new Headers(apiResponse.headers);
  cacheHeaders.set("Cache-Control", "public, max-age=" + FOOTBALL_CACHE_SECONDS);

  await caches.default.put(
    getFootballCacheRequest(target),
    new Response(apiResponse.clone().body, {
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      headers: cacheHeaders
    })
  );
}

async function getCachedFootballResponse(target, corsHeaders, errorDetail) {
  const cachedResponse = await caches.default.match(getFootballCacheRequest(target));

  if (!cachedResponse) {
    return null;
  }

  const headers = new Headers(cachedResponse.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  headers.set("X-Football-Data-Cache", "STALE");
  headers.set("X-Football-Data-Fallback", errorDetail.substring(0, 200));

  return new Response(cachedResponse.body, {
    status: 200,
    statusText: cachedResponse.statusText,
    headers
  });
}

function buildFootballUnavailableResponse(corsHeaders, detail, upstreamStatus) {
  return new Response(JSON.stringify({
    error: "Football data unavailable",
    detail,
    upstreamStatus
  }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwYgTGGTsBeB1mIAvg1asEbQ6NfCUJvPn8hx62wuPl-wE8LVFktyNxaZc0A3CAe0bxB/exec'
    const FOOTBALL_API_KEY = env.FOOTBALL_API_KEY || '09fedeb5e296477dbb31b5072e3612b1'

    // ✅ Handle duplicate check — GET /submit?email=...&check=1
    if (url.pathname === "/submit" && request.method === "GET") {
      try {
        const email    = url.searchParams.get("email");
        const gasUrl   = `${GAS_URL}?email=${encodeURIComponent(email)}&check=1`;
        const gasRes   = await fetch(gasUrl);
        const text     = await gasRes.text();
        return new Response(text, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch(err) {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ✅ Handle predictions submit — POST /submit
    if (url.pathname === "/submit" && request.method === "POST") {
      try {
        const body    = await request.json();
        const gasRes  = await fetch(GAS_URL, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body)
        });
        const text = await gasRes.text();
        return new Response(text, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch(err) {
        return new Response(JSON.stringify({ status: 'error', message: err.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ✅ Everything else — proxy to football-data.org
    const target      = "https://api.football-data.org/v4" + url.pathname + url.search;

    try {
      const controller  = new AbortController();
      const timeout     = setTimeout(() => controller.abort(), 30000);

      let apiResponse;
      try {
        apiResponse = await fetch(target, {
          headers: { "X-Auth-Token": FOOTBALL_API_KEY },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (request.method === "GET" && apiResponse.ok) {
        await cacheFootballResponse(target, apiResponse);
      }

      if (request.method === "GET" && apiResponse.status >= 500) {
        const fallback = await getCachedFootballResponse(
          target,
          corsHeaders,
          "football-data.org returned HTTP " + apiResponse.status
        );

        if (fallback) {
          return fallback;
        }

        return buildFootballUnavailableResponse(
          corsHeaders,
          "football-data.org returned HTTP " + apiResponse.status,
          apiResponse.status
        );
      }

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch(err) {
      if (request.method === "GET") {
        const fallback = await getCachedFootballResponse(target, corsHeaders, err.message);

        if (fallback) {
          return fallback;
        }
      }

      return buildFootballUnavailableResponse(corsHeaders, err.message);
    }
  }
};
