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
    const FOOTBALL_API_KEY = '09fedeb5e296477dbb31b5072e3612b1'

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
    try {
      const target      = "https://api.football-data.org/v4" + url.pathname + url.search;
      const controller  = new AbortController();
      const timeout     = setTimeout(() => controller.abort(), 8000);

      const apiResponse = await fetch(target, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
        signal: controller.signal
      });

      clearTimeout(timeout);

      return new Response(apiResponse.body, {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch(err) {
      return new Response(JSON.stringify({ error: "Origin unreachable", detail: err.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};