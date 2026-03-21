import { useState, useEffect } from "react";

/**
 * Get the user's city name via browser Geolocation + reverse geocoding.
 * Caches the result in localStorage to avoid repeated API calls.
 */
export function useLocation() {
  const [city, setCity] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem("trainelo_location");
      if (cached) {
        const { city, ts } = JSON.parse(cached);
        // Cache for 24 hours
        if (Date.now() - ts < 24 * 60 * 60 * 1000) return city;
      }
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => {
    if (city) return; // Already have a cached value

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
            { headers: { "Accept-Language": "en" } },
          );
          if (!resp.ok) return;
          const data = await resp.json();
          const name =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            null;
          if (name) {
            setCity(name);
            localStorage.setItem(
              "trainelo_location",
              JSON.stringify({ city: name, ts: Date.now() }),
            );
          }
        } catch { /* silent */ }
      },
      () => { /* permission denied — silent */ },
      { timeout: 5000, maximumAge: 24 * 60 * 60 * 1000 },
    );
  }, [city]);

  return city;
}
