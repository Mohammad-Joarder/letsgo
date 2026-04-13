import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RIDE_TYPES = ["economy", "comfort", "premium", "xl"] as const;

type NearbyDriverRow = { driver_id: string; distance_m: number; current_lat: number; current_lng: number };

function normalizeNearbyRpcRows(nearby: unknown): NearbyDriverRow[] {
  if (nearby == null) return [];
  if (Array.isArray(nearby)) return nearby as NearbyDriverRow[];
  if (typeof nearby === "object" && "driver_id" in (nearby as object)) {
    return [nearby as NearbyDriverRow];
  }
  return [];
}

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
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pickup_lat, pickup_lng, ride_type, radius_km } = body as Record<string, unknown>;
    const lat = Number(pickup_lat);
    const lng = Number(pickup_lng);
    const rt = typeof ride_type === "string" ? ride_type : "economy";
    const radiusKm = Number(radius_km) > 0 ? Number(radius_km) : 5;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid pickup coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RIDE_TYPES.includes(rt as (typeof RIDE_TYPES)[number])) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid ride_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const radiusM = radiusKm * 1000;

    const { data, error } = await supabase.rpc("nearby_drivers_for_ride", {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
      p_ride_type: rt,
    });

    if (error) throw error;

    const rows = normalizeNearbyRpcRows(data);

    const drivers = rows.map((r) => {
      const km = r.distance_m / 1000;
      const etaMin = Math.max(1, Math.round(km / 0.5));
      return {
        driver_id: r.driver_id,
        distance_m: Math.round(r.distance_m),
        eta_min: etaMin,
        current_lat: r.current_lat,
        current_lng: r.current_lng,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        drivers,
        message:
          drivers.length === 0
            ? "No drivers available nearby right now. Try again in a few minutes."
            : undefined,
      }),
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
