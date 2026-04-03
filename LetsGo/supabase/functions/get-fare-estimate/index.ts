import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PolygonGeo = {
  type: "Polygon";
  coordinates: number[][][];
};

function pointInPolygon(lng: number, lat: number, poly: PolygonGeo): boolean {
  const ring = poly.coordinates?.[0];
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function parsePolygon(raw: unknown): PolygonGeo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "Polygon" && Array.isArray(o.coordinates)) {
    return o as PolygonGeo;
  }
  if (o.type === "Feature" && o.geometry && typeof o.geometry === "object") {
    const g = o.geometry as Record<string, unknown>;
    if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
      return g as unknown as PolygonGeo;
    }
  }
  return null;
}

function zoneActive(row: {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}): boolean {
  if (!row.is_active) return false;
  const now = new Date();
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) < now) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "GOOGLE_MAPS_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = body as Record<string, unknown>;
    const plat = Number(pickup_lat);
    const plng = Number(pickup_lng);
    const dlat = Number(dropoff_lat);
    const dlng = Number(dropoff_lng);
    if (![plat, plng, dlat, dlng].every((n) => Number.isFinite(n))) {
      return new Response(JSON.stringify({ ok: false, error: "Missing or invalid coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origins = `${plat},${plng}`;
    const destinations = `${dlat},${dlng}`;
    const dmUrl =
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}&mode=driving&units=metric&key=${apiKey}`;

    const dmRes = await fetch(dmUrl);
    const dmJson = await dmRes.json();

    if (dmJson.status !== "OK" || !dmJson.rows?.[0]?.elements?.[0]) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: dmJson.error_message || dmJson.status || "Distance Matrix failed",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const el = dmJson.rows[0].elements[0];
    if (el.status !== "OK") {
      return new Response(
        JSON.stringify({ ok: false, error: el.status || "No route between points" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distanceM = el.distance.value as number;
    const durationS = el.duration.value as number;
    const distanceKm = distanceM / 1000;
    const durationMin = Math.max(1, Math.round(durationS / 60));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: fareRows, error: fareErr } = await supabase
      .from("fare_config")
      .select("*")
      .eq("is_active", true);

    if (fareErr) throw fareErr;
    if (!fareRows?.length) {
      return new Response(JSON.stringify({ ok: false, error: "No active fare configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: surgeRows } = await supabase.from("surge_zones").select("*");

    let surgeMultiplier = 1;
    let surgeActive = false;
    const now = new Date();
    for (const z of surgeRows ?? []) {
      if (!zoneActive(z)) continue;
      const poly = parsePolygon(z.polygon);
      if (!poly) continue;
      if (pointInPolygon(plng, plat, poly)) {
        const m = Number(z.multiplier);
        if (Number.isFinite(m) && m > surgeMultiplier) {
          surgeMultiplier = Math.min(m, 3);
          surgeActive = true;
        }
      }
    }

    const options = fareRows.map((row) => {
      const base = Number(row.base_fare);
      const pk = Number(row.per_km_rate);
      const pm = Number(row.per_min_rate);
      const minFare = Number(row.minimum_fare);
      const feePct = Number(row.platform_fee_percent);

      const distanceFare = pk * distanceKm;
      const timeFare = pm * durationMin;
      const subtotal = base + distanceFare + timeFare;
      const preSurge = Math.max(subtotal, minFare);
      const fare = preSurge * surgeMultiplier;
      const platformFee = fare * feePct;

      return {
        ride_type: row.ride_type,
        base_fare: base,
        distance_fare: distanceFare,
        time_fare: timeFare,
        minimum_fare: minFare,
        subtotal_pre_minimum: subtotal,
        fare_pre_surge: preSurge,
        estimated_fare: Math.round(fare * 100) / 100,
        platform_fee_percent: feePct,
        platform_fee: Math.round(platformFee * 100) / 100,
        surge_multiplier: surgeMultiplier,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        distance_km: Math.round(distanceKm * 1000) / 1000,
        duration_min: durationMin,
        surge_active: surgeActive,
        surge_multiplier: surgeMultiplier,
        options,
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
