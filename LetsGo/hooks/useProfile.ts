import { useState, useEffect } from "react";
import { supabase, Rider, Driver } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export function useProfile() {
  const { profile } = useAuth();
  const [riderData, setRiderData] = useState<Rider | null>(null);
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const fetchRoleData = async () => {
      setIsLoading(true);
      try {
        if (profile.role === "rider") {
          const { data } = await supabase
            .from("riders")
            .select("*")
            .eq("id", profile.id)
            .single();
          setRiderData(data);
        } else if (profile.role === "driver") {
          const { data } = await supabase
            .from("drivers")
            .select("*")
            .eq("id", profile.id)
            .single();
          setDriverData(data);
        }
      } catch (error) {
        console.error("Error fetching role data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoleData();
  }, [profile]);

  return { profile, riderData, driverData, isLoading };
}
