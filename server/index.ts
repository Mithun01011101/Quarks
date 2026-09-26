import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";

// Without these the app silently falls back to local-dev behaviour, which is
// harmful on Render: no DATABASE_URL -> data goes to quarks.json, which Render
// wipes on every restart/deploy/spin-down; no APP_PASSWORD -> no login gate,
// so anyone with the URL can read and change everything. Refuse to start.
if (process.env.NODE_ENV === "production") {
  for (const name of ["DATABASE_URL", "APP_PASSWORD"]) {
    if (!process.env[name]) {
      throw new Error(`${name} is not set — refusing to start in production (set it in Render → Environment).`);
    }
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
setupAuth(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Cloud hosts assign the port via the PORT env var; default to 5000 locally.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    // reusePort is not supported on Windows
    ...(process.platform !== "win32" ? { reusePort: true } : {}),
  }, () => {
    log(`serving on port ${port}`);
  });
})();
