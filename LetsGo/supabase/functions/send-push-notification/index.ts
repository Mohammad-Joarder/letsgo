import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendExpoPushMessages } from "../_shared/expo_push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const targetUserId = String(body?.user_id ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const pushBody = String(body?.body ?? "").trim();
    const data = (body?.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
    const notifType = String(body?.type ?? "system").trim() || "system";

    if (!targetUserId || !title || !pushBody) {
      return new Response(JSON.stringify({ ok: false, error: "user_id, title, body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: actor } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = actor?.role as string | undefined;
    const isAdmin = role === "admin";
    if (!isAdmin && user.id !== targetUserId) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: target } = await admin
      .from("profiles")
      .select("expo_push_token")
      .eq("id", targetUserId)
      .maybeSingle();

    const token = target?.expo_push_token as string | null | undefined;
    if (!token) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushRes = await sendExpoPushMessages([
      {
        to: token,
        title,
        body: pushBody,
        data,
        sound: "default",
        badge: 1,
      },
    ]);

    const { error: logErr } = await admin.from("notifications").insert({
      user_id: targetUserId,
      title,
      body: pushBody,
      type: notifType,
      data,
      is_read: false,
    });
    if (logErr) console.error("notifications insert", logErr);

    return new Response(
      JSON.stringify({ ok: true, expo_ok: pushRes.ok }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
