/**
 * Central API Route Registry
 * 
 * This file is the single source of truth for all API routes in local development.
 * When you add a new Vercel serverless function under /api/, register it here.
 * 
 * The dev-server.ts will auto-wire all routes from this registry.
 */

export interface ApiRoute {
  /** HTTP method (lowercase) */
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Route path (must start with /api/) */
  path: string;
  /** Import path relative to dev-server.ts (use .js extension) */
  handler: string;
  /** Optional description for logging */
  description?: string;
}

/**
 * ============================================
 * REGISTER NEW API ROUTES HERE
 * ============================================
 * 
 * Format:
 * { method: "post", path: "/api/your/route", handler: "../api/your/route.js" }
 */
export const API_ROUTES: ApiRoute[] = [
  // Recommendation endpoints
  {
    method: "post",
    path: "/api/recommendation/today",
    handler: "../api/recommendation/today.js",
    description: "Get today's workout recommendation candidates",
  },
  {
    method: "post",
    path: "/api/recommendation/choice",
    handler: "../api/recommendation/choice.js",
    description: "Submit user's chosen workout option",
  },

  // Check-in endpoints
  {
    method: "post",
    path: "/api/user-flags",
    handler: "../api/user-flags.js",
    description: "Submit morning check-in data",
  },
  {
    method: "post",
    path: "/api/checkin/calibrate",
    handler: "../api/checkin/calibrate.js",
    description: "Run session calibrator from check-in data",
  },

  // Garmin integration endpoints
  {
    method: "get",
    path: "/api/garmin/sync-status",
    handler: "../api/garmin/sync-status.js",
    description: "Get Garmin sync connection and data freshness status",
  },
  {
    method: "post",
    path: "/api/garmin/trigger",
    handler: "../api/garmin/trigger.js",
    description: "Trigger Garmin sync via GitHub Actions",
  },

  // Add new routes above this line
];

/**
 * Validate routes on import (catches typos early)
 */
export function validateRoutes(): void {
  const seen = new Set<string>();
  
  for (const route of API_ROUTES) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    
    // Check for duplicates
    if (seen.has(key)) {
      throw new Error(`Duplicate API route: ${key}`);
    }
    seen.add(key);
    
    // Check path format
    if (!route.path.startsWith("/api/")) {
      throw new Error(`API route must start with /api/: ${route.path}`);
    }
    
    // Check handler format
    if (!route.handler.endsWith(".js")) {
      throw new Error(`Handler must end with .js: ${route.handler}`);
    }
  }
}
