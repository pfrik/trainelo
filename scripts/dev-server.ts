/**
 * Local development server for API routes.
 * 
 * This server wraps Vercel serverless functions for local testing.
 * Routes are auto-registered from scripts/dev/apiRoutes.ts
 * 
 * Usage: npm run dev:api
 */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { API_ROUTES, validateRoutes } from "./dev/apiRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Validate routes on startup
try {
  validateRoutes();
} catch (error) {
  console.error("❌ Route validation failed:", error);
  process.exit(1);
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", routes: API_ROUTES.length });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", routes: API_ROUTES.length });
});

// Auto-register all API routes from the registry
for (const route of API_ROUTES) {
  const { method, path, handler } = route;
  
  app[method](path, async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const module = await import(handler);
      await module.default(req, res);
    } catch (error) {
      console.error(`❌ API Error [${method.toUpperCase()} ${path}]:`, error);
      res.status(500).json({ 
        error: "Internal server error", 
        details: String(error),
        path: path,
      });
    }
  });
}

// Catch-all for unknown API routes
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ 
    error: "API route not found",
    method: req.method,
    path: req.path,
    hint: "Make sure the route is registered in scripts/dev/apiRoutes.ts",
  });
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           Trainelo API Dev Server                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  ✓ Running at http://localhost:${PORT}`);
  console.log(`  ✓ Health check: http://localhost:${PORT}/health`);
  console.log("");
  console.log("  Registered routes:");
  for (const route of API_ROUTES) {
    const desc = route.description ? ` - ${route.description}` : "";
    console.log(`    ${route.method.toUpperCase().padEnd(6)} ${route.path}${desc}`);
  }
  console.log("");
  console.log("  To add new routes, edit: scripts/dev/apiRoutes.ts");
  console.log("");
});
