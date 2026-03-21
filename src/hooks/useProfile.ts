import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
  name: string | null;
  experience_level: string | null;
  weekly_hours_available: number | null;
  injury_notes: string | null;
  location: string | null;
}

/**
 * Fetch and manage the current user's profile from the profiles table.
 * Falls back to sensible defaults when no profile exists.
 */
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("name, experience_level, weekly_hours_available, injury_notes")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    }

    // Merge DB profile with any metadata from auth
    const row = data as Record<string, unknown> | null;
    setProfile({
      name: (row?.name as string) ?? user.user_metadata?.name ?? null,
      experience_level: (row?.experience_level as string) ?? null,
      weekly_hours_available: (row?.weekly_hours_available as number) ?? null,
      injury_notes: (row?.injury_notes as string) ?? null,
      location: (row as any)?.location ?? null,
    });
    setLoading(false);
  }, [user]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user) return false;

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...updates,
        });

      if (error) {
        console.error("Error updating profile:", error);
        return false;
      }

      // Refresh after update
      await fetchProfile();
      return true;
    },
    [user, fetchProfile],
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    updateProfile,
    refetch: fetchProfile,
    displayName: profile?.name || "Athlete",
  };
}
