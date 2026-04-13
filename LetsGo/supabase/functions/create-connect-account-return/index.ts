import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isAllowedAppContinueUrl } from "../_shared/stripeConnectAppUrl.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlPage(nextUrl: string): string {
  const nextJson = JSON.stringify(nextUrl);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Return to Lets Go</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 28rem; margin: auto;">
    <p>Returning to the Lets Go app…</p>
    <p style="margin-top:1rem;font-size:0.9rem;color:#555">If nothing happens, <a id="l" href="#">tap here</a>.</p>
    <script>
      (function () {
        var next = ${nextJson};
        var a = document.getElementById("l");
        if (a) a.href = next;
        function go() {
          try {
            window.location.replace(next);
          } catch (e1) {
            try {
              window.location.href = next;
            } catch (e2) {}
          }
        }
        go();
        setTimeout(go, 250);
        setTimeout(go, 1200);
      })();
    </script>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reqUrl = new URL(req.url);
  const rawContinue = reqUrl.searchParams.get("continue")?.trim() ?? "";
  const next =
    rawContinue && isAllowedAppContinueUrl(rawContinue) ? rawContinue : "letsgo://stripe-connect-return";

  return new Response(htmlPage(next), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});
