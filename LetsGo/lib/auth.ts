import { supabase, UserRole } from "./supabase";

// ─── Sign Up ──────────────────────────────────────────────────

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: UserRole
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role,
      },
    },
  });
  if (error) throw error;
  return data;
}

// ─── Sign In ──────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ─── Sign Out ─────────────────────────────────────────────────

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Get current session ──────────────────────────────────────

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// ─── Get profile ──────────────────────────────────────────────

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Create rider record ──────────────────────────────────────

export async function createRiderRecord(userId: string) {
  const { error } = await supabase.from("riders").insert({ id: userId });
  if (error) throw error;
}

// ─── Create driver record ─────────────────────────────────────

export async function createDriverRecord(userId: string) {
  const { error } = await supabase.from("drivers").insert({
    id: userId,
    approval_status: "pending",
  });
  if (error) throw error;
}

// ─── Update profile role ──────────────────────────────────────

export async function updateProfileRole(userId: string, role: UserRole) {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

// ─── Reset password ───────────────────────────────────────────

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "letsgo://reset-password",
  });
  if (error) throw error;
}

// ─── Verify OTP ───────────────────────────────────────────────

export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  if (error) throw error;
  return data;
}

// ─── Update push token ────────────────────────────────────────

export async function updatePushToken(userId: string, token: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ expo_push_token: token })
    .eq("id", userId);
  if (error) throw error;
}
