import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { DriverApprovalStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const NAV_PREF_KEY = "letsgo_driver_nav_app";

type Vehicle = {
  make: string;
  model: string;
  color: string;
  plate_number: string;
  ride_type: string;
  is_approved: boolean;
};

type DocRow = { document_type: string; is_verified: boolean };

function approvalTone(s: DriverApprovalStatus): "success" | "warning" | "muted" {
  if (s === "approved") return "success";
  if (s === "rejected" || s === "suspended") return "warning";
  return "muted";
}

export default function DriverAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [approval, setApproval] = useState<DriverApprovalStatus>("pending");
  const [rating, setRating] = useState<number | null>(null);
  const [totalTrips, setTotalTrips] = useState(0);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [bsb, setBsb] = useState<string | null>(null);
  const [acct, setAcct] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ rating: number; comment: string | null }[]>([]);
  const [navPref, setNavPref] = useState<"google" | "waze" | "apple">("google");

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data: d } = await supabase
      .from("drivers")
      .select("approval_status, rating, total_trips, bank_bsb, bank_account_number")
      .eq("id", user.id)
      .maybeSingle();
    if (d) {
      setApproval((d.approval_status as DriverApprovalStatus) ?? "pending");
      setRating(d.rating != null ? Number(d.rating) : null);
      setTotalTrips(Number(d.total_trips ?? 0));
      setBsb(d.bank_bsb ?? null);
      setAcct(d.bank_account_number ?? null);
    }
    const { data: v } = await supabase
      .from("vehicles")
      .select("make, model, color, plate_number, ride_type, is_approved")
      .eq("driver_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    setVehicle(v as Vehicle | null);

    const { data: docRows } = await supabase
      .from("driver_documents")
      .select("document_type, is_verified")
      .eq("driver_id", user.id);
    setDocs((docRows ?? []) as DocRow[]);

    const { data: ratRows } = await supabase
      .from("ratings")
      .select("rating, comment")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setReviews((ratRows ?? []) as { rating: number; comment: string | null }[]);

    const pref = await AsyncStorage.getItem(NAV_PREF_KEY);
    if (pref === "waze" || pref === "apple") setNavPref(pref);
    else setNavPref("google");
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)");
    } finally {
      setSigningOut(false);
    }
  }

  async function setNavPreference(p: "google" | "waze" | "apple") {
    setNavPref(p);
    await AsyncStorage.setItem(NAV_PREF_KEY, p);
  }

  const maskedAcct = acct && acct.length > 4 ? `••••${acct.slice(-4)}` : acct ?? "—";
  const maskedBsb = bsb ? `${bsb.slice(0, 3)}-•••` : "—";

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-sora-display text-2xl font-bold text-text">Account</Text>

        <Card className="mt-8 flex-row items-center gap-4">
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={56} />
          <View className="flex-1">
            <Text className="font-sora text-lg font-semibold text-text">
              {profile?.full_name ?? "Driver"}
            </Text>
            <Text className="font-inter text-sm text-textSecondary">{profile?.email}</Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              <Badge label={approval.replace(/_/g, " ")} tone={approvalTone(approval)} />
              <Text className="font-inter text-xs text-textSecondary">
                {rating != null ? `${rating.toFixed(1)} ★` : ""} · {totalTrips} trips
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Vehicle</SectionTitle>
        <Card>
          {vehicle ? (
            <>
              <Text className="font-sora text-base font-semibold text-text">
                {vehicle.make} {vehicle.model}
              </Text>
              <Text className="font-inter mt-1 text-sm text-textSecondary">
                {vehicle.color} · {vehicle.plate_number} · {vehicle.ride_type}
              </Text>
              <Text className="font-inter mt-2 text-xs text-textSecondary">
                Approved: {vehicle.is_approved ? "Yes" : "Pending"}
              </Text>
            </>
          ) : (
            <Text className="font-inter text-sm text-textSecondary">No active vehicle on file.</Text>
          )}
        </Card>

        <SectionTitle>Documents</SectionTitle>
        <Card className="p-0">
          {docs.length === 0 ? (
            <Text className="font-inter p-4 text-sm text-textSecondary">No uploads yet.</Text>
          ) : (
            docs.map((d) => (
              <View key={d.document_type} className="border-b border-border/60 px-4 py-3">
                <Text className="font-inter text-sm text-text">{d.document_type.replace(/_/g, " ")}</Text>
                <Text className="font-inter text-xs text-textSecondary">
                  {d.is_verified ? "Verified" : "Pending verification"}
                </Text>
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Bank</SectionTitle>
        <Card>
          <Text className="font-inter text-sm text-textSecondary">BSB: {maskedBsb}</Text>
          <Text className="font-inter mt-1 text-sm text-textSecondary">Account: {maskedAcct}</Text>
        </Card>

        <SectionTitle>Ratings & reviews</SectionTitle>
        <Card className="p-0">
          {reviews.length === 0 ? (
            <Text className="font-inter p-4 text-sm text-textSecondary">No reviews yet.</Text>
          ) : (
            reviews.map((r, i) => (
              <View key={i} className="border-b border-border/60 px-4 py-3">
                <Text className="font-inter text-sm text-text">{r.rating.toFixed(1)} ★</Text>
                {r.comment ? (
                  <Text className="font-inter mt-1 text-xs text-textSecondary">{r.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Settings</SectionTitle>
        <Card className="p-0">
          <Pressable
            className="flex-row items-center border-b border-border/60 px-4 py-4 active:bg-surface2/50"
            onPress={() => Alert.alert("Notifications", "Preference toggles ship in a later phase.")}
          >
            <Ionicons name="notifications-outline" size={20} color="#00D4AA" />
            <Text className="font-inter ml-3 flex-1 text-sm text-text">Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#5C6678" />
          </Pressable>
          <View className="px-4 py-3">
            <Text className="font-inter text-sm font-semibold text-text">Navigation app</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(
                [
                  ["google", "Google Maps"],
                  ["waze", "Waze"],
                  ["apple", "Apple Maps"],
                ] as const
              ).map(([k, label]) => (
                <Pressable
                  key={k}
                  onPress={() => void setNavPreference(k)}
                  className={`rounded-xl border px-3 py-2 ${navPref === k ? "border-primary bg-primary/15" : "border-border"}`}
                >
                  <Text className="font-inter text-xs text-text">{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => {
                const url =
                  navPref === "waze"
                    ? "https://waze.com"
                    : navPref === "apple"
                      ? "http://maps.apple.com"
                      : "https://maps.google.com";
                void Linking.openURL(url);
              }}
              className="mt-3"
            >
              <Text className="font-inter text-xs text-primary">Test open {navPref} maps</Text>
            </Pressable>
          </View>
        </Card>

        <View className="mt-10">
          <Button title="Sign out" variant="ghost" loading={signingOut} onPress={() => void onSignOut()} />
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="font-inter mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-textSecondary">
      {children}
    </Text>
  );
}
