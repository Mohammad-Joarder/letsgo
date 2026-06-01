import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUnreadNotificationCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    const { count: c, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (!error) setCount(c ?? 0);
  }, [userId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return count;
}
