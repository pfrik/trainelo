import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DayStatus, DayStatusType } from "@/types/dayStatus";
import { toast } from "sonner";

export function useDayStatuses() {
  const { user } = useAuth();
  const [dayStatuses, setDayStatuses] = useState<DayStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    if (!user) {
      setDayStatuses([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("day_status")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching day statuses:", error);
      toast.error("Failed to load day statuses");
    } else {
      const mapped: DayStatus[] = (data || []).map((s) => ({
        date: s.date,
        status: s.status as DayStatusType,
        notes: s.notes || undefined,
      }));
      setDayStatuses(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const saveStatus = async (status: DayStatus) => {
    if (!user) return;

    // If status is "normal", just delete the record
    if (status.status === "normal") {
      await clearStatus(status.date);
      return;
    }

    // Upsert the status
    const { error } = await supabase
      .from("day_status")
      .upsert(
        {
          user_id: user.id,
          date: status.date,
          status: status.status,
          notes: status.notes || null,
        },
        { onConflict: "user_id,date" }
      );

    if (error) {
      console.error("Error saving day status:", error);
      toast.error("Failed to save day status");
    } else {
      await fetchStatuses();
    }
  };

  const clearStatus = async (date: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("day_status")
      .delete()
      .eq("date", date)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing day status:", error);
      toast.error("Failed to clear day status");
    } else {
      await fetchStatuses();
    }
  };

  return { dayStatuses, loading, saveStatus, clearStatus, refetch: fetchStatuses };
}
