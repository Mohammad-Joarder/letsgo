import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr || !prof || prof.role !== "rider") {
      return new Response(JSON.stringify({ ok: false, error: "Rider profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rider } = await admin.from("riders").select("is_verified_id").eq("id", user.id).maybeSingle();
    if (rider?.is_verified_id === true) {
      return new Response(JSON.stringify({ ok: true, already_verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as { note?: string };
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

    const { error: tErr } = await admin.from("support_tickets").insert({
      user_id: user.id,
      category: "Account",
      subject: "Rider ID verification requested",
      description: [
        `Rider ${prof.full_name ?? user.id} requested government ID verification.`,
        note ? `Rider note: ${note}` : "No additional note.",
        "Action: collect ID via secure channel or admin tools, then set riders.is_verified_id when approved.",
      ].join("\n\n"),
      status: "open",
    });
    if (tErr) throw tErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
