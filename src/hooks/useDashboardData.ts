import { useState, useEffect } from 'react';

/**
 * Minimal dashboard scaffold data.
 * Recovery stats, recommendations, and workout data are all driven
 * by the real API via useTodayRecommendation.
 *
 * This hook provides only the user identity and layout-level data
 * that doesn't come from the recommendation pipeline.
 */
export interface DashboardScaffold {
  user: {
    name: string;
    profilePicture?: string;
  };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardScaffold | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with real user profile fetch when profiles API exists.
    // For now, return minimal scaffold immediately.
    setData({
      user: {
        name: 'Athlete',
        profilePicture: undefined,
      },
    });
    setLoading(false);
  }, []);

  return { data, loading };
}
