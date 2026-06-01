import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { RideTypeImage } from "@/components/rider/RideTypeImage";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/Input";
import { todayLocal } from "@/lib/documentExpiry";
import { RIDE_META } from "@/lib/rideMeta";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { edgeAbrLookup } from "@/lib/complianceEdgeCalls";
import { loadVehicleDraft, saveOnboardingStep, saveVehicleDraft } from "@/lib/driverOnboardingProgress";
import type { VehicleDraft } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

const COLORS = ["Black", "White", "Silver", "Grey", "Blue", "Red", "Green", "Other"] as const;
const CATEGORIES: VehicleDraft["category"][] = ["sedan", "suv", "van", "luxury"];
const RIDE_TYPES: VehicleDraft["ride_type"][] = ["economy", "comfort", "premium", "xl"];

export default function OnboardingStep3Vehicle() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeStr = Array.isArray(mode) ? mode[0] : mode;
  const isAdd = modeStr === "add";
  const { user, session } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("Black");
  const [colorOther, setColorOther] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [plate, setPlate] = useState("");
  const [category, setCategory] = useState<VehicleDraft["category"]>("sedan");
  const [rideType, setRideType] = useState<VehicleDraft["ride_type"]>("economy");
  const [seats, setSeats] = useState("4");
  const [regExpiry, setRegExpiry] = useState("");
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [abnInput, setAbnInput] = useState("");
  const [abnVerified, setAbnVerified] = useState(false);
  const [abnEntityName, setAbnEntityName] = useState("");
  const [abnGst, setAbnGst] = useState(false);
  const [abnBusy, setAbnBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const draft = await loadVehicleDraft();
    if (draft.make) setMake(draft.make);
    if (draft.model) setModel(draft.model);
    if (draft.color) setColor(draft.color);
    if (draft.year) setYear(String(draft.year));
    if (draft.plate_number) setPlate(draft.plate_number);
    if (draft.category) setCategory(draft.category);
    if (draft.ride_type) setRideType(draft.ride_type);
    if (draft.seat_count) setSeats(String(draft.seat_count));
    if (draft.registration_expiry) setRegExpiry(draft.registration_expiry);

    if (!isAdd) {
      const { data: v } = await supabase
        .from("vehicles")
        .select("*")
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (v) {
        setExistingId(v.id);
        if (!draft.make && v.make && v.make !== "Pending") setMake(v.make);
        if (!draft.model && v.model && v.model !== "Setup") setModel(v.model);
        if (!draft.color && v.color && v.color !== "—") setColor(v.color);
        if (!draft.year && v.year) setYear(String(v.year));
        if (!draft.plate_number && v.plate_number && v.plate_number !== "PENDING") setPlate(v.plate_number);
        if (!draft.category && v.category) setCategory(v.category as VehicleDraft["category"]);
        if (!draft.ride_type && v.ride_type) setRideType(v.ride_type as VehicleDraft["ride_type"]);
        if (!draft.seat_count && v.seat_count) setSeats(String(v.seat_count));
        if (v.registration_expiry && !draft.registration_expiry) setRegExpiry(String(v.registration_expiry).slice(0, 10));
      }
    }
    const { data: drv } = await supabase
      .from("drivers")
      .select("abn, abn_verified_at, abn_entity_name, abn_gst_registered")
      .eq("id", user.id)
      .maybeSingle();
    if (drv?.abn) setAbnInput(String(drv.abn));
    setAbnVerified(Boolean(drv?.abn_verified_at));
    setAbnEntityName(typeof drv?.abn_entity_name === "string" ? drv.abn_entity_name : "");
    setAbnGst(Boolean(drv?.abn_gst_registered));
    setBoot(false);
  }, [user?.id, isAdd]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistDraft() {
    const y = Number.parseInt(year, 10);
    await saveVehicleDraft({
      make: make.trim(),
      model: model.trim(),
      color: color === "Other" ? colorOther.trim() || "Other" : color,
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      plate_number: plate.trim().toUpperCase(),
      category,
      ride_type: rideType,
      seat_count: Math.min(12, Math.max(1, Number.parseInt(seats, 10) || 4)),
      registration_expiry: regExpiry.trim(),
    });
  }

  async function onNext() {
    if (!user?.id) return;
    const y = Number.parseInt(year, 10);
    if (!make.trim() || !model.trim()) {
      Alert.alert("Vehicle", "Enter make and model.");
      return;
    }
    const plateU = plate.trim().toUpperCase();
    if (plateU.length < 2 || plateU === "PENDING") {
      Alert.alert("Plate", "Enter a valid registration plate.");
      return;
    }
    if (!Number.isFinite(y) || y < 1990 || y > new Date().getFullYear() + 1) {
      Alert.alert("Year", "Enter a realistic vehicle year.");
      return;
    }
    if (flags.driver_abn_validation && !abnVerified) {
      Alert.alert("ABN", "Validate and save your Australian Business Number before continuing.");
      return;
    }
    setLoading(true);
    try {
      await persistDraft();
      const resolvedColor = color === "Other" ? (colorOther.trim() || "Other") : color;
      const seatCount = Math.min(12, Math.max(1, Number.parseInt(seats, 10) || 4));
      const reg = regExpiry.trim().length >= 8 ? regExpiry.trim() : null;

      if (isAdd) {
        await supabase.from("vehicles").update({ is_active: false }).eq("driver_id", user.id);
        const { error: insErr } = await supabase.from("vehicles").insert({
          driver_id: user.id,
          make: make.trim(),
          model: model.trim(),
          color: resolvedColor,
          year: y,
          plate_number: plateU,
          category,
          ride_type: rideType,
          is_active: true,
          is_approved: false,
          seat_count: seatCount,
          registration_expiry: reg,
        });
        if (insErr) throw insErr;
        router.back();
        return;
      }

      if (existingId) {
        const { error: upErr } = await supabase
          .from("vehicles")
          .update({
            make: make.trim(),
            model: model.trim(),
            color: resolvedColor,
            year: y,
            plate_number: plateU,
            category,
            ride_type: rideType,
            seat_count: seatCount,
            registration_expiry: reg,
            is_approved: false,
          })
          .eq("id", existingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from("vehicles").insert({
          driver_id: user.id,
          make: make.trim(),
          model: model.trim(),
          color: resolvedColor,
          year: y,
          plate_number: plateU,
          category,
          ride_type: rideType,
          is_active: true,
          is_approved: false,
          seat_count: seatCount,
          registration_expiry: reg,
        });
        if (insErr) throw insErr;
      }

      await saveOnboardingStep(4);
      router.push("/(driver)/onboarding/step4-vehicle-docs" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  if (boot || !user?.id) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <OnboardingScreenShell
      title={isAdd ? "Add vehicle" : "Vehicle details"}
      subtitle="Accurate details speed up approval. Plate changes may require re-verification."
      step={3}
      primaryTitle={isAdd ? "Save vehicle" : "Continue"}
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={
        !make.trim() || !model.trim() || !plate.trim() || (flags.driver_abn_validation && !abnVerified)
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {flags.driver_abn_validation ? (
          <View className="mb-4 rounded-xl border border-border bg-surface2/40 p-4">
            <Text className="font-sora text-sm font-semibold text-text">Australian Business Number (ABN)</Text>
            <Text className="font-inter mt-1 text-xs leading-5 text-textSecondary">
              Required for enhanced compliance. We call the free ABR JSON API from our server (GUID secret).
            </Text>
            <Input
              label="ABN (11 digits)"
              value={abnInput}
              onChangeText={(t) => {
                setAbnVerified(false);
                setAbnInput(t.replace(/\D/g, "").slice(0, 11));
              }}
              keyboardType="number-pad"
            />
            {abnEntityName ? (
              <Text className="font-inter mt-2 text-xs text-textSecondary">
                Entity: {abnEntityName}
                {abnGst ? " · GST registered" : ""}
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                void (async () => {
                  if (!session?.access_token) {
                    Alert.alert("Session", "Sign in again to validate ABN.");
                    return;
                  }
                  setAbnBusy(true);
                  try {
                    const res = (await edgeAbrLookup(session.access_token, {
                      abn: abnInput,
                      persist: true,
                    })) as {
                      ok?: boolean;
                      error?: string;
                      abn_active?: boolean;
                      entity_name?: string | null;
                      entity_display?: string | null;
                    };
                    if (!res.ok) throw new Error(typeof res.error === "string" ? res.error : "ABN lookup failed");
                    if (!res.abn_active) throw new Error("ABN is not active in ABR.");
                    setAbnVerified(true);
                    const display = res.entity_display ?? res.entity_name;
                    if (display) setAbnEntityName(display);
                    Alert.alert("ABN saved", "Your ABN is verified and stored.");
                  } catch (e) {
                    Alert.alert("ABN", e instanceof Error ? e.message : "Could not validate ABN");
                  } finally {
                    setAbnBusy(false);
                  }
                })();
              }}
              disabled={abnBusy || abnInput.length !== 11}
              className="mt-3 items-center rounded-xl bg-primary/20 py-3 active:opacity-80"
            >
              <Text className="font-inter text-sm font-semibold text-primary">
                {abnBusy ? "Checking…" : abnVerified ? "Re-check ABN" : "Validate & save ABN"}
              </Text>
            </Pressable>
            {abnVerified ? (
              <Text className="font-inter mt-2 text-xs text-primary">ABN verified on file</Text>
            ) : null}
          </View>
        ) : null}
        <Input label="Make" value={make} onChangeText={setMake} autoCapitalize="words" />
        <Input label="Model" value={model} onChangeText={setModel} autoCapitalize="words" />
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">Colour</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {COLORS.map((c) => {
            const on = color === c;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                className={`rounded-full border px-3 py-2 ${on ? "border-primary bg-primary/15" : "border-border bg-surface2"}`}
              >
                <Text className="font-inter text-xs text-text">{c}</Text>
              </Pressable>
            );
          })}
        </View>
        {color === "Other" ? (
          <Input label="Describe colour" value={colorOther} onChangeText={setColorOther} />
        ) : null}
        <Input label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <Input
          label="Plate number"
          value={plate}
          onChangeText={(t) => setPlate(t.toUpperCase())}
          autoCapitalize="characters"
        />
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">Category</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              className={`rounded-xl border px-3 py-2 ${category === c ? "border-primary bg-primary/15" : "border-border"}`}
            >
              <Text className="font-inter text-xs capitalize text-text">{c}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">Ride type offered</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {RIDE_TYPES.map((c) => {
            const selected = rideType === c;
            return (
              <Pressable
                key={c}
                onPress={() => setRideType(c)}
                className={`min-w-[76px] items-center rounded-xl border px-2 py-2 ${
                  selected ? "border-primary bg-primary/15" : "border-border bg-surface2/40"
                }`}
              >
                <RideTypeImage type={c} size={48} />
                <Text
                  className={`font-inter mt-1 text-xs font-medium ${selected ? "text-primary" : "text-text"}`}
                >
                  {RIDE_META[c].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Input label="Seat count" value={seats} onChangeText={setSeats} keyboardType="number-pad" />
        <DatePickerField
          label="Registration expiry"
          value={regExpiry}
          onChange={setRegExpiry}
          minimumDate={todayLocal()}
          placeholder="Select expiry date"
          optional
        />
      </ScrollView>
    </OnboardingScreenShell>
  );
}
