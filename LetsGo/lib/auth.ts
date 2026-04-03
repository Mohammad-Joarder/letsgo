import type { UserRole } from "./types";
import { supabase } from "./supabase";

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: { full_name: string; phone: string }
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: metadata.full_name,
        phone: metadata.phone,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function verifyEmailOtp(email: string, token: string) {
  const trimmed = token.replace(/\s/g, "");
  const tryTypes = ["signup", "email"] as const;
  let lastError: Error | null = null;
  for (const type of tryTypes) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: trimmed,
      type,
    });
    if (!error) return data;
    lastError = error;
  }
  if (lastError) throw lastError;
  return null;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "letsgo://reset-password",
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function createRiderProfile(params: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  const { error: profileError } = await supabase.from("profiles").insert({
    id: params.userId,
    role: "rider",
    full_name: params.fullName,
    email: params.email,
    phone: params.phone,
  });
  if (profileError) throw profileError;

  const { error: riderError } = await supabase.from("riders").insert({
    id: params.userId,
  });
  if (riderError) throw riderError;
}

export async function createDriverProfile(params: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  const { error: profileError } = await supabase.from("profiles").insert({
    id: params.userId,
    role: "driver",
    full_name: params.fullName,
    email: params.email,
    phone: params.phone,
  });
  if (profileError) throw profileError;

  const { error: driverError } = await supabase.from("drivers").insert({
    id: params.userId,
    approval_status: "pending",
    current_status: "offline",
    is_online: false,
  });
  if (driverError) throw driverError;
}

export async function completeRoleSelection(
  role: Exclude<UserRole, "admin">,
  meta: { userId: string; fullName: string; email: string; phone: string }
) {
  if (role === "rider") {
    await createRiderProfile({
      userId: meta.userId,
      fullName: meta.fullName,
      email: meta.email,
      phone: meta.phone,
    });
    return;
  }
  await createDriverProfile({
    userId: meta.userId,
    fullName: meta.fullName,
    email: meta.email,
    phone: meta.phone,
  });
}
